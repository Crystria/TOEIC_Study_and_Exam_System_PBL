import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handleBridge,
  requiredRoles,
  type BridgeConfig,
} from '../../apps/web/src/lib/integration/bridge';
import {
  ContractError,
  matchingId,
  mediaUrl,
  page,
  parseAudit,
  parseLesson,
  parseQuestion,
  parseSessionUser,
  parseTest,
  parseTopic,
  parseUser,
  parseWord,
  segment,
} from '../../apps/web/src/lib/integration/contracts';
import {
  attemptElapsedSeconds,
  parseAttempt,
  remainingTime,
} from '../../apps/web/src/lib/integration/attempt-contract';
import { examWritesEnabled, isExamMutation } from '../../apps/web/src/lib/integration/exam-access';
import {
  cmsContentWritesEnabled,
  MAX_VOCABULARY_IMPORT_BYTES,
  vocabularyWorkbookImportPath,
} from '../../apps/web/src/lib/integration/cms-access';
import { query } from '../../apps/web/src/lib/integration/query';
import {
  GatewayError,
  gateway,
  mutationOutcomeUnknown,
  validationFields,
} from '../../apps/web/src/lib/integration/client';
import {
  examApi,
  learningApi,
  analyticsApi,
} from '../../apps/web/src/lib/integration/repositories';
import { parseVocabularySession } from '../../apps/web/src/lib/integration/vocabulary-session';
import { personalLearningApi } from '../../apps/web/src/lib/integration/personal-learning';
import {
  isPersonalLearningMutation,
  isPersonalLearningRoute,
} from '../../apps/web/src/lib/integration/personal-learning-access';
import {
  contentApi,
  bankApi,
  parseContent,
  parseGroup,
  emptyQuestion,
} from '../../apps/admin-cms/src/lib/integration/content-api';
import { vocabularySessions } from '../../apps/web/src/lib/integration/vocabulary-session';
import { cmsApi } from '../../apps/admin-cms/src/lib/integration/repositories';
import { topicErrorMessage } from '../../apps/admin-cms/src/lib/integration/topic-errors';
import { parseLessonMarkdown, safeMarkdownHref } from '../../apps/web/src/lib/learning/markdown';
import {
  wireUser as user,
  wireWord,
  wireTopic,
  wireLesson,
  wireTest,
  wireAttempt,
  wirePage,
} from './frontend-wire-fixtures';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const req = (
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = 'toeic_web_access=unit-access; toeic_web_refresh=unit-refresh',
  extra: Record<string, string> = {},
) =>
  new Request(`http://localhost:3006/api/frontend/${path}`, {
    method,
    headers: {
      cookie,
      origin: 'http://localhost:3006',
      'Content-Type': 'application/json',
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const cfg = (fetcher: typeof fetch, extra: Partial<BridgeConfig> = {}): BridgeConfig => ({
  app: 'web',
  enabled: true,
  environment: 'local',
  gatewayUrl: 'http://127.0.0.1:3999/api/v1',
  fetcher,
  ...extra,
});
const bridge = (
  path: string,
  method: string,
  body: unknown,
  c: BridgeConfig,
  extra: Record<string, string> = {},
) =>
  handleBridge(
    req(
      path,
      method,
      body,
      c.app === 'cms' ? 'toeic_cms_access=unit-access; toeic_cms_refresh=unit-refresh' : undefined,
      extra,
    ),
    path.split('/'),
    c,
  );
test('API requires explicit local/test configuration; rejects remote production and embedded credentials', async () => {
  for (const extra of [
    { enabled: false },
    { environment: 'production' },
    { gatewayUrl: 'https://production.invalid/api/v1' },
    { gatewayUrl: 'http://u:p@127.0.0.1:3999/api/v1' },
    { gatewayUrl: 'http://localhost:3999/other' },
  ])
    assert.equal(
      (
        await bridge(
          'users/me',
          'GET',
          undefined,
          cfg(async () => {
            throw Error('must not fetch');
          }, extra),
        )
      ).status,
      503,
    );
});
test('cross-origin writes are rejected before fetch', async () => {
  assert.equal(
    (
      await bridge(
        'users/me',
        'PATCH',
        {},
        cfg(async () => {
          throw Error();
        }),
        { origin: 'https://other.invalid' },
      )
    ).status,
    403,
  );
});
test('empty, traversal, control and demo IDs are rejected', async () => {
  for (const p of ['', '..', 'demo-01', 'local-01', '\u0001'])
    assert.equal(
      (
        await handleBridge(
          req('tests/id'),
          ['tests', p],
          cfg(async () => {
            throw Error();
          }),
        )
      ).status,
      400,
    );
});
test('opaque IDs remain a single encoded segment', async () => {
  let target = '';
  const r = await handleBridge(
    req('tests/id'),
    ['tests', 'a/b ?'],
    cfg(async (input) => {
      target = String(input);
      return json(target.endsWith('users/me') ? user : {});
    }),
  );
  assert.equal(r.status, 200);
  assert.match(target, /a%2Fb%20%3F$/);
});
test('login stores HttpOnly app cookies; browser receives only sanitized user', async () => {
  const r = await bridge(
    'auth/login',
    'POST',
    { email: user.email, password: 'unit' },
    cfg(async (input) =>
      json(
        String(input).endsWith('login')
          ? { accessToken: 'opaque-access', refreshToken: 'opaque-refresh' }
          : user,
      ),
    ),
  );
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(!body.includes('opaque-'));
  assert.equal(parseSessionUser(JSON.parse(body).user).id, user.userId);
  assert.match(r.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(r.headers.get('set-cookie')!, /SameSite=Strict/);
  assert.match(r.headers.get('set-cookie')!, /Path=\/api\/frontend/);
});
test('HTTPS sessions add Secure cookies', async () => {
  const r = await handleBridge(
    new Request('https://localhost:3006/api/frontend/auth/login', {
      method: 'POST',
      headers: { origin: 'https://localhost:3006' },
      body: '{}',
    }),
    ['auth', 'login'],
    cfg(async (input) =>
      json(String(input).endsWith('login') ? { accessToken: 'a', refreshToken: 'r' } : user),
    ),
  );
  assert.match(r.headers.get('set-cookie')!, /Secure/);
});
test('registration acknowledges activation without parsing tokens or starting a session', async () => {
  let calls = 0;
  const r = await bridge(
    'auth/register',
    'POST',
    { email: user.email },
    cfg(
      async () => {
        calls++;
        return json({ user, activationRequired: true });
      },
      { writesEnabled: true },
    ),
  );
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { activationRequired: true });
  assert.equal(calls, 1);
  assert.equal(r.headers.get('set-cookie'), null);
});
test('registration and verification remain disabled without the write flag', async () => {
  for (const p of ['auth/register', 'auth/verify-email', 'auth/resend-verification'])
    assert.equal(
      (
        await bridge(
          p,
          'POST',
          {},
          cfg(async () => {
            throw Error('no call');
          }),
        )
      ).status,
      503,
    );
});
test('verification and resend work without auth/session lookup', async () => {
  for (const p of ['verify-email', 'resend-verification']) {
    const r = await bridge(
      `auth/${p}`,
      'POST',
      {},
      cfg(
        async (input, init) => {
          assert.ok(String(input).endsWith(p));
          assert.equal(new Headers(init?.headers).has('Authorization'), false);
          return json({ message: 'ack' });
        },
        { writesEnabled: true },
      ),
    );
    assert.equal(r.status, 200);
  }
});
test('CMS cannot register or use public student activation routes', async () => {
  assert.equal(
    (
      await bridge(
        'auth/register',
        'POST',
        {},
        cfg(async () => json({}), { app: 'cms', writesEnabled: true }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await bridge(
        'auth/verify-email',
        'POST',
        {},
        cfg(async () => json({}), { app: 'cms', writesEnabled: true }),
      )
    ).status,
    501,
  );
});
test('inactive login does not create a browser session', async () => {
  const r = await bridge(
    'auth/login',
    'POST',
    {},
    cfg(async (input) =>
      json(
        String(input).endsWith('login')
          ? { accessToken: 'a', refreshToken: 'r' }
          : { ...user, status: 'INACTIVE' },
      ),
    ),
  );
  assert.equal(r.status, 403);
  assert.match(r.headers.get('set-cookie')!, /Max-Age=0/);
});
test('session validates current backend roles, never query personas', async () => {
  const r = await bridge(
    'auth/session',
    'GET',
    undefined,
    cfg(async () => json({ ...user, roles: ['USER'] })),
  );
  assert.deepEqual((await r.json()).user.roles, ['USER']);
});
test('concurrent expired reads rotate refresh once', async () => {
  let refreshes = 0;
  const c = cfg(async (input, init) => {
    const p = String(input);
    if (p.endsWith('refresh')) {
      refreshes++;
      return json({ accessToken: 'new', refreshToken: 'new-r' });
    }
    return json(
      new Headers(init?.headers).get('Authorization') === 'Bearer new' ? user : {},
      new Headers(init?.headers).get('Authorization') === 'Bearer new' ? 200 : 401,
    );
  });
  const result = await Promise.all([
    bridge('auth/session', 'GET', undefined, c),
    bridge('auth/session', 'GET', undefined, c),
  ]);
  assert.deepEqual(
    result.map((r) => r.status),
    [200, 200],
  );
  assert.equal(refreshes, 1);
});
test('failed refresh clears cookies; network failure preserves recoverable session', async () => {
  for (const network of [false, true]) {
    const r = await bridge(
      'auth/session',
      'GET',
      undefined,
      cfg(async () => {
        if (network) throw Error('network');
        return json({}, 401);
      }),
    );
    assert.equal(r.status, network ? 502 : 401);
    assert.equal(r.headers.has('set-cookie'), !network);
  }
});
test('logout clears local cookies even when server revocation fails', async () => {
  const r = await bridge(
    'auth/logout',
    'POST',
    {},
    cfg(async (input) =>
      json(
        String(input).endsWith('users/me') ? user : {},
        String(input).endsWith('users/me') ? 200 : 500,
      ),
    ),
  );
  assert.equal(r.status, 500);
  assert.match(r.headers.get('set-cookie')!, /Max-Age=0/);
});
test('inactive explicit refresh is rejected', async () => {
  const r = await bridge(
    'auth/refresh',
    'POST',
    {},
    cfg(async (input) =>
      json(
        String(input).endsWith('refresh')
          ? { accessToken: 'a', refreshToken: 'r' }
          : { ...user, status: 'SUSPENDED' },
      ),
    ),
  );
  assert.equal(r.status, 403);
});
test('writes default off; a failed mutation is never replayed', async () => {
  let mutations = 0;
  const fetcher: typeof fetch = async (input, init) => {
    if (init?.method === 'GET' && String(input).endsWith('users/me')) return json(user);
    mutations++;
    return json({}, 401);
  };
  assert.equal((await bridge('users/me', 'PATCH', {}, cfg(fetcher))).status, 503);
  assert.equal(mutations, 0);
  assert.equal(
    (await bridge('users/me', 'PATCH', {}, cfg(fetcher, { writesEnabled: true }))).status,
    401,
  );
  assert.equal(mutations, 1);
});
test('idempotency key reaches only the business request and USER can start attempts', async () => {
  const calls: { path: string; key: string | null }[] = [];
  const r = await bridge(
    `tests/${wireTest.testId}/part-attempts`,
    'POST',
    { parts: [5], durationSeconds: 1800 },
    cfg(
      async (input, init) => {
        calls.push({ path: String(input), key: new Headers(init?.headers).get('Idempotency-Key') });
        return json(
          String(input).endsWith('users/me') ? { ...user, roles: ['USER'] } : wireAttempt(),
        );
      },
      { writesEnabled: true },
    ),
    { 'Idempotency-Key': 'start-key' },
  );
  assert.equal(r.status, 200);
  assert.equal(calls[0].key, null);
  assert.equal(calls[1].key, 'start-key');
  assert.deepEqual(requiredRoles('tests/id/attempts', 'POST'), []);
});

test('student exams work independently of experimental writes without opening other mutations', async () => {
  const paths = [
    [`tests/${wireTest.testId}/attempts`, 'POST'],
    [`tests/${wireTest.testId}/part-attempts`, 'POST'],
    ['attempts/attempt-id/draft', 'PUT'],
    ['attempts/attempt-id/answers/question-id', 'PUT'],
    ['attempts/attempt-id/submit', 'POST'],
  ];
  const calls: string[] = [];
  const config = cfg(
    async (input) => {
      calls.push(String(input));
      return json(
        String(input).endsWith('/users/me') ? { ...user, roles: ['USER'] } : wireAttempt(),
      );
    },
    { writesEnabled: false, examWritesEnabled: true },
  );
  for (const [path, method] of paths) {
    assert.equal(isExamMutation(path, method), true);
    assert.equal((await bridge(path, method, {}, config)).status, 200);
  }
  assert.equal(calls.length, paths.length * 2);
  for (const [path, method] of [
    ['users/me', 'PATCH'],
    ['learning/lessons/lesson-id/complete', 'POST'],
    ['learning/vocabulary-sessions', 'POST'],
    ['auth/register', 'POST'],
  ]) {
    assert.equal(isExamMutation(path, method), false);
    assert.equal((await bridge(path, method, {}, config)).status, 503);
  }
  assert.equal(calls.length, paths.length * 2);
  assert.equal((await bridge('tests', 'POST', {}, config)).status, 501);
  assert.equal(
    (
      await bridge(
        paths[0][0],
        'POST',
        {},
        { ...config, examWritesEnabled: false, writesEnabled: true },
      )
    ).status,
    503,
  );
  assert.equal((await bridge(paths[0][0], 'POST', {}, { ...config, app: 'cms' })).status, 501);
});

test('individual flashcard reviews work for an active web account with experimental writes disabled', async () => {
  const path = 'learning/flashcards/word-id/review';
  const body = { operationId: 'flashcard-review', quality: 3, baseEntityRevision: '1' };
  let reviews = 0;
  const config = cfg(
    async (input, init) => {
      if (String(input).endsWith('/users/me')) return json({ ...user, roles: ['USER'] });
      assert.equal(String(input), `http://127.0.0.1:3999/api/v1/${path}`);
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), body);
      reviews++;
      return json({ operationId: body.operationId });
    },
    { writesEnabled: false, examWritesEnabled: false },
  );

  assert.equal((await bridge(path, 'POST', body, config)).status, 200);
  assert.equal((await bridge(path, 'POST', body, { ...config, app: 'cms' })).status, 501);
  assert.equal((await bridge(path, 'GET', undefined, config)).status, 501);
  assert.equal(
    (await handleBridge(req(path, 'POST', body, ''), path.split('/'), config)).status,
    401,
  );
  assert.equal(
    (await bridge(path, 'POST', body, config, { origin: 'https://foreign.invalid' })).status,
    403,
  );
  assert.equal(
    (
      await bridge(path, 'POST', body, {
        ...config,
        fetcher: async () => json({ ...user, status: 'INACTIVE' }),
      })
    ).status,
    403,
  );
  assert.equal(reviews, 1);
});

test('flashcard sessions pass through for active learners with experimental writes disabled', async () => {
  const path = 'learning/flashcard-sessions';
  const session = `${path}/round-id`;
  const start = { topicId: 'topic-id', scope: 'PERSONAL', mode: 'REVIEW', limit: 2 };
  const review = { reviews: [{ vocabularyId: 'word-id', quality: 5 }] };
  const submit = {
    ...review,
    operationId: 'quiz-operation',
    answers: [{ questionId: 'question-id', selectedOption: 'A' }],
  };
  const expected = [
    [path, 'POST', start],
    [session, 'GET', undefined],
    [`${session}/reviews`, 'POST', review],
    [`${session}/submit`, 'POST', submit],
    [`${session}/cancel`, 'POST', undefined],
  ] as const;
  const calls: unknown[] = [];
  const config = cfg(
    async (input, init) => {
      const url = String(input);
      if (url.endsWith('/users/me')) return json({ ...user, roles: ['USER'] });
      calls.push([
        url.replace('http://127.0.0.1:3999/api/v1/', ''),
        init?.method,
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      ]);
      if (url.endsWith('/flashcard-sessions'))
        assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'flashcard-start');
      return json({ success: true });
    },
    { writesEnabled: false },
  );
  for (const [route, method, body] of expected) {
    const response = await bridge(route, method, body, config, { 'Idempotency-Key': 'flashcard-start' });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(calls, expected);
  assert.equal((await bridge(path, 'POST', start, { ...config, app: 'cms' })).status, 501);
  assert.equal((await bridge(session, 'GET', undefined, { ...config, app: 'cms' })).status, 501);
  assert.equal((await bridge(session, 'DELETE', undefined, config)).status, 501);
  assert.equal((await bridge('learning/vocabulary-sessions', 'POST', start, config)).status, 503);
  assert.equal((await bridge(path, 'POST', start, config, { origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await handleBridge(req(path, 'POST', start, ''), path.split('/'), config)).status, 401);
  assert.deepEqual(calls, expected);
});

test('exam write configuration has an explicit read-only override and stays local/test only', () => {
  assert.equal(examWritesEnabled('local'), true);
  assert.equal(examWritesEnabled('test', 'enabled'), true);
  assert.equal(examWritesEnabled('local', 'disabled'), false);
  assert.equal(examWritesEnabled('production', 'enabled'), false);
  assert.equal(examWritesEnabled(undefined, 'enabled'), false);
});

test('exam writes still reject missing sessions, inactive users, foreign origins and upstream ownership failures', async () => {
  const path = `tests/${wireTest.testId}/attempts`;
  let mutations = 0;
  const config = cfg(
    async (input) => {
      if (String(input).endsWith('/users/me')) return json({ ...user, roles: ['USER'] });
      mutations++;
      return json({ message: 'Attempt does not belong to user' }, 403);
    },
    { examWritesEnabled: true },
  );
  const noSession = await handleBridge(req(path, 'POST', {}, ''), path.split('/'), config);
  assert.equal(noSession.status, 401);
  assert.equal(
    (await bridge(path, 'POST', {}, config, { origin: 'https://other.invalid' })).status,
    403,
  );
  assert.equal(mutations, 0);
  assert.equal(
    (
      await bridge(
        path,
        'POST',
        {},
        { ...config, fetcher: async () => json({ ...user, status: 'INACTIVE' }) },
      )
    ).status,
    403,
  );
  assert.equal(mutations, 0);
  assert.equal((await bridge('attempts/other-user/submit', 'POST', {}, config)).status, 403);
  assert.equal(mutations, 1);
});
test('CMS content permissions follow the concrete backend role rules', async () => {
  for (const p of ['learning/admin/lessons', 'question-groups', 'tests']) {
    const r = await bridge(
      p,
      'POST',
      {},
      cfg(
        async (input) =>
          json(
            String(input).endsWith('users/me') ? { ...user, roles: ['USER'] } : { success: true },
          ),
        { app: 'cms', writesEnabled: true },
      ),
    );
    assert.equal(r.status, 403);
  }
  assert.deepEqual(requiredRoles('learning/admin/lessons', 'POST'), ['CONTENT_ADMIN']);
});

test('CMS content CRUD works with account writes disabled', async () => {
  const calls: { path: string; method: string }[] = [];
  const config = cfg(
    async (input, init) => {
      calls.push({ path: String(input), method: init?.method ?? 'GET' });
      return json(
        String(input).endsWith('/users/me')
          ? { ...user, roles: ['USER', 'CONTENT_ADMIN'] }
          : { success: true },
      );
    },
    { app: 'cms', writesEnabled: false, contentWritesEnabled: true },
  );
  for (const collection of [
    'questions',
    'question-groups',
    'tests',
    'learning/admin/lessons',
    'learning/admin/vocabularies',
    'learning/admin/vocabulary-topics',
  ]) {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const path = collection + (method === 'POST' ? '' : '/content-id');
      assert.equal((await bridge(path, method, { title: 'Content' }, config)).status, 200);
      assert.deepEqual(calls.at(-1), {
        path: `http://127.0.0.1:3999/api/v1/${path}`,
        method,
      });
    }
  }
  for (const path of [
    'learning/admin/vocabularies/bulk',
    vocabularyWorkbookImportPath,
    'questions/content-id/media/presign',
    'question-groups/content-id/media/presign',
    'learning/vocabularies/content-id/media/presign',
    'learning/vocabularies/content-id/media/confirm',
  ])
    assert.equal((await bridge(path, 'POST', {}, config)).status, 200);
  const topicWordsPath = 'learning/admin/vocabulary-topics/content-id/vocabularies';
  assert.equal((await bridge(topicWordsPath, 'DELETE', undefined, config)).status, 200);
  assert.deepEqual(calls.at(-1), {
    path: `http://127.0.0.1:3999/api/v1/${topicWordsPath}`,
    method: 'DELETE',
  });
  const before = calls.length;
  for (const path of ['admin/users/other/roles', 'admin/users/other/status', 'users/me'])
    assert.equal((await bridge(path, 'PATCH', {}, config)).status, 503);
  assert.equal(calls.length, before);
});

test('deleting all words in a topic requires the CMS, content writes and CONTENT_ADMIN', async () => {
  const path = 'learning/admin/vocabulary-topics/content-id/vocabularies';
  const fetcher: BridgeConfig['fetcher'] = async (input) => {
    assert.ok(String(input).endsWith('/users/me'));
    return json({ ...user, roles: ['SYSTEM_ADMIN'] });
  };
  const config = cfg(fetcher, { app: 'cms', contentWritesEnabled: true });
  assert.equal((await bridge(path, 'DELETE', undefined, config)).status, 403);
  assert.equal((await bridge(path, 'GET', undefined, config)).status, 501);
  assert.equal(
    (await bridge(path, 'DELETE', undefined, { ...config, contentWritesEnabled: false })).status,
    503,
  );
  assert.equal((await bridge(path, 'DELETE', undefined, { ...config, app: 'web' })).status, 501);
});

test('CMS content writes enforce role, session, account status and same-origin checks', async () => {
  for (const [roles, path, expected] of [
    [['USER'], 'questions', 403],
    [['USER'], 'tests', 403],
    [['USER'], 'question-groups', 403],
    [['USER'], 'learning/admin/lessons', 403],
    [['USER'], 'learning/admin/vocabularies', 403],
    [['USER'], 'learning/admin/vocabularies/bulk', 403],
    [['USER'], vocabularyWorkbookImportPath, 403],
    [['USER'], 'learning/admin/vocabulary-topics', 403],
    [['SYSTEM_ADMIN'], 'learning/admin/lessons', 403],
    [['SYSTEM_ADMIN'], 'learning/admin/vocabularies', 403],
    [['SYSTEM_ADMIN'], 'learning/admin/vocabularies/bulk', 403],
    [['SYSTEM_ADMIN'], vocabularyWorkbookImportPath, 403],
    [['SYSTEM_ADMIN'], 'learning/admin/vocabulary-topics', 403],
    [['SYSTEM_ADMIN'], 'questions', 403],
    [['SYSTEM_ADMIN'], 'question-groups', 403],
    [['SYSTEM_ADMIN'], 'tests', 403],
  ] as const) {
    let mutations = 0;
    const config = cfg(
      async (input) => {
        if (String(input).endsWith('/users/me')) return json({ ...user, roles });
        mutations++;
        return json({ success: true });
      },
      { app: 'cms', writesEnabled: false, contentWritesEnabled: true },
    );
    assert.equal((await bridge(path, 'POST', {}, config)).status, expected);
    assert.equal(mutations, 0);
  }
  let mutations = 0;
  const config = cfg(
    async (input) => {
      if (String(input).endsWith('/users/me'))
        return json({ ...user, roles: ['CONTENT_ADMIN'], status: 'SUSPENDED' });
      mutations++;
      return json({ success: true });
    },
    { app: 'cms', contentWritesEnabled: true },
  );
  assert.equal((await bridge('questions', 'POST', {}, config)).status, 403);
  assert.equal(
    (await bridge('questions', 'POST', {}, config, { origin: 'https://other.invalid' })).status,
    403,
  );
  assert.equal(
    (await handleBridge(req('questions', 'POST', {}, ''), ['questions'], config)).status,
    401,
  );
  assert.equal(mutations, 0);
});

test('CMS exam content writes require CONTENT_ADMIN while SYSTEM_ADMIN can read each part', async () => {
  for (const roles of [['SYSTEM_ADMIN'], ['CONTENT_ADMIN'], ['SYSTEM_ADMIN', 'CONTENT_ADMIN']]) {
    const calls: Array<{ path: string; method: string }> = [];
    const config = cfg(
      async (input, init) => {
        const path = new URL(String(input)).pathname.replace('/api/v1/', '');
        if (path === 'users/me') return json({ ...user, roles });
        calls.push({ path, method: init?.method ?? 'GET' });
        return json({ success: true });
      },
      { app: 'cms', writesEnabled: false, contentWritesEnabled: true },
    );
    for (const path of [
      'tests',
      'tests/content-id',
      'tests/content-id/parts',
      'questions/details',
      'question-groups/details',
    ]) {
      assert.equal((await bridge(path, 'GET', undefined, config)).status, 200);
      assert.deepEqual(calls.at(-1), { path, method: 'GET' });
    }
    for (const [path, method] of [
      ['tests', 'POST'],
      ['tests/content-id', 'PATCH'],
      ['tests/content-id', 'DELETE'],
      ['questions', 'POST'],
      ['questions/content-id', 'PATCH'],
      ['questions/content-id', 'DELETE'],
      ['questions/content-id/media/presign', 'POST'],
      ['question-groups', 'POST'],
      ['question-groups/content-id', 'PATCH'],
      ['question-groups/content-id', 'DELETE'],
      ['question-groups/content-id/media/presign', 'POST'],
    ]) {
      const before = calls.length;
      const response = await bridge(path, method, {}, config);
      if (roles.includes('CONTENT_ADMIN')) {
        assert.equal(response.status, 200);
        assert.deepEqual(calls.at(-1), { path, method });
      } else {
        assert.equal(response.status, 403);
        assert.equal((await response.json()).code, 'INSUFFICIENT_PERMISSIONS');
        assert.equal(calls.length, before, 'A rejected content write must never reach the Gateway');
      }
    }
  }
});

test('CMS read-only override blocks content even when account writes are enabled', async () => {
  assert.equal(cmsContentWritesEnabled('local'), true);
  assert.equal(cmsContentWritesEnabled('test', 'enabled'), true);
  assert.equal(cmsContentWritesEnabled('local', 'disabled'), false);
  assert.equal(cmsContentWritesEnabled('production', 'enabled'), false);
  assert.equal(cmsContentWritesEnabled(undefined, 'enabled'), false);
  const config = cfg(
    async () => {
      throw Error('must not fetch');
    },
    {
      app: 'cms',
      writesEnabled: true,
      contentWritesEnabled: false,
    },
  );
  for (const [path, method] of [
    ['questions', 'POST'],
    ['tests/id', 'PATCH'],
    ['learning/admin/lessons/id', 'DELETE'],
    ['learning/admin/vocabularies', 'POST'],
    ['learning/admin/vocabularies/bulk', 'POST'],
    [vocabularyWorkbookImportPath, 'POST'],
    ['questions/id/media/presign', 'POST'],
  ])
    assert.equal((await bridge(path, method, {}, config)).status, 503);
});
test('Vocabulary workbook import alone accepts larger CMS JSON bodies and forwards its key', async () => {
  const key = 'workbook-import-test';
  const body = { sample: 'ộ'.repeat(500_000) };
  const config = cfg(
    async (input, init) => {
      if (String(input).endsWith('/users/me')) return json({ ...user, roles: ['CONTENT_ADMIN'] });
      assert.equal(String(input).split('/api/v1/')[1], vocabularyWorkbookImportPath);
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('idempotency-key'), key);
      assert.equal(init?.body, JSON.stringify(body));
      return json({ success: true });
    },
    { app: 'cms', contentWritesEnabled: true },
  );
  const headers = { 'idempotency-key': key };
  assert.equal((await bridge(vocabularyWorkbookImportPath, 'POST', body, config, headers)).status, 200);
  assert.equal((await bridge('learning/admin/vocabularies/bulk', 'POST', body, config)).status, 413);
  assert.equal((await bridge(vocabularyWorkbookImportPath, 'GET', undefined, config)).status, 501);
  assert.equal(
    (await bridge(vocabularyWorkbookImportPath, 'POST', {}, { ...config, app: 'web' })).status,
    501,
  );
  assert.equal(
    (await bridge(vocabularyWorkbookImportPath, 'POST', {}, config, {
      'content-length': String(MAX_VOCABULARY_IMPORT_BYTES + 1),
    })).status,
    413,
  );
});
test('unknown paths, unsafe AI and internal endpoints stay blocked', async () => {
  for (const p of ['ai/conversations', 'internal/auth/state', 'arbitrary', 'questions/reindex'])
    assert.equal(
      (
        await bridge(
          p,
          'POST',
          {},
          cfg(async () => json(user), { writesEnabled: true }),
        )
      ).status,
      501,
    );
});
test('Gateway error detail is preserved without upstream cookies', async () => {
  const r = await bridge(
    'users/me',
    'PATCH',
    {},
    cfg(async (input) => (String(input).endsWith('users/me') ? json(user) : json({})), {
      writesEnabled: true,
    }),
  );
  assert.equal(r.status, 200);
  const fail = await bridge(
    'tests',
    'GET',
    undefined,
    cfg(async (input) =>
      String(input).endsWith('users/me')
        ? json(user)
        : new Response(JSON.stringify({ message: ['title invalid'] }), {
            status: 400,
            headers: { 'Set-Cookie': 'upstream-secret=x' },
          }),
    ),
  );
  assert.equal(fail.status, 400);
  assert.equal(fail.headers.has('set-cookie'), false);
  assert.deepEqual((await fail.json()).details.message, ['title invalid']);
});
test('wire User and sanitized session adapters distinguish their ID fields', () => {
  assert.equal(parseUser(user).id, user.userId);
  assert.equal(parseSessionUser({ ...parseUser(user) }).id, user.userId);
  assert.throws(() => parseUser({ ...user, userId: undefined, id: user.userId }), ContractError);
  assert.throws(() => parseUser({ ...user, roles: [{ code: 'USER' }] }), ContractError);
});
test('Learning uses topicName, definition/phonetic, contentMarkdown/category', () => {
  assert.equal(parseTopic(wireTopic).wordCount, 5);
  assert.equal(parseWord(wireWord).meaning, wireWord.definition);
  assert.equal(parseLesson(wireLesson).content, wireLesson.contentMarkdown);
});
test('pagination rejects invalid sizes, total assumptions and non-array pages', () => {
  assert.equal(page({ ...wirePage([]), total: 100 }, parseTopic).total, 100);
  for (const size of [0, 51, 1.5])
    assert.throws(() => page({ ...wirePage([]), size }, parseTopic), ContractError);
  assert.throws(() => page([], parseTopic), ContractError);
});
test('queries drop legacy filters and enforce current Part/mode/range rules', () => {
  assert.equal(
    query('tests', new URLSearchParams('keyword=hi&type=MINI&status=PUBLISHED&demoRole=USER')),
    'keyword=hi',
  );
  assert.equal(
    query('lessons', new URLSearchParams('level=basic&category=Tenses')),
    'category=Tenses',
  );
  assert.equal(
    query('analytics', new URLSearchParams('timeRange=LAST_7_DAYS&time_range=ALL_TIME')),
    'timeRange=LAST_7_DAYS',
  );
  assert.throws(
    () => query('analytics', new URLSearchParams('timeRange=LAST_90_DAYS')),
    ContractError,
  );
  assert.throws(() => query('attempts', new URLSearchParams('mode=TEST')), ContractError);
});
test('test list/detail use testId and explicit question references', () => {
  assert.equal(parseTest(wireTest).questionCount, 200);
  assert.equal(parseTest({ ...wireTest, questions: [] }).questionCount, 0);
  assert.throws(() => parseTest({ ...wireTest, testId: null }), ContractError);
});
test('question detail uses correctOption and source option codes', () => {
  const q = parseQuestion({
    questionId: 'q',
    part: 2,
    type: 'SINGLE_CHOICE',
    questionText: null,
    difficulty: 'EASY',
    correctOption: 'B',
    tags: ['tag'],
    options: ['A', 'B', 'C'].map((optionCode) => ({ optionCode, optionText: optionCode })),
  });
  assert.equal(q.options.length, 3);
  assert.equal(q.options[1].isCorrect, true);
});
test('audit uses actorUserId/targetUserId and before/after payloads', () => {
  assert.equal(
    parseAudit({
      auditId: 'a',
      actorUserId: 'u',
      targetUserId: 'v',
      action: 'CHANGE',
      occurredAt: '2026-11-03T00:00:00Z',
      beforeData: {},
      afterData: {},
    }).resourceId,
    'v',
  );
});
test('media must be a supplied full HTTP(S) URL; keys never become URLs', () => {
  for (const s of [
    'key/audio.mp3',
    'javascript:alert(1)',
    'data:text/html,hi',
    'https://u:p@host/file',
  ])
    assert.equal(mediaUrl(s), null);
  assert.equal(mediaUrl('https://host/file'), 'https://host/file');
});
test('in-progress attempts never expose grading, transcript or scores even if upstream leaks them', () => {
  const a = wireAttempt(true, 'FULL');
  const r = parseAttempt({ ...a, status: 'IN_PROGRESS' });
  assert.equal(r.score, null);
  assert.equal(r.totalCorrect, null);
  assert.equal(r.answers[0].isCorrect, null);
  assert.equal(r.questions[0].correctOption, null);
  assert.equal(r.questions[0].explanation, null);
});
test('Part practice with all Parts still has no scaled score', () => {
  const r = parseAttempt({
    ...wireAttempt(true),
    parts: [1, 2, 3, 4, 5, 6, 7],
    score: 990,
    scoreListening: 495,
    scoreReading: 495,
  });
  assert.equal(r.score, null);
});
test('Full results use backend scores and disclaimer only', () => {
  const r = parseAttempt(wireAttempt(true, 'FULL'));
  assert.equal(r.score, 990);
  assert.equal(r.scoreDisclaimer, 'Điểm tham khảo backend.');
  assert.throws(() => parseAttempt({ ...wireAttempt(true, 'FULL'), score: 1000 }), ContractError);
});
test('snapshot and answer identity are validated', () => {
  const a = wireAttempt();
  assert.throws(() => parseAttempt({ ...a, totalQuestions: 2 }), ContractError);
  assert.throws(
    () => parseAttempt({ ...a, answers: [{ questionId: 'other', selectedOption: 'A' }] }),
    ContractError,
  );
  assert.throws(
    () =>
      parseAttempt({
        ...a,
        answers: [{ questionId: a.questions[0].questionId, selectedOption: 'E' }],
      }),
    ContractError,
  );
});
test('timer never resets from render, negative elapsed or deadline expiry', () => {
  assert.equal(remainingTime(60, 1001), 59);
  assert.equal(remainingTime(60, 61000), 0);
  assert.equal(remainingTime(60, -1), 60);
});
test('completed attempt duration uses completion timestamps rather than zero remaining time', () => {
  const early = parseAttempt({
    ...wireAttempt(true),
    completedAt: '2026-11-03T03:04:05Z',
    submittedAt: '2026-11-03T03:04:05Z',
  });
  assert.equal(early.completedAt, '2026-11-03T03:04:05Z');
  assert.equal(attemptElapsedSeconds(early), 245);
  assert.equal(
    attemptElapsedSeconds(
      parseAttempt({ ...wireAttempt(true), submittedAt: '2026-11-03T03:02:00Z' }),
    ),
    120,
  );
  assert.equal(attemptElapsedSeconds(parseAttempt(wireAttempt(true))), null);
  assert.equal(
    attemptElapsedSeconds(parseAttempt({ ...wireAttempt(true), status: 'EXPIRED' })),
    7200,
  );
  assert.equal(
    attemptElapsedSeconds(
      parseAttempt({ ...wireAttempt(true), completedAt: '2026-11-03T06:00:00Z' }),
    ),
    7200,
  );
  assert.equal(
    attemptElapsedSeconds(
      parseAttempt({ ...wireAttempt(true), completedAt: '2026-11-03T02:59:59Z' }),
    ),
    null,
  );
  const active = parseAttempt({ ...wireAttempt(), completedAt: '2026-11-03T03:04:05Z' });
  assert.equal(active.completedAt, null);
  assert.equal(attemptElapsedSeconds(active), null);
});
test('quiz ignores any premature result on an active session', () => {
  const r = parseVocabularySession({
    sessionId: 's',
    topicId: 't',
    status: 'IN_PROGRESS',
    vocabularies: [wireWord],
    quiz: [],
    reviews: [],
    result: { secret: true },
  });
  assert.equal(r.result, null);
});
test('shared Markdown escapes HTML and rejects unsafe links', () => {
  assert.equal(safeMarkdownHref('javascript:alert(1)'), undefined);
  assert.ok(parseLessonMarkdown('<script>alert(1)</script>').length);
});
test('ambiguous failures differ from validation failures; validation maps only known fields', () => {
  assert.equal(mutationOutcomeUnknown(new GatewayError(504, 'timeout')), true);
  assert.equal(mutationOutcomeUnknown(new ContractError('id')), true);
  assert.equal(mutationOutcomeUnknown(new GatewayError(400, 'invalid')), false);
  assert.deepEqual(
    validationFields(
      new GatewayError(400, 'bad', {
        details: { message: ['password invalid', 'database secret'] },
      }),
      ['password'],
    ),
    { password: 'Server từ chối giá trị này. Vui lòng kiểm tra lại.' },
  );
});
test('repositories verify acknowledgement identity, revisions and current request DTOs', async () => {
  const original = globalThis.fetch;
  const seen: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    seen.push({ path, init });
    if (path.includes('/learning/lessons/') && init?.method === 'POST')
      return json({
        operationId: 'op',
        progress: [
          {
            entityType: 'LESSON',
            entityId: wireLesson.lessonId,
            revision: '1',
            state: { completedAt: '2026-11-03T00:00:00Z' },
          },
        ],
      });
    if (path.includes('learning/admin/')) return json(wireTopic);
    if (path.includes('/attempts/')) return json(wireAttempt());
    return json({ ...wireTest, testId: 'wrong' });
  };
  try {
    await assert.rejects(examApi.detail(wireTest.testId), ContractError);
    await assert.rejects(examApi.result('wrong'), ContractError);
    const completed = await learningApi.complete(wireLesson.lessonId, '0', 'op');
    assert.equal(completed.revision, '1');
    assert.deepEqual(JSON.parse(String(seen.at(-1)?.init?.body)), {
      baseEntityRevision: '0',
      operationId: 'op',
    });
    await contentApi.save('topics', { topicName: 'Business', evil: 'ignored' }, 'create-key');
    assert.deepEqual(JSON.parse(String(seen.at(-1)?.init?.body)), { topicName: 'Business' });
    assert.equal(new Headers(seen.at(-1)?.init?.headers).get('Idempotency-Key'), 'create-key');
  } finally {
    globalThis.fetch = original;
  }
});
test('analytics rejects a mismatched response range', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () =>
    json({
      timeRange: 'ALL_TIME',
      lifetime: { studyDays: 0, grammarLessonsCompleted: 0, vocabulariesLearned: 0 },
      inRange: {},
      dailyActivity: [],
      scoreTrend: [],
      weakAreas: [],
    });
  try {
    await assert.rejects(analyticsApi.progress('LAST_7_DAYS'), ContractError);
  } finally {
    globalThis.fetch = old;
  }
});
test('client abort/network failures are explicit and do not become success', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('network');
  };
  try {
    await assert.rejects(
      gateway('users/me'),
      (e: unknown) => e instanceof GatewayError && e.status === 0,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test('entity matching and demo identifiers fail closed', () => {
  assert.throws(() => matchingId({ id: 'other' }, 'requested'), ContractError);
  assert.throws(() => segment('demo-id'), ContractError);
  assert.equal(segment('a/b'), 'a%2Fb');
});
test('cancel session requires an explicit successful backend acknowledgement', async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => json({ success: false });
    await assert.rejects(vocabularySessions.cancel('s'), ContractError);
    globalThis.fetch = async () => json({ success: true });
    await vocabularySessions.cancel('s');
  } finally {
    globalThis.fetch = old;
  }
});
test('group update sends only DTO asset fields and keeps the requested member order', async () => {
  const old = globalThis.fetch;
  let sent: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return json({
      groupId: 'g',
      part: 7,
      type: 'PASSAGE',
      instruction: 'Read',
      passageText: 'Passage',
      transcript: null,
      questionIds: ['b', 'a'],
      assets: [],
      audioKey: null,
    });
  };
  try {
    await bankApi.saveGroup(
      {
        part: 7,
        type: 'PASSAGE',
        instruction: 'Read',
        passageText: 'Passage',
        transcript: '',
        questionOrder: ['b', 'a'],
        assets: [{ kind: 'TEXT', storageKey: null, content: 'Document', orderNo: 1 }],
      },
      [],
      'g',
    );
    assert.deepEqual(sent.questionOrder, ['b', 'a']);
    assert.deepEqual(sent.assets, [
      { kind: 'TEXT', storageKey: null, content: 'Document', orderNo: 1 },
    ]);
    assert.equal('questions' in sent, false);
  } finally {
    globalThis.fetch = old;
  }
});

