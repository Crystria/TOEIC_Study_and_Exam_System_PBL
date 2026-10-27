import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@toeic/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { jwtMiddlewareOptions } from './config/gateway-config';
import { createAuthorizationMiddleware } from './gateway/authorization.middleware';
import { createBodyLimitMiddleware } from './gateway/body-limit.middleware';
import { correlationIdMiddleware } from './gateway/correlation-id.middleware';
import { createJwtMiddleware } from './gateway/jwt.middleware';
import { gatewayNotFoundMiddleware } from './gateway/not-found.middleware';
import { createGatewayProxy } from './gateway/proxy';
import {
  createIpRateLimitMiddleware,
  createUserRateLimitMiddleware,
} from './gateway/rate-limit.middleware';

export function configureGateway(
  app: INestApplication,
  config: ConfigService,
  redis: RedisService,
  jwt: JwtService,
): void {
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.disable('x-powered-by');
  httpAdapter.set('trust proxy', Number(config.get<string>('TRUST_PROXY_HOPS') ?? 0));

  app.use(helmet());
  app.use(correlationIdMiddleware);
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID', 'Idempotency-Key'],
    exposedHeaders: ['X-Correlation-ID', 'Retry-After'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  });

  app.use(createBodyLimitMiddleware());
  app.use(createIpRateLimitMiddleware(redis, config));
  app.use(createJwtMiddleware(jwt, jwtMiddlewareOptions(config)));
  app.use(createUserRateLimitMiddleware(redis, config));
  app.use(createAuthorizationMiddleware());
  app.use(createGatewayProxy(config));
  app.use(gatewayNotFoundMiddleware);
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('ApiGateway');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  configureGateway(app, app.get(ConfigService), app.get(RedisService), app.get(JwtService));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`API Gateway listening on port ${port}`);
}

if (require.main === module) void bootstrap();
