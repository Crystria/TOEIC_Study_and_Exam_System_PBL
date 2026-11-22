import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readTestContent,
  type BankGroup,
  type BankQuestion,
  type TestQuestionReference,
} from '../src/lib/tests/content-reader';

function question(id: string, groupId: string | null = null): BankQuestion {
  return {
    id,
    audioUrl: null,
    imageUrl: null,
    input: {
      part: groupId ? 7 : 5,
      type: 'SINGLE_CHOICE',
      questionText: `Question ${id}`,
      difficulty: 'MEDIUM',
      correctOption: 'B',
      explanation: `Explanation ${id}`,
      transcript: null,
      groupId,
      positionInGroup: groupId ? 1 : null,
      options: ['A', 'B', 'C', 'D'].map((optionCode) => ({
        optionCode,
        optionText: `${id} ${optionCode}`,
      })),
      tags: [],
    },
  };
}

function group(id: string): BankGroup {
  return {
    id,
    audioUrl: null,
    audioKey: null,
    part: 7,
    type: 'READING',
    instruction: `Instruction ${id}`,
    passageText: `Passage ${id}`,
    transcript: '',
    assets: [],
    questionIds: [],
    isComplete: true,
  };
}

const references = (length: number): TestQuestionReference[] =>
  Array.from({ length }, (_, index) => ({
    questionId: `q-${index + 1}`,
    part: 5,
    orderNo: index + 1,
  }));

test('full test content follows orderNo and fetches repeated questions and shared groups once', async () => {
  const refs: TestQuestionReference[] = [
    { questionId: 'q-b', part: 7, orderNo: 3 },
    { questionId: 'q-a', part: 7, orderNo: 1 },
    { questionId: 'q-a', part: 7, orderNo: 2 },
  ];
  const before = structuredClone(refs);
  const questionCalls: string[] = [];
  const groupCalls: string[] = [];
  const signal = new AbortController().signal;
  const content = await readTestContent(
    refs,
    {
      async question(id, requestSignal) {
        assert.equal(requestSignal, signal);
        questionCalls.push(id);
        return question(id, 'shared');
      },
      async group(id, requestSignal) {
        assert.equal(requestSignal, signal);
        groupCalls.push(id);
        return group(id);
      },
    },
    signal,
  );

  assert.deepEqual(refs, before);
  assert.deepEqual(
    content.questions.map(({ reference }) => reference.orderNo),
    [1, 2, 3],
  );
  assert.deepEqual(
    content.questions.map(({ reference }) => reference.questionId),
    ['q-a', 'q-a', 'q-b'],
  );
  assert.deepEqual(questionCalls, ['q-a', 'q-b']);
  assert.deepEqual(groupCalls, ['shared']);
  assert.equal(content.questions[0].result.status, 'fulfilled');
  assert.equal(content.questions[2].result.status, 'fulfilled');
  assert.deepEqual(content.groups.get('shared'), {
    status: 'fulfilled',
    value: group('shared'),
  });
});

test('200-question reads bound concurrent question and group requests', async () => {
  let active = 0;
  let peak = 0;
  let questionCalls = 0;
  let groupCalls = 0;
  async function inFlight<T>(value: T) {
    active++;
    peak = Math.max(peak, active);
    await new Promise<void>((resolve) => setImmediate(resolve));
    active--;
    return value;
  }
  const content = await readTestContent(
    references(200),
    {
      async question(id) {
        questionCalls++;
        return inFlight(question(id, `g-${Math.floor((Number(id.slice(2)) - 1) / 10)}`));
      },
      async group(id) {
        groupCalls++;
        return inFlight(group(id));
      },
    },
    new AbortController().signal,
  );

  assert.equal(questionCalls, 200);
  assert.equal(groupCalls, 20);
  assert.equal(content.questions.length, 200);
  assert.equal(content.groups.size, 20);
  assert.ok(peak > 1, 'Requests should make progress concurrently');
  assert.ok(peak <= 8, `Expected at most 8 active requests, received ${peak}`);
  assert.equal(active, 0);
  assert.equal(content.questions[199].reference.questionId, 'q-200');
});

test('missing questions and groups retain successful questions, answers and shared content', async () => {
  const questionError = new Error('Question was archived');
  const groupError = new Error('Group is unavailable');
  const content = await readTestContent(
    references(4),
    {
      async question(id) {
        if (id === 'q-2') throw questionError;
        return question(id, id === 'q-3' ? 'missing-group' : 'shared');
      },
      async group(id) {
        if (id === 'missing-group') throw groupError;
        return group(id);
      },
    },
    new AbortController().signal,
  );

  assert.equal(content.questions.length, 4);
  assert.deepEqual(content.questions[1].result, { status: 'rejected', reason: questionError });
  for (const index of [0, 2, 3]) {
    const result = content.questions[index].result;
    assert.equal(result.status, 'fulfilled');
    if (result.status !== 'fulfilled') assert.fail('Expected successful question content');
    assert.equal(result.value.input.correctOption, 'B');
    assert.equal(result.value.input.options.length, 4);
    assert.equal(result.value.input.explanation, `Explanation q-${index + 1}`);
  }
  assert.deepEqual(content.groups.get('shared'), { status: 'fulfilled', value: group('shared') });
  assert.deepEqual(content.groups.get('missing-group'), {
    status: 'rejected',
    reason: groupError,
  });
});

