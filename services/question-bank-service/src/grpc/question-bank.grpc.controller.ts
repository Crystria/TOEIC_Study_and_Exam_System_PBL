import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { QuestionsService } from '../modules/questions/questions.service';

interface GetQuestionsRequest {
  question_ids: string[];
}

interface GetAnswerKeyRequest {
  question_ids: string[];
}

@Controller()
export class QuestionBankGrpcController {
  constructor(private readonly questionsService: QuestionsService) {}

  @GrpcMethod('QuestionBankService', 'GetQuestions')
  async getQuestions(data: GetQuestionsRequest) {
    const questions = await this.questionsService.findByIds(data.question_ids ?? []);
    return {
      questions: questions.map((q) => ({
        id: q.id,
        part: q.part,
        type: q.type,
        stem: q.stem,
        explanation: q.explanation ?? '',
        difficulty: q.difficulty,
        media_url: q.mediaUrl ?? '',
        options: q.options.map((o) => ({
          id: o.id,
          option_key: o.optionKey,
          content: o.content,
          media_url: o.mediaUrl ?? '',
        })),
      })),
    };
  }

  @GrpcMethod('QuestionBankService', 'GetAnswerKey')
  async getAnswerKey(data: GetAnswerKeyRequest) {
    const answers = await this.questionsService.getAnswerKey(data.question_ids ?? []);
    return {
      answers: answers.map((a) => ({
        question_id: a.questionId,
        correct_option: a.correctOption,
      })),
    };
  }
}