test('group create assigns nested part and member positions atomically without UI asset fields', async () => {
  const old = globalThis.fetch;
  let sent: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, 'POST');
    sent = JSON.parse(String(init?.body));
    return json({
      groupId: 'g',
      part: 7,
      type: 'PASSAGE',
      questionIds: ['a', 'b'],
      assets: [],
      isComplete: true,
    });
  };
  try {
    const question = {
      ...emptyQuestion(5),
      groupId: 'stale-group',
      positionInGroup: 99,
      tags: ['  grammar  ', '', 'grammar'],
    };
    const asset = {
      kind: 'TEXT',
      storageKey: null,
      content: 'Passage',
      orderNo: 1,
      url: 'https://media.invalid/ui-only',
    };
    const result = await bankApi.saveGroup(
      {
        part: 7,
        type: 'PASSAGE',
        instruction: 'Read',
        passageText: '',
        transcript: '',
        assets: [asset],
      },
      [question, question],
    );
    assert.equal(result.id, 'g');
    const questions = sent.questions as Record<string, unknown>[];
    assert.deepEqual(
      questions.map((q) => [q.part, q.positionInGroup]),
      [
        [7, 1],
        [7, 2],
      ],
    );
    assert(questions.every((q) => !('groupId' in q)));
    assert(questions.every((q) => JSON.stringify(q.tags) === JSON.stringify(['grammar'])));
    assert.deepEqual(sent.assets, [
      { kind: 'TEXT', storageKey: null, content: 'Passage', orderNo: 1 },
    ]);
    assert.deepEqual(
      parseGroup({ groupId: 'g', part: 7, type: 'PASSAGE', questionIds: ['b', 'a'], assets: [] })
        .questionIds,
      ['b', 'a'],
    );
  } finally {
    globalThis.fetch = old;
  }
});

