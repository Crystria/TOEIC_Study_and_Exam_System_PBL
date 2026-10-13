import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, JwtAuthGuard, MessagingModule, RedisModule, RolesGuard } from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { LearningModule } from './modules/learning/learning.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    MessagingModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    }),
    PrismaModule,
    LearningModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
