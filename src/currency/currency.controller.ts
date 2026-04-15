// src/currency/currency.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Controller('currency')
export class CurrencyController {
  constructor(private service: CurrencyService) {}

  @Get('currencies')
  getCurrencies() {
    return this.service.getCurrencies();
  }

  @Get('latest')
  getLatest(@Query('base') base: string) {
    return this.service.getLatest(base);
  }

  @Get('historical')
  getHistorical(
    @Query('base') base: string,
    @Query('date') date: string,
  ) {
    return this.service.getHistorical(base, date);
  }
}