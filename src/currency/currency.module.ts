// src/currency/currency.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  imports: [HttpModule],
  controllers: [CurrencyController],
  providers: [CurrencyService],
})
export class CurrencyModule {}