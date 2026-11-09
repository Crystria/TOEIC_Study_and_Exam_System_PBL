import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../src/generated/prisma';
import { PrismaService } from '../../src/prisma/prisma.service';
import { QuestionBankClient } from '../../src/grpc/question-bank.client';
import { TestsService } from '../../src/modules/tests/tests.service';
import { ScoringService } from '../../src/scoring/scoring.service';
import { AttemptRecord } from '../../src/modules/attempts/attempt-view';
import { AttemptsService } from '../../src/modules/attempts/attempts.service';
import { DraftAnswer, DraftStore } from '../../src/modules/attempts/draft.store';
import { AnswerDto } from '../../src/modules/attempts/dto/attempt.dto';

export const EXAM_NOW = new Date('2026-11-06T08:00:00.000Z');
export const ATTEMPT_ID = '61000000-0000-4000-8000-000000000001';
export const EXAM_USER = '62000000-0000-4000-8000-000000000001';
export const QUESTION_ID = '63000000-0000-4000-8000-000000000001';
export const SECOND_QUESTION = '63000000-0000-4000-8000-000000000002';
export const FOREIGN_QUESTION = '63000000-0000-4000-8000-000000000099';

/** Callback transactions and stateful draft/DB stubs; no DB, Redis or RPC connection.
 * This models successful writes, not database isolation/rollback guarantees.
 */
export function createAttemptHarness() {
  const testId = '64000000-0000-4000-8000-000000000001';
  const makeQuestion = (questionId: string, index: number) => ({
    id: `65000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    attemptId: ATTEMPT_ID,
    groupSnapshotId: null,
    questionId,
    part: 2,
    orderNo: index,
    questionText: 'Snapshot question',
    positionInGroup: null,
    type: 'SINGLE_CHOICE',
    transcript: null,
    audioKey: null,
    imageKey: null,
    explanation: 'private explanation',
    correctOption: 'A',
    createdAt: EXAM_NOW,
    options: ['A', 'B', 'C'].map((optionCode) => ({
      optionCode,
      optionText: `Choice ${optionCode}`,
    })),
  });
  const attempt: AttemptRecord = {
    id: ATTEMPT_ID,
    testId,
    userId: EXAM_USER,
    mode: 'PART',
    durationSeconds: 300,
    startedAt: new Date(+EXAM_NOW - 240000),
    deadlineAt: new Date(+EXAM_NOW + 60000),
    submittedAt: null,
    completedAt: null,
    status: 'IN_PROGRESS',
    snapshotVersion: 1,
    score: null,
    scoreListening: null,
    scoreReading: null,
    scoring: null,
    correctCount: null,
    totalQuestions: 25,
    accuracy: null,
    test: {
      id: testId,
      title: 'Unit fixture',
      durationSeconds: 7200,
      deletedAt: null,
      createdBy: null,
      createdAt: EXAM_NOW,
      updatedAt: EXAM_NOW,
    },
    answers: [],
    groupSnapshots: [],
    parts: [
      {
        attemptId: ATTEMPT_ID,
        part: 2,
        orderNo: 1,
        totalQuestions: 25,
        correctCount: 0,
        accuracy: 0,
      },
    ],
    questionSnapshots: Array.from({ length: 25 }, (_, i) =>
      makeQuestion(`63000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, i + 1),
    ),
  };
  // A second attempt's independent snapshot demonstrates cross-attempt membership.
  const otherSnapshot = [makeQuestion(FOREIGN_QUESTION, 26)];
  const draft: Record<string, DraftAnswer> = {};
  const drafts = {
    read: jest.fn(async () => structuredClone(draft)),
    write: jest.fn(async (_id: string, _deadline: Date, answers: AnswerDto[]) => {
      const answeredAt = new Date().toISOString();
      for (const answer of answers)
        draft[answer.questionId] = { selectedOption: answer.selectedOption, answeredAt };
      return answeredAt;
    }),
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ attempt_id: ATTEMPT_ID }]),
    attempt: {
      findUnique: jest.fn(async (): Promise<AttemptRecord | null> => attempt),
      update: jest.fn(async ({ data }) => Object.assign(attempt, data)),
    },
    attemptAnswer: {
      createMany: jest.fn(async ({ data }) => {
        attempt.answers = data.map((a: object, i: number) => ({ id: `answer-${i}`, ...a }));
        return { count: data.length };
      }),
    },
    attemptPart: { update: jest.fn(async ({ data }) => Object.assign(attempt.parts[0], data)) },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox' }) },
  };
  const prisma = {
    attempt: tx.attempt,
    $transaction: jest.fn((work: (db: Prisma.TransactionClient) => Promise<unknown>) =>
      work(tx as unknown as Prisma.TransactionClient),
    ),
  };
  const bank = { getQuestionBundle: jest.fn(), getAnswerBundle: jest.fn() };
  const tests = { record: jest.fn() };
  const scoring = { full: jest.fn(), provenance: jest.fn() };
  const config = { get: jest.fn() };
  const service = new AttemptsService(
    prisma as unknown as PrismaService,
    bank as unknown as QuestionBankClient,
    tests as unknown as TestsService,
    drafts as unknown as DraftStore,
    scoring as unknown as ScoringService,
    config as unknown as ConfigService,
  );
  return { service, prisma, tx, attempt, otherSnapshot, drafts, draft, bank, scoring, tests };
}
export type AttemptHarness = ReturnType<typeof createAttemptHarness>;

export function expectNoFinalWrites(h: AttemptHarness) {
  expect(h.tx.attempt.update).not.toHaveBeenCalled();
  expect(h.tx.attemptAnswer.createMany).not.toHaveBeenCalled();
  expect(h.tx.attemptPart.update).not.toHaveBeenCalled();
  expect(h.tx.outboxEvent.create).not.toHaveBeenCalled();
}
