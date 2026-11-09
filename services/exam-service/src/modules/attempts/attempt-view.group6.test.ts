import scenarioData from '../../../../../tests/fixtures/group6-cases.json';
import { attemptView, AttemptRecord } from './attempt-view';
import { EXAM_NOW } from '../../../test/helpers/attempt-harness';
import {
  createViewFixture,
  VIEW_BASE,
  VIEW_DEADLINE,
  VIEW_KEY,
  VIEW_URL,
} from '../../../test/helpers/attempt-view-fixture';

interface Profile {
  name: string;
  category: string;
  mode: string;
  status: string;
  kind: string;
  drafts?: string;
  trailingSlash?: boolean;
  offset?: number;
  expectedRemaining?: number;
  offsets?: number[];
  expectedSequence?: number[];
}
const cases: Record<string, Profile[]> = scenarioData;
const fullOnly = [
  'partDetails',
  'scoreDisclaimer',
  'scoring',
  'correctListeningCount',
  'correctReadingCount',
];
const scoreFields = ['score', 'totalScore', 'scoreListening', 'scoreReading'];
type View = ReturnType<typeof attemptView>;
function fixture(c: Profile) {
  if (c.mode !== 'FULL' && c.mode !== 'PART') throw new Error('Unsupported mode');
  if (!['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'].includes(c.status))
    throw new Error('Unsupported status');
  return createViewFixture(c.mode, c.status as AttemptRecord['status']);
}
// Independent literal oracle for totals, skill boundary and result counts.
function expectedStats(mode: string, final: boolean) {
  const rows: [number, string, number, number][] =
    mode === 'FULL'
      ? [
          [1, 'LISTENING', 6, 1],
          [2, 'LISTENING', 25, 0],
          [3, 'LISTENING', 39, 1],
          [4, 'LISTENING', 30, 0],
          [5, 'READING', 30, 1],
          [6, 'READING', 16, 0],
          [7, 'READING', 54, 0],
        ]
      : [
          [3, 'LISTENING', 39, 1],
          [5, 'READING', 30, 1],
        ];
  return rows.map(([part, skill, totalQuestions, correctCount]) => ({
    part,
    skill,
    totalQuestions,
    correctCount: final ? correctCount : null,
    accuracy: final ? correctCount / totalQuestions : null,
  }));
}

