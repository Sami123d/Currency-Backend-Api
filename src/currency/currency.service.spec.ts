import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { CurrencyService } from './currency.service';

const ok = (data: unknown) => of({ data } as AxiosResponse);

const upstreamError = (status: number, data: unknown) =>
  throwError(
    () =>
      new AxiosError('upstream', String(status), undefined, undefined, {
        status,
        data,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
  );

describe('CurrencyService', () => {
  let service: CurrencyService;
  const get = jest.fn();

  beforeEach(async () => {
    get.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: HttpService, useValue: { get } },
        { provide: ConfigService, useValue: { get: () => 'test-key' } },
      ],
    }).compile();
    service = moduleRef.get(CurrencyService);
  });

  it('fetches the currency list with the configured API key', async () => {
    const payload = { data: { USD: { name: 'US Dollar' } } };
    get.mockReturnValue(ok(payload));

    await expect(service.getCurrencies()).resolves.toEqual(payload);
    expect(get).toHaveBeenCalledWith(
      'https://api.freecurrencyapi.com/v1/currencies',
      { params: { apikey: 'test-key' } },
    );
  });

  it('passes an upper-cased base currency to /latest', async () => {
    get.mockReturnValue(ok({ data: { EUR: 0.9 } }));

    await expect(service.getLatest('usd')).resolves.toEqual({
      data: { EUR: 0.9 },
    });
    expect(get).toHaveBeenCalledWith(
      'https://api.freecurrencyapi.com/v1/latest',
      { params: { apikey: 'test-key', base_currency: 'USD' } },
    );
  });

  it('omits base_currency when no base is given (provider defaults to USD)', async () => {
    get.mockReturnValue(ok({ data: {} }));
    await service.getLatest(undefined);
    expect(get).toHaveBeenCalledWith(
      'https://api.freecurrencyapi.com/v1/latest',
      { params: { apikey: 'test-key', base_currency: undefined } },
    );
  });

  it('passes base and date to /historical', async () => {
    get.mockReturnValue(ok({ data: { '2025-01-02': { EUR: 0.97 } } }));

    await service.getHistorical('GBP', '2025-01-02');
    expect(get).toHaveBeenCalledWith(
      'https://api.freecurrencyapi.com/v1/historical',
      {
        params: {
          apikey: 'test-key',
          base_currency: 'GBP',
          date: '2025-01-02',
        },
      },
    );
  });

  it('rejects malformed input without calling the provider', () => {
    expect(() => service.getLatest('US')).toThrow(BadRequestException);
    expect(() => service.getHistorical('USD', '02/01/2025')).toThrow(
      BadRequestException,
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('maps provider validation errors (422) to 400 with the provider message', async () => {
    get.mockReturnValue(
      upstreamError(422, { message: 'The selected base currency is invalid.' }),
    );
    await expect(service.getLatest('XYZ')).rejects.toThrow(
      new BadRequestException('The selected base currency is invalid.'),
    );
  });

  it('maps auth, server and network failures to 502', async () => {
    get.mockReturnValue(upstreamError(401, { message: 'Invalid key' }));
    await expect(service.getCurrencies()).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    get.mockReturnValue(throwError(() => new Error('ECONNRESET')));
    await expect(service.getCurrencies()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
