import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  AppConfigModule,
  CorrelationIdMiddleware,
  DEFAULT_JWT_AUDIENCE,
  DEFAULT_JWT_ISSUER,
  JwtAuthGuard,
  MessagingModule,
  RedisModule,
  RolesGuard,
} from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
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
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is required');
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get<string>('JWT_ACCESS_TTL') ?? '15m',
            issuer: config.get<string>('JWT_ISSUER') ?? DEFAULT_JWT_ISSUER,
            audience: config.get<string>('JWT_AUDIENCE') ?? DEFAULT_JWT_AUDIENCE,
          },
        };
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
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
