import { ConfigService } from '@nestjs/config';
import { probe, RedisService } from '@toeic/common';
import { ReadinessController } from './readiness.controller';
describe('gateway readiness', () => {
  afterEach(() => jest.restoreAllMocks());
  function controller() {
    return new ReadinessController(
      { get: () => 'http://upstream' } as unknown as ConfigService,
      { getClient: () => ({ ping: () => Promise.resolve('PONG') }) } as unknown as RedisService,
    );
  }
  it('is ready only when Redis and required upstreams respond successfully', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'));
    expect((await controller().ready()).status).toBe('ready');
    jest.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(controller().ready()).rejects.toThrow();
  });
  it('bounds a hanging dependency without exposing error details', async () => {
    const result = await probe(
      {
        postgres: async () => {
          throw new Error('private connection string');
        },
        redis: () => new Promise(() => undefined),
      },
      10,
    );
    expect(result).toEqual({
      ready: false,
      checks: { postgres: 'unavailable', redis: 'unavailable' },
    });
  });
});
