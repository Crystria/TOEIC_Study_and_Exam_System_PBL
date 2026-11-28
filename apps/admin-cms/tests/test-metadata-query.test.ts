import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CmsTestMetadataQueryError,
  mapCmsTestMetadataQuery,
  serializeCmsTestMetadataQuery,
} from '../src/lib/tests/metadata-query';
import type { CmsTestMetadataQueryInput } from '../src/lib/tests/metadata-query-types';
import { parseCmsTestMetadataDetail } from '../src/lib/tests/metadata-adapter';
import { toCmsTestMetadataView } from '../src/lib/tests/metadata-presentation';
import { readTestParams } from '../src/lib/tests/query';
import { DEFAULT_TEST_QUERY } from '../src/lib/tests/types';
import { cmsMetadataQueryInput } from './fixtures/cms-test-metadata-query';
import { cmsMetadataBody } from './fixtures/cms-test-metadata';

const allowedKeys = ['keyword', 'type', 'status', 'page', 'size'];

function rejectsQuery(input: unknown, expectedPath: string): void {
  for (const read of [mapCmsTestMetadataQuery, serializeCmsTestMetadataQuery]) {
    assert.throws(
      () => read(input),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataQueryError);
        assert.equal(error.name, 'CmsTestMetadataQueryError');
        assert.equal(error.path, expectedPath);
        assert.ok(error.expected.length > 0);
        assert.ok(error.message.includes(expectedPath));
        return true;
      },
    );
  }
}

test('normalized UI defaults are compatible, omit empty filters and always send page/size', () => {
  const input: CmsTestMetadataQueryInput = DEFAULT_TEST_QUERY;
  assert.deepEqual(mapCmsTestMetadataQuery(input), { page: 1, size: 20 });
  assert.equal(serializeCmsTestMetadataQuery(input), 'page=1&size=20');
  assert.deepEqual(readTestParams(new URLSearchParams()).query, input);
});

for (const type of ['', 'FULL', 'MINI']) {
  for (const status of ['', 'DRAFT', 'PUBLISHED', 'ARCHIVED']) {
    test(`filter combination type=${type || 'empty'} status=${status || 'empty'} is projected`, () => {
      const input = cmsMetadataQueryInput({ keyword: 'TOEIC', type, status });
      const mapped = mapCmsTestMetadataQuery(input);
      assert.deepEqual(mapped, {
        keyword: 'TOEIC',
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        page: 1,
        size: 20,
      });
      const params = new URLSearchParams(serializeCmsTestMetadataQuery(input));
      assert.equal(params.get('keyword'), 'TOEIC');
      assert.equal(params.get('type'), type || null);
      assert.equal(params.get('status'), status || null);
      assert.deepEqual(readTestParams(params).query, input);
    });
  }
}

for (const [page, size] of [
  [1, 1],
  [2, 3],
  [999, 50],
  [Number.MAX_SAFE_INTEGER, 20],
] as const) {
  test(`pagination preserves page=${page} size=${size} without catalog/page-count inference`, () => {
    const input = cmsMetadataQueryInput({ page, size, total: 0, totalPages: 1, catalogTotal: 0 });
    assert.deepEqual(mapCmsTestMetadataQuery(input), { page, size });
    const params = new URLSearchParams(serializeCmsTestMetadataQuery(input));
    assert.equal(params.get('page'), String(page));
    assert.equal(params.get('size'), String(size));
    assert.equal(params.size, 2);
  });
}

for (const keyword of [
  'Đề thi tổng hợp',
  'ĐỀ thi  日本語 🚀',
  'A&B',
  'A+B',
  'A?B#C/D',
  '100% đúng',
  'literal %2F %26 %25',
  'A & B + C ? # / % 日本語',
]) {
  test(`keyword ${keyword} survives serialization and parser round trip`, () => {
    const input = cmsMetadataQueryInput({ keyword });
    const serialized = serializeCmsTestMetadataQuery(input);
    assert.equal(serialized.startsWith('?'), false);
    const params = new URLSearchParams(serialized);
    assert.equal(params.get('keyword'), keyword);
    assert.equal(params.getAll('keyword').length, 1);
    assert.deepEqual(readTestParams(params).query, input);
    assert.equal(serializeCmsTestMetadataQuery(readTestParams(params).query), serialized);
  });
}

