import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRemainingPlan, createPlan } from './seed-plan.mjs';

const now = new Date('2026-11-23T10:00:00Z');
const earlier = new Date('2026-11-01T00:00:00Z');
const user = { id: 'learner-1', createdAt: earlier };

const readOnlyDb = (models) => ({
  $transaction: (callback) =>
    callback({
      $executeRaw: async (sql) => assert.match(sql.join(''), /READ ONLY/),
      ...models,
    }),
});

function fullTest(id, overrides) {
  return {
    id,
    title: 'Đề ' + id,
    createdAt: earlier,
    durationSeconds: 7200,
    questions: [{ questionId: id + '-question' }],
    questionDates: [{ createdAt: earlier, group: null }],
    catalogHash: 'hash-' + id,
    partDurationSeconds: 1800,
    ...overrides,
  };
}

function fixture(tests, history = []) {
  const prepared = [];
  const db = {
    exam: readOnlyDb({
      test: {
        findMany: async ({ where }) =>
          tests.filter((row) => !row.deletedAt && row.durationSeconds === where.durationSeconds),
        findFirst: async ({ where }) => tests.find((row) => row.id === where.id && !row.deletedAt),
      },
      attempt: {
        groupBy: async ({ by, where }) => {
          assert.deepEqual(by, ['testId']);
          assert.deepEqual(Object.keys(where).sort(), ['testId', 'userId']);
          assert.equal(where.userId, user.id);
          const ids = new Set(
            history
              .filter((row) => row.userId === where.userId && where.testId.in.includes(row.testId))
              .map(({ testId }) => testId),
          );
          return [...ids].map((testId) => ({ testId }));
        },
      },
    }),
    question: readOnlyDb({
      question: {
        findMany: async ({ where }) =>
          tests
            .filter((row) =>
              row.questions.some(({ questionId }) => where.id.in.includes(questionId)),
            )
            .flatMap((row) => row.questionDates),
      },
    }),
    analytics: readOnlyDb({
      firstLearnedEntity: { findMany: async () => [] },
      completedLessonEntity: { findMany: async () => [] },
    }),
    learning: readOnlyDb({
      vocabularyTopic: {
        findMany: async () => [
          {
            id: 'topic',
            name: 'Từ vựng',
            createdAt: earlier,
            updatedAt: earlier,
            vocabularies: [{ id: 'word', createdAt: earlier, updatedAt: earlier }],
          },
        ],
      },
      personalVocabularyTopic: { findMany: async () => [] },
      grammarLesson: {
        findMany: async () => [
          { id: 'lesson', lessonTitle: 'Ngữ pháp', createdAt: earlier, updatedAt: earlier },
        ],
      },
    }),
  };
  const attempts = {
    prepareHistoricalTest: async (row) => {
      prepared.push(row.id);
      if (row.invalid) throw new Error(row.invalid);
      return { catalogHash: row.catalogHash, partDurationSeconds: row.partDurationSeconds };
    },
  };
  return {
    db,
    attempts,
    prepared,
    plan: (runKey = 'run-1') => createPlan(db, attempts, user, runKey, now),
  };
}

function exams(plan) {
  return plan.activities.filter((op) => op.kind === 'exam');
}

test('uses the only eligible test for all three Full and three Part attempts', async () => {
  const plan = await fixture([fullTest('a')]).plan();
  assert.equal(plan.days.length, 5);
  const operations = exams(plan);
  assert.deepEqual(
    operations.map((op) => op.testId),
    Array(6).fill('a'),
  );
  assert.equal(operations.filter((op) => op.mode === 'FULL').length, 3);
  assert.deepEqual(
    operations.filter((op) => op.mode === 'PART').map((op) => op.parts),
    [[2], [5], [7]],
  );
});

test('chooses distinct tests reproducibly and varies the order with the run key', async () => {
  const tests = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => fullTest(id));
  const original = await fixture(tests).plan('run-1');
  const reordered = await fixture([...tests].reverse()).plan('run-1');
  const anotherRun = await fixture(tests).plan('run-2');
  const ids = (plan) => exams(plan).map((op) => op.testId);
  assert.equal(new Set(ids(original)).size, 6);
  assert.deepEqual(original, reordered);
  assert.notDeepEqual(ids(original), ids(anotherRun));
});