test('topic CRUD preserves active-word count, trims names and retains the creation key', async () => {
  assert.equal(
    parseContent('topics', { topicId: 't', topicName: 'Business', vocabularyCount: 3 })
      .vocabularyCount,
    3,
  );
  assert.equal(
    parseContent('topics', { topicId: 't', topicName: 'Business' }).vocabularyCount,
    null,
  );
  assert.throws(
    () => parseContent('topics', { topicId: 't', topicName: 'Business', vocabularyCount: -1 }),
    ContractError,
  );
  const old = globalThis.fetch;
  const calls: { method: string; key: string | null; body: unknown }[] = [];
  globalThis.fetch = async (_input, init) => {
    calls.push({
      method: init?.method ?? 'GET',
      key: new Headers(init?.headers).get('Idempotency-Key'),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return json({ topicId: 't', topicName: 'Business', vocabularyCount: 3 });
  };
  try {
    await contentApi.save(
      'topics',
      { topicName: '  Business  ', userId: 'untrusted' },
      'topic-create-key',
    );
    await contentApi.save('topics', { topicName: 'Business' }, 'topic-create-key');
    await contentApi.save('topics', { topicName: '  Renamed  ' }, 'unused-update-key', 't');
    assert.deepEqual(calls, [
      { method: 'POST', key: 'topic-create-key', body: { topicName: 'Business' } },
      { method: 'POST', key: 'topic-create-key', body: { topicName: 'Business' } },
      { method: 'PATCH', key: null, body: { topicName: 'Renamed' } },
    ]);
    globalThis.fetch = async () => json({ success: false });
    await assert.rejects(contentApi.remove('topics', 't'), ContractError);
    globalThis.fetch = async () => json({ success: true });
    await contentApi.remove('topics', 't');
  } finally {
    globalThis.fetch = old;
  }
});

test('topic deletion explains a nonempty topic through the real bridge error envelope', () => {
  const message = topicErrorMessage(
    new GatewayError(409, 'Generic conflict', {
      code: 'GATEWAY_ERROR',
      details: { code: 'TOPIC_NOT_EMPTY', message: 'Do not render raw backend text' },
    }),
  );
  assert.match(message, /Chủ đề còn từ vựng/);
  assert(!message.includes('Do not render'));
  for (const details of [
    null,
    {},
    { code: 'GATEWAY_ERROR', details: null },
    { code: 'UNKNOWN', message: 'Internal text' },
  ])
    assert.equal(
      topicErrorMessage(new GatewayError(409, 'Safe fallback', details)),
      'Safe fallback',
    );
});
test('lesson progress refuses incomplete projection and repeated cursors', async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => json({ projectionReady: false, progress: [], nextCursor: null });
    await assert.rejects(learningApi.entityProgress('l'));
    globalThis.fetch = async () =>
      json({ projectionReady: true, progress: [], nextCursor: 'same' });
    await assert.rejects(learningApi.entityProgress('l'), ContractError);
  } finally {
    globalThis.fetch = old;
  }
});
test('an impossible backend correct count is rejected', () => {
  assert.throws(() => parseAttempt({ ...wireAttempt(true), correctCount: 2 }), ContractError);
});

