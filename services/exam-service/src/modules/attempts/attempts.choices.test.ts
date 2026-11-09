import 'reflect-metadata';
import {
  ConflictException,
  HttpException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { AnswerDto, AnswersDto, SubmitDto } from './dto/attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { AttemptsController } from './attempts.controller';
import scenarioData from '../../../../../tests/fixtures/group2-cases.json';
import {
  ATTEMPT_ID,
  EXAM_NOW,
  EXAM_USER,
  FOREIGN_QUESTION,
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
  option?: unknown;
  deadlineOffset?: number;
  dependency?: string;
  http?: number;
  answers?: string;
  mixed?: boolean;
  duplicate?: boolean;
  missing?: boolean;
  question?: string;
  record?: string;
  lock?: string;
  owner?: string;
  snapshotVersion?: number;
  status?: string;
  snapshot?: string;
  outcome?: string;
}
const cases: Record<'UT-008' | 'UT-009' | 'UT-010', Profile[]> = {
  'UT-008': scenarioData['UT-008'],
  'UT-009': scenarioData['UT-009'],
  'UT-010': scenarioData['UT-010'],
};

describe('Snapshot answer validation requirements', () => {
  let h: AttemptHarness;
  let controller: AttemptsController;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(EXAM_NOW);
    h = createAttemptHarness();
    controller = new AttemptsController(h.service);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });
  async function rejected(work: Promise<unknown>, status: number, message?: string) {
    const error: unknown = await work.catch((reason: unknown) => reason);
    if (error instanceof Error && !(error instanceof HttpException)) throw error;
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    if (message) expect((error as HttpException).getResponse()).toMatchObject({ message });
  }
  function noRemoteCalls() {
    expect(h.bank.getQuestionBundle).not.toHaveBeenCalled();
    expect(h.bank.getAnswerBundle).not.toHaveBeenCalled();
    expect(h.tests.record).not.toHaveBeenCalled();
    expect(h.scoring.full).not.toHaveBeenCalled();
  }
  // Same settings as configureHttp in src/main.ts. The real DTO decorators execute
  // without bootstrapping Nest or connecting any application module.
  const pipe = () =>
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });

  describe('UT-008 | accepts a choice present in the attempt snapshot', () => {
    it.each(cases['UT-008'])('$name', async (c) => {
      if (c.deadlineOffset !== undefined)
        h.attempt.deadlineAt = new Date(+EXAM_NOW + c.deadlineOffset);
      const before = structuredClone(h.attempt);
      const deadline = h.attempt.deadlineAt;
      if (c.dependency === 'draft-write')
        h.drafts.write.mockRejectedValueOnce(
          new ServiceUnavailableException('Draft storage unavailable'),
        );
      if (c.dependency === 'deadline-race')
        h.drafts.write.mockRejectedValueOnce(new ConflictException('Attempt deadline has passed'));
      if (c.dependency === 'draft-read')
        h.drafts.read.mockRejectedValueOnce(
          new ServiceUnavailableException('Draft storage unavailable'),
        );
      const answers: AnswerDto[] =
        c.answers === 'empty'
          ? []
          : c.answers === 'two'
            ? [
                { questionId: QUESTION_ID, selectedOption: 'B' },
                { questionId: SECOND_QUESTION, selectedOption: 'C' },
              ]
            : [{ questionId: QUESTION_ID, selectedOption: c.option as string | null }];
      if (c.entry === 'replace')
        await controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, { selectedOption: 'B' }, EXAM_USER);
      const work =
        c.entry === 'draft'
          ? controller.draft(ATTEMPT_ID, EXAM_USER, { answers })
          : controller.saveAnswer(
              ATTEMPT_ID,
              QUESTION_ID,
              { selectedOption: c.option as string | null },
              EXAM_USER,
            );

      if (c.http) await rejected(work, c.http);
      else {
        await expect(work).resolves.toEqual(
          c.entry === 'draft'
            ? { attemptId: ATTEMPT_ID, saved: answers.length, answeredAt: EXAM_NOW.toISOString() }
            : {
                attemptId: ATTEMPT_ID,
                questionId: QUESTION_ID,
                selectedOption: c.option,
                answeredAt: EXAM_NOW.toISOString(),
              },
        );
        expect(h.drafts.write).toHaveBeenLastCalledWith(ATTEMPT_ID, deadline, answers);
        expect(h.drafts.write).toHaveBeenCalledTimes(c.entry === 'replace' ? 2 : 1);
        expect(h.draft).toEqual(
          Object.fromEntries(
            answers.map((a) => [
              a.questionId,
              { selectedOption: a.selectedOption, answeredAt: EXAM_NOW.toISOString() },
            ]),
          ),
        );
      }
      if (c.deadlineOffset !== undefined && c.deadlineOffset <= 0 && !c.dependency) {
        expect(h.drafts.write).not.toHaveBeenCalled();
        expect(h.attempt.status).toBe('EXPIRED');
        expect(h.attempt.completedAt).toEqual(deadline);
        expect(h.attempt.submittedAt).toBeNull();
        expect(h.attempt.score).toBeNull();
        expect(h.tx.attemptAnswer.createMany).toHaveBeenCalledTimes(1);
        expect(h.attempt.answers).toHaveLength(25);
        for (const answer of h.attempt.answers)
          expect(answer).toMatchObject({ selectedOption: null, isCorrect: false });
        expect(h.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
        expect(h.tx.outboxEvent.create.mock.calls[0][0].data.payload).toMatchObject({
          eventType: 'PartPracticeSubmittedEvent.v2',
          payload: { mode: 'PART', correctCount: 0, totalQuestions: 25 },
        });
      } else {
        expectNoFinalWrites(h);
        expect(h.attempt).toEqual(before);
        if (c.http) expect(h.draft).toEqual({});
        if (c.dependency === 'draft-read') expect(h.drafts.write).not.toHaveBeenCalled();
      }
      expect(h.attempt.deadlineAt).toEqual(deadline);
      expect(h.tx.$queryRaw.mock.calls[0]).toEqual([
        ['SELECT attempt_id FROM attempts WHERE attempt_id = ', ' FOR UPDATE'],
        ATTEMPT_ID,
      ]);
      noRemoteCalls();
    });
  });

  describe('UT-009 | rejects options absent from the snapshot or DTO enum', () => {
    it.each(cases['UT-009'])('$name', async (c) => {
      const before = structuredClone(h.attempt);
      const dto = c.missing ? {} : { selectedOption: c.option };
      let answers = [{ questionId: QUESTION_ID, selectedOption: c.option }] as AnswerDto[];
      if (c.mixed) answers = [{ questionId: SECOND_QUESTION, selectedOption: 'B' }, ...answers];
      if (c.duplicate) answers = [...answers, ...answers];
      const save = jest.spyOn(h.service, 'saveAnswer');
      const draft = jest.spyOn(h.service, 'saveDraft');
      const submit = jest.spyOn(h.service, 'submit');
      let work: Promise<unknown>;
      if (c.entry.startsWith('dto-') && c.entry !== 'dto-then-save') {
        const single = c.entry === 'dto-single';
        work = pipe()
          .transform(single ? dto : { answers }, {
            type: 'body',
            metatype: single ? SaveAnswerDto : c.entry === 'dto-draft' ? AnswersDto : SubmitDto,
          })
          .then<unknown>((valid) =>
            single
              ? controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, valid, EXAM_USER)
              : c.entry === 'dto-draft'
                ? controller.draft(ATTEMPT_ID, EXAM_USER, valid)
                : controller.submit(ATTEMPT_ID, EXAM_USER, valid),
          );
      } else if (c.entry === 'dto-then-save') {
        const valid = await pipe().transform(dto, { type: 'body', metatype: SaveAnswerDto });
        expect(valid).toBeInstanceOf(SaveAnswerDto);
        expect(valid.selectedOption).toBe('D');
        work = controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, valid, EXAM_USER);
      } else
        work =
          c.entry === 'draft'
            ? controller.draft(ATTEMPT_ID, EXAM_USER, { answers })
            : controller.saveAnswer(ATTEMPT_ID, QUESTION_ID, dto as SaveAnswerDto, EXAM_USER);
      await rejected(
        work,
        400,
        c.entry.startsWith('dto-') && c.entry !== 'dto-then-save'
          ? undefined
          : c.duplicate
            ? 'Duplicate question in answers'
            : 'Invalid selected option for question',
      );
      if (c.entry.startsWith('dto-') && c.entry !== 'dto-then-save') {
        expect(save).not.toHaveBeenCalled();
        expect(draft).not.toHaveBeenCalled();
        expect(submit).not.toHaveBeenCalled();
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
      }
      expect(h.drafts.write).not.toHaveBeenCalled();
      expect(h.draft).toEqual({});
      expect(h.attempt).toEqual(before);
      expectNoFinalWrites(h);
      noRemoteCalls();
    });
  });

  describe('UT-010 | rejects questions outside the attempt snapshot', () => {
    it.each(cases['UT-010'])('$name', async (c) => {
      if (c.record === 'missing') h.tx.attempt.findUnique.mockResolvedValue(null);
      if (c.lock === 'missing') h.tx.$queryRaw.mockResolvedValue([]);
      if (c.owner === 'foreign') h.attempt.userId = 'another-user';
      if (c.snapshotVersion !== undefined) h.attempt.snapshotVersion = c.snapshotVersion;
      if (c.status) h.attempt.status = c.status as typeof h.attempt.status;
      if (c.snapshot === 'empty') h.attempt.questionSnapshots = [];
      const before = structuredClone({ attempt: h.attempt, other: h.otherSnapshot });
      const questionId =
        c.question === 'empty' ? '' : c.question === 'foreign' ? FOREIGN_QUESTION : QUESTION_ID;
      if (c.question === 'foreign') {
        expect(h.otherSnapshot.some((q) => q.questionId === questionId)).toBe(true);
        expect(h.attempt.questionSnapshots.some((q) => q.questionId === questionId)).toBe(false);
      }
      const answers = [
        ...(c.mixed ? [{ questionId: QUESTION_ID, selectedOption: 'B' }] : []),
        { questionId, selectedOption: 'B' },
      ];
      const work =
        c.entry === 'result'
          ? h.service.getResult(ATTEMPT_ID, EXAM_USER)
          : c.entry === 'submit-default'
            ? h.service.submit(ATTEMPT_ID, EXAM_USER)
            : c.entry === 'submit'
              ? controller.submit(ATTEMPT_ID, EXAM_USER, { answers })
              : c.entry === 'draft'
                ? controller.draft(ATTEMPT_ID, EXAM_USER, { answers })
                : controller.saveAnswer(ATTEMPT_ID, questionId, { selectedOption: 'B' }, EXAM_USER);
      const message =
        c.http === 404
          ? 'Attempt not found'
          : c.http === 403
            ? 'Attempt does not belong to user'
            : c.snapshotVersion === 0
              ? 'Legacy attempts are read-only'
              : c.status
                ? 'Attempt is already complete'
                : 'Question does not belong to attempt snapshot';
      if (c.outcome)
        await expect(work).resolves.toMatchObject({ attemptId: ATTEMPT_ID, status: 'SUBMITTED' });
      else await rejected(work, c.http ?? 400, message);
      expect(h.drafts.write).not.toHaveBeenCalled();
      expect(h.draft).toEqual({});
      if (c.outcome === 'finalized') {
        expect(h.attempt.status).toBe('SUBMITTED');
        expect(h.attempt.completedAt).toEqual(EXAM_NOW);
        expect(h.attempt.correctCount).toBe(0);
        expect(h.attempt.answers).toHaveLength(25);
        for (const answer of h.attempt.answers)
          expect(answer).toMatchObject({ selectedOption: null, isCorrect: false });
        expect(h.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
        expect(h.attempt.questionSnapshots).toEqual(before.attempt.questionSnapshots);
        expect(h.otherSnapshot).toEqual(before.other);
      } else {
        expectNoFinalWrites(h);
        expect({ attempt: h.attempt, other: h.otherSnapshot }).toEqual(before);
      }
      if ((c.entry === 'submit' && !c.outcome) || c.entry === 'submit-default')
        expect(h.drafts.read).toHaveBeenCalledWith(ATTEMPT_ID);
      else expect(h.drafts.read).not.toHaveBeenCalled();
      noRemoteCalls();
    });
  });
});
