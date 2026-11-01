import { accessJwtOptions } from '@toeic/common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthorizationModule } from '@toeic/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule, MessagingModule, RedisModule, RolesGuard } from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SearchModule } from './modules/search/search.module';
import { HealthController } from './health/health.controller';
import { ReadinessController } from './health/readiness.controller';
import { QuestionBankGrpcController } from './grpc/question-bank.grpc.controller';
import { GroupsModule } from './modules/groups/groups.module';
import { OutboxRelay } from './modules/outbox/outbox-relay';
import { QuestionBankAuthGuard } from './question-bank-auth.guard';

@Module({
  imports: [
    AppConfigModule,
    AuthorizationModule.forService('question-bank-service'),
    RedisModule,
    MessagingModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => accessJwtOptions(config, false),
    }),
    PrismaModule,
    SearchModule,
    QuestionsModule,
    GroupsModule,
  ],
  controllers: [HealthController, ReadinessController, QuestionBankGrpcController],
  providers: [
    { provide: APP_GUARD, useClass: QuestionBankAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    OutboxRelay,
  ],
})
export class AppModule {}