test('lesson reload finds the acknowledged revision on a later ready projection page', async () => {
  const old = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return json({
      projectionReady: true,
      nextCursor: calls.length === 1 ? 'next-page' : null,
      progress:
        calls.length === 1
          ? []
          : [
              {
                entityType: 'LESSON',
                entityId: wireLesson.lessonId,
                revision: '7',
                state: { completedAt: '2026-11-03T07:00:00Z' },
              },
            ],
    });
  };
  try {
    const restored = await learningApi.entityProgress(wireLesson.lessonId);
    assert.equal(restored.revision, '7');
    assert.equal(restored.completedAt, '2026-11-03T07:00:00Z');
    assert.equal(calls.length, 2);
    assert.match(calls[1], /cursor=next-page/);
  } finally {
    globalThis.fetch = old;
  }
});

test('CMS role/status changes require an acknowledgment of the requested state', async () => {
  const old = globalThis.fetch;
  const responses = [
    { ...user, roles: ['USER'] },
    { ...user, status: 'ACTIVE' },
    { ...user, roles: ['CONTENT_ADMIN', 'USER'] },
    { ...user, status: 'SUSPENDED' },
  ];
  globalThis.fetch = async () => json(responses.shift());
  try {
    await assert.rejects(cmsApi.updateRoles(user.userId, ['USER', 'CONTENT_ADMIN']), ContractError);
    await assert.rejects(cmsApi.updateStatus(user.userId, 'SUSPENDED'), ContractError);
    assert.deepEqual((await cmsApi.updateRoles(user.userId, ['USER', 'CONTENT_ADMIN'])).roles, [
      'CONTENT_ADMIN',
      'USER',
    ]);
    assert.equal((await cmsApi.updateStatus(user.userId, 'SUSPENDED')).status, 'SUSPENDED');
  } finally {
    globalThis.fetch = old;
  }
});

