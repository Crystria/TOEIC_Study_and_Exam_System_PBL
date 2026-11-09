import 'reflect-metadata';
import fs from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import scenarioData from '../../../../tests/fixtures/group4-cases.json';
import oracle from '../../../../tests/fixtures/group4-score-oracle.json';
import { partStats, PartStat, ScoringService, SCORE_DISCLAIMER } from './scoring.service';
import { loadEtsScoreTable, lookupEtsScore, validateEtsScoreTable } from './ets-score-table';
import { bundleErrors, fullStructureErrors } from '../modules/tests/test-rules';
import { QuestionBundle } from '../grpc/question-bank.client';
import {
  ATTEMPT_ID,
  EXAM_NOW,
  EXAM_USER,
  createAttemptHarness,
} from '../../test/helpers/attempt-harness';

interface Profile {
  name: string;
  category: string;
  kind: string;
  questions?: (string | number)[][];
  choices?: (string | null)[][];
  expected?: (number | string)[][] | number[];
  correctByPart?: number[];
  raw?: number[] | number | string;
  mutation?: string;
  error?: string;
  policy?: string;
  mode?: string;
}
// These exact profiles also drive the report adapter. The oracle is a fixed
// reviewed JSON snapshot of reference data, never the output of scoring code.
const cases: Record<string, Profile[]> = scenarioData;
const totals = [6, 25, 39, 30, 30, 16, 54];
const configStub = (values: Record<string, string>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;
const makeStats = (correct: number[]): PartStat[] =>
  correct.map((correctCount, i) => ({
    part: i + 1,
    skill: i < 4 ? 'LISTENING' : 'READING',
    totalQuestions: totals[i],
    correctCount,
    accuracy: correctCount / totals[i],
  }));
function splitRaw(listening: number, reading: number) {
  let l = listening,
    r = reading;
  return totals.map((total, i) => {
    const count = Math.min(total, i < 4 ? l : r);
    if (i < 4) l -= count;
    else r -= count;
    return count;
  });
}

/** Reuse Group 2/3 I/O harness, adapting only this instance to a real 7-Part shape.
 * DB callback writes are stubs; they do not prove isolation/rollback behavior.
 */
function sevenPartHarness(mode: 'FULL' | 'PART', correct: number[]) {
  const h = createAttemptHarness();
  const template = h.attempt.questionSnapshots[0];
  h.attempt.mode = mode;
  h.attempt.durationSeconds = 7200;
  h.attempt.totalQuestions = 200;
  h.attempt.questionSnapshots = [];
  h.attempt.groupSnapshots = [];
  h.attempt.parts = totals.map((totalQuestions, i) => ({
    ...h.attempt.parts[0],
    part: i + 1,
    orderNo: i + 1,
    totalQuestions,
  }));
  let index = 0;
  for (let part = 1; part <= 7; part++) {
    const size = part === 6 ? 4 : 3;
    for (let position = 0; position < totals[part - 1]; position++) {
      const grouped = [3, 4, 6, 7].includes(part);
      if (grouped && position % size === 0) {
        const groupId = `67000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
        h.attempt.groupSnapshots.push({
          id: groupId,
          groupId,
          attemptId: ATTEMPT_ID,
          part,
          orderNo: h.attempt.groupSnapshots.length + 1,
          type: 'QUESTION_GROUP',
          instruction: 'Read or listen and answer.',
          audioKey: part <= 4 ? 'fixture/group.mp3' : null,
          transcript: part <= 4 ? 'Group transcript' : null,
          passageText:
            part === 6 ? 'Slots [[1]] [[2]] [[3]] [[4]]' : part === 7 ? 'Reading passage' : null,
          assets: [],
          createdAt: EXAM_NOW,
        });
      }
      index++;
      const questionId = `63000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
      const correctOption = ['A', 'B', 'C', ...(part === 2 ? [] : ['D'])][
        position % (part === 2 ? 3 : 4)
      ];
      h.attempt.questionSnapshots.push({
        ...template,
        id: `65000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        questionId,
        part,
        orderNo: index,
        correctOption,
        groupSnapshotId: grouped ? h.attempt.groupSnapshots.at(-1)!.id : null,
        positionInGroup: grouped ? (position % size) + 1 : null,
        audioKey: part <= 2 ? 'fixture/question.mp3' : null,
        imageKey: part === 1 ? 'fixture/photo.jpg' : null,
        transcript: part <= 2 ? 'Question transcript' : null,
        options: (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((optionCode) => ({
          optionCode,
          optionText: `Choice ${optionCode}`,
        })),
      });
      if (position < correct[part - 1])
        h.draft[questionId] = {
          selectedOption: correctOption,
          answeredAt: new Date(+EXAM_NOW - 1000).toISOString(),
        };
    }
  }
  // The original harness deliberately supports one Part. Override only this
  // instance's DB stub so a write to Part 5 cannot silently overwrite Part 1.
  h.tx.attemptPart.update.mockImplementation(async ({ where, data }) => {
    const target = h.attempt.parts.find((p) => p.part === where.attemptId_part.part);
    if (!target) throw new Error('Unknown fixture Part');
    return Object.assign(target, data);
  });
  const items = h.attempt.questionSnapshots;
  const bundle: QuestionBundle = {
    missing_ids: [],
    questions: items.map((q) => ({
      id: q.questionId,
      part: q.part,
      type: q.type,
      stem: q.questionText,
      question_text: q.questionText,
      explanation: '',
      difficulty: 'MEDIUM',
      media_url: '',
      group_id: q.groupSnapshotId ?? '',
      position_in_group: q.positionInGroup ?? 0,
      transcript: q.transcript ?? '',
      audio_key: q.audioKey ?? '',
      image_key: q.imageKey ?? '',
      is_complete: true,
      revision: 'fixture-v1',
      options: (q.options as { optionCode: string; optionText: string }[]).map((o) => ({
        id: `${q.questionId}-${o.optionCode}`,
        option_key: o.optionCode,
        content: o.optionText,
        media_url: '',
      })),
    })),
    groups: h.attempt.groupSnapshots.map((g) => ({
      group_id: g.id,
      part: g.part,
      type: g.type,
      instruction: g.instruction ?? '',
      audio_key: g.audioKey ?? '',
      transcript: g.transcript ?? '',
      passage_text: g.passageText ?? '',
      order_no: g.orderNo,
      assets: [],
      question_ids: items.filter((q) => q.groupSnapshotId === g.id).map((q) => q.questionId),
    })),
  };
  expect(fullStructureErrors(items, 7200)).toEqual([]);
  expect(
    bundleErrors(items, bundle, {
      missing_ids: [],
      answers: items.map((q) => ({
        question_id: q.questionId,
        correct_option: q.correctOption,
        revision: 'fixture-v1',
      })),
    }),
  ).toEqual([]);
  return h;
}

describe('Group 4 real Part statistics and reference scoring', () => {
  let scoring: ScoringService;
  beforeEach(() => {
    jest.resetAllMocks();
    scoring = new ScoringService(configStub({ NODE_ENV: 'test', ETS_ALLOW_DEV_FALLBACK: 'false' }));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  describe('UT-016 | partStats counts and Listening Reading boundary', () => {
    it.each(cases['UT-016'])('$name', (c) => {
      const questions = c.questions!.map(([questionId, part, correctOption]) => ({
        questionId: String(questionId),
        part: Number(part),
        correctOption: String(correctOption),
      }));
      const choices = new Map(c.choices!.map(([id, choice]) => [id!, choice]));
      const before = structuredClone({ questions, choices });
      questions.forEach(Object.freeze);
      Object.freeze(questions);
      const expected = (c.expected as (string | number)[][]).map(
        ([part, skill, totalQuestions, correctCount, accuracy]) => ({
          part,
          skill,
          totalQuestions,
          correctCount,
          accuracy,
        }),
      );
      expect(partStats(questions, choices)).toEqual(expected);
      expect({ questions, choices }).toEqual(before);
    });
  });

  describe('UT-017 | Full conversion using pinned reference tables', () => {
    it.each(cases['UT-017'])('$name', async (c) => {
      if (c.kind === 'full') {
        const stats = makeStats(c.correctByPart!);
        const before = structuredClone(stats);
        const [scoreListening, scoreReading, totalScore] = c.expected as number[];
        const [correctListeningCount, correctReadingCount] = c.raw as number[];
        expect(scoring.full(stats)).toEqual({
          scoreListening,
          scoreReading,
          totalScore,
          correctListeningCount,
          correctReadingCount,
        });
        expect(stats).toEqual(before);
        expect(scoring.provenance()).toEqual({
          method: 'LOOKUP',
          tableVersion: '2026.10-sample',
          official: false,
        });
      } else if (c.kind === 'sweep') {
        for (const skill of ['listening', 'reading'] as const) {
          const table = loadEtsScoreTable(skill);
          expect(table).toMatchObject({
            version: oracle[skill].version,
            official: false,
            source: oracle[skill].source,
          });
          expect(table.table).toHaveLength(101);
          for (let raw = 0; raw <= 100; raw++)
            expect(lookupEtsScore(table, raw)).toBe(oracle[skill].table[raw]);
        }
        for (let raw = 0; raw <= 100; raw++) {
          expect(scoring.full(makeStats(splitRaw(raw, raw)))).toEqual({
            scoreListening: oracle.listening.table[raw],
            scoreReading: oracle.reading.table[raw],
            totalScore: oracle.listening.table[raw] + oracle.reading.table[raw],
            correctListeningCount: raw,
            correctReadingCount: raw,
          });
        }
      } else if (c.kind === 'invalid-raw') {
        const raw = Number(c.raw);
        for (const table of [scoring.listening, scoring.reading]) {
          expect(() => lookupEtsScore(table, raw)).toThrow(
            new Error(`Raw score must be an integer in 0-100: ${raw}`),
          );
        }
      } else if (c.kind === 'invalid-table') {
        let value: unknown = structuredClone(oracle.listening);
        const table = value as Record<string, unknown> & { table: number[] };
        switch (c.mutation) {
          case 'null':
            value = null;
            break;
          case 'number':
            value = 5;
            break;
          case 'version-type':
            delete table.version;
            break;
          case 'version-empty':
            table.version = '';
            break;
          case 'official':
            table.official = 'false';
            break;
          case 'source-type':
            delete table.source;
            break;
          case 'source-empty':
            table.source = '';
            break;
          case 'array':
            table.table = {} as number[];
            break;
          case 'length100':
            table.table.pop();
            break;
          case 'length102':
            table.table.push(495);
            break;
          case 'fraction':
            table.table[50] = 230.5;
            break;
          case 'below':
            table.table[0] = 0;
            break;
          case 'above':
            table.table[100] = 500;
            break;
          case 'step':
            table.table[0] = 7;
            break;
          case 'decrease':
            table.table[50] = 5;
            break;
          default:
            throw new Error(`Unmapped table mutation: ${c.mutation}`);
        }
        expect(() => validateEtsScoreTable(value, 'fixture')).toThrow(`fixture: ${c.error}`);
        expect(() => validateEtsScoreTable(value)).toThrow(`ETS table: ${c.error}`);
      } else if (c.kind === 'fallback') {
        const fault = new Error('Injected reference file read failure');
        jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
          throw fault;
        });
        const config = configStub({
          NODE_ENV: c.policy === 'production' ? 'production' : 'test',
          ETS_ALLOW_DEV_FALLBACK: c.policy === 'disabled' ? 'false' : 'true',
        });
        if (c.policy === 'development') {
          const fallback = new ScoringService(config);
          expect(fallback.listening.version).toBe('dev-formula');
          expect(fallback.reading.version).toBe('dev-formula');
          expect(fallback.listening.official).toBe(false);
          expect(fallback.listening.table).toHaveLength(101);
          expect(() => fallback.provenance()).toThrow(ServiceUnavailableException);
        } else expect(() => new ScoringService(config)).toThrow(fault);
      } else if (c.kind === 'provenance') {
        if (c.mutation === 'listening-dev')
          Object.assign(scoring.listening, { version: 'dev-formula' });
        if (c.mutation === 'reading-dev')
          Object.assign(scoring.reading, { version: 'dev-formula' });
        if (c.mutation === 'version-mismatch')
          Object.assign(scoring.reading, { version: 'different' });
        expect(() => scoring.provenance()).toThrow(
          new ServiceUnavailableException(
            'A versioned reference lookup table is required for Full events',
          ),
        );
      } else if (c.kind === 'finalize') {
        jest.useFakeTimers();
        jest.setSystemTime(EXAM_NOW);
        if (c.mode !== 'FULL' && c.mode !== 'PART')
          throw new Error(`Invalid fixture mode: ${c.mode}`);
        const h = sevenPartHarness(c.mode, c.correctByPart!);
        h.scoring.full.mockImplementation(scoring.full.bind(scoring));
        h.scoring.provenance.mockImplementation(scoring.provenance.bind(scoring));
        const result = await h.service.submit(ATTEMPT_ID, EXAM_USER);
        const expectedStats = makeStats(c.correctByPart!);
        expect(result).toMatchObject({
          status: 'SUBMITTED',
          mode: c.mode,
          totalQuestions: 200,
          correctCount: 120,
          accuracy: 0.6,
          partStats: expectedStats,
        });
        expect(h.tx.attemptPart.update).toHaveBeenCalledTimes(7);
        for (const p of expectedStats)
          expect(h.tx.attemptPart.update).toHaveBeenCalledWith({
            where: { attemptId_part: { attemptId: ATTEMPT_ID, part: p.part } },
            data: {
              correctCount: p.correctCount,
              totalQuestions: p.totalQuestions,
              accuracy: p.accuracy,
            },
          });
        expect(h.attempt.answers).toHaveLength(200);
        expect(h.attempt.answers.filter((a) => a.isCorrect)).toHaveLength(120);
        expect(h.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
        const event = h.tx.outboxEvent.create.mock.calls[0][0].data.payload;
        expect(() => validateEvent(event)).not.toThrow();
        expect(event.payload.partStats).toEqual(
          expectedStats.map((p) => ({
            part: p.part,
            correct: p.correctCount,
            total: p.totalQuestions,
          })),
        );
        if (c.mode === 'FULL') {
          expect(h.scoring.full).toHaveBeenCalledWith(expectedStats);
          expect(h.scoring.full).toHaveBeenCalledTimes(1);
          expect(h.scoring.provenance).toHaveBeenCalledTimes(1);
          expect(result).toMatchObject({
            score: 540,
            totalScore: 540,
            scoreListening: 230,
            scoreReading: 310,
            correctListeningCount: 50,
            correctReadingCount: 70,
            scoreDisclaimer: SCORE_DISCLAIMER,
          });
          expect(event).toMatchObject({
            eventType: 'TestSubmittedEvent.v2',
            payload: {
              scoreListening: 230,
              scoreReading: 310,
              totalScore: 540,
              correctListeningCount: 50,
              correctReadingCount: 70,
              scoring: { method: 'LOOKUP', tableVersion: '2026.10-sample', official: false },
            },
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
            payload: { mode: 'PART', parts: [1, 2, 3, 4, 5, 6, 7] },
          });
          for (const key of ['scoreListening', 'scoreReading', 'totalScore', 'scoring'])
            expect(event.payload).not.toHaveProperty(key);
        }
        expect(h.bank.getQuestionBundle).not.toHaveBeenCalled();
        expect(h.bank.getAnswerBundle).not.toHaveBeenCalled();
        expect(h.tests.record).not.toHaveBeenCalled();
        expect(h.drafts.write).not.toHaveBeenCalled();
      } else throw new Error(`Unmapped Group 4 profile: ${c.kind}`);
    });
  });
});
