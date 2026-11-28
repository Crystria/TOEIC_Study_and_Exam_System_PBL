import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CmsTestMetadataContractError,
  parseCmsTestMetadataDetail,
  parseCmsTestMetadataList,
} from '../src/lib/tests/metadata-adapter';
import {
  toCmsTestMetadataPageView,
  toCmsTestMetadataView,
} from '../src/lib/tests/metadata-presentation';
import { cmsMetadataBody, cmsMetadataListBody } from './fixtures/cms-test-metadata';

const metadataKeys = ['id', 'title', 'type', 'durationSeconds', 'questionCount', 'status'];
const pageKeys = ['items', 'total', 'page', 'size'];

function freezeDeep(value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
}

function rejectsContract(read: () => unknown, path: string): void {
  assert.throws(read, (error: unknown) => {
    assert.ok(error instanceof CmsTestMetadataContractError);
    assert.equal(error.name, 'CmsTestMetadataContractError');
    assert.equal(error.path, path);
    assert.ok(error.expected.length > 0);
    assert.ok(error.message.includes(path));
    return true;
  });
}

test('valid detail/list bodies and presentation leave deeply frozen input intact', () => {
  const detail = cmsMetadataBody();
  const list = cmsMetadataListBody();
  const before = structuredClone({ detail, list });
  freezeDeep(detail);
  freezeDeep(list);
  const parsedDetail = parseCmsTestMetadataDetail(detail);
  const parsedList = parseCmsTestMetadataList(list);
  assert.deepEqual(parsedDetail, detail);
  assert.deepEqual(parsedList, list);
  assert.notEqual(parsedDetail, detail);
  assert.notEqual(parsedList.items, list.items);
  assert.notEqual(parsedList.items[0], parsedDetail);
  freezeDeep(parsedDetail);
  freezeDeep(parsedList);
  toCmsTestMetadataView(parsedDetail);
  toCmsTestMetadataPageView(parsedList);
  assert.deepEqual({ detail, list }, before);
  assert.deepEqual(Object.keys(parsedDetail), metadataKeys);
  assert.deepEqual(Object.keys(parsedList), pageKeys);
});

for (const key of metadataKeys.filter((key) => key !== 'id')) {
  test(`nullable ${key} remains null in detail and list`, () => {
    const body = cmsMetadataBody({ [key]: null });
    assert.equal(Reflect.get(parseCmsTestMetadataDetail(body), key), null);
    const page = parseCmsTestMetadataList(cmsMetadataListBody({ items: [body] }));
    assert.equal(Reflect.get(page.items[0], key), null);
  });
}

test('all null metadata display missing text without replacing raw values', () => {
  const raw = cmsMetadataBody({
    title: null,
    type: null,
    durationSeconds: null,
    questionCount: null,
    status: null,
  });
  const parsed = parseCmsTestMetadataDetail(raw);
  assert.deepEqual(toCmsTestMetadataView(parsed), {
    id: 'demo-test-001',
    titleText: 'Chưa có dữ liệu',
    typeText: 'Chưa có dữ liệu',
    durationText: 'Chưa có dữ liệu',
    questionCountText: 'Chưa có dữ liệu',
    status: { kind: 'missing', label: 'Chưa có dữ liệu', rawCode: null },
  });
  assert.deepEqual(parsed, raw);
});

test('zero count differs from null and neither type supplies duration/count/status', () => {
  const parsed = parseCmsTestMetadataList(cmsMetadataListBody());
  const view = toCmsTestMetadataPageView(parsed);
  assert.equal(parsed.items[0].questionCount, 0);
  assert.equal(parsed.items[1].questionCount, null);
  assert.equal(view.items[0].questionCountText, '0 câu');
  assert.equal(view.items[1].questionCountText, 'Chưa có dữ liệu');
  assert.equal(view.items[0].typeText, 'Full Test');
  assert.equal(view.items[1].typeText, 'Mini Test');
  assert.equal(view.items[0].durationText, '1 phút 1 giây');
  assert.equal(view.items[1].durationText, '2 phút 3 giây');
  for (const type of ['FULL', 'MINI', null]) {
    const item = parseCmsTestMetadataDetail(
      cmsMetadataBody({ type, durationSeconds: null, questionCount: null, status: null }),
    );
    assert.equal(item.durationSeconds, null);
    assert.equal(item.questionCount, null);
    assert.equal(item.status, null);
  }
});

