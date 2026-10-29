import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsTestMetadataContractError } from '../src/lib/tests/metadata-adapter';
import { createCmsTestMetadataTransport } from '../src/lib/tests/metadata-fetch-transport';
import type {
  CmsTestMetadataFetcher,
  CmsTestMetadataFetchResponse,
} from '../src/lib/tests/metadata-fetch-types';
import { CmsTestMetadataQueryError } from '../src/lib/tests/metadata-query';
import type { CmsTestMetadataQueryInput } from '../src/lib/tests/metadata-query-types';
import {
  CmsTestMetadataHttpError,
  CmsTestMetadataIdError,
  CmsTestMetadataTransportError,
  createCmsTestMetadataRepository,
} from '../src/lib/tests/metadata-repository';
import { cmsMetadataBody, cmsMetadataListBody } from './fixtures/cms-test-metadata';
import { metadataFetchResponse, metadataFetcherStub } from './fixtures/cms-test-metadata-fetch';

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

test('factory has no fetcher default and rejects non-functions before any work', () => {
  for (const invalid of [undefined, null, {}, 1, 'fetcher']) {
    assert.throws(
      () => createCmsTestMetadataTransport(invalid as unknown as CmsTestMetadataFetcher),
      TypeError,
    );
  }
});

for (const body of [
  frozen(cmsMetadataListBody()),
  frozen(cmsMetadataBody()),
  frozen({ error: 'Illustrative API error as JSON' }),
  frozen(['JSON array']),
  'JSON string',
  0,
  false,
  null,
]) {
  test(`transport 200 returns unknown JSON unchanged: ${JSON.stringify(body)}`, async () => {
    const json = metadataFetchResponse(200, body);
    const stub = metadataFetcherStub(() => json.response);
    const request = Object.freeze({ path: '/api/v1/tests/cms-metadata?page=1&size=20' });
    const before = structuredClone({ request, body });
    const result = await createCmsTestMetadataTransport(stub.fetcher).get(request);
    assert.equal(result.status, 200);
    assert.equal(result.body, body);
    assert.deepEqual(Object.keys(result), ['status', 'body']);
    assert.equal(json.jsonReads, 1);
    assert.deepEqual(stub.calls, [{ path: request.path, options: { method: 'GET' } }]);
    assert.deepEqual({ request, body }, before);
    assert.equal(Object.isFrozen(stub.calls[0].options), true);
  });
}

test('transport calls json as a response method and keeps status read before JSON', async () => {
  const body = frozen(cmsMetadataBody());
  let reads = 0;
  const response = Object.freeze({
    get status() {
      reads++;
      return 200;
    },
    async json() {
      assert.equal(this, response);
      return body;
    },
  });
  const stub = metadataFetcherStub(() => response);
  assert.deepEqual(await createCmsTestMetadataTransport(stub.fetcher).get({ path: '/opaque' }), {
    status: 200,
    body,
  });
  assert.equal(reads, 1);
});

for (const status of [201, 204, 301, 302, 307, 308, 400, 401, 403, 404, 429, 500]) {
  test(`HTTP ${status} skips JSON and retains HTTP/not-found decisions in repository`, async () => {
    let jsonReads = 0;
    const response: CmsTestMetadataFetchResponse = Object.freeze({
      status,
      async json() {
        jsonReads++;
        throw new SyntaxError('Illustrative non-JSON body');
      },
    });
    const stub = metadataFetcherStub(() => response);
    const transport = createCmsTestMetadataTransport(stub.fetcher);
    assert.deepEqual(await transport.get({ path: '/api/v1/tests/cms-metadata' }), {
      status,
      body: undefined,
    });
    const repository = createCmsTestMetadataRepository(transport);
    await assert.rejects(repository.list(defaults), (error: unknown) => {
      assert.ok(error instanceof CmsTestMetadataHttpError);
      assert.equal(error.status, status);
      return true;
    });
    if (status === 404) {
      assert.deepEqual(await repository.read('demo-test-001'), { kind: 'not-found' });
    } else {
      await assert.rejects(repository.read('demo-test-001'), (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataHttpError);
        assert.equal(error.status, status);
        return true;
      });
    }
    assert.equal(jsonReads, 0);
    assert.equal(stub.calls.length, 3);
  });
}

test('non-200 does not even access the json property', async () => {
  const response: CmsTestMetadataFetchResponse = Object.freeze({
    status: 404,
    get json(): () => Promise<unknown> {
      return assert.fail('Must not access json');
    },
  });
  const stub = metadataFetcherStub(() => response);
  const repository = createCmsTestMetadataRepository(createCmsTestMetadataTransport(stub.fetcher));
  assert.deepEqual(await repository.read('opaque'), { kind: 'not-found' });
  assert.equal(stub.calls.length, 1);
});

