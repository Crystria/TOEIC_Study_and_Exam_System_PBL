import { ConfigService } from '@nestjs/config';
import { RedisService } from '@toeic/common';
import { Request, Response } from 'express';
import { createUserRateLimitMiddleware } from './rate-limit.middleware';
describe('rate limit Redis deadline', () => {
  it('applies the existing fail-open policy without hanging protected reads', async () => {
    const next = jest.fn();
    const middleware = createUserRateLimitMiddleware(
      { consumeToken: () => new Promise(() => undefined) } as unknown as RedisService,
      { get: () => undefined } as unknown as ConfigService,
    );
    await middleware(
      { method: 'GET', path: '/api/v1/tests', user: { sub: 'p6-test' } } as unknown as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