for (const [seconds, label] of [
  [1, '0 phút 1 giây'],
  [60, '1 phút'],
  [61, '1 phút 1 giây'],
  [123, '2 phút 3 giây'],
  [7200, '120 phút'],
] as const) {
  test(`explicit ${seconds} seconds displays ${label}`, () => {
    const item = parseCmsTestMetadataDetail(cmsMetadataBody({ durationSeconds: seconds }));
    assert.equal(item.durationSeconds, seconds);
    assert.equal(toCmsTestMetadataView(item).durationText, label);
  });
}

for (const [code, label] of [
  ['DRAFT', 'Bản nháp'],
  ['PUBLISHED', 'Đã xuất bản'],
  ['ARCHIVED', 'Đã lưu trữ'],
] as const) {
  test(`known status ${code} keeps raw code beside its display label`, () => {
    const item = parseCmsTestMetadataDetail(cmsMetadataBody({ status: code }));
    assert.deepEqual(toCmsTestMetadataView(item).status, { kind: 'known', label, rawCode: code });
    assert.equal(item.status, code);
  });
}

for (const code of [
  'CUSTOM_REVIEW',
  'draft',
  '__proto__',
  'constructor',
  ' PUBLISHED ',
  '<b>Lạ</b>',
]) {
  test(`unknown status ${code} has an explicit fallback and preserves exact text`, () => {
    const item = parseCmsTestMetadataDetail(cmsMetadataBody({ status: code }));
    assert.equal(item.status, code);
    assert.deepEqual(toCmsTestMetadataView(item).status, {
      kind: 'unknown',
      label: `Trạng thái chưa hỗ trợ (${code})`,
      rawCode: code,
    });
  });
}

test('opaque IDs and non-blank text retain whitespace, Unicode and markup as text', () => {
  const body = cmsMetadataBody({
    id: ' opaque/id? ',
    title: ' <b>Đề thi</b> 日本語\n ',
    status: ' X ',
  });
  const item = parseCmsTestMetadataDetail(body);
  assert.deepEqual(item, body);
  assert.equal(toCmsTestMetadataView(item).titleText, body.title);
});

for (const key of metadataKeys) {
  test(`missing ${key} is rejected in detail and list, including nullable fields`, () => {
    const body = cmsMetadataBody();
    delete body[key];
    rejectsContract(() => parseCmsTestMetadataDetail(body), `$.${key}`);
    rejectsContract(
      () => parseCmsTestMetadataList(cmsMetadataListBody({ items: [body] })),
      `$.items[0].${key}`,
    );
  });
}

for (const key of ['catalogTotal', '_count', 'questions', 'description', 'statusCode']) {
  test(`additional item key ${key} is rejected without changing input`, () => {
    const body = cmsMetadataBody({ [key]: 1 });
    const before = structuredClone(body);
    rejectsContract(() => parseCmsTestMetadataDetail(body), `$.${key}`);
    rejectsContract(
      () => parseCmsTestMetadataList(cmsMetadataListBody({ items: [cmsMetadataBody(), body] })),
      `$.items[1].${key}`,
    );
    assert.deepEqual(body, before);
  });
}

const invalidText: unknown[] = ['', ' \n\t ', 1, false, {}, [], undefined];
for (const key of ['id', 'title', 'status']) {
  for (const [index, value] of [...invalidText, ...(key === 'id' ? [null] : [])].entries()) {
    test(`invalid ${key} text case ${index} is rejected, not repaired`, () => {
      rejectsContract(
        () => parseCmsTestMetadataDetail(cmsMetadataBody({ [key]: value })),
        `$.${key}`,
      );
    });
  }
}

for (const value of [
  'FULL_TEST',
  'MINI_TEST',
  'PRACTICE',
  'MOCK_TEST',
  'full',
  '',
  1,
  {},
  undefined,
]) {
  test(`invalid type ${String(value)} is rejected without enum conversion`, () => {
    rejectsContract(() => parseCmsTestMetadataDetail(cmsMetadataBody({ type: value })), '$.type');
  });
}

const invalidNumbers: unknown[] = [
  -1,
  1.5,
  NaN,
  Infinity,
  -Infinity,
  '2',
  '',
  false,
  {},
  [],
  undefined,
];
for (const key of ['durationSeconds', 'questionCount']) {
  for (const [index, value] of [
    ...invalidNumbers,
    ...(key === 'durationSeconds' ? [0] : []),
  ].entries()) {
    test(`invalid ${key} numeric case ${index} is rejected without coercion`, () => {
      rejectsContract(
        () => parseCmsTestMetadataDetail(cmsMetadataBody({ [key]: value })),
        `$.${key}`,
      );
    });
  }
}

