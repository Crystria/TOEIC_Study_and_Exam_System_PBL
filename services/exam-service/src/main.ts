import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpErrorFilter } from './http-error.filter';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export function configureHttp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Exam Service API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3003);
  await app.listen(port);
}

if (require.main === module) void bootstrap();
