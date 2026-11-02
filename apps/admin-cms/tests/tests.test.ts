import assert from 'node:assert/strict';
import test from 'node:test';
import { readTestParams, testHref, selectTestPage } from '../src/lib/tests/query';
import { TEST_FIXTURES } from '../src/lib/tests/fixtures';
import { DEFAULT_TEST_QUERY, formatTestDuration } from '../src/lib/tests/types';
import { demoTestRepository } from '../src/lib/tests/demo-repository';

test('Exam URL defaults and independently verified size boundaries', () => {
  assert.deepEqual(readTestParams(new URLSearchParams()).query, DEFAULT_TEST_QUERY);
  for (const size of [1, 3, 20, 50])
    assert.equal(readTestParams(new URLSearchParams(`size=${size}`)).query.size, size);
  for (const bad of ['-1', '0', '1.5', 'Infinity', '1e3', '9007199254740992']) {
    const parsed = readTestParams(
      new URLSearchParams(`page=${bad}&size=51&type=FULL_TEST&status=ACTIVE`),
    );
    assert.deepEqual(parsed.query, DEFAULT_TEST_QUERY);
    assert.equal(parsed.corrected, true);
  }
});
test('Repeated params, invalid persona and preview normalize; Unicode survives canonical round trip', () => {
  const parsed = readTestParams(
    new URLSearchParams(
      'type=FULL&type=MINI&status=DRAFT&status=PUBLISHED&page=2&page=3&demoRole=invalid&testPreview=invalid',
    ),
  );
  assert.deepEqual(parsed.query, DEFAULT_TEST_QUERY);
  assert.equal(parsed.role, 'CONTENT_ADMIN');
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.corrected, true);
  const current = new URLSearchParams(
    'demoRole=SYSTEM_ADMIN&keyword=%20A%26B+日本語%20&type=MINI&status=DRAFT&size=3&page=2&testPreview=slow',
  );
  const data = readTestParams(current);
  assert.deepEqual(
    readTestParams(
      new URL(testHref(current, data.query, data.preview), 'http://local').searchParams,
    ),
    data,
  );
});
test('Title search and type/status intersect over the same catalog without student modes', () => {
  const result = selectTestPage(TEST_FIXTURES, {
    ...DEFAULT_TEST_QUERY,
    keyword: 'GIAO TIẾP',
    type: 'MINI',
    status: 'PUBLISHED',
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['demo-test-002'],
  );
  assert.equal(selectTestPage(TEST_FIXTURES, { ...DEFAULT_TEST_QUERY, type: 'FULL' }).total, 12);
  assert.equal(selectTestPage(TEST_FIXTURES, { ...DEFAULT_TEST_QUERY, type: 'MINI' }).total, 12);
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)
    assert.ok(
      selectTestPage(TEST_FIXTURES, { ...DEFAULT_TEST_QUERY, status }).items.every(
        (item) => item.status === status,
      ),
    );
  assert.equal(readTestParams(new URLSearchParams('type=PRACTICE')).query.type, '');
});
test('Pagination is stable, clamps past end, distinguishes empty/no match, never mutates', () => {
  const before = JSON.stringify(TEST_FIXTURES);
  const ids = [1, 2, 3, 4, 5].flatMap((page) =>
    selectTestPage(TEST_FIXTURES, { ...DEFAULT_TEST_QUERY, size: 5, page }).items.map(
      (item) => item.id,
    ),
  );
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, 24);
  const last = selectTestPage(TEST_FIXTURES, {
    ...DEFAULT_TEST_QUERY,
    size: 5,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(last.page, 5);
  assert.equal(last.items.length, 4);
  assert.equal(selectTestPage([], DEFAULT_TEST_QUERY).catalogTotal, 0);
  const missing = selectTestPage(TEST_FIXTURES, { ...DEFAULT_TEST_QUERY, keyword: 'missing' });
  assert.equal(missing.total, 0);
  assert.equal(missing.catalogTotal, 24);
  assert.equal(JSON.stringify(TEST_FIXTURES), before);
});
test('Missing metadata stays missing and duration formatting never infers from test type', () => {
  assert.equal(formatTestDuration(null), 'Chưa có dữ liệu');
  assert.equal(formatTestDuration(7200), '120 phút');
  assert.equal(formatTestDuration(1800), '30 phút');
  assert.equal(formatTestDuration(61), '1 phút 1 giây');
  const missing = TEST_FIXTURES.find((item) => item.id === 'demo-test-023')!;
  assert.equal(missing.durationSeconds, null);
  assert.equal(missing.questionCount, null);
  assert.equal(missing.status, null);
  assert.ok(
    TEST_FIXTURES.filter((item) => item.type === 'MINI').every(
      (item) => item.questionCount === null,
    ),
  );
});
test('Demo repository cancels stale reads, simulates errors, retries and empty catalog locally', async () => {
  const controller = new AbortController();
  const pending = demoTestRepository.list(DEFAULT_TEST_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const signal = new AbortController().signal;
  await assert.rejects(
    demoTestRepository.list(DEFAULT_TEST_QUERY, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
  assert.equal(
    (await demoTestRepository.list(DEFAULT_TEST_QUERY, { signal, preview: 'error', retry: true }))
      .total,
    24,
  );
  assert.equal(
    (await demoTestRepository.list(DEFAULT_TEST_QUERY, { signal, preview: 'empty', retry: false }))
      .catalogTotal,
    0,
  );
});