test('CMS ambiguous mutation reconciliation uses a filtered GET and matches ID plus email', async () => {
  const old = globalThis.fetch;
  const seen: { path: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => {
    seen.push({ path: String(input), method: init?.method ?? 'GET' });
    return json(wirePage([{ ...user, userId: '00000000-0000-4000-8000-000000000099' }, user]));
  };
  try {
    assert.equal((await cmsApi.userForReconciliation(user.userId, user.email)).id, user.userId);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].method, 'GET');
    const url = new URL(seen[0].path, 'http://localhost');
    assert.equal(url.pathname, '/api/frontend/admin/users');
    assert.equal(url.searchParams.get('keyword'), user.email);
    assert.equal(url.searchParams.get('size'), '50');
  } finally {
    globalThis.fetch = old;
  }
});

test('CMS reconciliation cannot confirm an unrelated or missing user', async () => {
  const old = globalThis.fetch;
  const responses = [wirePage([{ ...user, email: 'other@example.invalid' }]), wirePage([])];
  globalThis.fetch = async () => json(responses.shift());
  try {
    await assert.rejects(cmsApi.userForReconciliation(user.userId, user.email), ContractError);
    await assert.rejects(cmsApi.userForReconciliation(user.userId, user.email), ContractError);
  } finally {
    globalThis.fetch = old;
  }
});

