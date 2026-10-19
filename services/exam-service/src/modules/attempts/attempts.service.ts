import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessagingService, writeOutbox } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionBankClient } from '../../grpc/question-bank.client';
import { SaveAnswerDto } from './dto/save-answer.dto';

/**
 * NOTE: Công thức tính điểm TOEIC (quy đổi scaled score) CHƯA được chốt.
 * Xem ADR / docs/notes. Hiện tại triển khai đơn giản:
 *   totalCorrect = số câu đúng
 *   score        = totalCorrect (placeholder, quy đổi TOEIC TBD)
 */
@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionBank: QuestionBankClient,
    private readonly messaging: MessagingService,
  ) {}

  async start(testId: string, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    if (!test) {
      throw new NotFoundException('Test not found');
    }
    if (test.questions.length === 0) {
      throw new BadRequestException('Test has no questions');
    }

    // Tải nội dung câu hỏi từ Question Bank (không có answer key).
    const questionIds = test.questions.map((q) => q.questionId);
    const fetched = await this.questionBank.getQuestions(questionIds);
    const questionById = new Map(fetched.map((q) => [q.id, q]));

    const startedAt = new Date();
    const deadline = new Date(startedAt.getTime() + test.durationSeconds * 1000);
    // TODO: persist deadline / add background job để chuyển Attempt sang EXPIRED khi quá hạn.

    const attempt = await this.prisma.attempt.create({
      data: { testId, userId, startedAt, status: 'IN_PROGRESS' },
    });

    const questions = test.questions.map((tq) => {
      const q = questionById.get(tq.questionId);
      return {
        orderNo: tq.orderNo,
        part: tq.part,
        questionId: tq.questionId,
        type: q?.type ?? '',
        stem: q?.stem ?? '',
        mediaUrl: q?.media_url || null,
        options: (q?.options ?? []).map((o) => ({
          id: o.id,
          optionKey: o.option_key,
          content: o.content,
          mediaUrl: o.media_url || null,
        })),
      };
    });

    return {
      attemptId: attempt.id,
      testId: test.id,
      testType: test.type,
      startedAt,
      deadline,
      durationSeconds: test.durationSeconds,
      questions,
    };
  }

  async saveAnswer(
    attemptId: string,
    questionId: string,
    dto: SaveAnswerDto,
    userId: string,
  ) {
    const attempt = await this.requireOwnedAttempt(attemptId, userId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Attempt is not in progress');
    }

    // TODO: kiểm tra deadline (startedAt + test.durationSeconds) và tự động EXPIRED nếu quá hạn.
    const inStructure = await this.prisma.testQuestion.findFirst({
      where: { testId: attempt.testId, questionId },
      select: { questionId: true },
    });
    if (!inStructure) {
      throw new NotFoundException('Question does not belong to this test');
    }

    const answeredAt = new Date();
    const answer = await this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, selectedOption: dto.selectedOption, answeredAt },
      update: { selectedOption: dto.selectedOption, answeredAt },
    });

    // Chỉ trả selectedOption — KHÔNG bao giờ lộ isCorrect/answer key khi đang làm.
    return {
      attemptId,
      questionId,
      selectedOption: answer.selectedOption,
      answeredAt: answer.answeredAt,
    };
  }

  async submit(attemptId: string, userId: string) {
    const attempt = await this.requireOwnedAttempt(attemptId, userId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Attempt already submitted or expired');
    }

    const answers = await this.prisma.attemptAnswer.findMany({ where: { attemptId } });
    const questionIds = answers.map((a) => a.questionId);
    const answerKey = await this.questionBank.getAnswerKey(questionIds);
    const correctByQuestion = new Map(
      answerKey.map((a) => [a.question_id, a.correct_option]),
    );

    const graded = answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      isCorrect:
        Boolean(a.selectedOption) && correctByQuestion.get(a.questionId) === a.selectedOption,
    }));
    const totalCorrect = graded.filter((g) => g.isCorrect).length;

    // NOTE: quy đổi TOEIC scaled score TBD — tạm dùng score = totalCorrect.
    const score = totalCorrect;
    const submittedAt = new Date();
    const eventId = randomUUID();
    const occurredAt = Date.now();
    const eventPayload = {
      eventId,
      occurredAt,
      attemptId,
      userId,
      testId: attempt.testId,
      testType: attempt.test.type,
      score,
      totalCorrect,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.attempt.update({
        where: { id: attemptId },
        data: { status: 'SUBMITTED', submittedAt, score, totalCorrect },
      });

      for (const g of graded) {
        await tx.attemptAnswer.update({
          where: { id: g.id },
          data: { isCorrect: g.isCorrect },
        });
      }

      await writeOutbox(tx as never, {
        aggregateId: attemptId,
        eventType: 'TestSubmittedEvent',
        payload: eventPayload,
      });
    });

    await this.messaging.emit('test.submitted', attemptId, {
      eventId,
      eventType: 'TestSubmittedEvent',
      occurredAt,
      payload: eventPayload,
    });
    this.logger.log(`Attempt ${attemptId} submitted: ${totalCorrect} correct, score ${score}`);

    return {
      attemptId,
      testId: attempt.testId,
      status: 'SUBMITTED',
      submittedAt,
      totalCorrect,
      score,
      totalQuestions: answers.length,
    };
  }

  async getResult(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { test: true, answers: true },
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('Attempt does not belong to user');
    }

    const graded = attempt.status !== 'IN_PROGRESS';
    return {
      attemptId: attempt.id,
      testId: attempt.testId,
      testTitle: attempt.test.title,
      testType: attempt.test.type,
      status: attempt.status,
      score: attempt.score,
      totalCorrect: attempt.totalCorrect,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      answers: attempt.answers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        ...(graded ? { isCorrect: a.isCorrect } : {}),
      })),
    };
  }

  private async requireOwnedAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { test: true },
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.userId !== userId) {
      throw new ForbiddenException('Attempt does not belong to user');
    }
    return attempt;
  }
}
