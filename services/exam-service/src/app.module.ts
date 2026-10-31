import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExamAuthGuard } from './exam-auth.guard';
import { ExamOutboxRelay } from './modules/outbox/outbox-relay';
import {
  AppConfigModule,
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
    RedisModule,
    MessagingModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
        if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
        return {
          secret,
          verifyOptions: {
            issuer: config.get<string>('JWT_ISSUER') ?? 'toeic-auth',
            audience: config.get<string>('JWT_AUDIENCE') ?? 'toeic-api',
            algorithms: ['HS256' as const],
          },
        };
      },
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
