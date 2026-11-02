import assert from 'node:assert/strict';
import test from 'node:test';
import { demoExamTests } from '../src/lib/exams/mock-data';
import { buildDemoQuestions, loadDemoQuestions } from '../src/lib/exams/question-fixtures';
import {
  createLocalSession,
  paragraphIds,
  remainingSeconds,
  restoreLocalSession,
  updateLocalSession,
} from '../src/lib/exams/session';
import { EXAM_CONTENT_VERSION } from '../src/lib/exams/session-types';
import type { ExamSelection } from '../src/lib/exams/types';

const full = demoExamTests[0];
const selection: ExamSelection = { mode: 'PRACTICE', scope: 'parts', partIds: [1, 5, 6, 7] };
const set = buildDemoQuestions(full, selection);
const now = Date.UTC(2026, 9, 24, 0, 0);
const make = () =>
  createLocalSession(full, selection, 'local-exam-00000000-1111-2222-3333-444444444444', now);
const roundTrip = (value: unknown, time = now) => restoreLocalSession(JSON.stringify(value), time);

test('Demo fixtures match every TestPart count, group ownership and unique option keys', () => {
  for (const exam of demoExamTests) {
    const data = buildDemoQuestions(exam, {
      mode: 'MOCK_TEST',
      scope: 'full',
      partIds: exam.parts.map((part) => part.id),
    });
    assert.equal(
      data.questions.length,
      exam.parts.reduce((n, part) => n + part.questionCount, 0),
    );
    assert.equal(new Set(data.questions.map((q) => q.id)).size, data.questions.length);
    for (const part of exam.parts)
      assert.equal(data.questions.filter((q) => q.partId === part.id).length, part.questionCount);
    for (const q of data.questions) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map((option) => option.key)).size, 4);
      assert.ok(
        data.groups
          .find((group) => group.id === q.groupId && group.partId === q.partId)
          ?.questionIds.includes(q.id),
      );
    }
    assert.equal(
      /"(answerKey|isCorrect|explanation|transcript|correctOption)"/.test(JSON.stringify(data)),
      false,
    );
  }
});
test('Partial session loads only selected Parts and keeps original question numbers', () => {
  assert.equal(set.questions.length, 106);
  assert.deepEqual([...new Set(set.questions.map((q) => q.partId))], [1, 5, 6, 7]);
  assert.equal(set.questions[6].number, 101);
  assert.equal(set.questions.at(-1)?.number, 200);
  assert.throws(() => buildDemoQuestions(demoExamTests[2], { ...selection, partIds: [1] }));
});
test('Part 3/4 share groups of three, Part 6 shares four, Part 7 has multiple passages', () => {
  const data = buildDemoQuestions(full, { ...selection, partIds: [3, 4, 6, 7] });
  for (const group of data.groups) {
    assert.equal(group.questionIds.length, group.partId === 6 ? 4 : 3);
    if (group.partId === 7) assert.equal(group.passages.length, 2);
  }
});
test('Session snapshot distinguishes local ID, fixes deadline and clones the selection', () => {
  const s = make();
  assert.ok(s.localId.startsWith('local-exam-'));
  assert.equal('attemptId' in s, false);
  assert.equal(s.durationSeconds, 3816);
  assert.equal(s.deadlineAt, now + 3816000);
  assert.notEqual(s.selection.partIds, selection.partIds);
  assert.throws(() => createLocalSession(full, selection, 'fake-server-attempt', now));
});
test('Answer changes, clearing and duplicate answers do not corrupt progress or extend time', () => {
  const s = make();
  const id = set.questions[0].id;
  const a = updateLocalSession(s, { type: 'answer', questionId: id, option: 'B' }, set, now + 1000);
  const b = updateLocalSession(a, { type: 'answer', questionId: id, option: 'C' }, set, now + 2000);
  assert.equal(s.answers[id], undefined);
  assert.equal(b.answers[id], 'C');
  assert.equal(Object.keys(b.answers).length, 1);
  assert.equal(b.deadlineAt, s.deadlineAt);
  assert.equal(
    updateLocalSession(b, { type: 'answer', questionId: id, option: 'C' }, set, now + 3000),
    b,
  );
  assert.deepEqual(
    updateLocalSession(b, { type: 'clear', questionId: id }, set, now + 4000).answers,
    {},
  );
});
test('Foreign questions and options cannot be answered, navigated or flagged', () => {
  const s = make();
  for (const action of [
    { type: 'answer' as const, questionId: 'foreign', option: 'A' },
    { type: 'navigate' as const, questionId: 'foreign' },
    { type: 'flag' as const, questionId: 'foreign' },
    { type: 'answer' as const, questionId: s.currentQuestionId, option: 'E' },
  ])
    assert.equal(updateLocalSession(s, action, set, now + 1), s);
});
test('Flags and paragraph highlights toggle only valid IDs and restore with current question', () => {
  const s = make();
  const id = set.questions[7].id;
  const paragraph = paragraphIds(set)[0];
  let next = updateLocalSession(s, { type: 'navigate', questionId: id }, set, now + 1);
  next = updateLocalSession(next, { type: 'flag', questionId: id }, set, now + 2);
  next = updateLocalSession(next, { type: 'highlight', paragraphId: paragraph }, set, now + 3);
  assert.deepEqual(roundTrip(next, now + 3), next);
  assert.equal(
    updateLocalSession(next, { type: 'highlight', paragraphId: 'foreign' }, set, now + 4),
    next,
  );
  assert.deepEqual(
    updateLocalSession(next, { type: 'flag', questionId: id }, set, now + 4).flaggedIds,
    [],
  );
});
test('Reload keeps deadline and elapsed time, including after a long hidden-tab gap', () => {
  const s = make();
  const restored = roundTrip(s, now + 90_000)!;
  assert.equal(restored.deadlineAt, s.deadlineAt);
  assert.equal(remainingSeconds(restored, now + 90_000), 3726);
  assert.equal(remainingSeconds(restored, s.deadlineAt + 1000), 0);
});
test('Expiry rejects late answers and locks all later actions without changing snapshot time', () => {
  const s = make();
  const expired = updateLocalSession(
    s,
    { type: 'answer', questionId: s.currentQuestionId, option: 'A' },
    set,
    s.deadlineAt,
  );
  assert.equal(expired.status, 'expired');
  assert.equal(expired.endedAt, s.deadlineAt);
  assert.deepEqual(expired.answers, {});
  assert.equal(updateLocalSession(expired, { type: 'end' }, set, s.deadlineAt + 100), expired);
  assert.equal(roundTrip(s, s.deadlineAt + 100)?.status, 'expired');
});
test('Manual ending freezes the clock and preserves all answers without scoring', () => {
  const s = make();
  const ended = updateLocalSession(s, { type: 'end' }, set, now + 10000);
  assert.equal(ended.status, 'ended');
  assert.equal(remainingSeconds(ended, now + 20000), 3806);
  assert.equal(
    updateLocalSession(
      ended,
      { type: 'answer', questionId: s.currentQuestionId, option: 'B' },
      set,
      now + 11000,
    ),
    ended,
  );
  assert.deepEqual(roundTrip(ended, now + 20000), ended);
  assert.equal('score' in ended, false);
});
test('Corrupt, incompatible, wrong-scope and tampered snapshots are rejected', () => {
  const s = make();
  for (const changes of [
    { schemaVersion: 2 },
    { contentVersion: EXAM_CONTENT_VERSION + 'new' },
    { localId: 'attempt-123' },
    { testId: 'missing' },
    { selection: { ...selection, partIds: [1, 1] } },
    { durationSeconds: 7200 },
    { deadlineAt: s.deadlineAt + 1 },
    { currentQuestionId: 'foreign' },
    { questionIds: [...s.questionIds].reverse() },
    { answers: { foreign: 'A' } },
    { answers: { [s.currentQuestionId]: 'E' } },
    { flaggedIds: [s.currentQuestionId, s.currentQuestionId] },
    { highlightedIds: ['foreign'] },
    { status: 'submitted' },
    { endedAt: now },
    { startedAt: now + 10000 },
    { revision: -1 },
  ])
    assert.equal(roundTrip({ ...s, ...changes }), null, JSON.stringify(changes));
  assert.equal(restoreLocalSession('{', now), null);
  assert.equal(restoreLocalSession('x'.repeat(150001), now), null);
});
test('Short timer is explicitly tagged QA and cannot silently alter the normal duration', () => {
  const s = createLocalSession(full, selection, make().localId, now, 'short-timer');
  assert.equal(s.durationSeconds, 15);
  assert.equal(roundTrip(s, now + 16000)?.status, 'expired');
  assert.equal(roundTrip({ ...s, qa: 'normal' }), null);
});
test('Question demo loader exposes error, empty and cancellation without fallback', async () => {
  await assert.rejects(loadDemoQuestions(full, selection, 'error', new AbortController().signal));
  assert.deepEqual(
    await loadDemoQuestions(full, selection, 'empty', new AbortController().signal),
    { questions: [], groups: [] },
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadDemoQuestions(full, selection, undefined, controller.signal), {
    name: 'AbortError',
  });
});
