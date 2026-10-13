import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigModule, JwtAuthGuard, KafkaModule, RedisModule, RolesGuard } from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SearchModule } from './modules/search/search.module';
import { HealthController } from './health/health.controller';
import { QuestionBankGrpcController } from './grpc/question-bank.grpc.controller';

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
    SearchModule,
    QuestionsModule,
  ],
  controllers: [HealthController, QuestionBankGrpcController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
