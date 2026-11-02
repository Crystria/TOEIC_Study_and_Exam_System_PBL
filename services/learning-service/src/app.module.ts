import { ServiceOutboxRelay } from './outbox-relay';
import { ConfigService } from '@nestjs/config';
import { accessJwtOptions } from '@toeic/common';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  AppConfigModule,
  AuthorizationModule,
  CorrelationIdMiddleware,
  JwtAuthGuard,
  MessagingModule,
  RedisModule,
  RolesGuard,
} from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { LearningModule } from './modules/learning/learning.module';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';
import { LearningSyncModule } from './sync/learning-sync.module';

@Module({
  imports: [
    AppConfigModule,
    AuthorizationModule.forService('learning-service'),
    RedisModule,
    MessagingModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => accessJwtOptions(config, false),
    }),
    PrismaModule,
    LearningModule,
    LearningSyncModule,
  ],
  controllers: [HealthController, ReadinessController],
  providers: [
    ServiceOutboxRelay,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
