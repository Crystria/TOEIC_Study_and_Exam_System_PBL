import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsTestMetadataContractError } from '../src/lib/tests/metadata-adapter';
import { CmsTestMetadataQueryError } from '../src/lib/tests/metadata-query';
import type { CmsTestMetadataQueryInput } from '../src/lib/tests/metadata-query-types';
import {
  CmsTestMetadataHttpError,
  CmsTestMetadataIdError,
  CmsTestMetadataTransportError,
  createCmsTestMetadataRepository,
} from '../src/lib/tests/metadata-repository';
import type { CmsTestMetadataTransport } from '../src/lib/tests/metadata-repository-types';
import { cmsMetadataBody, cmsMetadataListBody } from './fixtures/cms-test-metadata';
import { cmsMetadataQueryInput } from './fixtures/cms-test-metadata-query';
import { metadataTransportStub } from './fixtures/cms-test-metadata-transport';

const defaults: CmsTestMetadataQueryInput = Object.freeze({
  keyword: '',
  type: '',
  status: '',
  page: 1,
  size: 20,
});

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}

test('factory requires a transport and independent factories use their own injected GET', async () => {
  for (const invalid of [undefined, null, {}, { get: 1 }]) {
    assert.throws(
      () => createCmsTestMetadataRepository(invalid as unknown as CmsTestMetadataTransport),
      TypeError,
    );
  }
  const first = metadataTransportStub(() => ({ status: 200, body: cmsMetadataBody() }));
  const second = metadataTransportStub(() => ({ status: 404, body: null }));
  assert.equal(
    (await createCmsTestMetadataRepository(first.transport).read('opaque')).kind,
    'success',
  );
  assert.deepEqual(await createCmsTestMetadataRepository(second.transport).read('opaque'), {
    kind: 'not-found',
  });
  assert.equal(first.requests.length, 1);
  assert.equal(second.requests.length, 1);
});

test('list 200 composes mapper, GET stub and adapter without UI fields or input mutations', async () => {
  const body = frozen(cmsMetadataListBody());
  const response = Object.freeze({ status: 200, body });
  const before = structuredClone(response);
  const stub = metadataTransportStub(() => response);
  const repository = createCmsTestMetadataRepository(stub.transport);
  const result = await repository.list(defaults);
  assert.deepEqual(stub.requests, [{ path: '/api/v1/tests/cms-metadata?page=1&size=20' }]);
  assert.deepEqual(result, body);
  assert.notEqual(result, body);
  assert.notEqual(result.items, body.items);
  assert.deepEqual(Object.keys(result), ['items', 'total', 'page', 'size']);
  assert.equal(result.items[0].questionCount, 0);
  assert.equal(result.items[0].durationSeconds, 61);
  assert.equal(result.items[1].durationSeconds, 123);
  assert.equal(result.items[1].questionCount, null);
  assert.equal(result.items[1].status, 'CUSTOM_REVIEW');
  assert.deepEqual(Object.keys(result.items[0]), [
    'id',
    'title',
    'type',
    'durationSeconds',
    'questionCount',
    'status',
  ]);
  assert.deepEqual(response, before);
  assert.deepEqual(defaults, { keyword: '', type: '', status: '', page: 1, size: 20 });
});

test('list 200 keeps nullable metadata rather than inferring values from another item', async () => {
  const body = frozen(
    cmsMetadataListBody({
      items: [
        cmsMetadataBody({
          title: null,
          type: null,
          durationSeconds: null,
          questionCount: null,
          status: null,
        }),
      ],
      total: 1,
    }),
  );
  const stub = metadataTransportStub(() => ({ status: 200, body }));
  assert.deepEqual(await createCmsTestMetadataRepository(stub.transport).list(defaults), body);
});

for (const overrides of [
  { title: null, type: null, durationSeconds: null, questionCount: null, status: null },
  { type: 'FULL', durationSeconds: 61, questionCount: 0, status: 'CUSTOM_REVIEW' },
  { type: 'MINI', durationSeconds: 123, questionCount: 2, status: ' PUBLISHED ' },
]) {
  test(`detail 200 preserves explicit metadata ${JSON.stringify(overrides)}`, async () => {
    const body = frozen(cmsMetadataBody(overrides));
    const before = structuredClone(body);
    const stub = metadataTransportStub(() => Object.freeze({ status: 200, body }));
    const result = await createCmsTestMetadataRepository(stub.transport).read('opaque');
    assert.deepEqual(result, { kind: 'success', metadata: body });
    assert.equal(result.kind, 'success');
    if (result.kind !== 'success') assert.fail('Expected validated metadata');
    assert.notEqual(result.metadata, body);
    assert.deepEqual(body, before);
    assert.deepEqual(stub.requests, [{ path: '/api/v1/tests/cms-metadata/opaque' }]);
  });
}

