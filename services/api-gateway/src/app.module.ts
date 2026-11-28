import { accessJwtOptions } from '@toeic/common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, RedisModule } from '@toeic/common';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => accessJwtOptions(config, false),
    }),
  ],
  controllers: [HealthController, ReadinessController],
})
export class AppModule {}