test('CMS vocabulary preserves acknowledged media URLs and rejects unsafe URLs', () => {
  const audioUrl = 'http://localhost:19000/toeic-media-p6/learning/word/audio.mp3';
  const imageUrl = 'http://localhost:19000/toeic-media-p6/learning/word/image.png';
  const parsed = parseContent('vocabulary', { ...wireWord, audioUrl, imageUrl });
  assert.equal(parsed.audioUrl, audioUrl);
  assert.equal(parsed.imageUrl, imageUrl);
  assert.equal(parseContent('vocabulary', { ...wireWord, audioUrl: null }).audioUrl, null);
  assert.equal(
    parseContent('vocabulary', { ...wireWord, audioUrl: 'javascript:alert(1)' }).audioUrl,
    null,
  );
});

test('completed quiz reload reads backend grading without submitting or recomputing it', async () => {
  const old = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? 'GET');
    return json({
      sessionId: 'session-reload',
      topicId: wireTopic.topicId,
      status: 'COMPLETED',
      vocabularies: [wireWord],
      reviews: [{ vocabularyId: wireWord.vocabularyId, quality: 5 }],
      quiz: [
        {
          questionId: 'q',
          vocabularyId: wireWord.vocabularyId,
          prompt: wireWord.word,
          options: [
            { code: 'A', text: 'Answer' },
            { code: 'B', text: 'Other' },
          ],
        },
      ],
      result: {
        sessionId: 'session-reload',
        status: 'COMPLETED',
        quizScore: 0,
        quizTotal: 1,
        answers: [{ questionId: 'q', selectedOption: 'A', correctOption: 'B', isCorrect: false }],
      },
    });
  };
  try {
    const restored = await vocabularySessions.read('session-reload');
    assert.equal(restored.status, 'COMPLETED');
    assert.equal(restored.result?.correct, 0);
    assert.equal(restored.result?.answers[0].selected, 'A');
    assert.equal(restored.result?.answers[0].correct, 'B');
    assert.deepEqual(methods, ['GET']);
  } finally {
    globalThis.fetch = old;
  }
});