describe('Group 6 attempt presentation and server deadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(EXAM_NOW);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('UT-021 | ongoing view hides question group and grading secrets', () => {
    it.each(cases['UT-021'])('$name', (c) => {
      const { record, drafts } = fixture(c);
      const supplied = c.drafts === 'populated' ? drafts : {};
      const before = structuredClone({ record, supplied });
      const view =
        c.drafts === 'default'
          ? attemptView(record, VIEW_BASE)
          : attemptView(record, VIEW_BASE, supplied);
      expect(view).toMatchObject({
        status: 'IN_PROGRESS',
        mode: c.mode,
        readOnly: false,
        submittedAt: null,
        completedAt: null,
        correctCount: null,
        accuracy: null,
        totalQuestions: c.mode === 'FULL' ? 200 : 69,
      });
      for (const field of scoreFields) {
        expect(view).toHaveProperty(field, null);
      }
      for (const field of fullOnly) expect(view).not.toHaveProperty(field);
      expect(view.partStats).toEqual(expectedStats(c.mode, false));
      expect(view.answers).toEqual(
        Object.entries(supplied).map(([questionId, answer]) => ({ questionId, ...answer })),
      );
      for (const answer of view.answers)
        expect(Object.keys(answer).sort()).toEqual(['answeredAt', 'questionId', 'selectedOption']);
      if (c.drafts === 'populated') {
        expect(view.answers.some((a) => a.selectedOption === 'A')).toBe(true);
        expect(view.answers.some((a) => a.selectedOption === 'B')).toBe(true);
        expect(view.answers.some((a) => a.selectedOption === null)).toBe(true);
        expect(
          view.answers.some((a) => a.questionId === record.questionSnapshots[3].questionId),
        ).toBe(false);
      }
      expect(record.questionSnapshots.some((q) => q.explanation?.startsWith('SECRET-'))).toBe(true);
      expect(record.groupSnapshots.some((g) => g.transcript?.startsWith('SECRET-'))).toBe(true);
      expect(record.questionSnapshots.some((q) => q.transcript?.startsWith('SECRET-'))).toBe(true);
      for (const [index, q] of view.questions.entries()) {
        for (const key of ['correctOption', 'explanation', 'transcript', 'isCorrect'])
          expect(q).not.toHaveProperty(key);
        expect(q).toMatchObject({
          questionText: record.questionSnapshots[index].questionText,
          options: record.questionSnapshots[index].options,
        });
        expect(q.audioUrl).toBe(q.audioKey ? VIEW_URL : null);
        expect(q.imageUrl).toBe(q.imageKey ? VIEW_BASE + '/fixture/image%20%231.png' : null);
      }
      for (const [index, g] of view.groups.entries()) {
        for (const key of ['transcript', 'correctOption', 'explanation', 'isCorrect'])
          expect(g).not.toHaveProperty(key);
        expect(g).toMatchObject({
          passageText: record.groupSnapshots[index].passageText,
          instruction: 'Read or listen and answer.',
        });
        expect(g.audioUrl).toBe(g.audioKey ? VIEW_URL : null);
        const assets = record.groupSnapshots[index].assets as
          null | { storageKey: string | null; [key: string]: unknown }[];
        expect(g.assets).toEqual(
          (assets ?? []).map((asset) => ({
            ...asset,
            publicUrl: asset.storageKey ? VIEW_BASE + '/fixture/image%20%231.png' : null,
          })),
        );
      }
      // Exact private sentinels, not broad words such as "transcript" in learning text.
      const serialized = JSON.stringify(view);
      for (const q of record.questionSnapshots) {
        expect(serialized).not.toContain(q.explanation!);
        if (q.transcript) expect(serialized).not.toContain(q.transcript);
      }
      for (const g of record.groupSnapshots)
        if (g.transcript) expect(serialized).not.toContain(g.transcript);
      expect({ record, supplied }).toEqual(before);
    });
  });

  describe('UT-022 | final view maps persisted submission and media', () => {
    it.each(cases['UT-022'])('$name', (c) => {
      const { record, drafts } = fixture(c);
      if (c.status === 'EXPIRED') jest.setSystemTime(new Date(+VIEW_DEADLINE + 1));
      // Conflicting live drafts must not replace final persisted answers.
      for (const answer of Object.values(drafts)) answer.selectedOption = 'C';
      const before = structuredClone({ record, drafts });
      const view = attemptView(record, VIEW_BASE + (c.trailingSlash ? '/' : ''), drafts);
      const completedAt = c.status === 'EXPIRED' ? VIEW_DEADLINE : EXAM_NOW;
      expect(view).toMatchObject({
        attemptId: record.id,
        testId: record.testId,
        testTitle: 'View fixture',
        mode: c.mode,
        status: c.status,
        readOnly: false,
        startedAt: record.startedAt,
        deadlineAt: VIEW_DEADLINE,
        deadline: VIEW_DEADLINE,
        durationSeconds: c.mode === 'FULL' ? 7200 : 300,
        submittedAt: c.status === 'EXPIRED' ? null : EXAM_NOW,
        completedAt,
        remainingSeconds: 0,
        correctCount: c.mode === 'FULL' ? 3 : 2,
        totalQuestions: c.mode === 'FULL' ? 200 : 69,
        accuracy: c.mode === 'FULL' ? 3 / 200 : 2 / 69,
      });
      const stats = expectedStats(c.mode, true);
      expect(view.partStats).toEqual(stats);
      expect(view.parts).toEqual(c.mode === 'FULL' ? [1, 2, 3, 4, 5, 6, 7] : [3, 5]);
      if (c.mode === 'FULL') {
        expect(view).toMatchObject({
          score: 10,
          totalScore: 10,
          scoreListening: 5,
          scoreReading: 5,
          correctListeningCount: 2,
          correctReadingCount: 1,
          partDetails: stats,
          scoring: { method: 'LOOKUP', tableVersion: '2026.10-sample', official: false },
          scoreDisclaimer: 'Điểm quy đổi chỉ mang tính tham khảo, không phải điểm ETS chính thức.',
        });
      } else {
        for (const key of scoreFields) expect(view).toHaveProperty(key, null);
        for (const key of fullOnly) expect(view).not.toHaveProperty(key);
      }
      const correct = c.mode === 'FULL' ? [1, 32, 101] : [32, 101];
      const wrong = c.mode === 'FULL' ? 2 : 33;
      const explicitNull = c.mode === 'FULL' ? 3 : 34;
      expect(view.answers).toHaveLength(c.mode === 'FULL' ? 200 : 69);
      expect(view.questions).toHaveLength(view.answers.length);
      for (const [i, q] of record.questionSnapshots.entries()) {
        const selectedOption = correct.includes(q.orderNo) ? 'A' : q.orderNo === wrong ? 'B' : null;
        const answeredAt =
          correct.includes(q.orderNo) || [wrong, explicitNull].includes(q.orderNo)
            ? new Date(+EXAM_NOW - 1000)
            : completedAt;
        expect(view.answers[i]).toEqual({
          questionId: q.questionId,
          selectedOption,
          isCorrect: correct.includes(q.orderNo),
          answeredAt,
        });
        const grouped = [3, 4, 6, 7].includes(q.part);
        const groupSize = q.part === 6 ? 4 : 3;
        const start = [1, 7, 32, 71, 101, 131, 147][q.part - 1];
        const groupOrdinal = start + Math.floor((q.orderNo - start) / groupSize) * groupSize;
        expect(view.questions[i]).toEqual({
          questionId: q.questionId,
          part: q.part,
          orderNo: q.orderNo,
          type: 'SINGLE_CHOICE',
          positionInGroup: grouped ? ((q.orderNo - start) % groupSize) + 1 : null,
          groupId: grouped
            ? `67000000-0000-4000-8000-${String(groupOrdinal).padStart(12, '0')}`
            : null,
          questionText: `Allowed question ${q.orderNo}: explain the word transcript.`,
          options: (q.part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((optionCode) => ({
            optionCode,
            optionText: `Choice ${optionCode}`,
          })),
          audioKey: q.part <= 2 ? VIEW_KEY : null,
          imageKey: q.part === 1 ? 'fixture/image #1.png' : null,
          audioUrl: q.part <= 2 ? VIEW_URL : null,
          imageUrl: q.part === 1 ? VIEW_BASE + '/fixture/image%20%231.png' : null,
          correctOption: 'A',
          explanation: `SECRET-EXPLANATION-${q.orderNo}`,
          transcript: q.part <= 3 ? `SECRET-QUESTION-${q.orderNo}` : null,
        });
      }
      expect(view.groups).toHaveLength(record.groupSnapshots.length);
      for (const [index, g] of record.groupSnapshots.entries()) {
        const ordinal = Number(g.groupId.split('-').at(-1));
        expect(view.groups[index]).toEqual({
          groupId: `67000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          part: g.part,
          orderNo: index + 1,
          type: 'QUESTION_GROUP',
          instruction: 'Read or listen and answer.',
          audioKey: g.part <= 4 ? VIEW_KEY : null,
          audioUrl: g.part <= 4 ? VIEW_URL : null,
          passageText:
            g.part === 6
              ? 'Slots [[1]] [[2]] [[3]] [[4]]'
              : g.part === 7
                ? 'Reading passage'
                : null,
          transcript: g.part <= 4 ? `SECRET-GROUP-${ordinal}` : null,
          assets:
            index === 1
              ? []
              : [
                  {
                    assetId: `69000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
                    kind: 'IMAGE',
                    storageKey: 'fixture/image #1.png',
                    content: null,
                    orderNo: 1,
                    publicUrl: VIEW_BASE + '/fixture/image%20%231.png',
                  },
                  {
                    assetId: `6a000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
                    kind: 'TEXT',
                    storageKey: null,
                    content: 'Allowed passage asset',
                    orderNo: 2,
                    publicUrl: null,
                  },
                ],
        });
      }
      expect({ record, drafts }).toEqual(before);
    });
  });

  describe('UT-024 | remaining time uses fixed server deadline ceil and zero clamp', () => {
    it.each(cases['UT-024'])('$name', (c) => {
      const { record } = fixture(c);
      const before = structuredClone(record);
      if (c.kind === 'sequence') {
        jest.setSystemTime(new Date(+VIEW_DEADLINE + c.offsets![0]));
        c.offsets!.forEach((offset, index) => {
          if (index) jest.advanceTimersByTime(offset - c.offsets![index - 1]);
          const view = attemptView(record, VIEW_BASE);
          expect(view.serverTime).toEqual(new Date(+VIEW_DEADLINE + offset));
          expect(view.remainingSeconds).toBe(c.expectedSequence![index]);
          expect(view.deadlineAt).toEqual(VIEW_DEADLINE);
          expect(view.deadline).toEqual(VIEW_DEADLINE);
          // A pure view at D retains status; getResult/finalize is a different flow.
          expect(view.status).toBe('IN_PROGRESS');
        });
      } else {
        jest.setSystemTime(new Date(+VIEW_DEADLINE + c.offset!));
        const view = attemptView(record, VIEW_BASE);
        expect(view.remainingSeconds).toBe(c.expectedRemaining);
        expect(view.serverTime).toEqual(new Date(+VIEW_DEADLINE + c.offset!));
        expect(view.deadlineAt).toEqual(VIEW_DEADLINE);
        expect(view.deadline).toEqual(VIEW_DEADLINE);
        expect(view.status).toBe(c.status);
      }
      expect(record).toEqual(before);
    });
  });
});