for (const key of pageKeys) {
  test(`missing envelope key ${key} is rejected`, () => {
    const body = cmsMetadataListBody();
    delete body[key];
    rejectsContract(() => parseCmsTestMetadataList(body), `$.${key}`);
  });
}
for (const key of ['catalogTotal', 'totalPages', 'data', 'statusCode']) {
  test(`additional envelope key ${key} is rejected`, () => {
    rejectsContract(() => parseCmsTestMetadataList(cmsMetadataListBody({ [key]: 1 })), `$.${key}`);
  });
}
for (const key of ['total', 'page', 'size']) {
  const values = [
    ...invalidNumbers,
    null,
    ...(key === 'total' ? [] : [0]),
    ...(key === 'size' ? [51] : []),
  ];
  for (const [index, value] of values.entries()) {
    test(`invalid envelope ${key} numeric case ${index} is rejected`, () => {
      rejectsContract(
        () => parseCmsTestMetadataList(cmsMetadataListBody({ [key]: value })),
        `$.${key}`,
      );
    });
  }
}
for (const [index, value] of [null, undefined, false, 1, 'body', []].entries()) {
  test(`invalid root case ${index} is rejected by both parsers`, () => {
    rejectsContract(() => parseCmsTestMetadataDetail(value), '$');
    rejectsContract(() => parseCmsTestMetadataList(value), '$');
  });
}
for (const [index, items] of [null, undefined, {}, '[]', 1, false].entries()) {
  test(`invalid items container case ${index} is rejected`, () => {
    rejectsContract(() => parseCmsTestMetadataList(cmsMetadataListBody({ items })), '$.items');
  });
}
for (const [index, item] of [null, undefined, {}, [], 'metadata', 0].entries()) {
  test(`invalid list item case ${index} is rejected at its path`, () => {
    const path =
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? '$.items[0].id'
        : '$.items[0]';
    rejectsContract(() => parseCmsTestMetadataList(cmsMetadataListBody({ items: [item] })), path);
  });
}

test('inherited required keys and sparse item arrays cannot bypass validation', () => {
  const inherited: unknown = Object.create(cmsMetadataBody());
  rejectsContract(() => parseCmsTestMetadataDetail(inherited), '$.id');
  rejectsContract(
    () => parseCmsTestMetadataList(cmsMetadataListBody({ items: new Array(1) })),
    '$.items[0]',
  );
});

for (const [total, size, page, totalPages] of [
  [0, 20, 1, 1],
  [0, 1, 8, 1],
  [1, 1, 1, 1],
  [20, 20, 1, 1],
  [21, 20, 1, 2],
  [51, 50, 999, 2],
] as const) {
  test(`empty items total=${total} size=${size} page=${page} keeps response page; UI derives ${totalPages}`, () => {
    const body = cmsMetadataListBody({ items: [], total, size, page });
    const parsed = parseCmsTestMetadataList(body);
    assert.deepEqual(parsed, body);
    const view = toCmsTestMetadataPageView(parsed);
    assert.deepEqual(view, { items: [], total, size, page, totalPages });
    assert.equal(Object.hasOwn(parsed, 'totalPages'), false);
    assert.equal(Object.hasOwn(parsed, 'catalogTotal'), false);
    assert.equal(Object.hasOwn(view, 'catalogTotal'), false);
  });
}

test('does not invent cross-field, uniqueness or safe-integer restrictions outside the contract', () => {
  const item = cmsMetadataBody({ questionCount: 9007199254740992, durationSeconds: 1 });
  const body = cmsMetadataListBody({
    items: [item, item],
    total: 0,
    page: 9007199254740992,
    size: 1,
  });
  assert.deepEqual(parseCmsTestMetadataList(body), body);
});

for (const statusCode of [400, 401, 403, 404, 429, 500]) {
  test(`API error body ${statusCode} never becomes successful metadata or a demo fallback`, () => {
    const body: unknown = { statusCode, message: 'Illustrative API error', error: 'Stub error' };
    rejectsContract(() => parseCmsTestMetadataDetail(body), '$.id');
    rejectsContract(() => parseCmsTestMetadataList(body), '$.items');
    rejectsContract(
      () => parseCmsTestMetadataList(cmsMetadataListBody({ items: [body] })),
      '$.items[0].id',
    );
  });
}

test('detail/list and demo-style wrappers cannot be mistaken for each other', () => {
  rejectsContract(() => parseCmsTestMetadataDetail(cmsMetadataListBody()), '$.id');
  rejectsContract(() => parseCmsTestMetadataList(cmsMetadataBody()), '$.items');
  rejectsContract(
    () => parseCmsTestMetadataDetail({ kind: 'found', test: cmsMetadataBody() }),
    '$.id',
  );
});
