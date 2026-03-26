import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { PaginationDto } from '../common/pagination/dto/pagination.dto';
import { paginate } from '../common/pagination/pagination.helper';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import { UserRole } from 'src/users/enums/user-role.enum';
import { Response } from 'express';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs', description: 'Admin-only. Returns paginated list of system audit logs.' })
  @ApiResponse({ status: 200, description: 'List of logs' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAuditLogs(@Query() paginationDto: PaginationDto) {
    const queryBuilder =
      this.auditService.auditLogRepository.createQueryBuilder('audit');
    return await paginate(queryBuilder, paginationDto, 'audit');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID', description: 'Admin-only. Retrieves details for a specific log entry.' })
  @ApiResponse({ status: 200, description: 'Log found', type: AuditLog })
  @ApiResponse({ status: 404, description: 'Log not found' })
  async getAuditLogById(@Param('id') id: string): Promise<AuditLog> {
    const log = await this.auditService.auditLogRepository.findOneBy({ id });
    if (!log) {
      throw new NotFoundException('Audit log not found');
    }
    return log;
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs', description: 'Admin-only. Downloads audit logs as a CSV file.' })
  @ApiResponse({ status: 200, description: 'CSV file' })
  async exportAuditLogs(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response,
  ) {
    const queryBuilder =
      this.auditService.auditLogRepository.createQueryBuilder('audit');
    const paginated = await paginate(queryBuilder, paginationDto, 'audit');
    const logs = paginated.data;

    const header = [
      'id',
      'action',
      'userId',
      'resourceId',
      'metadata',
      'createdAt',
    ];
    const csvRows = [header.join(',')];
    for (const log of logs) {
      csvRows.push(
        [
          log.id,
          log.action,
          log.userId,
          log.resourceId ?? '',
          JSON.stringify(log.metadata ?? {}),
          log.createdAt.toISOString(),
        ]
          .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
          .join(','),
      );
    }
    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="audit_logs.csv"',
    );
    res.send(csv);
  }
}