test('empty tests do not fetch question or group resources', async () => {
  const content = await readTestContent(
    [],
    {
      async question() {
        assert.fail('Empty tests must not fetch questions');
      },
      async group() {
        assert.fail('Empty tests must not fetch groups');
      },
    },
    new AbortController().signal,
  );
  assert.deepEqual(content.questions, []);
  assert.equal(content.groups.size, 0);
});

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

test('abort cancels active reads and prevents queued questions and groups from starting', async () => {
  const controller = new AbortController();
  const reason = new Error('Navigated away from test');
  const started: string[] = [];
  const pending = readTestContent(
    references(200),
    {
      async question(id, signal) {
        assert.ok(signal);
        started.push(id);
        return waitForAbort(signal);
      },
      async group() {
        assert.fail('No groups may load after aborting question reads');
      },
    },
    controller.signal,
  );

  assert.equal(started.length, 8);
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.deepEqual(
    started,
    references(8).map(({ questionId }) => questionId),
  );
});

test('abort during shared-content reads prevents queued groups from starting', async () => {
  const controller = new AbortController();
  const reason = new Error('Navigated away while reading groups');
  const started: string[] = [];
  let batchStarted!: () => void;
  const firstBatch = new Promise<void>((resolve) => {
    batchStarted = resolve;
  });
  const pending = readTestContent(
    references(20),
    {
      async question(id) {
        return question(id, `group-${id}`);
      },
      async group(id, signal) {
        assert.ok(signal);
        started.push(id);
        if (started.length === 8) batchStarted();
        return waitForAbort(signal);
      },
    },
    controller.signal,
  );

  await firstBatch;
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(started.length, 8);
});

test('200 questions use four batches and shared groups are deduplicated and batched without changing test order', async () => {
  const refs = references(200).reverse();
  const before = structuredClone(refs);
  const questionCalls: string[][] = [];
  const groupCalls: string[][] = [];
  const signal = new AbortController().signal;
  const content = await readTestContent(
    refs,
    {
      async question() {
        assert.fail('Batch readers must not fall back to individual question requests');
      },
      async group() {
        assert.fail('Batch readers must not fall back to individual group requests');
      },
      async questionBatch(ids, requestSignal) {
        assert.equal(requestSignal, signal);
        questionCalls.push([...ids]);
        // Server row order is independent of the order requested by the test.
        return [...ids]
          .reverse()
          .map((id) => question(id, `g-${Math.floor((Number(id.slice(2)) - 1) / 2)}`));
      },
      async groupBatch(ids, requestSignal) {
        assert.equal(requestSignal, signal);
        groupCalls.push([...ids]);
        return [...ids].reverse().map(group);
      },
    },
    signal,
  );

  assert.deepEqual(refs, before);
  assert.equal(questionCalls.length, 4);
  assert.ok(questionCalls.every((ids) => ids.length <= 50));
  assert.deepEqual(
    questionCalls.flat(),
    references(200).map((ref) => ref.questionId),
  );
  assert.equal(groupCalls.length, 2);
  assert.ok(groupCalls.every((ids) => ids.length <= 50));
  assert.deepEqual(
    groupCalls.flat(),
    Array.from({ length: 100 }, (_, index) => `g-${index}`),
  );
  assert.equal(content.groups.size, 100);
  for (const [index, row] of content.questions.entries()) {
    assert.equal(row.reference.orderNo, index + 1);
    assert.equal(row.reference.questionId, `q-${index + 1}`);
    if (row.result.status !== 'fulfilled') assert.fail('Expected all batch questions to load');
    assert.equal(row.result.value.id, row.reference.questionId);
    assert.equal(row.result.value.input.correctOption, 'B');
    assert.equal(row.result.value.input.explanation, `Explanation q-${index + 1}`);
  }
  for (let index = 0; index < 100; index++)
    assert.deepEqual(content.groups.get(`g-${index}`), {
      status: 'fulfilled',
      value: group(`g-${index}`),
    });
});

