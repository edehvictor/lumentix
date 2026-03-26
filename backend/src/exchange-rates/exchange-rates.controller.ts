import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create exchange rate', description: 'Adds or updates a conversion rate between currencies.' })
  @ApiResponse({ status: 201, description: 'Rate created' })
  create(@Body() createExchangeRateDto: CreateExchangeRateDto) {
    return this.exchangeRatesService.create(createExchangeRateDto);
  }

  @Get()
  @ApiOperation({ summary: 'List exchange rates', description: 'Public. Returns all configured exchange rates.' })
  @ApiResponse({ status: 200, description: 'List of rates' })
  findAll() {
    return this.exchangeRatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exchange rate', description: 'Returns details for a single exchange rate entry.' })
  @ApiResponse({ status: 200, description: 'Rate found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.exchangeRatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update exchange rate', description: 'Updates an existing conversion rate.' })
  @ApiResponse({ status: 200, description: 'Rate updated' })
  update(
    @Param('id') id: string,
    @Body() updateExchangeRateDto: UpdateExchangeRateDto,
  ) {
    return this.exchangeRatesService.update(id, updateExchangeRateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove exchange rate', description: 'Deletes a conversion rate entry.' })
  @ApiResponse({ status: 200, description: 'Rate removed' })
  remove(@Param('id') id: string) {
    return this.exchangeRatesService.remove(id);
  }
}
