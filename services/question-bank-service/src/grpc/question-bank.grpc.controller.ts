import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { QuestionsService } from '../modules/questions/questions.service';
import { isComplete } from '../modules/questions/question-rules';

interface QuestionIds {
  question_ids?: string[];
  questionIds?: string[];
}
@Controller()
export class QuestionBankGrpcController {
  constructor(private readonly questions: QuestionsService) {}
  @GrpcMethod('QuestionBankService', 'GetQuestions')
  async getQuestions(data: QuestionIds) {
    const ids = [...new Set(data.question_ids ?? data.questionIds ?? [])];
    const questions = await this.questions.findByIds(ids);
    const found = new Set(questions.map((q) => q.id));
    const groups = [
      ...new Map(questions.filter((q) => q.group).map((q) => [q.group!.id, q.group!])).values(),
    ];
    return {
      questions: questions.map((q) => ({
        id: q.id,
        part: q.part,
        type: q.type,
        stem: q.questionText ?? '',
        question_text: q.questionText ?? '',
        explanation: q.explanation ?? '',
        difficulty: q.difficulty,
        media_url: '',
        transcript: q.transcript ?? '',
        audio_key: q.audioKey ?? '',
        image_key: q.imageKey ?? '',
        group_id: q.groupId ?? '',
        position_in_group: q.positionInGroup ?? 0,
        is_complete: isComplete(q),
        options: q.options.map((o) => ({
          id: `${q.id}:${o.optionCode}`,
          option_key: o.optionCode,
          content: o.optionText,
          media_url: '',
        })),
      })),
      groups: groups.map((g) => ({
        group_id: g.id,
        part: g.part,
        type: g.type,
        instruction: g.instruction ?? '',
        audio_key: g.audioKey ?? '',
        transcript: g.transcript ?? '',
        passage_text: g.passageText ?? '',
        order_no: g.orderNo ?? 0,
        question_ids: g.questions.filter((q) => !q.deletedAt).map((q) => q.id),
        assets: g.assets.map((a) => ({
          asset_id: a.id,
          kind: a.kind,
          storage_key: a.storageKey ?? '',
          content: a.content ?? '',
          order_no: a.orderNo,
        })),
      })),
      missing_ids: ids.filter((id) => !found.has(id)),
    };
  }
  @GrpcMethod('QuestionBankService', 'GetAnswerKey')
  async getAnswerKey(data: QuestionIds) {
    const ids = [...new Set(data.question_ids ?? data.questionIds ?? [])];
    const answers = await this.questions.getAnswerKey(ids);
    const found = new Set(answers.map((a) => a.questionId));
    return {
      answers: answers.map((a) => ({ question_id: a.questionId, correct_option: a.correctOption })),
      missing_ids: ids.filter((id) => !found.has(id)),
    };
  }
}
