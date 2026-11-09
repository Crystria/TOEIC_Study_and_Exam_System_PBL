import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import scenarioData from '../../../../../tests/fixtures/group5-cases.json';
import * as grading from '../../scoring/scoring.service';
import { AttemptsController } from './attempts.controller';
import { SubmitDto } from './dto/attempt.dto';
import { SnapshotOption } from './attempt-view';
import {
  ATTEMPT_ID,
  EXAM_NOW,
  EXAM_USER,
  AttemptHarness,
  createAttemptHarness,
  expectNoFinalWrites,
} from '../../../test/helpers/attempt-harness';
import { createSevenPartSubmissionHarness } from '../../../test/helpers/submission-harness';

interface Profile {
  name: string;
  mode: string;
  entry: string;
  body: string;
  category: string;
  expectedCorrect?: number;
  expectedCounts?: number[];
  emptyDraft?: boolean;
  readFailure?: boolean;
  clockOffset?: number;
  readCrossesDeadline?: boolean;
  expired?: boolean;
  status?: string;
}
// Report adapter validates the exact executed profiles, names and cardinalities.
const cases: Record<string, Profile[]> = scenarioData;
type Token = 'right' | 'wrong' | null;
type Result = Awaited<ReturnType<AttemptHarness['service']['submit']>>;

