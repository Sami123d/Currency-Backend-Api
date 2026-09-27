import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import request from 'supertest';
import { App } from 'supertest/types';
import { of, throwError } from 'rxjs';
import { AppModule } from './../src/app.module';

/**
 * Boots the real AppModule (controllers, service, config) with the outbound
 * HTTP client replaced, so no request reaches freecurrencyapi.com.
 */
describe('Currency API (e2e)', () => {
  let app: INestApplication<App>;
  const get = jest.fn();

  const lastCall = () => get.mock.calls[0] as [string, { params: object }];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue({ get })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => get.mockReset());

  afterAll(async () => {
    await app.close();
  });

  it('GET / responds (health check)', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });

  it('GET /currency/currencies proxies the provider payload', async () => {
    const payload = { data: { EUR: { code: 'EUR', name: 'Euro' } } };
    get.mockReturnValue(of({ data: payload } as AxiosResponse));

    const res = await request(app.getHttpServer())
      .get('/currency/currencies')
      .expect(200);
    expect(res.body).toEqual(payload);
    expect(lastCall()[0]).toBe('https://api.freecurrencyapi.com/v1/currencies');
  });

  it('GET /currency/latest?base=eur forwards base_currency=EUR', async () => {
    get.mockReturnValue(of({ data: { data: { USD: 1.1 } } } as AxiosResponse));

    const res = await request(app.getHttpServer())
      .get('/currency/latest?base=eur')
      .expect(200);
    expect(res.body).toEqual({ data: { USD: 1.1 } });
    expect(lastCall()[1].params).toMatchObject({ base_currency: 'EUR' });
  });

  it('GET /currency/historical forwards base and date', async () => {
    const payload = { data: { '2025-01-02': { EUR: 0.97 } } };
    get.mockReturnValue(of({ data: payload } as AxiosResponse));

    const res = await request(app.getHttpServer())
      .get('/currency/historical?base=USD&date=2025-01-02')
      .expect(200);
    expect(res.body).toEqual(payload);
    expect(lastCall()[1].params).toMatchObject({
      base_currency: 'USD',
      date: '2025-01-02',
    });
  });

  it('GET /currency/historical with a malformed date returns 400', async () => {
    await request(app.getHttpServer())
      .get('/currency/historical?base=USD&date=yesterday')
      .expect(400);
    expect(get).not.toHaveBeenCalled();
  });

  it('returns 400 with the provider message when the provider rejects input', async () => {
    get.mockReturnValue(
      throwError(
        () =>
          new AxiosError('422', '422', undefined, undefined, {
            status: 422,
            data: { message: 'The selected base currency is invalid.' },
            statusText: '',
            headers: {},
            config: { headers: new AxiosHeaders() },
          }),
      ),
    );

    const res = await request(app.getHttpServer())
      .get('/currency/latest?base=XYZ')
      .expect(400);
    expect((res.body as { message: string }).message).toBe(
      'The selected base currency is invalid.',
    );
  });

  it('returns 502 when the provider is unreachable', () => {
    get.mockReturnValue(throwError(() => new Error('ECONNRESET')));
    return request(app.getHttpServer()).get('/currency/currencies').expect(502);
  });
});