test('missing batch rows become individual failures while other questions, answers and passages remain available', async () => {
  const content = await readTestContent(
    references(4),
    {
      async question() {
        assert.fail('Expected question batch');
      },
      async group() {
        assert.fail('Expected group batch');
      },
      async questionBatch(ids) {
        return ids
          .filter((id) => id !== 'q-2')
          .map((id) => question(id, id === 'q-3' ? 'missing-group' : 'shared'));
      },
      async groupBatch() {
        return [group('shared')];
      },
    },
    new AbortController().signal,
  );

  assert.equal(content.questions[1].result.status, 'rejected');
  for (const index of [0, 2, 3]) {
    const result = content.questions[index].result;
    if (result.status !== 'fulfilled')
      assert.fail('Available rows must survive a missing batch row');
    assert.equal(result.value.input.correctOption, 'B');
    assert.equal(result.value.input.options.length, 4);
    assert.equal(result.value.input.explanation, `Explanation q-${index + 1}`);
  }
  assert.deepEqual(content.groups.get('shared'), { status: 'fulfilled', value: group('shared') });
  assert.equal(content.groups.get('missing-group')?.status, 'rejected');
  assert.equal(content.groups.size, 2);
});

test('a failed question batch retains successful batches and loads only their shared groups', async () => {
  const failure = new Error('Question batch unavailable');
  const groupIds: string[] = [];
  const content = await readTestContent(
    references(120),
    {
      async question() {
        assert.fail('Expected question batch');
      },
      async group() {
        assert.fail('Expected group batch');
      },
      async questionBatch(ids) {
        if (ids.includes('q-51')) throw failure;
        return ids.map((id) => question(id, `group-${id}`));
      },
      async groupBatch(ids) {
        groupIds.push(...ids);
        return ids.map(group);
      },
    },
    new AbortController().signal,
  );

  assert.equal(content.questions.length, 120);
  for (const [index, row] of content.questions.entries()) {
    if (index >= 50 && index < 100)
      assert.deepEqual(row.result, { status: 'rejected', reason: failure });
    else assert.equal(row.result.status, 'fulfilled');
  }
  assert.equal(content.groups.size, 70);
  assert.deepEqual(
    new Set(groupIds),
    new Set(
      [...references(50), ...references(120).slice(100)].map((ref) => `group-${ref.questionId}`),
    ),
  );
});

test('a failed shared-group batch retains every question and the other batches of passages', async () => {
  const failure = new Error('Group batch unavailable');
  const content = await readTestContent(
    references(120),
    {
      async question() {
        assert.fail('Expected question batch');
      },
      async group() {
        assert.fail('Expected group batch');
      },
      async questionBatch(ids) {
        return ids.map((id) => question(id, `group-${id}`));
      },
      async groupBatch(ids) {
        if (ids.includes('group-q-51')) throw failure;
        return ids.map(group);
      },
    },
    new AbortController().signal,
  );

  assert.equal(content.questions.length, 120);
  assert.ok(content.questions.every((row) => row.result.status === 'fulfilled'));
  assert.equal(content.groups.size, 120);
  for (let number = 1; number <= 120; number++) {
    const id = `group-q-${number}`;
    assert.deepEqual(
      content.groups.get(id),
      number >= 51 && number <= 100
        ? { status: 'rejected', reason: failure }
        : { status: 'fulfilled', value: group(id) },
    );
  }
});

test('duplicate or unrequested records reject only their question or group batch', async (t) => {
  for (const resource of ['questions', 'groups'] as const) {
    for (const invalid of ['duplicate', 'unrequested'] as const) {
      await t.test(`${resource}: ${invalid}`, async () => {
        const corrupt = <T extends { id: string }>(values: T[], extra: T): T[] => [
          ...values,
          invalid === 'duplicate' ? values[0] : extra,
        ];
        const content = await readTestContent(
          references(60),
          {
            async question() {
              assert.fail('Expected question batch');
            },
            async group() {
              assert.fail('Expected group batch');
            },
            async questionBatch(ids) {
              const values = ids.map((id) => question(id, `group-${id}`));
              return resource === 'questions' && ids.includes('q-1')
                ? corrupt(values, question('unexpected-question'))
                : values;
            },
            async groupBatch(ids) {
              const values = ids.map(group);
              return resource === 'groups' && ids.includes('group-q-1')
                ? corrupt(values, group('unexpected-group'))
                : values;
            },
          },
          new AbortController().signal,
        );

        assert.equal(content.questions.length, 60);
        for (const [index, row] of content.questions.entries()) {
          assert.equal(
            row.result.status,
            resource === 'questions' && index < 50 ? 'rejected' : 'fulfilled',
          );
        }
        if (resource === 'groups') {
          assert.equal(content.groups.size, 60);
          for (let number = 1; number <= 60; number++)
            assert.equal(
              content.groups.get(`group-q-${number}`)?.status,
              number <= 50 ? 'rejected' : 'fulfilled',
            );
        } else assert.equal(content.groups.size, 10);
        assert.equal(content.groups.has('unexpected-group'), false);
      });
    }
  }
});
