import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

/**
 * Token dùng để inject gRPC client proxy của Question Bank.
 * Khai báo tại đây (thay vì trong GrpcModule) để tránh import vòng.
 */
export const QUESTION_BANK_CLIENT = 'QUESTION_BANK_CLIENT';

// ----- Kiểu dữ liệu khớp với packages/contracts/proto/question_bank.proto -----
// (proto field giữ nguyên snake_case nhờ loader `keepCase: true`).

export interface QuestionOption {
  id: string;
  option_key: string;
  content: string;
  media_url: string;
}

export interface Question {
  id: string;
  part: number;
  type: string;
  stem: string;
  explanation: string;
  difficulty: string;
  media_url: string;
  options: QuestionOption[];
}

export interface AnswerKeyItem {
  question_id: string;
  correct_option: string;
}

interface GetQuestionsRequest {
  question_ids: string[];
}

interface GetQuestionsResponse {
  questions: Question[];
}

interface GetAnswerKeyRequest {
  question_ids: string[];
}

interface GetAnswerKeyResponse {
  answers: AnswerKeyItem[];
}

/**
 * Nest expose các RPC method ở dạng camelCase (GetQuestions -> getQuestions).
 */
interface QuestionBankGrpcService {
  getQuestions(request: GetQuestionsRequest): Observable<GetQuestionsResponse>;
  getAnswerKey(request: GetAnswerKeyRequest): Observable<GetAnswerKeyResponse>;
}

/**
 * Wrapper gọi nội bộ Question Bank Service qua gRPC.
 * Chỉ dùng cho luồng server-side (tải đề, chấm điểm) — answer key KHÔNG bao giờ trả ra client.
 */
@Injectable()
export class QuestionBankClient implements OnModuleInit {
  private service!: QuestionBankGrpcService;

  constructor(@Inject(QUESTION_BANK_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.service = this.client.getService<QuestionBankGrpcService>('QuestionBankService');
  }

  async getQuestions(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await firstValueFrom(
      this.service.getQuestions({ question_ids: ids }),
    );
    return response.questions ?? [];
  }

  async getAnswerKey(ids: string[]): Promise<AnswerKeyItem[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await firstValueFrom(this.service.getAnswerKey({ question_ids: ids }));
    return response.answers ?? [];
  }
}
