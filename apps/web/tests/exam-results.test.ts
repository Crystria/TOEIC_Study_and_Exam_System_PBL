import assert from 'node:assert/strict';
import test from 'node:test';
import { demoExamTests } from '../src/lib/exams/mock-data';
import { buildDemoQuestions } from '../src/lib/exams/question-fixtures';
import {
  createLocalSession,
  restoreLocalSession,
  updateLocalSession,
} from '../src/lib/exams/session';
import {
  archiveDemoSession,
  emptyDemoHistory,
  filterDemoHistory,
  filterReview,
  localSummary,
  restoreDemoHistory,
} from '../src/lib/exams/results';
import { DEMO_HISTORY_LIMIT } from '../src/lib/exams/result-types';
import type { ReviewDocument } from '../src/lib/exams/result-types';
import { getReviewExample } from '../src/lib/exams/review-example';
import type { ExamSelection } from '../src/lib/exams/types';

const now = Date.UTC(2026, 9, 26, 1);
const exam = demoExamTests[0];
const selection: ExamSelection = { mode: 'PRACTICE', scope: 'parts', partIds: [5, 6, 7] };
const set = buildDemoQuestions(exam, selection);
function closed(index = 0) {
  let session = createLocalSession(
    exam,
    selection,
    `local-exam-results-${String(index).padStart(8, '0')}`,
    now,
  );
  session = updateLocalSession(
    session,
    { type: 'answer', questionId: session.questionIds[0], option: 'B' },
    set,
    now + 1000,
  );
  return updateLocalSession(session, { type: 'end' }, set, now + 2100 + index);
}
const restore = (value: unknown) => restoreDemoHistory(JSON.stringify(value), now + 10_000);

test('History round-trip preserves only closed local snapshots, never a graded result', () => {
  const session = closed();
  const history = archiveDemoSession(emptyDemoHistory(), session, now + 10_000);
  assert.deepEqual(restore(history), history);
  assert.equal(history.source, 'local-demo');
  assert.equal(
    /"(score|correctOption|explanation|transcript|isCorrect|attemptId)"/.test(
      JSON.stringify(history),
    ),
    false,
  );
  assert.equal(localSummary(session).answered, 1);
  assert.equal(localSummary(session).unanswered, 99);
  assert.equal(localSummary(session).elapsedSeconds, 2);
});

test('History does not accept active drafts even when the deadline has elapsed', () => {
  const active = createLocalSession(
    exam,
    selection,
    'local-exam-active-00000000',
    now - 100_000_000,
  );
  const history = emptyDemoHistory();
  assert.equal(archiveDemoSession(history, active, now), history);
  assert.equal(restore({ ...history, sessions: [active] }), null);
});

test('History rejects malformed envelopes, versions, duplicate IDs and incomplete questions', () => {
  const history = { ...emptyDemoHistory(), sessions: [closed()] };
  assert.equal(restoreDemoHistory('{', now), null);
  for (const value of [
    null,
    [],
    { ...history, schemaVersion: 2 },
    { ...history, source: 'server' },
    { ...history, score: 700 },
    { ...history, sessions: [closed(), closed()] },
    { ...history, sessions: [{ ...closed(), questionIds: [] }] },
    { ...history, sessions: [{ ...closed(), contentVersion: 'old' }] },
  ])
    assert.equal(restore(value), null);
});

test('History rejects injected grading, invalid choices, time and selection data', () => {
  for (const patch of [
    { score: 700 },
    { solutions: {} },
    { attemptId: 'fake' },
    { answers: { [closed().questionIds[0]]: 'Z' } },
    { endedAt: now + 10_000, updatedAt: now + 2000 },
    { status: 'expired' },
    { selection: { ...selection, partIds: [5, 5] } },
  ])
    assert.equal(restore({ ...emptyDemoHistory(), sessions: [{ ...closed(), ...patch }] }), null);
});

test('Snapshot status and current question reject arrays masquerading as strings', () => {
  const session = closed();
  assert.equal(
    restoreLocalSession(JSON.stringify({ ...session, status: ['ended'] }), now + 10_000),
    null,
  );
  assert.equal(
    restoreLocalSession(
      JSON.stringify({ ...session, currentQuestionId: [session.currentQuestionId] }),
      now + 10_000,
    ),
    null,
  );
});