test('full list chain keeps nullable/count/status/duration values and API page without UI fields', async () => {
  const body = frozen(cmsMetadataListBody({ page: 999 }));
  const before = structuredClone(body);
  const json = metadataFetchResponse(200, body);
  const stub = metadataFetcherStub(() => json.response);
  const repository = createCmsTestMetadataRepository(createCmsTestMetadataTransport(stub.fetcher));
  const result = await repository.list(defaults);
  assert.deepEqual(result, body);
  assert.notEqual(result, body);
  assert.equal(result.items[0].questionCount, 0);
  assert.equal(result.items[0].durationSeconds, 61);
  assert.equal(result.items[1].questionCount, null);
  assert.equal(result.items[1].durationSeconds, 123);
  assert.equal(result.items[1].status, 'CUSTOM_REVIEW');
  assert.deepEqual(Object.keys(result), ['items', 'total', 'page', 'size']);
  assert.deepEqual(stub.calls, [
    {
      path: '/api/v1/tests/cms-metadata?page=1&size=20',
      options: { method: 'GET' },
    },
  ]);
  assert.equal(json.jsonReads, 1);
  assert.deepEqual(body, before);
});

for (const [type, status] of [
  ['FULL', 'DRAFT'],
  ['MINI', 'PUBLISHED'],
  ['', 'ARCHIVED'],
  ['MINI', ''],
] as const) {
  test(`full query chain ${type}/${status} preserves encoding and five-parameter allowlist`, async () => {
    const keyword = ' Đề 日本語 🚀 + & / ? # % literal %2F e\u0301 ';
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
      returnTo: '/other',
    });
    const before = structuredClone(query);
    const body = frozen(cmsMetadataListBody({ items: [], total: 2, page: 999, size: 3 }));
    const json = metadataFetchResponse(200, body);
    const stub = metadataFetcherStub(() => json.response);
    const repository = createCmsTestMetadataRepository(
      createCmsTestMetadataTransport(stub.fetcher),
    );
    assert.deepEqual(await repository.list(query), body);
    const expectedSearch = new URLSearchParams({ keyword });
    if (type) expectedSearch.set('type', type);
    if (status) expectedSearch.set('status', status);
    expectedSearch.set('page', '999');
    expectedSearch.set('size', '3');
    assert.deepEqual(stub.calls, [
      {
        path: `/api/v1/tests/cms-metadata?${expectedSearch}`,
        options: { method: 'GET' },
      },
    ]);
    assert.equal(new URLSearchParams(expectedSearch).get('keyword'), keyword);
    assert.ok(stub.calls[0].path.includes('%252F'));
    assert.deepEqual(query, before);
    assert.equal(json.jsonReads, 1);
  });
}

for (const [id, segment] of [
  ['đề 日本語 🚀', '%C4%91%E1%BB%81%20%E6%97%A5%E6%9C%AC%E8%AA%9E%20%F0%9F%9A%80'],
  ['a/b?c#d%e', 'a%2Fb%3Fc%23d%25e'],
  ['%2F', '%252F'],
  ['%252F', '%25252F'],
  [' /?#% literal %2F ', '%20%2F%3F%23%25%20literal%20%252F%20'],
] as const) {
  test(`full detail chain preserves opaque ID ${id} without another encoding step`, async () => {
    const body = frozen(cmsMetadataBody({ id, title: null, type: null, status: null }));
    const json = metadataFetchResponse(200, body);
    const stub = metadataFetcherStub(() => json.response);
    const repository = createCmsTestMetadataRepository(
      createCmsTestMetadataTransport(stub.fetcher),
    );
    assert.deepEqual(await repository.read(id), { kind: 'success', metadata: body });
    assert.deepEqual(stub.calls, [
      {
        path: `/api/v1/tests/cms-metadata/${segment}`,
        options: { method: 'GET' },
      },
    ]);
    assert.equal(json.jsonReads, 1);
    assert.equal(decodeURIComponent(segment), id);
  });
}

for (const [operation, body, errorPath] of [
  ['read', { id: 'opaque' }, '$.title'],
  ['read', cmsMetadataBody({ questionCount: '0' }), '$.questionCount'],
  ['read', cmsMetadataBody({ extra: true }), '$.extra'],
  ['read', { data: cmsMetadataBody() }, '$.id'],
  ['read', { statusCode: 404, message: 'Illustrative error' }, '$.id'],
  [
    'list',
    cmsMetadataListBody({ items: [cmsMetadataBody({ type: 'FULL_TEST' })] }),
    '$.items[0].type',
  ],
  ['list', cmsMetadataListBody({ catalogTotal: 1 }), '$.catalogTotal'],
  ['list', { statusCode: 500, message: 'Illustrative error' }, '$.items'],
  ['list', null, '$'],
] as const) {
  test(`JSON-decoded invalid ${operation} body reaches adapter error ${errorPath}`, async () => {
    const json = metadataFetchResponse(200, frozen(body));
    const stub = metadataFetcherStub(() => json.response);
    const repository = createCmsTestMetadataRepository(
      createCmsTestMetadataTransport(stub.fetcher),
    );
    await assert.rejects(
      operation === 'read' ? repository.read('opaque') : repository.list(defaults),
      (error: unknown) => {
        assert.ok(error instanceof CmsTestMetadataContractError);
        assert.equal(error.path, errorPath);
        return true;
      },
    );
    assert.equal(json.jsonReads, 1);
    assert.equal(stub.calls.length, 1);
  });
}