for (const body of [
  cmsMetadataListBody({ items: [], total: 0, page: 1, size: 20 }),
  cmsMetadataListBody({ items: [], total: 7, page: 999, size: 3 }),
  cmsMetadataListBody({ total: 2, page: 42, size: 1 }),
]) {
  test(`list keeps API pagination without clamping or extra cross-field rules: ${body.page}/${body.total}`, async () => {
    const stub = metadataTransportStub(() => ({ status: 200, body: frozen(body) }));
    const query = Object.freeze({ ...defaults, page: 999 });
    const result = await createCmsTestMetadataRepository(stub.transport).list(query);
    assert.deepEqual(result, body);
    assert.equal(query.page, 999);
    assert.equal(stub.requests[0].path, '/api/v1/tests/cms-metadata?page=999&size=20');
  });
}

for (const [type, status] of [
  ['FULL', 'DRAFT'],
  ['MINI', 'PUBLISHED'],
  ['', 'ARCHIVED'],
  ['MINI', ''],
] as const) {
  test(`query filters ${type}/${status} preserve Unicode and encode only five parameters`, async () => {
    const keyword = ' Đề 日本語 🚀 & + / ? # % literal %2F e\u0301 ';
    const query = Object.freeze({
      ...defaults,
      keyword,
      type,
      status,
      page: 999,
      size: 3,
      demoRole: 'SYSTEM_ADMIN',
      testPreview: 'error',
      detailPreview: 'missing',
      returnTo: 'https://example.com',
      totalPages: 1,
      catalogTotal: 0,
    });
    const before = structuredClone(query);
    const stub = metadataTransportStub(() => ({ status: 200, body: cmsMetadataListBody() }));
    await createCmsTestMetadataRepository(stub.transport).list(query);
    assert.deepEqual(query, before);
    assert.deepEqual(Object.keys(stub.requests[0]), ['path']);
    const [pathname, search] = stub.requests[0].path.split('?');
    assert.equal(pathname, '/api/v1/tests/cms-metadata');
    const params = new URLSearchParams(search);
    assert.deepEqual(
      [...params.keys()],
      ['keyword', ...(type ? ['type'] : []), ...(status ? ['status'] : []), 'page', 'size'],
    );
    assert.equal(params.get('keyword'), keyword);
    assert.equal(params.get('type'), type || null);
    assert.equal(params.get('status'), status || null);
    assert.equal(params.get('page'), '999');
    assert.equal(params.get('size'), '3');
    assert.ok(search.includes('%252F'));
  });
}

test('UI-only getters are never read by repository query projection', async () => {
  const query = Object.freeze(
    Object.defineProperty({ ...defaults }, 'demoRole', {
      get() {
        assert.fail('UI-only field must not be read');
      },
    }),
  );
  const stub = metadataTransportStub(() => ({ status: 200, body: cmsMetadataListBody() }));
  await createCmsTestMetadataRepository(stub.transport).list(query);
  assert.deepEqual(stub.requests, [{ path: '/api/v1/tests/cms-metadata?page=1&size=20' }]);
});

