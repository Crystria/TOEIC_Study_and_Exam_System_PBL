import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, RedisService, RoleCode } from '@toeic/common';
import express, { Express } from 'express';
import {
  createServer,
  IncomingMessage,
  request as httpRequest,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { configureGateway } from '../main';
import { HealthController } from '../health/health.controller';
import { createAuthorizationMiddleware } from './authorization.middleware';
import { createBodyLimitMiddleware } from './body-limit.middleware';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { createJwtMiddleware } from './jwt.middleware';
import { gatewayNotFoundMiddleware } from './not-found.middleware';
import { createGatewayProxy } from './proxy';
import {
  createIpRateLimitMiddleware,
  createUserRateLimitMiddleware,
} from './rate-limit.middleware';

const SECRET = 'test-secret';
const ISSUER = 'toeic-auth';
const AUDIENCE = 'toeic-api';

interface ReceivedRequest {
  method: string;
  url: string;
  body: string;
  headers: IncomingMessage['headers'];
}

function fakeConfig(upstreamUrl: string): ConfigService {
  const values: Record<string, string> = {
    AUTH_SERVICE_URL: upstreamUrl,
    QUESTION_BANK_SERVICE_URL: upstreamUrl,
    EXAM_SERVICE_URL: upstreamUrl,
    LEARNING_SERVICE_URL: upstreamUrl,
    ANALYTICS_SERVICE_URL: upstreamUrl,
    AI_CHATBOX_SERVICE_URL: upstreamUrl,
    JWT_ACCESS_SECRET: SECRET,
    JWT_ISSUER: ISSUER,
    JWT_AUDIENCE: AUDIENCE,
    CORS_ORIGINS: 'http://localhost:3006',
  };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function fakeRedis(): jest.Mocked<Pick<RedisService, 'consumeToken'>> {
  return {
    consumeToken: jest.fn().mockResolvedValue(true),
  };
}

function createTestApp(upstreamUrl: string, redis: ReturnType<typeof fakeRedis>): Express {
  const app = express();
  const jwt = new JwtService({ secret: SECRET });

  app.use(correlationIdMiddleware);
  app.use(createBodyLimitMiddleware());
  app.use(createIpRateLimitMiddleware(redis as unknown as RedisService, fakeConfig(upstreamUrl)));
  app.use(createJwtMiddleware(jwt, { secret: SECRET, issuer: ISSUER, audience: AUDIENCE }));
  app.use(createUserRateLimitMiddleware(redis as unknown as RedisService, fakeConfig(upstreamUrl)));
  app.use(createAuthorizationMiddleware());
  app.use(createGatewayProxy(fakeConfig(upstreamUrl)));
  app.use(gatewayNotFoundMiddleware);
  return app;
}

function signToken(jwt: JwtService, overrides: Partial<JwtPayload> = {}): string {
  const payload: JwtPayload = {
    sub: 'user-1',
    email: 'user@example.com',
    roles: [RoleCode.USER],
    type: 'access',
    ...overrides,
  };
  return jwt.sign(payload, { issuer: ISSUER, audience: AUDIENCE, expiresIn: '5m' });
}

async function chunkedRequest(
  app: Express,
  path: string,
  body: string,
  headers: Record<string, string> = {},
) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    return await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = httpRequest(
        {
          hostname: '127.0.0.1',
          port: (server.address() as AddressInfo).port,
          path,
          method: 'PATCH',
          headers: { ...headers, 'Transfer-Encoding': 'chunked' },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }),
          );
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('API Gateway e2e', () => {
  let upstream: Server;
  let upstreamUrl: string;
  let received: ReceivedRequest | undefined;
  let jwt: JwtService;

  beforeAll(async () => {
    jwt = new JwtService({ secret: SECRET });
    upstream = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        received = {
          method: req.method ?? '',
          url: req.url ?? '',
          body: Buffer.concat(chunks).toString('utf8'),
          headers: req.headers,
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const address = upstream.address() as AddressInfo;
    upstreamUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    received = undefined;
  });

  it('keeps the POST body intact and forwards identity headers', async () => {
    const redis = fakeRedis();
    const app = createTestApp(upstreamUrl, redis);
    const body = { durationMinutes: 45, parts: [1, 2, 3] };

    const response = await request(app)
      .post('/api/v1/tests/test-1/part-attempts')
      .set('Authorization', `Bearer ${signToken(jwt)}`)
      .set('X-Correlation-ID', 'corr-123')
      .set('X-User-ID', 'attacker')
      .set('X-User-Roles', 'SYSTEM_ADMIN')
      .set('X-User-Extra', 'forged')
      .send(body);

    expect(response.status).toBe(200);
    expect(received?.method).toBe('POST');
    expect(received?.url).toBe('/api/v1/tests/test-1/part-attempts');
    expect(JSON.parse(received?.body ?? '{}')).toEqual(body);
    expect(received?.headers['x-user-id']).toBe('user-1');
    expect(received?.headers['x-user-roles']).toBe('USER');
    expect(received?.headers['x-user-extra']).toBeUndefined();
    expect(received?.headers['x-correlation-id']).toBe('corr-123');
    expect(response.headers['x-correlation-id']).toBe('corr-123');
  });

  it('rejects missing and refresh tokens with 401', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());

    const missing = await request(app).get('/api/v1/tests');
    expect(missing.status).toBe(401);

    const refresh = await request(app)
      .get('/api/v1/tests')
      .set('Authorization', `Bearer ${signToken(jwt, { type: 'refresh' })}`);
    expect(refresh.status).toBe(401);
  });

  it('rejects insufficient roles with 403', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());

    const response = await request(app)
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${signToken(jwt)}`)
      .send({ stem: 'Question' });

    expect(response.status).toBe(403);
    expect(received).toBeUndefined();
  });

  it('lets public auth traffic through without a token', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'secret' });

    expect(response.status).toBe(200);
    expect(received?.url).toBe('/api/v1/auth/login');
  });

  it('does not retain one server-close listener per proxied request', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    try {
      for (let i = 0; i < 20; i++)
        expect(
          (
            await request(server)
              .get('/api/v1/tests')
              .set('Authorization', `Bearer ${signToken(jwt)}`)
          ).status,
        ).toBe(200);
      expect(server.listenerCount('close')).toBeLessThanOrEqual(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns 429 when the user bucket is exhausted', async () => {
    const redis = fakeRedis();
    redis.consumeToken.mockResolvedValueOnce(false);
    const app = createTestApp(upstreamUrl, redis);

    const response = await request(app)
      .get('/api/v1/tests')
      .set('Authorization', `Bearer ${signToken(jwt)}`);

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
    expect(received).toBeUndefined();
  });

  it('rejects invalid issuer, audience, expiration and missing expiration', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());
    for (const options of [
      { issuer: 'other', audience: AUDIENCE, expiresIn: 300 },
      { issuer: ISSUER, audience: 'other', expiresIn: 300 },
      { issuer: ISSUER, audience: AUDIENCE, expiresIn: -1 },
      { issuer: ISSUER, audience: AUDIENCE },
    ]) {
      const token = jwt.sign({ sub: 'user-1', type: 'access', roles: ['USER'] }, options);
      expect(
        (await request(app).get('/api/v1/tests').set('Authorization', `Bearer ${token}`)).status,
      ).toBe(401);
    }
    expect(received).toBeUndefined();
  });

  it('rejects oversized bodies with and without content-length before forwarding', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());
    const body = 'a'.repeat(1024 * 1024 + 1);
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send(body);
    expect(response.status).toBe(413);
    expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
    const chunked = await chunkedRequest(app, '/api/v1/auth/login', body);
    expect(chunked.status).toBe(413);
    expect(JSON.parse(chunked.body).code).toBe('PAYLOAD_TOO_LARGE');
    expect(received).toBeUndefined();
  });

  it('forwards a chunked PATCH body byte-for-byte and preserves query strings', async () => {
    const app = createTestApp(upstreamUrl, fakeRedis());
    const body = '{ "text": "Tiếng Việt", "value": 1 }';
    const response = await chunkedRequest(app, '/api/v1/questions/q1?revision=2', body, {
      Authorization: `Bearer ${signToken(jwt, { roles: [RoleCode.CONTENT_ADMIN] })}`,
      'Content-Type': 'application/json',
    });
    expect(response.status).toBe(200);
    expect(received?.body).toBe(body);
    expect(received?.url).toBe('/api/v1/questions/q1?revision=2');
  });

  it('returns consistent 502 responses for missing upstream config and connection failure', async () => {
    const closedServer = createServer();
    await new Promise<void>((resolve) => closedServer.listen(0, '127.0.0.1', resolve));
    const port = (closedServer.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closedServer.close(() => resolve()));
    for (const url of ['', `http://127.0.0.1:${port}`]) {
      const response = await request(createTestApp(url, fakeRedis()))
        .post('/api/v1/auth/login')
        .send({});
      expect(response.status).toBe(502);
      expect(response.body.code).toBe('UPSTREAM_ERROR');
      expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
      expect(response.body).not.toHaveProperty('stack');
    }
  });

  it('returns 504 when an upstream does not respond', async () => {
    const hanging = createServer((req) => req.resume());
    await new Promise<void>((resolve) => hanging.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${(hanging.address() as AddressInfo).port}`;
      const response = await request(createTestApp(url, fakeRedis()))
        .get('/api/v1/tests')
        .set('Authorization', `Bearer ${signToken(jwt)}`);
      expect(response.status).toBe(504);
      expect(response.body.code).toBe('UPSTREAM_TIMEOUT');
    } finally {
      hanging.closeAllConnections();
      await new Promise<void>((resolve) => hanging.close(() => resolve()));
    }
  }, 10_000);

  it('fails open for reads when Redis is unavailable and returns 404 for unknown API routes', async () => {
    const redis = fakeRedis();
    redis.consumeToken.mockRejectedValue(new Error('Redis unavailable'));
    const app = createTestApp(upstreamUrl, redis);
    const token = signToken(jwt);
    expect(
      (await request(app).get('/api/v1/tests').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(200);
    const response = await request(app)
      .get('/api/v1/unknown')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('gateway bootstrap middleware', () => {
  let app: INestApplication;
  const redis = fakeRedis();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureGateway(
      app,
      fakeConfig('http://127.0.0.1:1'),
      redis as unknown as RedisService,
      new JwtService({ secret: SECRET }),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('serves health and status locally without JWT or rate limiting', async () => {
    redis.consumeToken.mockClear();
    for (const path of ['/health', '/status']) {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    }
    expect(redis.consumeToken).not.toHaveBeenCalled();
  });

  it('allows configured CORS origins with credentials and handles preflight before authentication', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/tests')
      .set('Origin', 'http://localhost:3006')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,idempotency-key');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3006');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-headers']).toContain('Idempotency-Key');
    expect(response.headers['x-correlation-id']).toBeDefined();
    const denied = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://untrusted.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
