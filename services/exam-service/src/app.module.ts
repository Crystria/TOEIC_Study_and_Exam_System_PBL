import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  AppConfigModule,
  CorrelationIdMiddleware,
  JwtAuthGuard,
  KafkaModule,
  RedisModule,
  RolesGuard,
} from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { GrpcModule } from './grpc/grpc.module';
import { TestsModule } from './modules/tests/tests.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    KafkaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    }),
    PrismaModule,
    GrpcModule,
    TestsModule,
    AttemptsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
