import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEST_FIXTURES } from '../src/lib/tests/fixtures';
import { TEST_DETAIL_IDS, hasTestDetail } from '../src/lib/tests/detail-availability';
import { TEST_DETAIL_FIXTURES } from '../src/lib/tests/detail-fixtures';
import {
  decodeTestSegment,
  readTestDetailParams,
  testDetailHref,
} from '../src/lib/tests/detail-navigation';
import { demoTestDetailRepository as repository } from '../src/lib/tests/detail-repository';
import type { TestDetailPreview } from '../src/lib/tests/detail-types';
import { resolveCmsDestination } from '../src/lib/demo/cms-destination';

const read = (id: string, preview: TestDetailPreview = 'normal', retry = false) =>
  repository.read(id, { signal: new AbortController().signal, preview, retry });

test('Only two catalog IDs have metadata, with no extra fields or inferred Mini count', () => {
  assert.deepEqual(TEST_DETAIL_IDS, ['demo-test-001', 'demo-test-002']);
  assert.equal(TEST_DETAIL_FIXTURES.length, 2);
  for (const detail of TEST_DETAIL_FIXTURES) {
    assert.deepEqual(
      detail,
      TEST_FIXTURES.find((item) => item.id === detail.id),
    );
    assert.deepEqual(
      Object.keys(detail).sort(),
      ['id', 'title', 'type', 'durationSeconds', 'questionCount', 'status'].sort(),
    );
  }
  assert.equal(TEST_DETAIL_FIXTURES[1].questionCount, null);
  assert.equal(hasTestDetail('demo-test-003'), false);
  assert.equal(hasTestDetail('unknown'), false);
});

test('Literal list return restores allowlisted params and rejects every returnTo destination', () => {
  const params = new URLSearchParams({
    demoRole: 'CONTENT_ADMIN',
    keyword: 'tên & <demo>',
    type: 'MINI',
    status: 'PUBLISHED',
    page: '2',
    size: '1',
    testPreview: 'slow',
  });
  const expected = '/tests?' + params;
  assert.equal(readTestDetailParams(params).backHref, expected);
  for (const value of [
    'https://evil.test/tests',
    '//evil.test',
    '/users',
    '/tests/../users',
    '/tests?demoRole=SYSTEM_ADMIN',
  ]) {
    params.set('returnTo', value);
    params.append('returnTo', '/tests');
    const result = readTestDetailParams(params);
    assert.equal(result.backHref, expected);
    assert.equal(result.search.includes('returnTo'), false);
    assert.equal(result.corrected, true);
    params.delete('returnTo');
  }
});

test('Malformed and repeated detail/list params normalize by the existing list parser', () => {
  const result = readTestDetailParams(
    new URLSearchParams(
      'keyword=a&keyword=b&type=FULL&type=MINI&status=bad&page=0&size=51&testPreview=bad&detailPreview=error&detailPreview=slow&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN',
    ),
  );
  assert.equal(result.preview, 'normal');
  assert.equal(result.backHref, '/tests?demoRole=CONTENT_ADMIN');
  assert.equal(result.corrected, true);
  assert.equal(
    readTestDetailParams(new URLSearchParams('page=9007199254740992&size=-1&detailPreview=garbage'))
      .backHref,
    '/tests?demoRole=CONTENT_ADMIN',
  );
  assert.equal(
    readTestDetailParams(new URLSearchParams('demoRole=SYSTEM_ADMIN&size=7&detailPreview=error'))
      .backHref,
    '/tests?demoRole=SYSTEM_ADMIN&size=7',
  );
});

test('Catalog without detail differs from unknown ID in every preview', async () => {
  for (const preview of ['normal', 'error', 'empty'] as const) {
    assert.deepEqual(await read('demo-test-003', preview), { kind: 'unsupported' });
    assert.deepEqual(await read('unknown', preview), { kind: 'not-found' });
  }
  assert.deepEqual(await read('demo-test-001', 'empty'), { kind: 'unsupported' });
});

test('Missing/long/retry reads leave both fixture layers intact and never infer metadata', async () => {
  const before = JSON.stringify([TEST_FIXTURES, TEST_DETAIL_FIXTURES]);
  const missing = await read('demo-test-001', 'missing');
  if (missing.kind !== 'found') assert.fail('Expected missing-field projection');
  assert.deepEqual(missing.test, {
    id: 'demo-test-001',
    title: null,
    type: null,
    durationSeconds: null,
    questionCount: null,
    status: null,
  });
  const long = await read('demo-test-002', 'long');
  if (long.kind !== 'found') assert.fail('Expected long-name projection');
  assert.match(long.test.title!, /<strong>/);
  assert.equal(long.test.questionCount, null);
  await assert.rejects(read('demo-test-001', 'error'));
  const recovery = await read('demo-test-002', 'error', true);
  if (recovery.kind !== 'found') assert.fail('Expected exact current ID');
  assert.equal(recovery.test.id, 'demo-test-002');
  assert.equal(recovery.test.questionCount, null);
  await assert.rejects(read('demo-test-002', 'error'));
  assert.equal(JSON.stringify([TEST_FIXTURES, TEST_DETAIL_FIXTURES]), before);
});

test('Read cancellation before/during delay prevents stale results when the ID changes', async () => {
  const before = new AbortController();
  before.abort();
  await assert.rejects(
    repository.read('demo-test-001', { signal: before.signal, preview: 'normal', retry: false }),
    { name: 'AbortError' },
  );
  const during = new AbortController();
  const pending = repository.read('demo-test-001', {
    signal: during.signal,
    preview: 'slow',
    retry: false,
  });
  during.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const next = await read('demo-test-002');
  if (next.kind !== 'found') assert.fail('Expected new ID');
  assert.equal(next.test.id, 'demo-test-002');
});

test('Segments decode once; detail resolver accepts only one segment and keeps role destinations', () => {
  for (const id of ['a/b?<x>', 'a%2Fb', 'tiếng Việt', 'a%invalid']) {
    const segment = testDetailHref(id, new URLSearchParams()).split('?')[0].split('/').pop()!;
    assert.equal(decodeTestSegment(segment), id);
  }
  assert.equal(decodeTestSegment('%malformed'), '%malformed');
  assert.equal(resolveCmsDestination('/tests/demo-test-001')?.href, '/tests');
  assert.equal(resolveCmsDestination('/tests/unknown')?.role, 'CONTENT_ADMIN');
  for (const path of ['/tests/x/edit/extra', '/tests-other/x', '/users/x/extra', '/tests/'])
    assert.equal(resolveCmsDestination(path), undefined);
  assert.equal(resolveCmsDestination('/questions/demo-q-017')?.href, '/questions');
  assert.equal(resolveCmsDestination('/users')?.role, 'SYSTEM_ADMIN');
});
