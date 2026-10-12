import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, RedisModule } from '@toeic/common';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
