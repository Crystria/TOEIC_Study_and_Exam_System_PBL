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
import { AnalyticsModule } from './modules/analytics/analytics.module';
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
    AnalyticsModule,
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
