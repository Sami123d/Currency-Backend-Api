// src/currency/currency.service.ts
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

const CURRENCY_CODE = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class CurrencyService {
  private API_KEY: string;
  private BASE_URL = 'https://api.freecurrencyapi.com/v1';

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.API_KEY = this.configService.get<string>('CURRENCY_API_KEY') || '';
  }

  getCurrencies(): Promise<unknown> {
    return this.request('currencies', {});
  }

  getLatest(base?: string): Promise<unknown> {
    return this.request('latest', { base_currency: this.normalizeBase(base) });
  }

  getHistorical(base?: string, date?: string): Promise<unknown> {
    if (date !== undefined && !ISO_DATE.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    return this.request('historical', {
      base_currency: this.normalizeBase(base),
      date,
    });
  }

  /** Base is optional (the provider defaults to USD) but must be a 3-letter code when given. */
  private normalizeBase(base?: string): string | undefined {
    if (base === undefined || base === '') return undefined;
    const code = base.toUpperCase();
    if (!CURRENCY_CODE.test(code)) {
      throw new BadRequestException('base must be a 3-letter currency code');
    }
    return code;
  }

  /**
   * Proxies a GET to freecurrencyapi.com. Provider validation errors (4xx other
   * than auth/quota) become 400s; anything else becomes 502 instead of an
   * opaque 500.
   */
  private async request(
    path: string,
    params: Record<string, string | undefined>,
  ): Promise<unknown> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<unknown>(`${this.BASE_URL}/${path}`, {
          params: { apikey: this.API_KEY, ...params },
        }),
      );
      return res.data;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 400 || status === 422) {
        const data = (isAxiosError(err) ? err.response?.data : undefined) as
          | { message?: string }
          | undefined;
        throw new BadRequestException(
          data?.message ?? 'Invalid request to exchange-rate provider',
        );
      }
      throw new BadGatewayException('Exchange-rate provider request failed');
    }
  }
}
