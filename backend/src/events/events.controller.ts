import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';
import { DuplicateEventDto } from './dto/duplicate-event.dto';
import { EventStatsResponseDto } from './dto/event-stats-response.dto';
import { AddEventImageDto } from './dto/add-event-image.dto';
import { UpdateImageOrderDto } from './dto/update-image-order.dto';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { TicketsService } from '../tickets/tickets.service';
import { StorageService } from '../common/storage/storage.service';
import { Event } from './entities/event.entity';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiResponse({ status: 429, description: 'Too Many Requests' })
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({ status: 201, description: 'Event created', type: Event })
  create(@Body() dto: CreateEventDto, @Req() req: AuthenticatedRequest) {
    return this.eventsService.createEvent(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all events' })
  list(@Query() filterDto: ListEventsDto) {
    return this.eventsService.listEvents(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getEventById(id);
  }

  @Put(':id')
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'Update an event' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.updateEvent(id, dto, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.ORGANIZER)
  @ApiOperation({ summary: 'Patch an event' })
  patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.updateEvent(id, dto, req.user.id);
  }

  // ── Image upload ────────────────────────────────────────────────────────

  @Post(':id/image')
  @Roles(Role.ORGANIZER)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload event image (JPEG/PNG, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Event image file (JPEG/PNG, max 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    const { url } = await this.storageService.upload(file, `events/${id}`);
    return this.eventsService.updateEventImage(id, url, req.user.id);
  }

  @Post(':id/emergency')
  @Roles(Role.ORGANIZER)
  triggerEmergency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      protocol?: string;
      message?: string;
      emergencyServicesContact?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.trigger_emergency_protocol(id, req.user.id, body);
  }

  @Get(':id/evacuation')
  @Roles(Role.ORGANIZER)
  trackEvacuation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.track_evacuation_status(id, req.user.id);
  }

  @Post(':id/weather/monitor')
  @Roles(Role.ORGANIZER)
  monitorWeather(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.monitor_weather_conditions(id, req.user.id);
  }

  @Post(':id/reschedule')
  @Roles(Role.ORGANIZER)
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { startDate: string; endDate: string; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.reschedule_event(id, req.user.id, body);
  }

  @Delete(':id')
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.deleteEvent(id, req.user.id);
  }

  @Post(':id/publish')
  @Roles(Role.ORGANIZER)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.publishEvent(id, req.user.id);
  }

  @Post(':id/complete')
  @Roles(Role.ORGANIZER)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.completeEvent(id, req.user.id);
  }

  @Post(':id/cancel')
  @Roles(Role.ORGANIZER)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.cancelEvent(id, req.user.id);
  }

  @Get(':id/stats')
  @Roles(Role.ORGANIZER)
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.getEventStats(id, req.user.id);
  }

  @Get(':eventId/tickets')
  @Roles(Role.ORGANIZER)
  async getEventTickets(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: AuthenticatedRequest,
    @Query() paginationDto: any,
  ) {
    return this.ticketsService.findByEvent(eventId, req.user.id, paginationDto);
  }

  @Get(':eventId/tickets/summary')
  @Roles(Role.ORGANIZER)
  async getTicketSummary(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.getEventTicketSummary(eventId, req.user.id);
  }

  @Post(':id/duplicate')
  @Roles(Role.ORGANIZER)
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateEventDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.duplicateEvent(id, dto, req.user.id);
  }

  @Post(':id/images')
  @Roles(Role.ORGANIZER)
  addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEventImageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.addEventImage(id, req.user.id, dto);
  }

  @Patch(':id/images/order')
  @Roles(Role.ORGANIZER)
  updateImageOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImageOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.updateImageOrder(id, req.user.id, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles(Role.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.eventsService.deleteEventImage(id, imageId, req.user.id);
  }
}
