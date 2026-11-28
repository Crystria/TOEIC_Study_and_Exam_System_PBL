import { Inject, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout } from 'rxjs';

export const QUESTION_BANK_CLIENT = 'QUESTION_BANK_CLIENT';
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
  question_text: string;
  explanation: string;
  difficulty: string;
  media_url: string;
  options: QuestionOption[];
  group_id: string;
  position_in_group: number;
  transcript: string;
  audio_key: string;
  image_key: string;
  is_complete: boolean;
  revision: string;
}
export interface QuestionGroupAsset {
  asset_id: string;
  kind: 'AUDIO' | 'IMAGE' | 'TEXT';
  storage_key: string;
  content: string;
  order_no: number;
}
export interface QuestionGroup {
  group_id: string;
  part: number;
  type: string;
  instruction: string;
  audio_key: string;
  transcript: string;
  passage_text: string;
  order_no: number;
  assets: QuestionGroupAsset[];
  question_ids: string[];
}
export interface AnswerKeyItem {
  question_id: string;
  correct_option: string;
  revision: string;
}
export interface QuestionBundle {
  questions: Question[];
  groups: QuestionGroup[];
  missing_ids: string[];
}
export interface AnswerBundle {
  answers: AnswerKeyItem[];
  missing_ids: string[];
}
interface QuestionBankGrpcService {
  getQuestions(data: { question_ids: string[] }): Observable<QuestionBundle>;
  getAnswerKey(data: { question_ids: string[] }): Observable<AnswerBundle>;
}
@Injectable()
export class QuestionBankClient implements OnModuleInit {
  private service!: QuestionBankGrpcService;
  constructor(@Inject(QUESTION_BANK_CLIENT) private readonly client: ClientGrpc) {}
  onModuleInit() {
    this.service = this.client.getService<QuestionBankGrpcService>('QuestionBankService');
  }
  private async rpc<T>(call: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(call.pipe(timeout(5000)));
    } catch {
      throw new ServiceUnavailableException('Question Bank is unavailable');
    }
  }
  async getQuestionBundle(ids: string[]): Promise<QuestionBundle> {
    if (!ids.length) return { questions: [], groups: [], missing_ids: [] };
    const response = await this.rpc(this.service.getQuestions({ question_ids: ids }));
    return {
      questions: response.questions ?? [],
      groups: response.groups ?? [],
      missing_ids: response.missing_ids ?? [],
    };
  }
  async getAnswerBundle(ids: string[]): Promise<AnswerBundle> {
    if (!ids.length) return { answers: [], missing_ids: [] };
    const response = await this.rpc(this.service.getAnswerKey({ question_ids: ids }));
    return { answers: response.answers ?? [], missing_ids: response.missing_ids ?? [] };
  }
  async getQuestions(ids: string[]) {
    return (await this.getQuestionBundle(ids)).questions;
  }
  async getAnswerKey(ids: string[]) {
    return (await this.getAnswerBundle(ids)).answers;
  }
}
