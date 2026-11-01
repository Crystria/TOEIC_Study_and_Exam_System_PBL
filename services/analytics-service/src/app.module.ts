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
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';

@Module({
  imports: [
    AppConfigModule,
    AuthorizationModule.forService('analytics-service'),
    RedisModule,
    MessagingModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => accessJwtOptions(config, false),
    }),
    PrismaModule,
    AnalyticsModule,
  ],
  controllers: [HealthController, ReadinessController],
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