for (const [id, segment] of [
  ['đề 日本語 🚀', '%C4%91%E1%BB%81%20%E6%97%A5%E6%9C%AC%E8%AA%9E%20%F0%9F%9A%80'],
  ['a/b?c#d%e', 'a%2Fb%3Fc%23d%25e'],
  ['%2F', '%252F'],
  ['%252F', '%25252F'],
  [' /?#% literal %2F ', '%20%2F%3F%23%25%20literal%20%252F%20'],
  [' demo-test-001 ', '%20demo-test-001%20'],
  ['not-a-uuid', 'not-a-uuid'],
  ['https://example.com/a?b#c', 'https%3A%2F%2Fexample.com%2Fa%3Fb%23c'],
] as const) {
  test(`opaque ID ${id} is preserved and encoded once as one path segment`, async () => {
    const body = frozen(cmsMetadataBody({ id }));
    const stub = metadataTransportStub(() => ({ status: 200, body }));
    const result = await createCmsTestMetadataRepository(stub.transport).read(id);
    assert.deepEqual(result, { kind: 'success', metadata: body });
    const request = stub.requests[0];
    assert.equal(request.path, `/api/v1/tests/cms-metadata/${segment}`);
    assert.equal(request.path.split('/').length, 6);
    assert.equal(request.path.includes('?'), false);
    assert.equal(request.path.includes('#'), false);
    assert.equal(decodeURIComponent(segment), id);
  });
}

for (const [input, path] of [
  [null, '$'],
  [undefined, '$'],
  [[], '$'],
  [{}, '$.keyword'],
  [cmsMetadataQueryInput({ keyword: null }), '$.keyword'],
  [cmsMetadataQueryInput({ type: 'FULL_TEST' }), '$.type'],
  [cmsMetadataQueryInput({ status: 'CUSTOM_REVIEW' }), '$.status'],
  [cmsMetadataQueryInput({ page: '1' }), '$.page'],
  [cmsMetadataQueryInput({ page: 0 }), '$.page'],
  [cmsMetadataQueryInput({ size: 51 }), '$.size'],
] as const) {
  test(`invalid query ${JSON.stringify(input)} keeps mapper error before any GET`, async () => {
    const stub = metadataTransportStub(() => {
      assert.fail('Must not call transport');
    });
    const before = structuredClone(input);
    await assert.rejects(
      createCmsTestMetadataRepository(stub.transport).list(
        frozen(input) as CmsTestMetadataQueryInput,
      ),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataQueryError);
        assert.equal(error.path, path);
        assert.ok(error.expected.length > 0);
        return true;
      },
    );
    assert.equal(stub.requests.length, 0);
    assert.deepEqual(input, before);
  });
}

for (const id of [undefined, null, 123, {}, [], '', ' \t\n', '\uD800', '\uDC00']) {
  test(`invalid ID ${JSON.stringify(id)} fails before any GET`, async () => {
    const stub = metadataTransportStub(() => {
      assert.fail('Must not call transport');
    });
    await assert.rejects(
      createCmsTestMetadataRepository(stub.transport).read(frozen(id) as string),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataIdError);
        assert.equal(error.path, '$.id');
        return true;
      },
    );
    assert.equal(stub.requests.length, 0);
  });
}

const { title: omittedTitle, ...missingTitle } = cmsMetadataBody();
void omittedTitle;
for (const [body, path] of [
  [missingTitle, '$.title'],
  [cmsMetadataBody({ questions: [] }), '$.questions'],
  [cmsMetadataBody({ questionCount: '0' }), '$.questionCount'],
  [cmsMetadataBody({ type: 'FULL_TEST' }), '$.type'],
  [{ data: cmsMetadataBody() }, '$.id'],
  [{ kind: 'found', test: cmsMetadataBody() }, '$.id'],
  [{ statusCode: 401, message: 'Illustrative API error' }, '$.id'],
  [null, '$'],
] as const) {
  test(`detail HTTP 200 invalid body retains adapter error ${path}`, async () => {
    const stub = metadataTransportStub(() => ({ status: 200, body: frozen(body) }));
    await assert.rejects(
      createCmsTestMetadataRepository(stub.transport).read('opaque'),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataContractError);
        assert.equal(error.path, path);
        assert.ok(error.expected.length > 0);
        return true;
      },
    );
    assert.equal(stub.requests.length, 1);
  });
}