for (const phase of ['fetch-reject', 'fetch-throw', 'json-reject', 'json-throw'] as const) {
  for (const cause of [
    new SyntaxError('Illustrative read failure'),
    { status: 404 },
    'offline',
    null,
    undefined,
  ]) {
    test(`${phase} ${JSON.stringify(cause)} keeps original rejection through repository without retry`, async () => {
      let calls = 0;
      let jsonReads = 0;
      const fetcher: CmsTestMetadataFetcher = () => {
        calls++;
        if (phase === 'fetch-throw') throw cause;
        if (phase === 'fetch-reject') return Promise.reject(cause);
        return Promise.resolve(
          Object.freeze({
            status: 200,
            json(): Promise<unknown> {
              jsonReads++;
              if (phase === 'json-throw') throw cause;
              return Promise.reject(cause);
            },
          }),
        );
      };
      const transport = createCmsTestMetadataTransport(fetcher);
      await assert.rejects(
        transport.get({ path: '/api/v1/tests/cms-metadata' }),
        (error: unknown) => {
          assert.equal(error, cause);
          return true;
        },
      );
      const repository = createCmsTestMetadataRepository(transport);
      for (const read of [
        () => repository.list(defaults),
        () => repository.read('demo-test-001'),
      ]) {
        await assert.rejects(read, (error: unknown) => {
          assert.ok(error instanceof CmsTestMetadataTransportError);
          assert.equal(error.cause, cause);
          return true;
        });
      }
      assert.equal(calls, 3);
      assert.equal(jsonReads, phase.startsWith('json-') ? 3 : 0);
    });
  }
}

test('query and ID validation reject before the injected fetcher is called', async () => {
  const stub = metadataFetcherStub(() => assert.fail('Must not call fetcher'));
  const repository = createCmsTestMetadataRepository(createCmsTestMetadataTransport(stub.fetcher));
  const query = Object.freeze({ ...defaults, status: 'CUSTOM_REVIEW' });
  await assert.rejects(
    repository.list(query as unknown as CmsTestMetadataQueryInput),
    CmsTestMetadataQueryError,
  );
  for (const id of ['', ' \t', '\uD800'])
    await assert.rejects(repository.read(id), CmsTestMetadataIdError);
  assert.equal(stub.calls.length, 0);
});

test('factories keep injected implementations separate and repeated calls do not cache', async () => {
  const firstBody = frozen(cmsMetadataBody({ status: 'FIRST' }));
  const secondBody = frozen(cmsMetadataBody({ status: 'SECOND' }));
  const firstJson = metadataFetchResponse(200, firstBody);
  const secondJson = metadataFetchResponse(200, secondBody);
  const firstStub = metadataFetcherStub(() => firstJson.response);
  const secondStub = metadataFetcherStub(() => secondJson.response);
  const first = createCmsTestMetadataTransport(firstStub.fetcher);
  const second = createCmsTestMetadataTransport(secondStub.fetcher);
  const request = Object.freeze({ path: '/api/v1/tests/cms-metadata/opaque' });
  const firstResult = await first.get(request);
  const secondResult = await second.get(request);
  const repeated = await first.get(request);
  assert.equal(firstResult.body, firstBody);
  assert.equal(secondResult.body, secondBody);
  assert.equal(repeated.body, firstBody);
  assert.notEqual(firstResult, repeated);
  assert.equal(firstStub.calls.length, 2);
  assert.equal(secondStub.calls.length, 1);
  assert.equal(firstJson.jsonReads, 2);
  assert.equal(secondJson.jsonReads, 1);
  assert.notEqual(firstStub.calls[0].options, firstStub.calls[1].options);
});

test('concurrent in-memory reads may finish out of order without sharing response state', async () => {
  let releaseFirst!: (response: CmsTestMetadataFetchResponse) => void;
  const delayed = new Promise<CmsTestMetadataFetchResponse>((resolve) => {
    releaseFirst = resolve;
  });
  const firstBody = frozen(cmsMetadataBody({ id: 'first' }));
  const secondBody = frozen(cmsMetadataBody({ id: 'second', durationSeconds: 123 }));
  const firstJson = metadataFetchResponse(200, firstBody);
  const secondJson = metadataFetchResponse(200, secondBody);
  const stub = metadataFetcherStub((path) =>
    path.endsWith('/first') ? delayed : secondJson.response,
  );
  const repository = createCmsTestMetadataRepository(createCmsTestMetadataTransport(stub.fetcher));
  const first = repository.read('first');
  assert.deepEqual(await repository.read('second'), { kind: 'success', metadata: secondBody });
  releaseFirst(firstJson.response);
  assert.deepEqual(await first, { kind: 'success', metadata: firstBody });
  assert.equal(stub.calls.length, 2);
  assert.equal(firstJson.jsonReads, 1);
  assert.equal(secondJson.jsonReads, 1);
});