test('prefers unseen tests, then unused tests with history, then balances repetitions', async () => {
  const rows = [
    { testId: 'a', userId: user.id, mode: 'FULL', status: 'SUBMITTED' },
    { testId: 'b', userId: user.id, mode: 'PART', status: 'EXPIRED' },
    { testId: 'c', userId: user.id, mode: 'FULL', status: 'IN_PROGRESS' },
    { testId: 'd', userId: 'another-learner', mode: 'FULL', status: 'SUBMITTED' },
  ];
  const tests = ['a', 'b', 'c', 'd', 'e'].map((id) => fullTest(id));
  const ids = exams(await fixture(tests, rows).plan()).map((op) => op.testId);
  assert.deepEqual(new Set(ids.slice(0, 2)), new Set(['d', 'e']));
  assert.deepEqual(new Set(ids.slice(2, 5)), new Set(['a', 'b', 'c']));
  assert.ok(ids.slice(0, 5).includes(ids[5]));

  const balanced = exams(await fixture(tests.slice(0, 2), rows).plan()).map((op) => op.testId);
  for (let start = 0; start < balanced.length; start += 2) {
    assert.deepEqual(new Set(balanced.slice(start, start + 2)), new Set(['a', 'b']));
  }
});

test('skips incomplete tests and waits until a later test has all its resources', async () => {
  const lateAsset = new Date('2026-11-21T11:10:00Z');
  const tests = [
    fullTest('older'),
    fullTest('later', {
      questionDates: [
        { createdAt: earlier, group: { createdAt: earlier, assets: [{ createdAt: lateAsset }] } },
      ],
    }),
    fullTest('missing-audio', { invalid: 'group audio required' }),
    fullTest('missing-question', { questionDates: [] }),
    fullTest('archived', { deletedAt: earlier }),
  ];
  const history = [{ testId: 'older', userId: user.id, mode: 'FULL', status: 'SUBMITTED' }];
  const plan = await fixture(tests, history).plan();
  const operations = exams(plan);
  assert.deepEqual(
    operations.slice(0, 3).map((op) => op.testId),
    ['older', 'older', 'older'],
  );
  assert.equal(operations[3].slot, 'part-5');
  assert.equal(operations[3].testId, 'later');
  assert.ok(operations.every((op) => ['older', 'later'].includes(op.testId)));
  assert.ok(
    operations
      .filter((op) => op.testId === 'later')
      .every((op) => new Date(op.startedAt) >= lateAsset),
  );
});

test('rejects missing or incomplete catalogs and schedules shorter than three days', async () => {
  await assert.rejects(fixture([]).plan(), /Thiếu đề Full hợp lệ/);
  await assert.rejects(
    fixture([fullTest('incomplete', { invalid: 'group audio required' })]).plan(),
    /Đề incomplete.*group audio required/,
  );
  await assert.rejects(
    fixture([fullTest('recent', { createdAt: new Date('2026-11-22T00:00:00Z') })]).plan(),
    /Thiếu ngày hợp lệ/,
  );
});

test('revalidates a saved single-test plan once without changing its assignments', async () => {
  const { db, attempts, plan, prepared } = fixture([fullTest('legacy')]);
  const saved = JSON.parse(JSON.stringify(exams(await plan())));
  prepared.length = 0;
  const original = JSON.stringify(saved);
  await checkRemainingPlan(db, attempts, user.id, saved);
  assert.deepEqual(prepared, ['legacy']);
  assert.equal(JSON.stringify(saved), original);
});

test('rejects a changed test in the middle of a saved multi-test plan', async () => {
  const tests = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => fullTest(id));
  const { db, attempts, plan, prepared } = fixture(tests);
  const saved = exams(await plan());
  const affected = saved[2];
  tests.find(({ id }) => id === affected.testId).catalogHash = 'updated-catalog-hash';
  prepared.length = 0;
  await assert.rejects(
    checkRemainingPlan(db, attempts, user.id, saved),
    (error) =>
      error.message.includes(`"${affected.title}" (${affected.testId})`) &&
      error.message.includes('đã thay đổi'),
  );
  assert.deepEqual(
    prepared,
    saved.slice(0, 3).map((op) => op.testId),
  );
});

test('checks Part duration for the test assigned to each pending Part attempt', async () => {
  const tests = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => fullTest(id));
  const { db, attempts, plan } = fixture(tests);
  const saved = exams(await plan());
  const affected = saved.find((op) => op.slot === 'part-5');
  tests.find(({ id }) => id === affected.testId).partDurationSeconds += 60;
  await assert.rejects(
    checkRemainingPlan(db, attempts, user.id, saved),
    (error) => error.message.includes(affected.title) && error.message.includes('Thời lượng'),
  );
});