const { total: omittedTotal, ...missingTotal } = cmsMetadataListBody();
void omittedTotal;
for (const [body, path] of [
  [missingTotal, '$.total'],
  [cmsMetadataListBody({ catalogTotal: 2 }), '$.catalogTotal'],
  [cmsMetadataListBody({ items: {} }), '$.items'],
  [
    cmsMetadataListBody({ items: [cmsMetadataBody(), cmsMetadataBody({ status: 123 })] }),
    '$.items[1].status',
  ],
  [cmsMetadataListBody({ total: '2' }), '$.total'],
  [cmsMetadataListBody({ size: 51 }), '$.size'],
  [{ data: cmsMetadataListBody() }, '$.items'],
  [cmsMetadataBody(), '$.items'],
  [{ statusCode: 500, message: 'Illustrative API error' }, '$.items'],
  [undefined, '$'],
] as const) {
  test(`list HTTP 200 invalid body retains adapter error ${path}`, async () => {
    const stub = metadataTransportStub(() => ({ status: 200, body: frozen(body) }));
    await assert.rejects(
      createCmsTestMetadataRepository(stub.transport).list(defaults),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataContractError);
        assert.equal(error.path, path);
        return true;
      },
    );
    assert.equal(stub.requests.length, 1);
  });
}

test('only detail HTTP 404 is not-found, regardless of its body; list 404 stays an HTTP error', async () => {
  for (const body of [
    null,
    { statusCode: 404, message: 'Illustrative missing record' },
    cmsMetadataBody(),
  ]) {
    const stub = metadataTransportStub(() => ({ status: 404, body: frozen(body) }));
    const repository = createCmsTestMetadataRepository(stub.transport);
    assert.deepEqual(await repository.read('demo-test-001'), { kind: 'not-found' });
    await assert.rejects(repository.list(defaults), (error: unknown) => {
      assert.ok(error instanceof CmsTestMetadataHttpError);
      assert.equal(error.status, 404);
      return true;
    });
    assert.equal(stub.requests.length, 2);
  }
});

for (const status of [201, 204, 301, 400, 401, 403, 429, 500]) {
  test(`HTTP ${status} is neither metadata nor a contract/transport/not-found result`, async () => {
    for (const body of [
      undefined,
      { statusCode: status, message: 'Illustrative error' },
      cmsMetadataListBody(),
      cmsMetadataBody(),
    ]) {
      const stub = metadataTransportStub(() => ({ status, body: frozen(body) }));
      const repository = createCmsTestMetadataRepository(stub.transport);
      for (const read of [() => repository.list(defaults), () => repository.read('opaque')]) {
        await assert.rejects(read, (error: unknown) => {
          assert.ok(error instanceof CmsTestMetadataHttpError);
          assert.equal(error.status, status);
          return true;
        });
      }
      assert.equal(stub.requests.length, 2);
    }
  });
}

test('non-200 statuses never read the error body as metadata', async () => {
  for (const status of [204, 401, 404, 500]) {
    const response = Object.freeze({
      status,
      get body(): unknown {
        return assert.fail('Must not read error body');
      },
    });
    const stub = metadataTransportStub(() => response);
    const repository = createCmsTestMetadataRepository(stub.transport);
    await assert.rejects(repository.list(defaults), CmsTestMetadataHttpError);
    if (status === 404) assert.deepEqual(await repository.read('opaque'), { kind: 'not-found' });
    else await assert.rejects(repository.read('opaque'), CmsTestMetadataHttpError);
  }
});

for (const cause of [new Error('Illustrative network failure'), { status: 404 }, 'offline', null]) {
  test(`transport reject ${JSON.stringify(cause)} preserves cause without retries or demo fallback`, async () => {
    const stub = metadataTransportStub(() => {
      throw cause;
    });
    const repository = createCmsTestMetadataRepository(stub.transport);
    for (const read of [() => repository.list(defaults), () => repository.read('demo-test-001')]) {
      await assert.rejects(read, (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataTransportError);
        assert.equal(error.cause, cause);
        return true;
      });
    }
    assert.equal(stub.requests.length, 2);
  });
}

test('synchronous transport throws are classified; successful reads are not cached or mutated', async () => {
  const cause = new Error('Synchronous injected failure');
  const repository = createCmsTestMetadataRepository({
    get() {
      throw cause;
    },
  });
  await assert.rejects(repository.read('opaque'), (error: unknown) => {
    assert.ok(error instanceof CmsTestMetadataTransportError);
    assert.equal(error.cause, cause);
    return true;
  });
  const body = frozen(cmsMetadataBody());
  const before = structuredClone(body);
  const stub = metadataTransportStub(() => ({ status: 200, body }));
  const uncached = createCmsTestMetadataRepository(stub.transport);
  const first = await uncached.read('opaque');
  const second = await uncached.read('opaque');
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(stub.requests.length, 2);
  assert.deepEqual(body, before);
});
