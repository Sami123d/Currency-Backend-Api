// src/currency/currency.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CurrencyService {
  private API_KEY: string;
  private BASE_URL = 'https://api.freecurrencyapi.com/v1';

  constructor(
    private configService: ConfigService,
    private httpService: HttpService
  ) {
    this.API_KEY = this.configService.get<string>('CURRENCY_API_KEY') || '';
  }

  async getCurrencies() {
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/currencies`, {
        params: {
          apikey: this.API_KEY,
        },
      })
    );
    return res.data;
  }

  async getLatest(base: string) {
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/latest`, {
        params: {
          apikey: this.API_KEY,
          base_currency: base,
        },
      })
    );
    return res.data;
  }

  async getHistorical(base: string, date: string) {
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/historical`, {
        params: {
          apikey: this.API_KEY,
          base_currency: base,
          date,
        },
      })
    );
    return res.data;
  }
}