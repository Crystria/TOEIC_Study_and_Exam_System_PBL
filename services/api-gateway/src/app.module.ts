import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  AppConfigModule,
  DEFAULT_JWT_AUDIENCE,
  DEFAULT_JWT_ISSUER,
  RedisModule,
} from '@toeic/common';
import { requiredConfig } from './config/gateway-config';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requiredConfig(config, 'JWT_ACCESS_SECRET'),
        signOptions: {
          issuer: config.get<string>('JWT_ISSUER') ?? DEFAULT_JWT_ISSUER,
          audience: config.get<string>('JWT_AUDIENCE') ?? DEFAULT_JWT_AUDIENCE,
        },
      }),
    }),
  ],
  controllers: [HealthController, ReadinessController],
})
export class AppModule {}
