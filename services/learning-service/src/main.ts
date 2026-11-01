import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureLearning } from './http';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureLearning(app);
  const document = JSON.parse(
    readFileSync(
      require.resolve('@toeic/contracts/openapi/auth-learning-analytics.v1.json'),
      'utf8',
    ),
    (key, value) =>
      key === 'x-contract-status'
        ? 'P3_RUNTIME'
        : key === 'description' &&
            typeof value === 'string' &&
            value.startsWith('Success. Target P0')
          ? 'Success'
          : value,
  ) as ReturnType<typeof SwaggerModule.createDocument>;
  document.paths = Object.fromEntries(
    Object.entries(document.paths).filter(([p]) => p.startsWith('/learning/')),
  );
  document.info = { title: 'Learning Service API', version: '0.3.0' };
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(Number(process.env.PORT || 3004));
}
if (require.main === module) void bootstrap();