test('personal learner CRUD uses only owner-bound routes independently of experimental writes', async () => {
  const calls: { path: string; key: string | null }[] = [];
  const config = cfg(
    async (input, init) => {
      calls.push({ path: String(input), key: new Headers(init?.headers).get('Idempotency-Key') });
      return json(
        String(input).endsWith('/users/me') ? { ...user, roles: ['USER'] } : { success: true },
      );
    },
    { writesEnabled: false, examWritesEnabled: false },
  );
  for (const resource of ['vocabulary-topics', 'vocabularies', 'lessons']) {
    const collection = `learning/personal/${resource}`;
    for (const [path, method] of [
      [collection, 'GET'],
      [`${collection}/owned-id`, 'GET'],
      [collection, 'POST'],
      [`${collection}/owned-id`, 'PATCH'],
      [`${collection}/owned-id`, 'DELETE'],
    ]) {
      assert.equal(isPersonalLearningRoute(path, method), true);
      assert.equal(isPersonalLearningMutation(path, method), method !== 'GET');
      assert.deepEqual(requiredRoles(path, method), []);
      assert.equal(
        (
          await bridge(path, method, method === 'GET' ? undefined : {}, config, {
            'Idempotency-Key': 'personal-create-key',
          })
        ).status,
        200,
      );
    }
  }
  assert.equal(calls.length, 30);
  assert(calls.filter((_, index) => index % 2 === 0).every((call) => call.key === null));
  assert(
    calls.filter((_, index) => index % 2 === 1).every((call) => call.key === 'personal-create-key'),
  );
});

