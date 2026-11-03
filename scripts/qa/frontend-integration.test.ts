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
import { parseAttempt, remainingTime } from '../../apps/web/src/lib/integration/attempt-contract';
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
import {
  contentApi,
  bankApi,
  parseContent,
} from '../../apps/admin-cms/src/lib/integration/content-api';
import { vocabularySessions } from '../../apps/web/src/lib/integration/vocabulary-session';
import { cmsApi } from '../../apps/admin-cms/src/lib/integration/repositories';
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