describe('Group 5 submit saved draft, deadline and idempotency', () => {
  let h: AttemptHarness;
  let grade: jest.SpyInstance;
  let finalized: jest.SpyInstance;
  const draftTime = new Date(+EXAM_NOW - 1000);
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(EXAM_NOW);
    grade = jest.spyOn(grading, 'partStats'); // Real implementation remains active.
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  function setup(c: Profile) {
    if (c.mode !== 'PART' && c.mode !== 'FULL') throw new Error('Invalid fixture mode');
    h =
      c.mode === 'FULL'
        ? createSevenPartSubmissionHarness('FULL', [0, 0, 0, 0, 0, 0, 0])
        : createAttemptHarness();
    // Supply a complete Part 2 snapshot too; no real media I/O is performed.
    if (c.mode === 'PART')
      for (const q of h.attempt.questionSnapshots) {
        q.audioKey = 'fixture/part2.mp3';
        q.transcript = 'Snapshot transcript';
      }
    const config = { get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'test' : 'false')) };
    const scoring = new grading.ScoringService(config as unknown as ConfigService);
    h.scoring.full.mockImplementation(scoring.full.bind(scoring));
    h.scoring.provenance.mockImplementation(scoring.provenance.bind(scoring));
    finalized = jest.spyOn(
      h.service as unknown as { finalize: (...args: unknown[]) => Promise<unknown> },
      'finalize',
    );
    if (!c.emptyDraft) {
      for (const [ordinal, token] of [
        [1, 'right'],
        [2, 'wrong'],
        [3, null],
      ] as const) {
        const q = h.attempt.questionSnapshots[ordinal - 1];
        h.draft[q.questionId] = {
          selectedOption: choice(ordinal, token),
          answeredAt: draftTime.toISOString(),
        };
      }
      if (c.mode === 'FULL') {
        const q = h.attempt.questionSnapshots[100];
        h.draft[q.questionId] = {
          selectedOption: choice(101, 'right'),
          answeredAt: draftTime.toISOString(),
        };
      }
    }
  }
  function choice(ordinal: number, token: Token) {
    if (token === null) return null;
    const q = h.attempt.questionSnapshots[ordinal - 1];
    return token === 'right' ? q.correctOption : q.correctOption === 'A' ? 'B' : 'A';
  }
  function bodyChoices(body: string): [number, Token][] {
    if (body === 'merge')
      return [
        [1, null],
        [2, 'right'],
        [4, 'right'],
      ];
    if (body === 'late')
      return [
        [1, 'wrong'],
        [2, 'right'],
        [3, 'right'],
        [4, 'right'],
      ];
    if (body === 'changed')
      return [
        [1, 'wrong'],
        [2, 'right'],
        [3, 'right'],
        [4, 'right'],
      ];
    return [];
  }
  async function dispatch(c: Profile) {
    if (c.body === 'omitted') return h.service.submit(ATTEMPT_ID, EXAM_USER);
    let dto: SubmitDto | undefined;
    if (c.body !== 'undefined') {
      const payload =
        c.body === 'empty-object'
          ? {}
          : {
              answers: bodyChoices(c.body).map(([ordinal, token]) => ({
                questionId: h.attempt.questionSnapshots[ordinal - 1].questionId,
                selectedOption: choice(ordinal, token),
              })),
            };
      // Late choices pass the real DTO pipe; deadline behavior is reached in the service.
      dto = await new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }).transform(payload, { type: 'body', metatype: SubmitDto });
    }
    return c.entry === 'controller'
      ? new AttemptsController(h.service).submit(ATTEMPT_ID, EXAM_USER, dto!)
      : h.service.submit(ATTEMPT_ID, EXAM_USER, dto);
  }
  function assertNoExternalIO() {
    expect(h.bank.getQuestionBundle).not.toHaveBeenCalled();
    expect(h.bank.getAnswerBundle).not.toHaveBeenCalled();
    expect(h.tests.record).not.toHaveBeenCalled();
    expect(h.drafts.write).not.toHaveBeenCalled();
  }
  function expectedSelections(c: Profile, ignored = false): Map<string, string | null> {
    const expected = new Map<string, string | null>();
    if (!c.emptyDraft) {
      for (const [ordinal, token] of [
        [1, 'right'],
        [2, 'wrong'],
        [3, null],
      ] as const)
        expected.set(h.attempt.questionSnapshots[ordinal - 1].questionId, choice(ordinal, token));
      if (c.mode === 'FULL')
        expected.set(h.attempt.questionSnapshots[100].questionId, choice(101, 'right'));
    }
    if (!ignored)
      for (const [ordinal, token] of bodyChoices(c.body))
        expected.set(h.attempt.questionSnapshots[ordinal - 1].questionId, choice(ordinal, token));
    return expected;
  }
  function verifyFinal(c: Profile, result: Result, completedAt: Date, expired: boolean) {
    const expected = expectedSelections(c, expired);
    const counts = c.expectedCounts!;
    const total = c.mode === 'FULL' ? 200 : 25;
    const correct = c.expectedCorrect!;
    expect(result).toMatchObject({
      status: expired ? 'EXPIRED' : 'SUBMITTED',
      mode: c.mode,
      correctCount: correct,
      totalQuestions: total,
      accuracy: correct / total,
      completedAt,
      submittedAt: expired ? null : completedAt,
      deadlineAt: new Date(+EXAM_NOW + 60000),
      remainingSeconds: 0,
    });
    expect(grade).toHaveBeenCalledTimes(1);
    expect(grade.mock.calls[0][0]).toEqual(h.attempt.questionSnapshots);
    expect(grade.mock.calls[0][1]).toEqual(expected);
    expect(finalized).toHaveBeenCalledTimes(1);
    const totals = c.mode === 'FULL' ? [6, 25, 39, 30, 30, 16, 54] : [25];
    const parts = c.mode === 'FULL' ? [1, 2, 3, 4, 5, 6, 7] : [2];
    const stats = parts.map((part, i) => ({
      part,
      skill: part <= 4 ? 'LISTENING' : 'READING',
      correctCount: counts[i],
      totalQuestions: totals[i],
      accuracy: counts[i] / totals[i],
    }));
    expect(result.partStats).toEqual(stats);
    expect(h.tx.attemptPart.update).toHaveBeenCalledTimes(parts.length);
    for (const p of stats)
      expect(h.tx.attemptPart.update).toHaveBeenCalledWith({
        where: { attemptId_part: { attemptId: ATTEMPT_ID, part: p.part } },
        data: {
          correctCount: p.correctCount,
          totalQuestions: p.totalQuestions,
          accuracy: p.accuracy,
        },
      });
    expect(h.tx.attempt.update).toHaveBeenCalledTimes(1);
    expect(h.tx.attemptAnswer.createMany).toHaveBeenCalledTimes(1);
    const submitted = expired
      ? []
      : bodyChoices(c.body).map(([ordinal]) => h.attempt.questionSnapshots[ordinal - 1].questionId);
    const expectedRows = h.attempt.questionSnapshots.map((q) => ({
      questionId: q.questionId,
      selectedOption: expected.get(q.questionId) ?? null,
      isCorrect: expected.get(q.questionId) === q.correctOption,
      answeredAt:
        !submitted.includes(q.questionId) && h.draft[q.questionId] ? draftTime : completedAt,
    }));
    expect(h.attempt.answers).toHaveLength(total);
    expect(
      h.attempt.answers.map(({ questionId, selectedOption, isCorrect, answeredAt }) => ({
        questionId,
        selectedOption,
        isCorrect,
        answeredAt,
      })),
    ).toEqual(expectedRows);
    expect(result.answers).toEqual(expectedRows);
    expect(h.attempt.answers.filter((a) => a.isCorrect)).toHaveLength(correct);
    expect(h.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    const event = h.tx.outboxEvent.create.mock.calls[0][0].data.payload;
    expect(() => validateEvent(event)).not.toThrow();
    expect(event).toMatchObject({
      version: 2,
      producer: 'exam-service',
      payload: {
        mode: c.mode,
        attemptId: ATTEMPT_ID,
        userId: EXAM_USER,
        completedAt: completedAt.toISOString(),
        correctCount: correct,
        totalQuestions: total,
        partStats: stats.map((p) => ({
          part: p.part,
          correct: p.correctCount,
          total: p.totalQuestions,
        })),
      },
    });
    if (c.mode === 'FULL') {
      expect(h.scoring.full).toHaveBeenCalledTimes(1);
      expect(h.scoring.full).toHaveBeenCalledWith(stats);
      expect(h.scoring.provenance).toHaveBeenCalledTimes(1);
      // Raw counts are 0..3 in these submit fixtures; both pinned tables map to 5.
      expect(result).toMatchObject({
        score: 10,
        totalScore: 10,
        scoreListening: 5,
        scoreReading: 5,
        correctListeningCount: counts.slice(0, 4).reduce((n, v) => n + v, 0),
        correctReadingCount: counts.slice(4).reduce((n, v) => n + v, 0),
        scoring: { method: 'LOOKUP', tableVersion: '2026.10-sample', official: false },
      });
      expect(event).toMatchObject({
        eventType: 'TestSubmittedEvent.v2',
        payload: { scoreListening: 5, scoreReading: 5, totalScore: 10 },
      });
    } else {
      expect(h.scoring.full).not.toHaveBeenCalled();
      expect(h.scoring.provenance).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        score: null,
        totalScore: null,
        scoreListening: null,
        scoreReading: null,
      });
      expect(event).toMatchObject({
        eventType: 'PartPracticeSubmittedEvent.v2',
        payload: { parts: [2], accuracy: correct / 25 },
      });
      for (const key of ['totalScore', 'scoreListening', 'scoreReading', 'scoring'])
        expect(event.payload).not.toHaveProperty(key);
    }
    expect(h.drafts.read).toHaveBeenCalledTimes(1);
    expect(h.drafts.read).toHaveBeenCalledWith(ATTEMPT_ID);
    expect(h.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 20000 });
    assertNoExternalIO();
  }

  describe('UT-018 | absent answers preserve saved draft and merge only submitted IDs', () => {
    it.each(cases['UT-018'])('$name', async (c) => {
      setup(c);
      const before = structuredClone(h.draft);
      if (c.readFailure) {
        const fault = new ServiceUnavailableException('Draft storage unavailable');
        h.drafts.read.mockRejectedValueOnce(fault);
        await expect(dispatch(c)).rejects.toBe(fault);
        expect(grade).not.toHaveBeenCalled();
        expect(h.scoring.full).not.toHaveBeenCalled();
        expect(h.scoring.provenance).not.toHaveBeenCalled();
        expectNoFinalWrites(h);
        expect(h.attempt.status).toBe('IN_PROGRESS');
        expect(h.drafts.read).toHaveBeenCalledTimes(1);
      } else verifyFinal(c, await dispatch(c), EXAM_NOW, false);
      expect(h.draft).toEqual(before);
      assertNoExternalIO();
    });
  });
  describe('UT-019 | deadline is checked again after awaiting draft', () => {
    it.each(cases['UT-019'])('$name', async (c) => {
      setup(c);
      const deadline = new Date(h.attempt.deadlineAt);
      jest.setSystemTime(new Date(+deadline + c.clockOffset!));
      if (c.readCrossesDeadline)
        h.drafts.read.mockImplementationOnce(async () => {
          jest.setSystemTime(deadline);
          return structuredClone(h.draft);
        });
      const before = structuredClone(h.draft);
      verifyFinal(
        c,
        await dispatch(c),
        c.expired ? deadline : new Date(+deadline - 1),
        !!c.expired,
      );
      expect(h.attempt.deadlineAt).toEqual(deadline);
      expect(h.draft).toEqual(before);
    });
  });
  describe('UT-020 | completed attempt returns the original result without grading or outbox writes', () => {
    it.each(cases['UT-020'])('$name', async (c) => {
      setup(c);
      const expired = c.status === 'EXPIRED';
      if (expired) jest.setSystemTime(h.attempt.deadlineAt);
      const firstProfile = { ...c, body: 'omitted', entry: 'service' };
      const first = await dispatch(firstProfile);
      verifyFinal(firstProfile, first, expired ? h.attempt.deadlineAt : EXAM_NOW, expired);
      const persisted = structuredClone(h.attempt);
      const draft = structuredClone(h.draft);
      const outbox = structuredClone(h.tx.outboxEvent.create.mock.calls[0][0]);
      // Ignore only dynamic serverTime; persisted fields and the complete business
      // result must be identical even when the wall clock advances.
      const { serverTime: firstTime, ...originalResult } = first;
      jest.clearAllMocks();
      jest.setSystemTime(new Date(+EXAM_NOW + 120000));
      const repeated = await dispatch(c);
      const { serverTime: repeatedTime, ...repeatedResult } = repeated;
      expect(repeatedTime).not.toEqual(firstTime);
      expect(repeatedResult).toEqual(originalResult);
      expect(h.attempt).toEqual(persisted);
      expect(h.draft).toEqual(draft);
      expect(grade).not.toHaveBeenCalled();
      expect(finalized).not.toHaveBeenCalled();
      expect(h.scoring.full).not.toHaveBeenCalled();
      expect(h.scoring.provenance).not.toHaveBeenCalled();
      expect(h.drafts.read).not.toHaveBeenCalled();
      expectNoFinalWrites(h);
      expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(h.tx.attempt.findUnique).toHaveBeenCalledTimes(1);
      expect(outbox.data.payload.eventId).toBe(outbox.data.id);
      expect(() => validateEvent(outbox.data.payload)).not.toThrow();
      assertNoExternalIO();
    });
  });
});
