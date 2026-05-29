import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import { PaymentsService } from '../payments/payments.service';
import { SponsorsService } from '../sponsors/sponsors.service';
import { ContributionsService } from '../sponsors/contributions.service';

/**
 * Shared queue type for unmatched payment events.
 */
export interface DlqItem {
  id: string;
  transactionHash: string;
  type: string;
  payload: Record<string, unknown>;
  retryCount: number;
  enqueuedAt: string;
  lastError: string | null;
}

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_DLQ_RETRIES = 5;
const DLQ_RETRY_DELAY_MS = 30_000;

@Injectable()
export class StellarWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StellarWebhookService.name);

  private streamCloser: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private destroyed = false;

  /**
   * In-memory dead-letter queue.
   * In production, replace with Bull/Redis.
   */
  private readonly deadLetterQueue: DlqItem[] = [];
  private dlqProcessingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly stellarService: StellarService,
    private readonly paymentsService: PaymentsService,
    private readonly sponsorsService: SponsorsService,
    private readonly contributionsService: ContributionsService,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.logger.log('Starting Stellar payment stream listener');
    this.connect();
    this.startDlqProcessor();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.closeStream();
    this.stopDlqProcessor();
    this.logger.log('Stellar payment stream shut down');
  }

  // ─── Dead-letter queue ─────────────────────────────────────────────────────

  /** Return a snapshot of the current DLQ items (for admin endpoint). */
  getDlqItems(): DlqItem[] {
    return [...this.deadLetterQueue];
  }

  private enqueueDlq(
    payment: Horizon.ServerApi.PaymentOperationRecord,
    error: string,
  ): void {
    const item: DlqItem = {
      id: payment.id,
      transactionHash: payment.transaction_hash,
      type: payment.type,
      payload: payment as unknown as Record<string, unknown>,
      retryCount: 0,
      enqueuedAt: new Date().toISOString(),
      lastError: error,
    };
    this.deadLetterQueue.push(item);
    this.logger.warn(
      `Enqueued unmatched event in DLQ: tx=${payment.transaction_hash}, reason=${error}`,
    );
  }

  private startDlqProcessor(): void {
    this.dlqProcessingInterval = setInterval(() => {
      void this.processDlqRetries();
    }, DLQ_RETRY_DELAY_MS);
    this.logger.log(`DLQ processor started (interval=${DLQ_RETRY_DELAY_MS}ms)`);
  }

  private stopDlqProcessor(): void {
    if (this.dlqProcessingInterval) {
      clearInterval(this.dlqProcessingInterval);
      this.dlqProcessingInterval = null;
    }
  }

  private async processDlqRetries(): Promise<void> {
    if (this.deadLetterQueue.length === 0) return;

    const itemsToRetry = [...this.deadLetterQueue];
    this.deadLetterQueue.length = 0; // clear — success items stay out, failures go back in

    for (const item of itemsToRetry) {
      if (item.retryCount >= MAX_DLQ_RETRIES) {
        this.logger.error(
          `DLQ item permanently failed after ${MAX_DLQ_RETRIES} retries: tx=${item.transactionHash}`,
        );
        // Write a permanent failure audit record
        this.logger.warn(
          `[DLQ_PERMANENT_FAILURE] tx=${item.transactionHash} type=${item.type} retries=${item.retryCount}`,
        );
        continue;
      }

      try {
        // Re-construct a minimal payment-like object for handlePayment
        const payment = {
          id: item.id,
          type: item.type,
          transaction_hash: item.transactionHash,
          ...item.payload,
        } as unknown as Horizon.ServerApi.PaymentOperationRecord;

        // Try to match the event again
        const confirmed =
          (await this.tryConfirmPayment(payment.transaction_hash)) ||
          (await this.tryConfirmSponsor(payment.transaction_hash));

        if (confirmed) {
          this.logger.log(
            `DLQ item resolved on retry: tx=${item.transactionHash}`,
          );
        } else {
          // Still unmatched — re-enqueue with incremented retry count
          this.deadLetterQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: 'Still unmatched after retry',
          });
        }
      } catch (err: unknown) {
        const reason =
          err instanceof Error ? err.message : 'Unknown error during DLQ retry';
        this.deadLetterQueue.push({
          ...item,
          retryCount: item.retryCount + 1,
          lastError: reason,
        });
      }
    }
  }

  // ─── Connection management ────────────────────────────────────────────────

  private connect(): void {
    if (this.destroyed) return;

    this.logger.log('Opening Stellar payment stream...');

    try {
      this.streamCloser = this.stellarService.streamPayments(
        (payment) => void this.handlePayment(payment),
      );

      // Reset backoff on successful connection
      this.reconnectDelay = RECONNECT_DELAY_MS;
      this.logger.log('Stellar payment stream connected');
    } catch (err) {
      this.logger.error('Failed to open stream, scheduling reconnect', err);
      this.scheduleReconnect();
    }
  }

  private closeStream(): void {
    if (this.streamCloser) {
      this.streamCloser();
      this.streamCloser = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;

    this.clearReconnectTimer();

    this.logger.warn(
      `Reconnecting Stellar stream in ${this.reconnectDelay}ms...`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.closeStream();
      this.connect();

      // Exponential backoff capped at max delay
      this.reconnectDelay = Math.min(
        this.reconnectDelay * BACKOFF_MULTIPLIER,
        MAX_RECONNECT_DELAY_MS,
      );
    }, this.reconnectDelay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Payment handler ──────────────────────────────────────────────────────

  async handlePayment(
    payment: Horizon.ServerApi.PaymentOperationRecord,
  ): Promise<void> {
    this.logger.debug(
      `Received payment: type=${payment.type} id=${payment.id}`,
    );

    // We only handle payment and create_account operations
    if (payment.type !== 'payment' && payment.type !== 'create_account') {
      this.logger.debug(`Skipping non-payment operation type: ${payment.type}`);
      return;
    }

    const transactionHash = payment.transaction_hash;

    if (!transactionHash) {
      this.logger.warn('Payment record has no transaction_hash, skipping');
      return;
    }

    // Try payment confirmation first, then sponsor confirmation
    const confirmed =
      (await this.tryConfirmPayment(transactionHash)) ||
      (await this.tryConfirmSponsor(transactionHash));

    if (!confirmed) {
      this.logger.debug(
        `No pending payment or sponsor found for tx: ${transactionHash}`,
      );

      // Enqueue unmatched event to dead-letter queue instead of discarding
      this.enqueueDlq(payment, 'No matching payment or sponsor found');
    }
  }

  // ─── Payment confirmation ─────────────────────────────────────────────────

  private async tryConfirmPayment(transactionHash: string): Promise<boolean> {
    try {
      await this.paymentsService.confirmPayment(transactionHash, 'system');
      this.logger.log(
        `Payment confirmed via stream: txHash=${transactionHash}`,
      );
      return true;
    } catch (err: unknown) {
      if (isNotFound(err)) return false;
      if (isBadRequest(err) && isNotFoundMessage(err)) return false;

      this.logger.error(
        `Unexpected error confirming payment for tx ${transactionHash}`,
        err,
      );
      return false;
    }
  }

  // ─── Sponsor confirmation ─────────────────────────────────────────────────

  private async tryConfirmSponsor(transactionHash: string): Promise<boolean> {
    try {
      await this.contributionsService.confirmContribution(transactionHash);
      this.logger.log(
        `Sponsor contribution confirmed via stream: txHash=${transactionHash}`,
      );
      return true;
    } catch (err: unknown) {
      if (isNotFound(err)) return false;
      if (isBadRequest(err) && isNotFoundMessage(err)) return false;

      this.logger.error(
        `Unexpected error confirming sponsor contribution for tx ${transactionHash}`,
        err,
      );
      return false;
    }
  }
}

// ─── Error type helpers ───────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 404
  );
}

function isBadRequest(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 400
  );
}

function isNotFoundMessage(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string' &&
    (err as { message: string }).message.toLowerCase().includes('not found')
  );
}
