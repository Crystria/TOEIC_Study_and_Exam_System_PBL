import 'reflect-metadata';
import {
  ConflictException,
  HttpException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { RedisService } from '@toeic/common';
import scenarioData from '../../../../../tests/fixtures/group3-cases.json';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import { AttemptsController } from './attempts.controller';
import { DraftStore } from './draft.store';
import { AnswerDto, AnswersDto, SubmitDto } from './dto/attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import * as scoringLogic from '../../scoring/scoring.service';
import {
  ATTEMPT_ID,
  EXAM_NOW,
  EXAM_USER,
  QUESTION_ID,
  SECOND_QUESTION,
  AttemptHarness,
  createAttemptHarness,
  expectNoFinalWrites,
} from '../../../test/helpers/attempt-harness';

interface Profile {
  name: string;
  category: string;
  entry: string;
  questions?: number[];
  unique?: boolean;
  storage?: string;
  clockOffset?: number;
  readCrossesDeadline?: boolean;
  readFailure?: boolean;
  status?: string;
  fault?: string;
}
// The report adapter reads these exact literal profiles and checks executed names/cardinality.
const cases: Record<string, Profile[]> = scenarioData;
const OTHER_USER = '62000000-0000-4000-8000-000000000002';

describe('Group 3 attempt ownership, mutation and draft failure', () => {
  let h: AttemptHarness;
  let controller: AttemptsController;
  beforeEach(() => {
    jest.resetAllMocks();
    h = createAttemptHarness();
    controller = new AttemptsController(h.service);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });
  const freeze = (time = EXAM_NOW) => {
    jest.useFakeTimers();
    jest.setSystemTime(time);
  };
  const pipe = () =>
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  function seedDraft() {
    h.draft[QUESTION_ID] = {
      selectedOption: 'A',
      answeredAt: new Date(+EXAM_NOW - 1000).toISOString(),
    };
    h.draft[SECOND_QUESTION] = {
      selectedOption: 'A',
      answeredAt: new Date(+EXAM_NOW - 2000).toISOString(),
    };
  }
  function dispatch(entry: string, user = EXAM_USER, selectedOption: string | null = 'B') {
    const answers = [{ questionId: QUESTION_ID, selectedOption }];
    if (entry === 'single')
      return controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, { selectedOption }, user);
    if (entry === 'draft') return controller.draft(ATTEMPT_ID, user, { answers });
    if (entry === 'submit') return controller.submit(ATTEMPT_ID, user, { answers });
    if (entry === 'result') return controller.result(ATTEMPT_ID, user);
    throw new Error(`Unknown entry: ${entry}`);
  }
  async function rejected(work: Promise<unknown>, status: number, message: string) {
    const reason: unknown = await work.catch((error: unknown) => error);
    expect(reason).toBeInstanceOf(HttpException);
    expect((reason as HttpException).getStatus()).toBe(status);
    expect((reason as HttpException).getResponse()).toMatchObject({ message });
    return reason as HttpException;
  }
  function noExternalCalls() {
    expect(h.bank.getQuestionBundle).not.toHaveBeenCalled();
    expect(h.bank.getAnswerBundle).not.toHaveBeenCalled();
    expect(h.tests.record).not.toHaveBeenCalled();
    expect(h.scoring.full).not.toHaveBeenCalled();
    expect(h.scoring.provenance).not.toHaveBeenCalled();
  }
  function verifyEvent(correct: number, completedAt: Date) {
    expect(h.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    const event = h.tx.outboxEvent.create.mock.calls[0][0].data.payload;
    expect(() => validateEvent(event)).not.toThrow();
    expect(event).toMatchObject({
      eventType: 'PartPracticeSubmittedEvent.v2',
      version: 2,
      producer: 'exam-service',
      payload: {
        attemptId: ATTEMPT_ID,
        userId: EXAM_USER,
        mode: 'PART',
        parts: [2],
        correctCount: correct,
        totalQuestions: 25,
        accuracy: correct / 25,
        completedAt: completedAt.toISOString(),
        partStats: [{ part: 2, correct, total: 25 }],
      },
    });
  }
  /** Real DraftStore boundary, stateful Redis stub only. Lua is NOT executed here. */
  function useRedisStore() {
    const client = {
      status: 'ready',
      hgetall: jest.fn(async () =>
        Object.fromEntries(Object.entries(h.draft).map(([id, a]) => [id, JSON.stringify(a)])),
      ),
      eval: jest.fn(
        async (
          _script: string,
          _keys: number,
          _key: string,
          _deadline: number,
          _ttl: number,
          ...args: string[]
        ) => {
          for (let i = 0; i < args.length; i += 2) h.draft[args[i]] = JSON.parse(args[i + 1]);
          return 1;
        },
      ),
    };
    const redis = { getClient: jest.fn(() => client) };
    const store = new DraftStore(redis as unknown as RedisService);
    h.drafts.write.mockImplementation(store.write.bind(store));
    h.drafts.read.mockImplementation(store.read.bind(store));
    return { client, redis };
  }

  describe('UT-011 | duplicate question IDs reject the whole batch', () => {
    it.each(cases['UT-011'])('$name', async (c) => {
      freeze();
      seedDraft();
      const grade = jest.spyOn(scoringLogic, 'partStats');
      const before = structuredClone({ attempt: h.attempt, draft: h.draft });
      const answers: AnswerDto[] = c.questions!.map((index, position) => ({
        questionId: index === 1 ? QUESTION_ID : SECOND_QUESTION,
        selectedOption: c.unique ? (position === 0 ? 'A' : null) : position % 2 === 0 ? 'B' : 'C',
      }));
      // DTO allows duplicate UUIDs. The real service must reject, not the input pipe.
      const dto = await pipe().transform(
        { answers },
        { type: 'body', metatype: c.entry === 'draft' ? AnswersDto : SubmitDto },
      );
      const work =
        c.entry === 'draft'
          ? controller.draft(ATTEMPT_ID, EXAM_USER, dto)
          : controller.submit(ATTEMPT_ID, EXAM_USER, dto);
      if (!c.unique) {
        await rejected(work, 400, 'Duplicate question in answers');
        expect(h.drafts.write).not.toHaveBeenCalled();
        expectNoFinalWrites(h);
        expect(grade).not.toHaveBeenCalled();
        expect({ attempt: h.attempt, draft: h.draft }).toEqual(before);
      } else if (c.entry === 'draft') {
        await expect(work).resolves.toEqual({
          attemptId: ATTEMPT_ID,
          saved: 2,
          answeredAt: EXAM_NOW.toISOString(),
        });
        expect(h.draft[QUESTION_ID].selectedOption).toBe('A');
        expect(h.draft[SECOND_QUESTION].selectedOption).toBeNull();
        expect(h.drafts.write).toHaveBeenCalledTimes(1);
        expectNoFinalWrites(h);
        expect(h.attempt).toEqual(before.attempt);
      } else {
        await expect(work).resolves.toMatchObject({ status: 'SUBMITTED', correctCount: 1 });
        expect(h.attempt.answers.find((a) => a.questionId === SECOND_QUESTION)).toMatchObject({
          selectedOption: null,
          isCorrect: false,
        });
        expect(h.drafts.write).not.toHaveBeenCalled();
        verifyEvent(1, EXAM_NOW);
      }
      expect(h.drafts.read).toHaveBeenCalledTimes(c.entry === 'submit' ? 1 : 0);
      noExternalCalls();
    });
  });

  describe('UT-012 | replace and clear the actual saved choice', () => {
    it.each(cases['UT-012'])('$name', async (c) => {
      freeze();
      seedDraft();
      const peer = structuredClone(h.draft[SECOND_QUESTION]);
      const redis = c.storage === 'redis' ? useRedisStore() : undefined;
      expect(h.draft[QUESTION_ID].selectedOption).toBe('A');
      for (const selectedOption of ['B', null]) {
        const payload =
          c.entry === 'single'
            ? { selectedOption }
            : { answers: [{ questionId: QUESTION_ID, selectedOption }] };
        const dto = await pipe().transform(payload, {
          type: 'body',
          metatype: c.entry === 'single' ? SaveAnswerDto : AnswersDto,
        });
        const result =
          c.entry === 'single'
            ? await controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, dto, EXAM_USER)
            : await controller.draft(ATTEMPT_ID, EXAM_USER, dto);
        expect(result).toEqual(
          c.entry === 'single'
            ? {
                attemptId: ATTEMPT_ID,
                questionId: QUESTION_ID,
                selectedOption,
                answeredAt: EXAM_NOW.toISOString(),
              }
            : { attemptId: ATTEMPT_ID, saved: 1, answeredAt: EXAM_NOW.toISOString() },
        );
        expect(h.draft[QUESTION_ID]).toEqual({
          selectedOption,
          answeredAt: EXAM_NOW.toISOString(),
        });
        expect(h.draft[SECOND_QUESTION]).toEqual(peer);
        const view = await controller.result(ATTEMPT_ID, EXAM_USER);
        expect(view.answers.find((a) => a.questionId === QUESTION_ID)?.selectedOption).toBe(
          selectedOption,
        );
        expect(view.questions[0]).not.toHaveProperty('correctOption');
        expect(view.questions[0]).not.toHaveProperty('explanation');
        expectNoFinalWrites(h);
      }
      expect(h.drafts.write).toHaveBeenCalledTimes(2);
      expect(h.drafts.write.mock.calls.map((call) => call[2][0].selectedOption)).toEqual([
        'B',
        null,
      ]);
      const result = await h.service.submit(ATTEMPT_ID, EXAM_USER);
      expect(result).toMatchObject({
        status: 'SUBMITTED',
        correctCount: 1,
        accuracy: 1 / 25,
        score: null,
      });
      expect(h.attempt.answers).toHaveLength(25);
      expect(h.attempt.answers.find((a) => a.questionId === QUESTION_ID)).toMatchObject({
        selectedOption: null,
        isCorrect: false,
      });
      expect(h.attempt.answers.find((a) => a.questionId === SECOND_QUESTION)).toMatchObject({
        selectedOption: 'A',
        isCorrect: true,
      });
      verifyEvent(1, EXAM_NOW);
      if (redis) {
        expect(redis.client.eval).toHaveBeenCalledTimes(2);
        const args = redis.client.eval.mock.calls[1];
        expect(args.slice(1, 5)).toEqual([
          1,
          `exam:draft:${ATTEMPT_ID}`,
          +h.attempt.deadlineAt,
          +h.attempt.deadlineAt + 3600000,
        ]);
        expect(JSON.parse(args[6])).toEqual({
          selectedOption: null,
          answeredAt: EXAM_NOW.toISOString(),
        });
      }
      noExternalCalls();
    });
  });

  describe('UT-013 | deadline minus one, exact and plus one millisecond', () => {
    it.each(cases['UT-013'])('$name', async (c) => {
      const deadline = new Date(+EXAM_NOW + 60000);
      freeze(new Date(+deadline + c.clockOffset!));
      seedDraft();
      const before = structuredClone({ attempt: h.attempt, draft: h.draft });
      if (c.readCrossesDeadline)
        h.drafts.read.mockImplementationOnce(async () => {
          jest.setSystemTime(deadline);
          return structuredClone(h.draft);
        });
      if (c.readFailure)
        h.drafts.read.mockRejectedValueOnce(
          new ServiceUnavailableException('Draft storage unavailable'),
        );
      const expired = c.clockOffset! >= 0 || !!c.readCrossesDeadline;
      const mutation = c.entry === 'single' || c.entry === 'draft';
      const work = dispatch(c.entry);
      if (c.readFailure) {
        await rejected(work, 503, 'Draft storage unavailable');
        expect({ attempt: h.attempt, draft: h.draft }).toEqual(before);
        expectNoFinalWrites(h);
      } else if (expired) {
        if (mutation) {
          const error = await rejected(work, 409, 'Attempt deadline has passed');
          expect(error.getResponse()).toMatchObject({
            details: { attemptId: ATTEMPT_ID, status: 'EXPIRED' },
          });
        } else await expect(work).resolves.toMatchObject({ status: 'EXPIRED', correctCount: 2 });
        expect(h.attempt).toMatchObject({
          status: 'EXPIRED',
          completedAt: deadline,
          submittedAt: null,
          correctCount: 2,
          totalQuestions: 25,
          accuracy: 2 / 25,
          score: null,
        });
        expect(h.attempt.answers).toHaveLength(25);
        expect(h.attempt.answers.find((a) => a.questionId === QUESTION_ID)).toMatchObject({
          selectedOption: 'A',
          isCorrect: true,
          answeredAt: new Date(before.draft[QUESTION_ID].answeredAt),
        });
        expect(h.tx.attemptAnswer.createMany).toHaveBeenCalledTimes(1);
        expect(h.tx.attempt.update).toHaveBeenCalledTimes(1);
        verifyEvent(2, deadline);
      } else if (mutation) {
        await expect(work).resolves.toMatchObject({
          attemptId: ATTEMPT_ID,
          answeredAt: new Date(+deadline - 1).toISOString(),
        });
        expect(h.draft[QUESTION_ID].selectedOption).toBe('B');
        expect(h.drafts.write).toHaveBeenCalledWith(ATTEMPT_ID, deadline, [
          { questionId: QUESTION_ID, selectedOption: 'B' },
        ]);
        expect(h.attempt).toEqual(before.attempt);
        expectNoFinalWrites(h);
      } else if (c.entry === 'submit') {
        await expect(work).resolves.toMatchObject({ status: 'SUBMITTED', correctCount: 1 });
        expect(h.attempt.answers.find((a) => a.questionId === QUESTION_ID)).toMatchObject({
          selectedOption: 'B',
          isCorrect: false,
        });
        verifyEvent(1, new Date(+deadline - 1));
      } else {
        const result = (await work) as Awaited<ReturnType<AttemptsController['result']>>;
        expect(result).toMatchObject({
          status: 'IN_PROGRESS',
          correctCount: null,
          remainingSeconds: 1,
        });
        expect(result.answers.find((a) => a.questionId === QUESTION_ID)?.selectedOption).toBe('A');
        expect(result.questions[0]).not.toHaveProperty('correctOption');
        expect(result.questions[0]).not.toHaveProperty('explanation');
        expectNoFinalWrites(h);
      }
      if (expired || !mutation) {
        expect(h.drafts.write).not.toHaveBeenCalled();
        expect(h.draft).toEqual(before.draft);
      }
      expect(h.attempt.deadlineAt).toEqual(deadline);
      noExternalCalls();
    });
  });

  describe('UT-014 | completed attempts cannot change draft or results', () => {
    it.each(cases['UT-014'])('$name', async (c) => {
      freeze();
      seedDraft();
      // Establish a valid completed result using real finalize and event validation.
      if (c.status === 'EXPIRED') jest.setSystemTime(h.attempt.deadlineAt);
      await h.service.submit(ATTEMPT_ID, EXAM_USER);
      expect(h.attempt.status).toBe(c.status);
      jest.clearAllMocks();
      const before = structuredClone({ attempt: h.attempt, draft: h.draft });
      const work = dispatch(c.entry, EXAM_USER, null);
      if (c.entry === 'single' || c.entry === 'draft')
        await rejected(work, 409, 'Attempt is already complete');
      else {
        const result = (await work) as Awaited<ReturnType<AttemptsController['result']>>;
        expect(result).toMatchObject({
          status: c.status,
          correctCount: 2,
          accuracy: 2 / 25,
          score: null,
          remainingSeconds: 0,
        });
        expect(result.answers.find((a) => a.questionId === QUESTION_ID)).toMatchObject({
          selectedOption: 'A',
          isCorrect: true,
        });
      }
      expect({ attempt: h.attempt, draft: h.draft }).toEqual(before);
      expect(h.drafts.read).not.toHaveBeenCalled();
      expect(h.drafts.write).not.toHaveBeenCalled();
      expectNoFinalWrites(h);
      noExternalCalls();
    });
  });

  describe('UT-015 | owner gate precedes draft, scoring and sensitive response', () => {
    it.each(cases['UT-015'])('$name', async (c) => {
      freeze();
      seedDraft();
      if (c.status === 'SUBMITTED') {
        await h.service.submit(ATTEMPT_ID, EXAM_USER);
        jest.clearAllMocks();
      }
      if (c.clockOffset !== undefined)
        jest.setSystemTime(new Date(+h.attempt.deadlineAt + c.clockOffset));
      const before = structuredClone({ attempt: h.attempt, draft: h.draft });
      const finalize = jest.spyOn(
        h.service as unknown as { finalize: (...args: unknown[]) => Promise<unknown> },
        'finalize',
      );
      const grade = jest.spyOn(scoringLogic, 'partStats');
      const acknowledged = jest.fn();
      const error = await rejected(
        dispatch(c.entry, OTHER_USER).then(acknowledged),
        403,
        'Attempt does not belong to user',
      );
      expect(acknowledged).not.toHaveBeenCalled();
      expect(finalize).not.toHaveBeenCalled();
      expect(grade).not.toHaveBeenCalled();
      // Internal record lookup is necessary to check owner; no record is returned to B.
      expect(h.tx.attempt.findUnique).toHaveBeenCalledTimes(1);
      expect(h.tx.attempt.findUnique.mock.calls[0][0]).toMatchObject({ where: { id: ATTEMPT_ID } });
      if (c.entry === 'result') expect(h.prisma.$transaction).not.toHaveBeenCalled();
      else expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
      for (const sensitive of [
        EXAM_USER,
        ATTEMPT_ID,
        QUESTION_ID,
        'private explanation',
        'correctOption',
        'selectedOption',
        'answers',
      ])
        expect(JSON.stringify(error.getResponse())).not.toContain(sensitive);
      expect(h.drafts.read).not.toHaveBeenCalled();
      expect(h.drafts.write).not.toHaveBeenCalled();
      expectNoFinalWrites(h);
      expect({ attempt: h.attempt, draft: h.draft }).toEqual(before);
      noExternalCalls();
    });
  });

  describe('UT-023 | failed draft writes never acknowledge success', () => {
    it.each(cases['UT-023'])('$name', async (c) => {
      freeze();
      seedDraft();
      const before = structuredClone({ attempt: h.attempt, draft: h.draft });
      const fault =
        c.fault === 'error'
          ? new Error('Injected draft write failure')
          : c.fault === 'conflict'
            ? new ConflictException('Attempt deadline has passed')
            : new ServiceUnavailableException('Draft storage unavailable');
      const usesRedis = c.fault!.startsWith('redis-');
      const redis = usesRedis ? useRedisStore() : undefined;
      if (!redis) h.drafts.write.mockRejectedValueOnce(fault);
      else if (c.fault === 'redis-not-ready') redis.client.status = 'connecting';
      else if (c.fault === 'redis-reject')
        redis.client.eval.mockRejectedValueOnce(new Error('Injected Redis write failure'));
      else if (c.fault === 'redis-timeout')
        redis.client.eval.mockImplementationOnce(() => new Promise<number>(() => {}));
      else if (c.fault === 'redis-deadline') redis.client.eval.mockResolvedValueOnce(0);
      const acknowledged = jest.fn();
      const failed = jest.fn((error: unknown) => error);
      // Attach a rejection handler before advancing timers to avoid unhandled rejections.
      const observed = dispatch(c.entry).then(acknowledged).catch(failed);
      if (c.fault === 'redis-timeout') {
        await jest.advanceTimersByTimeAsync(999);
        expect(acknowledged).not.toHaveBeenCalled();
        expect(failed).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
      }
      const error = await observed;
      expect(failed).toHaveBeenCalledTimes(1);
      if (!redis) expect(error).toBe(fault);
      if (c.fault !== 'error') {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          c.fault === 'conflict' || c.fault === 'redis-deadline' ? 409 : 503,
        );
      }
      expect(acknowledged).not.toHaveBeenCalled();
      expect(h.drafts.write).toHaveBeenCalledTimes(1);
      expect(h.drafts.write).toHaveBeenCalledWith(ATTEMPT_ID, before.attempt.deadlineAt, [
        { questionId: QUESTION_ID, selectedOption: 'B' },
      ]);
      expect(h.drafts.read).not.toHaveBeenCalled();
      expect({ attempt: h.attempt, draft: h.draft }).toEqual(before);
      expectNoFinalWrites(h);
      noExternalCalls();
      if (redis)
        expect(redis.client.eval).toHaveBeenCalledTimes(c.fault === 'redis-not-ready' ? 0 : 1);
      expect(jest.getTimerCount()).toBe(0);
      // State/side effects of stubs only; this does not prove DB rollback or Redis Lua concurrency.
    });
  });
});