test('personal access cannot open shared content, admin routes or unapproved methods', async () => {
  let calls = 0;
  const config = cfg(
    async () => {
      calls++;
      return json({ ...user, roles: ['USER'] });
    },
    { writesEnabled: true },
  );
  for (const [path, method] of [
    ['learning/personal/lessons/item', 'POST'],
    ['learning/personal/lessons', 'PATCH'],
    ['learning/personal/lessons', 'DELETE'],
    ['learning/personal/lessons/item', 'PUT'],
    ['learning/personal/lessons/item/complete', 'POST'],
    ['learning/personal/users/other', 'DELETE'],
    ['learning/personal/vocabularies/item/media/presign', 'POST'],
    ['learning/vocabulary-topics', 'POST'],
    ['learning/vocabularies/shared-id', 'PATCH'],
    ['learning/lessons/shared-id', 'DELETE'],
    ['learning/admin/lessons', 'POST'],
    ['learning/admin/vocabularies/shared-id', 'PATCH'],
    ['admin/users/other/status', 'PATCH'],
  ]) {
    assert.equal(isPersonalLearningRoute(path, method), false);
    assert.equal((await bridge(path, method, {}, config)).status, 501);
  }
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const path = `learning/personal/lessons${['PATCH', 'DELETE'].includes(method) ? '/item' : ''}`;
    assert.equal(
      (await bridge(path, method, method === 'GET' ? undefined : {}, { ...config, app: 'cms' }))
        .status,
      501,
    );
  }
  assert.equal(calls, 0);
});

test('personal CRUD requires an active session and same origin, preserves ownership errors without replay', async () => {
  const path = 'learning/personal/lessons/other-owned-id';
  let mutations = 0;
  const config = cfg(async (input) => {
    if (String(input).endsWith('/users/me')) return json({ ...user, roles: ['USER'] });
    mutations++;
    return json({ message: 'Not found' }, 404);
  });
  assert.equal(
    (await handleBridge(req(path, 'PATCH', {}, ''), path.split('/'), config)).status,
    401,
  );
  assert.equal(
    (await bridge(path, 'PATCH', {}, config, { origin: 'https://foreign.invalid' })).status,
    403,
  );
  assert.equal(
    (
      await bridge(
        path,
        'PATCH',
        {},
        {
          ...config,
          fetcher: async () => json({ ...user, roles: ['USER'], status: 'SUSPENDED' }),
        },
      )
    ).status,
    403,
  );
  assert.equal(mutations, 0);
  assert.equal((await bridge(path, 'PATCH', {}, config)).status, 404);
  assert.equal(mutations, 1);
  const failed = await bridge(path, 'DELETE', undefined, {
    ...config,
    fetcher: async (input) => {
      if (String(input).endsWith('/users/me')) return json({ ...user, roles: ['USER'] });
      mutations++;
      return json({ message: 'Expired' }, 401);
    },
  });
  assert.equal(failed.status, 401);
  assert.equal(mutations, 2);
});

test('personal repositories parse private collections, filter query keys and send only permitted input fields', async () => {
  const original = globalThis.fetch;
  const calls: { path: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    calls.push({ path, init });
    const value = path.includes('vocabulary-topics')
      ? wireTopic
      : path.includes('vocabularies')
        ? wireWord
        : { ...wireLesson, status: 'PRIVATE' };
    return json(path.includes('?') ? wirePage([value]) : value);
  };
  try {
    const topics = await personalLearningApi.topics.list(
      new URLSearchParams({ keyword: ' Business ', ownerUserId: 'other', status: 'PUBLISHED' }),
    );
    assert.equal(topics.items[0].name, wireTopic.topicName);
    assert.equal(
      calls.at(-1)?.path,
      '/api/frontend/learning/personal/vocabulary-topics?keyword=Business',
    );
    const words = await personalLearningApi.words.list(
      new URLSearchParams({ topicId: wireTopic.topicId, page: '2', size: '10', userId: 'other' }),
    );
    assert.equal(words.items[0].meaning, wireWord.definition);
    assert.match(calls.at(-1)!.path, new RegExp(`topicId=${wireTopic.topicId}&page=2&size=10$`));
    const lessons = await personalLearningApi.lessons.list(
      new URLSearchParams({ category: 'Tenses', status: 'PUBLISHED' }),
    );
    assert.equal(lessons.items[0].status, 'PRIVATE');
    assert.equal(lessons.items[0].content, wireLesson.contentMarkdown);
    assert.equal(calls.at(-1)?.path, '/api/frontend/learning/personal/lessons?category=Tenses');
    assert.equal((await personalLearningApi.topics.get(wireTopic.topicId)).id, wireTopic.topicId);
    assert.equal(
      (await personalLearningApi.words.get(wireWord.vocabularyId)).id,
      wireWord.vocabularyId,
    );
    assert.equal(
      (await personalLearningApi.lessons.get(wireLesson.lessonId)).id,
      wireLesson.lessonId,
    );
    await personalLearningApi.topics.create(
      { topicName: ' Business ', ownerUserId: 'other' } as { topicName: string },
      'personal-key',
    );
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { topicName: 'Business' });
    assert.equal(new Headers(calls.at(-1)?.init?.headers).get('Idempotency-Key'), 'personal-key');
    await personalLearningApi.words.create(
      {
        topicId: wireTopic.topicId,
        word: ' agenda ',
        definition: ' meeting ',
        phonetic: '',
        example: null,
      },
      'word-key',
    );
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), {
      topicId: wireTopic.topicId,
      word: 'agenda',
      definition: 'meeting',
      phonetic: null,
      example: null,
    });
    await personalLearningApi.lessons.update(wireLesson.lessonId, {
      lessonTitle: ' New title ',
      status: 'PUBLISHED',
      ownerUserId: 'other',
    } as { lessonTitle: string });
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { lessonTitle: 'New title' });
    assert.equal(calls.at(-1)?.init?.method, 'PATCH');
    assert.equal(new Headers(calls.at(-1)?.init?.headers).has('Idempotency-Key'), false);
  } finally {
    globalThis.fetch = original;
  }
});

test('personal repositories reject cross-entity acknowledgments and shared lesson responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => json({ ...wireTopic, topicId: 'another-topic' });
    await assert.rejects(personalLearningApi.topics.get(wireTopic.topicId), ContractError);
    await assert.rejects(
      personalLearningApi.topics.update(wireTopic.topicId, { topicName: 'New' }),
      ContractError,
    );
    globalThis.fetch = async () => json(wireLesson);
    await assert.rejects(personalLearningApi.lessons.get(wireLesson.lessonId), ContractError);
    globalThis.fetch = async () => json(wirePage([wireLesson]));
    await assert.rejects(personalLearningApi.lessons.list(), ContractError);
    for (const response of [
      { id: 'other', deleted: true },
      { id: wireWord.vocabularyId, deleted: false },
      { success: true },
    ]) {
      globalThis.fetch = async () => json(response);
      await assert.rejects(personalLearningApi.words.remove(wireWord.vocabularyId), ContractError);
    }
    globalThis.fetch = async () =>
      json({ id: wireWord.vocabularyId, deleted: true, success: true });
    assert.deepEqual(await personalLearningApi.words.remove(wireWord.vocabularyId), {
      id: wireWord.vocabularyId,
      deleted: true,
    });
    assert.throws(() => personalLearningApi.topics.update(wireTopic.topicId, {}), ContractError);
  } finally {
    globalThis.fetch = original;
  }
});
