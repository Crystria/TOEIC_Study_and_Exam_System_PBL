import { QuestionBundle } from '../../src/grpc/question-bank.client';
import { bundleErrors, fullStructureErrors } from '../../src/modules/tests/test-rules';
import { ATTEMPT_ID, EXAM_NOW, createAttemptHarness } from './attempt-harness';

// Validated snapshot factory reused from Group 4; no test suite is imported.
// I/O uses the existing shared harness; assertions use real structure validators.
const totals = [6, 25, 39, 30, 30, 16, 54];
export function createSevenPartSubmissionHarness(mode: 'FULL' | 'PART', correct: number[]) {
  const h = createAttemptHarness();
  const template = h.attempt.questionSnapshots[0];
  h.attempt.mode = mode;
  h.attempt.durationSeconds = 7200;
  h.attempt.startedAt = new Date(+h.attempt.deadlineAt - 7200000);
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
