import { Controller, Param, Post, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RefundService } from './refund.service';
import { RefundResultDto } from './dto/refund-result.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/pagination/dto/pagination.dto';
import { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post('event/:eventId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Refund all event tickets', description: 'Admin-only. Triggers refunds for all confirmed payments on a cancelled event.' })
  @ApiResponse({ status: 201, description: 'Refunds initiated', type: [RefundResultDto] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async refundEvent(
    @Param('eventId') eventId: string,
  ): Promise<RefundResultDto[]> {
    return this.refundService.refundEvent(eventId);
  }

  @Get('event/:eventId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get refund history for an event', description: 'Admin-only. Returns paginated refunded payments for an event.' })
  @ApiResponse({ status: 200, description: 'Refund history' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRefundHistory(
    @Param('eventId') eventId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.refundService.getRefundHistoryForEvent(eventId, paginationDto);
  }

  @Get(':paymentId/eligibility')
  @ApiOperation({ summary: 'Check refund eligibility', description: 'Returns eligibility and computed refund amount for a payment.' })
  @ApiResponse({ status: 200, description: 'Eligibility result' })
  async checkEligibility(@Param('paymentId') paymentId: string) {
    return this.refundService.checkRefundEligibility(paymentId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my refund history', description: 'Returns paginated refunds for the authenticated user.' })
  @ApiResponse({ status: 200, description: 'User refund history' })
  async getMyRefunds(
    @Req() req: AuthenticatedRequest,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.refundService.getMyRefunds(req.user.id, paginationDto);
  }
}
