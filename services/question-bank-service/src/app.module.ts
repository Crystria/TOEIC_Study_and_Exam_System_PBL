import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule, MessagingModule, RedisModule, RolesGuard } from '@toeic/common';
import { PrismaModule } from './prisma/prisma.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SearchModule } from './modules/search/search.module';
import { HealthController } from './health/health.controller';
import { QuestionBankGrpcController } from './grpc/question-bank.grpc.controller';
import { GroupsModule } from './modules/groups/groups.module';
import { OutboxRelay } from './modules/outbox/outbox-relay';
import { QuestionBankAuthGuard } from './question-bank-auth.guard';

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
    SearchModule,
    QuestionsModule,
    GroupsModule,
  ],
  controllers: [HealthController, QuestionBankGrpcController],
  providers: [
    { provide: APP_GUARD, useClass: QuestionBankAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    OutboxRelay,
  ],
})
export class AppModule {}
