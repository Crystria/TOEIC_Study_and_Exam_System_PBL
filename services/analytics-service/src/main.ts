import { readFileSync } from 'node:fs';
import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AnalyticsHttpFilter } from './http';
export function configureAnalytics(app: INestApplication) {
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () =>
        new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Check query parameters' }),
    }),
  );
  app.useGlobalFilters(new AnalyticsHttpFilter());
}
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureAnalytics(app);
  const document = JSON.parse(
    readFileSync(
      require.resolve('@toeic/contracts/openapi/auth-learning-analytics.v1.json'),
      'utf8',
    ),
  ) as ReturnType<typeof SwaggerModule.createDocument>;
  document.paths = Object.fromEntries(
    Object.entries(document.paths).filter(([p]) => p.startsWith('/analytics/')),
  );
  for (const path of Object.values(document.paths))
    for (const op of Object.values(path))
      if (op && typeof op === 'object' && 'operationId' in op)
        (op as Record<string, unknown>)['x-contract-status'] = 'P5_RUNTIME';
  document.info = { title: 'Analytics Service API', version: '0.5.0' };
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(Number(process.env.PORT || 3005));
}
if (require.main === module) void bootstrap();
