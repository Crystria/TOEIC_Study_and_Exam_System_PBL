import type { AttemptRecord } from '../../src/modules/attempts/attempt-view';
import type { DraftAnswer } from '../../src/modules/attempts/draft.store';
import { ATTEMPT_ID, EXAM_NOW, EXAM_USER } from './attempt-harness';

export const VIEW_DEADLINE = new Date(+EXAM_NOW + 60000);
export const VIEW_BASE = 'https://media.example.test/toeic';
export const VIEW_KEY = 'fixture/audio space/#câu?.mp3';
export const VIEW_URL = 'https://media.example.test/toeic/fixture/audio%20space/%23c%C3%A2u%3F.mp3';
export const VIEW_TOTALS = [6, 25, 39, 30, 30, 16, 54];

/** Pure persisted-record fixture. No service is constructed, no finalize or I/O.
 * Part sizes/group positions follow the shared submission fixture. PART retains
 * complete Parts 3 and 5 so both grouped listening and standalone reading exist.
 */
export function createViewFixture(mode: 'FULL' | 'PART', status: AttemptRecord['status']) {
  const final = status !== 'IN_PROGRESS';
  const completedAt = final ? (status === 'EXPIRED' ? VIEW_DEADLINE : EXAM_NOW) : null;
  const testId = '64000000-0000-4000-8000-000000000001';
  const record: AttemptRecord = {
    id: ATTEMPT_ID,
    testId,
    userId: EXAM_USER,
    mode,
    status,
    snapshotVersion: 1,
    durationSeconds: mode === 'FULL' ? 7200 : 300,
    startedAt: new Date(+VIEW_DEADLINE - (mode === 'FULL' ? 7200000 : 300000)),
    deadlineAt: new Date(VIEW_DEADLINE),
    completedAt,
    submittedAt: status === 'SUBMITTED' ? EXAM_NOW : null,
    totalQuestions: mode === 'FULL' ? 200 : 69,
    correctCount: final ? (mode === 'FULL' ? 3 : 2) : null,
    accuracy: final ? (mode === 'FULL' ? 3 / 200 : 2 / 69) : null,
    score: final && mode === 'FULL' ? 10 : null,
    scoreListening: final && mode === 'FULL' ? 5 : null,
    scoreReading: final && mode === 'FULL' ? 5 : null,
    scoring:
      final && mode === 'FULL'
        ? { method: 'LOOKUP', tableVersion: '2026.10-sample', official: false }
        : null,
    test: {
      id: testId,
      title: 'View fixture',
      durationSeconds: 7200,
      deletedAt: null,
      createdBy: null,
      createdAt: EXAM_NOW,
      updatedAt: EXAM_NOW,
    },
    parts: [],
    groupSnapshots: [],
    questionSnapshots: [],
    answers: [],
  };
  let ordinal = 0;
  for (let part = 1; part <= 7; part++) {
    for (let index = 0; index < VIEW_TOTALS[part - 1]; index++) {
      ordinal++;
      if (mode === 'PART' && ![3, 5].includes(part)) continue;
      const grouped = [3, 4, 6, 7].includes(part);
      const groupSize = part === 6 ? 4 : 3;
      if (grouped && index % groupSize === 0) {
        const groupIndex = record.groupSnapshots.length;
        record.groupSnapshots.push({
          id: `66000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          groupId: `67000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          attemptId: ATTEMPT_ID,
          part,
          orderNo: groupIndex + 1,
          type: 'QUESTION_GROUP',
          instruction: 'Read or listen and answer.',
          audioKey: part <= 4 ? VIEW_KEY : null,
          transcript: part <= 4 ? `SECRET-GROUP-${ordinal}` : null,
          passageText:
            part === 6 ? 'Slots [[1]] [[2]] [[3]] [[4]]' : part === 7 ? 'Reading passage' : null,
          assets:
            groupIndex === 1
              ? null
              : [
                  {
                    assetId: `69000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
                    kind: 'IMAGE',
                    storageKey: 'fixture/image #1.png',
                    content: null,
                    orderNo: 1,
                  },
                  {
                    assetId: `6a000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
                    kind: 'TEXT',
                    storageKey: null,
                    content: 'Allowed passage asset',
                    orderNo: 2,
                  },
                ],
          createdAt: EXAM_NOW,
        });
      }
      const questionId = `63000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`;
      record.questionSnapshots.push({
        id: `65000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
        attemptId: ATTEMPT_ID,
        questionId,
        groupSnapshotId: grouped ? record.groupSnapshots.at(-1)!.id : null,
        part,
        orderNo: ordinal,
        positionInGroup: grouped ? (index % groupSize) + 1 : null,
        type: 'SINGLE_CHOICE',
        questionText: `Allowed question ${ordinal}: explain the word transcript.`,
        correctOption: 'A',
        explanation: `SECRET-EXPLANATION-${ordinal}`,
        transcript: part <= 3 ? `SECRET-QUESTION-${ordinal}` : null,
        audioKey: part <= 2 ? VIEW_KEY : null,
        imageKey: part === 1 ? 'fixture/image #1.png' : null,
        options: (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((optionCode) => ({
          optionCode,
          optionText: `Choice ${optionCode}`,
        })),
        createdAt: EXAM_NOW,
      });
    }
    if (mode === 'PART' && ![3, 5].includes(part)) continue;
    const correctCount = final && [1, 3, 5].includes(part) ? 1 : 0;
    record.parts.push({
      attemptId: ATTEMPT_ID,
      part,
      orderNo: record.parts.length + 1,
      totalQuestions: VIEW_TOTALS[part - 1],
      correctCount,
      accuracy: correctCount / VIEW_TOTALS[part - 1],
    });
  }
  const first = mode === 'FULL' ? 1 : 32;
  const selections = new Map<number, string | null>([
    [first, 'A'],
    [first + 1, 'B'],
    [first + 2, null],
    [101, 'A'],
  ]);
  if (mode === 'FULL') selections.set(32, 'A');
  const drafts: Record<string, DraftAnswer> = {};
  for (const q of record.questionSnapshots) {
    const selectedOption = selections.get(q.orderNo) ?? null;
    if (selections.has(q.orderNo))
      drafts[q.questionId] = {
        selectedOption,
        answeredAt: new Date(+EXAM_NOW - 1000).toISOString(),
      };
    if (final)
      record.answers.push({
        id: `68000000-0000-4000-8000-${String(q.orderNo).padStart(12, '0')}`,
        attemptId: ATTEMPT_ID,
        attemptQuestionSnapshotId: q.id,
        questionId: q.questionId,
        selectedOption,
        isCorrect: selectedOption === 'A',
        answeredAt: selections.has(q.orderNo) ? new Date(+EXAM_NOW - 1000) : completedAt!,
      });
  }
  return { record, drafts };
}