test('Archiving is idempotent and retains the latest thirty sessions in stable order', () => {
  let history = emptyDemoHistory();
  for (let index = 0; index < 35; index++)
    history = archiveDemoSession(history, closed(index), now + 10_000);
  assert.equal(history.sessions.length, DEMO_HISTORY_LIMIT);
  assert.equal(history.sessions[0].localId, closed(34).localId);
  assert.equal(history.sessions.at(-1)?.localId, closed(5).localId);
  assert.equal(archiveDemoSession(history, closed(34), now + 10_000), history);
  assert.deepEqual(restore(history), history);
});

test('TOEIC eligibility never gives PRACTICE, partial scope or one-skill sessions a score', () => {
  const selections: ExamSelection[] = [
    selection,
    { mode: 'PRACTICE', scope: 'full', partIds: [1, 2, 3, 4, 5, 6, 7] },
    { mode: 'MOCK_TEST', scope: 'parts', partIds: [1, 5] },
    { mode: 'MOCK_TEST', scope: 'parts', partIds: [5, 6, 7] },
  ];
  for (const choice of selections) {
    const s = createLocalSession(exam, choice, 'local-exam-eligibility-00000000', now);
    assert.equal(localSummary(s).toeicEligible, false);
    assert.equal('score' in localSummary(s), false);
  }
  const full = createLocalSession(
    exam,
    { mode: 'MOCK_TEST', scope: 'full', partIds: [1, 2, 3, 4, 5, 6, 7] },
    'local-exam-eligibility-11111111',
    now,
  );
  assert.equal(localSummary(full).toeicEligible, true);
  assert.equal('score' in localSummary(full), false);
});

test('Ungraded review cannot infer correct or incorrect from locally selected options', () => {
  const session = closed();
  const document: ReviewDocument = {
    source: 'local-demo',
    set,
    answers: session.answers,
    flaggedIds: [set.questions[0].id],
    highlightedIds: [],
    solutions: null,
  };
  assert.equal(filterReview(document, 'all', 'correct').length, 0);
  assert.equal(filterReview(document, 'all', 'incorrect').length, 0);
  assert.equal(filterReview(document, 'all', 'unanswered').length, 99);
  assert.equal(filterReview(document, '5', 'flagged').length, 1);
  assert.equal(filterReview(document, '6', 'flagged').length, 0);
});

test('Authored example supplies consistent solutions separately from local sessions', () => {
  const example = getReviewExample();
  assert.equal(example.source, 'example');
  assert.equal(example.set.questions.length, 10);
  assert.equal(
    example.set.questions.some((question) =>
      set.questions.some((active) => active.id === question.id),
    ),
    false,
  );
  assert.equal(filterReview(example, 'all', 'correct').length, 4);
  assert.equal(filterReview(example, 'all', 'incorrect').length, 3);
  assert.equal(filterReview(example, 'all', 'unanswered').length, 3);
  assert.equal(filterReview(example, 'all', 'flagged').length, 2);
  assert.equal(filterReview(example, '6', 'all').length, 4);
  for (const q of example.set.questions) {
    const solution = example.solutions![q.id];
    assert.ok(q.options.some((o) => o.key === solution.correctOption));
    assert.ok(solution.explanation);
    assert.equal(
      solution.outcome,
      !example.answers[q.id]
        ? 'unanswered'
        : example.answers[q.id] === solution.correctOption
          ? 'correct'
          : 'incorrect',
    );
  }
  assert.equal('localId' in example, false);
  assert.equal(
    /"(correctOption|explanation|transcript)"/.test(
      JSON.stringify(buildDemoQuestions(exam, selection)),
    ),
    false,
  );
});

test('History combines search, mode, scope and closed status without mixing the example', () => {
  const sessions = [closed()];
  assert.equal(filterDemoHistory(sessions, 'Part 6', 'PRACTICE', 'parts', 'ended').length, 1);
  assert.equal(filterDemoHistory(sessions, 'không tồn tại', 'all', 'all', 'all').length, 0);
  assert.equal(filterDemoHistory(sessions, '', 'MOCK_TEST', 'all', 'all').length, 0);
  assert.equal(filterDemoHistory(sessions, '', 'all', 'full', 'all').length, 0);
  assert.equal(filterDemoHistory(sessions, '', 'all', 'all', 'expired').length, 0);
});
