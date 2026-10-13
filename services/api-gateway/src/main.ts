import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@toeic/common';
import { AppModule } from './app.module';
import { correlationIdMiddleware } from './gateway/correlation-id.middleware';
import { createJwtMiddleware } from './gateway/jwt.middleware';
import { createGatewayProxy } from './gateway/proxy';
import { createRateLimitMiddleware } from './gateway/rate-limit.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const redis = app.get(RedisService);
  const jwt = app.get(JwtService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.use(correlationIdMiddleware);
  app.use(createRateLimitMiddleware(redis, config));
  app.use(createJwtMiddleware(jwt));
  app.use(createGatewayProxy(config));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