test('standard encoding distinguishes literal plus, percent text, separators and space', () => {
  const input = cmsMetadataQueryInput({ keyword: '+ %2F & ? # / %' });
  const serialized = serializeCmsTestMetadataQuery(input);
  assert.equal(serialized, 'keyword=%2B+%252F+%26+%3F+%23+%2F+%25&page=1&size=20');
  assert.equal(new URLSearchParams(serialized).get('keyword'), input.keyword);
});

test('mapper does not trim, lowercase, normalize Unicode or decode its input', () => {
  for (const keyword of ['  ĐỀ THI  ', ' \t ', 'Tiếng Việt', 'A%2FB+C']) {
    const input = cmsMetadataQueryInput({ keyword });
    assert.equal(mapCmsTestMetadataQuery(input).keyword, keyword);
    assert.equal(new URLSearchParams(serializeCmsTestMetadataQuery(input)).get('keyword'), keyword);
  }
});

test('extra UI fields are ignored without reading them or mutating frozen input', () => {
  const input = cmsMetadataQueryInput({
    keyword: 'Đề thi',
    type: 'MINI',
    status: 'ARCHIVED',
    page: 999,
  });
  for (const key of [
    'demoRole',
    'testPreview',
    'detailPreview',
    'returnTo',
    'catalogTotal',
    'totalPages',
    'other',
  ]) {
    Object.defineProperty(input, key, {
      enumerable: true,
      get() {
        throw new Error(`Unexpected extra UI field read: ${key}`);
      },
    });
  }
  Object.freeze(input);
  const expected = { keyword: 'Đề thi', type: 'MINI', status: 'ARCHIVED', page: 999, size: 20 };
  const mapped = mapCmsTestMetadataQuery(input);
  assert.deepEqual(mapped, expected);
  assert.notEqual(mapped, input);
  assert.deepEqual(Object.keys(mapped), allowedKeys);
  const params = new URLSearchParams(serializeCmsTestMetadataQuery(input));
  assert.deepEqual([...params.keys()], allowedKeys);
  assert.equal(input.page, 999);
  assert.ok(Object.isFrozen(input));
});

test('both functions leave valid and invalid deeply frozen fixtures intact', () => {
  for (const status of ['DRAFT', 'CUSTOM_REVIEW']) {
    const extra = Object.freeze({ page: 1 });
    const input = Object.freeze(cmsMetadataQueryInput({ status, extra }));
    const before = structuredClone(input);
    if (status === 'DRAFT') {
      mapCmsTestMetadataQuery(input);
      serializeCmsTestMetadataQuery(input);
    } else rejectsQuery(input, '$.status');
    assert.deepEqual(input, before);
    assert.equal(input.extra, extra);
  }
});

test('demo parser owns URL normalization; mapper only projects its normalized query', () => {
  const params = new URLSearchParams({
    keyword: '  ĐỀ thi & 日本語  ',
    type: 'MINI',
    status: 'PUBLISHED',
    page: '999',
    size: '3',
    demoRole: 'SYSTEM_ADMIN',
    testPreview: 'slow',
    detailPreview: 'missing',
    returnTo: 'https://example.invalid/users',
  });
  const before = params.toString();
  const parsed = readTestParams(params);
  assert.equal(parsed.role, 'SYSTEM_ADMIN');
  assert.equal(parsed.preview, 'slow');
  assert.equal(parsed.query.keyword, 'ĐỀ thi & 日本語');
  const mapped = mapCmsTestMetadataQuery(parsed.query);
  assert.deepEqual(mapped, {
    keyword: 'ĐỀ thi & 日本語',
    type: 'MINI',
    status: 'PUBLISHED',
    page: 999,
    size: 3,
  });
  const output = new URLSearchParams(serializeCmsTestMetadataQuery(parsed.query));
  assert.deepEqual([...output.keys()], allowedKeys);
  assert.equal(output.get('page'), '999');
  assert.equal(params.toString(), before);
  rejectsQuery(parsed, '$.keyword');
});

