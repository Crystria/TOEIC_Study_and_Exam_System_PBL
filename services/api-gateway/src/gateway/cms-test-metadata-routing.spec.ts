import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@toeic/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { createJwtMiddleware } from './jwt.middleware';
import { createGatewayProxy } from './proxy';
import { createRateLimitMiddleware } from './rate-limit.middleware';

jest.mock('http-proxy-middleware', () => ({ createProxyMiddleware: jest.fn() }));
jest.mock('@nestjs/core', () => ({ NestFactory: { create: jest.fn() } }));
jest.mock('@toeic/common', () => ({ RedisService: class {} }));
jest.mock('../app.module', () => ({ AppModule: class {} }));
jest.mock('./correlation-id.middleware', () => ({ correlationIdMiddleware: jest.fn() }));
jest.mock('./jwt.middleware', () => ({ createJwtMiddleware: jest.fn() }));
jest.mock('./rate-limit.middleware', () => ({ createRateLimitMiddleware: jest.fn() }));

describe('Gateway CMS route dispatch and bootstrap ordering (all external I/O stubbed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    '/api/v1/tests/cms-metadata',
    '/api/v1/tests/cms-metadata/demo-test-002?ignored-for-routing=1',
    '/api/v1/tests',
    '/api/v1/tests/demo-test-001',
  ])('uses the existing Exam prefix without rewriting %s', (url) => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'EXAM_SERVICE_URL' ? 'http://exam.invalid' : undefined,
      ),
    };
    createGatewayProxy(config as unknown as ConfigService);
    const options = jest.mocked(createProxyMiddleware).mock.calls[0][0] as {
      pathFilter: (pathname: string) => boolean;
      router: (req: { url: string }) => string | undefined;
      pathRewrite?: unknown;
      xfwd: boolean;
    };
    expect(options.pathFilter(url)).toBe(true);
    expect(options.router({ url })).toBe('http://exam.invalid');
    expect(options).not.toHaveProperty('pathRewrite');
    expect(options.xfwd).toBe(true);
    expect(config.get).toHaveBeenCalledWith('EXAM_SERVICE_URL');
  });

  it('registers correlation, rate limit and JWT before the proxy in the actual bootstrap', async () => {
    const config = { get: jest.fn() };
    const redis = {};
    const jwt = {};
    const rateLimit = jest.fn();
    const jwtMiddleware = jest.fn();
    const proxy = Object.assign(jest.fn(), { upgrade: jest.fn() });
    jest.mocked(createRateLimitMiddleware).mockReturnValue(rateLimit);
    jest.mocked(createJwtMiddleware).mockReturnValue(jwtMiddleware);
    jest.mocked(createProxyMiddleware).mockReturnValue(proxy);
    const app = {
      get: jest.fn((token: unknown) =>
        token === RedisService ? redis : token === JwtService ? jwt : config,
      ),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      listen: jest.fn(),
    };
    const listened = new Promise<void>((resolveListen) => {
      app.listen.mockImplementation(async () => {
        resolveListen();
      });
    });
    jest.mocked(NestFactory.create).mockResolvedValue(app as never);
    await import('../main');
    await listened;
    expect(app.use.mock.calls.map(([middleware]) => middleware)).toEqual([
      correlationIdMiddleware,
      rateLimit,
      jwtMiddleware,
      proxy,
    ]);
    expect(createJwtMiddleware).toHaveBeenCalledWith(jwt);
    expect(createRateLimitMiddleware).toHaveBeenCalledWith(redis, config);
  });
});
