import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { StellarService } from './stellar.service';
import { UsersService } from '../users/users.service';

@ApiTags('Stellar')
@Controller('stellar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StellarController {
  constructor(
    private readonly stellarService: StellarService,
    private readonly usersService: UsersService,
  ) {}

  @Get('account/:publicKey')
  @ApiOperation({ summary: 'Get Stellar account info and balances' })
  @ApiResponse({
    status: 200,
    description: 'Stellar account information returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid public key or Horizon error',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Stellar account not found' })
  async getAccount(@Param('publicKey') publicKey: string) {
    if (!/^G[A-Z2-7]{55}$/.test(publicKey)) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    try {
      const account = await this.stellarService.getAccount(publicKey);
      return {
        publicKey: account.id,
        sequence: account.sequence,
        balances: account.balances,
        lastModifiedLedger: account.last_modified_ledger,
      };
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) {
        throw new NotFoundException('Stellar account not found');
      }

      throw new BadRequestException('Could not fetch account from Horizon');
    }
  }

  @Post('create-testnet-account')
  @UseGuards(RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({
    summary: 'Create and fund a new Stellar testnet account',
    description:
      'Testnet only. Creates a new Stellar keypair and funds it via Friendbot. ' +
      'The secret key is returned ONCE — the caller must save it immediately. ' +
      'The public key is linked to the calling user profile.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created and funded. Save the secret — it is never stored.',
  })
  @ApiResponse({ status: 400, description: 'Not available on mainnet' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createTestnetAccount(@Req() req: AuthenticatedRequest) {
    const account = await this.stellarService.createTestnetAccount();
    await this.usersService.updateWallet(req.user.id, account.publicKey);
    return account;
  }
}