test('existing parser normalizes invalid/repeated URL values before mapping; mapper never does', () => {
  const parsed = readTestParams(
    new URLSearchParams(
      'keyword=a&keyword=b&type=FULL&type=MINI&status=CUSTOM_REVIEW&page=0&size=51&demoRole=bad&testPreview=bad',
    ),
  );
  assert.equal(parsed.corrected, true);
  assert.deepEqual(parsed.query, DEFAULT_TEST_QUERY);
  assert.deepEqual(mapCmsTestMetadataQuery(parsed.query), { page: 1, size: 20 });
  rejectsQuery(cmsMetadataQueryInput({ page: '1' }), '$.page');
  rejectsQuery(cmsMetadataQueryInput({ status: 'CUSTOM_REVIEW' }), '$.status');
});

test('unknown response status remains valid display data but is rejected as a query filter', () => {
  const metadata = parseCmsTestMetadataDetail(cmsMetadataBody({ status: 'CUSTOM_REVIEW' }));
  assert.equal(metadata.status, 'CUSTOM_REVIEW');
  assert.equal(toCmsTestMetadataView(metadata).status.kind, 'unknown');
  rejectsQuery(cmsMetadataQueryInput({ status: metadata.status }), '$.status');
});

for (const key of allowedKeys) {
  test(`missing normalized query key ${key} fails instead of supplying defaults`, () => {
    const input = cmsMetadataQueryInput();
    delete input[key];
    rejectsQuery(Object.freeze(input), `$.${key}`);
  });
}

for (const [index, value] of [null, undefined, 1, false, [], {}, ['text']].entries()) {
  test(`wrong keyword type case ${index} fails`, () => {
    rejectsQuery(cmsMetadataQueryInput({ keyword: value }), '$.keyword');
  });
}
for (const [index, value] of [
  null,
  undefined,
  false,
  1,
  [],
  {},
  'FULL_TEST',
  'MINI_TEST',
  'PRACTICE',
  'MOCK_TEST',
  'full',
  ' FULL ',
].entries()) {
  test(`invalid type filter case ${index} fails without enum repair`, () => {
    rejectsQuery(cmsMetadataQueryInput({ type: value }), '$.type');
  });
}
for (const [index, value] of [
  null,
  undefined,
  false,
  1,
  [],
  {},
  'CUSTOM_REVIEW',
  'draft',
  ' PUBLISHED ',
  '__proto__',
  'constructor',
].entries()) {
  test(`invalid status filter case ${index} fails without fallback or conversion`, () => {
    rejectsQuery(cmsMetadataQueryInput({ status: value }), '$.status');
  });
}

const invalidNumbers: unknown[] = [
  null,
  undefined,
  -1,
  0,
  1.5,
  NaN,
  Infinity,
  -Infinity,
  '2',
  '',
  false,
  true,
  [],
  {},
];
for (const key of ['page', 'size']) {
  for (const [index, value] of [...invalidNumbers, ...(key === 'size' ? [51] : [])].entries()) {
    test(`invalid ${key} case ${index} fails without numeric coercion or clamp`, () => {
      rejectsQuery(cmsMetadataQueryInput({ [key]: value }), `$.${key}`);
    });
  }
}
for (const [index, value] of [
  null,
  undefined,
  '',
  1,
  false,
  [],
  new URLSearchParams('page=1&size=20'),
].entries()) {
  test(`invalid input root case ${index} is not a normalized query`, () => {
    rejectsQuery(value, value instanceof URLSearchParams ? '$.keyword' : '$');
  });
}

test('inherited query keys do not masquerade as the normalized parser result', () => {
  const input: unknown = Object.create(cmsMetadataQueryInput());
  rejectsQuery(input, '$.keyword');
});
