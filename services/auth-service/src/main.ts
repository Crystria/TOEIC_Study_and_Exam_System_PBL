import { configureAuth } from './http';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureAuth(app);

  // Runtime validation and Swagger share the canonical contracts, without duplicate DTO schemas.
  const document = JSON.parse(
    readFileSync(
      require.resolve('@toeic/contracts/openapi/auth-learning-analytics.v1.json'),
      'utf8',
    ),
    (key, value) =>
      key === 'x-contract-status'
        ? 'P4_RUNTIME'
        : key === 'description' &&
            typeof value === 'string' &&
            value.startsWith('Success. Target P0')
          ? 'Success'
          : value,
  ) as ReturnType<typeof SwaggerModule.createDocument>;
  document.paths = Object.fromEntries(
    Object.entries(document.paths).filter(([path]) =>
      /^\/(auth|users|admin|sync)(\/|$)/.test(path),
    ),
  );
  document.info = {
    title: 'Auth Service API',
    version: '0.4.0',
    description: 'Auth P2 and asynchronous Learning sync P4 endpoints.',
  };
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

if (require.main === module) void bootstrap();
