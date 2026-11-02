import { accessJwtOptions } from '@toeic/common';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExamAuthGuard } from './exam-auth.guard';
import { ExamOutboxRelay } from './modules/outbox/outbox-relay';
import {
  AppConfigModule,
  AuthorizationModule,
  CorrelationIdMiddleware,
  MessagingModule,
  RedisModule,
  RolesGuard,
} from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { GrpcModule } from './grpc/grpc.module';
import { TestsModule } from './modules/tests/tests.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';

@Module({
  imports: [
    AppConfigModule,
    AuthorizationModule.forService('exam-service'),
    RedisModule,
    MessagingModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => accessJwtOptions(config, false),
    }),
    PrismaModule,
    GrpcModule,
    TestsModule,
    AttemptsModule,
  ],
  controllers: [HealthController, ReadinessController],
  providers: [
    { provide: APP_GUARD, useClass: ExamAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    ExamOutboxRelay,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
