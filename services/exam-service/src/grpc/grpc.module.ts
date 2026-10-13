import { join } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AppConfigModule } from '@toeic/common';
import { QUESTION_BANK_CLIENT, QuestionBankClient } from './question-bank.client';

/**
 * Đăng ký gRPC client tới Question Bank Service.
 *
 * protoPath mặc định resolve tương đối tới file biên dịch:
 *   services/exam-service/dist/grpc/  ->  ../../../../packages/contracts/proto/question_bank.proto
 * (khi chạy từ src/, __dirname cũng lùi 4 cấp về repo root nên vẫn đúng).
 * Có thể override bằng env `QUESTION_BANK_PROTO_PATH`.
 */
@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: QUESTION_BANK_CLIENT,
        imports: [AppConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'toeic.questionbank.v1',
            protoPath:
              config.get<string>('QUESTION_BANK_PROTO_PATH') ??
              join(__dirname, '../../../../packages/contracts/proto/question_bank.proto'),
            url: config.get<string>('QUESTION_BANK_GRPC_URL') ?? 'localhost:50052',
            loader: {
              keepCase: true,
            },
          },
        }),
      },
    ]),
  ],
  providers: [QuestionBankClient],
  exports: [QuestionBankClient],
})
export class GrpcModule {}
