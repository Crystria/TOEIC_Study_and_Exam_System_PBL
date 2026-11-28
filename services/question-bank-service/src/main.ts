import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CorrelationIdMiddleware } from '@toeic/common';
import { HttpErrorFilter } from './http-error.filter';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export function configureHttp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  const correlation = new CorrelationIdMiddleware();
  app.use(correlation.use.bind(correlation));
  app.useGlobalFilters(new HttpErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureHttp(app);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'toeic.questionbank.v1',
      protoPath: join(__dirname, '../../../packages/contracts/proto/question_bank.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50052}`,
      loader: { keepCase: true },
    },
  });
  await app.startAllMicroservices();

  const config = new DocumentBuilder()
    .setTitle('Question Bank Service API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(Number(process.env.PORT ?? 3002));
}

if (require.main === module) void bootstrap();
