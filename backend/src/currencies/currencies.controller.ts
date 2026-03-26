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
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post()
  @ApiOperation({ summary: 'Create currency', description: 'Adds a new supported currency for the marketplace.' })
  @ApiResponse({ status: 201, description: 'Currency created' })
  create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Get()
  @ApiOperation({ summary: 'List currencies', description: 'Public. Returns all supported currencies.' })
  @ApiResponse({ status: 200, description: 'List of currencies' })
  findAll() {
    return this.currenciesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get currency', description: 'Returns details for a single currency.' })
  @ApiResponse({ status: 200, description: 'Currency found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update currency', description: 'Updates existing currency configuration.' })
  @ApiResponse({ status: 200, description: 'Currency updated' })
  update(
    @Param('id') id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.update(id, updateCurrencyDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove currency', description: 'Deletes a currency from the platform.' })
  @ApiResponse({ status: 200, description: 'Currency removed' })
  remove(@Param('id') id: string) {
    return this.currenciesService.remove(id);
  }
}
