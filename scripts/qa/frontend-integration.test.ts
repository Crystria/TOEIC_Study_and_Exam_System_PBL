import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handleBridge,
  type BridgeConfig,
  requiredRoles,
} from '../../apps/web/src/lib/integration/bridge';
import {
  ContractError,
  page,
  parseUser,
  parseSessionUser,
  parseWord,
  parseTopic,
  parseQuestion,
  parseAudit,
  parseResult,
  parseScores,
  parseTest,
  parseCompletion,
  matchingId,
  mediaUrl,
  segment,
} from '../../apps/web/src/lib/integration/contracts';
import { query } from '../../apps/web/src/lib/integration/query';
import { parseLessonMarkdown, safeMarkdownHref } from '../../apps/web/src/lib/learning/markdown';
import { cmsApi } from '../../apps/admin-cms/src/lib/integration/repositories';
import { newQuestionDraft } from '../../apps/admin-cms/src/lib/questions/form-draft';
import {
  GatewayError,
  mutationOutcomeUnknown,
  validationFields,
} from '../../apps/web/src/lib/integration/client';
import {
  analyticsApi,
  examApi,
  learningApi,
} from '../../apps/web/src/lib/integration/repositories';

// Test-only opaque values; never used by runtime configuration or login UI.
const user = {
  id: 'test-user',
  email: 'qa@example.invalid',
  fullName: 'Test Account',
  phoneNumber: null,
  avatarUrl: null,
  status: 'ACTIVE',
  roles: [{ code: 'USER', name: 'User' }],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const config = (fetcher: typeof fetch, extra: Partial<BridgeConfig> = {}): BridgeConfig => ({
  app: 'web',
  enabled: true,
  environment: 'local',
  gatewayUrl: 'http://127.0.0.1:3999/api/v1',
  fetcher,
  ...extra,
});
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = 'toeic_web_access=unit-access; toeic_web_refresh=unit-refresh',
) {
  return new Request(`http://localhost:3006/api/frontend/${path}`, {
    method,
    headers: { cookie, origin: 'http://localhost:3006', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test('API cannot run implicitly or target production', async () => {
  let calls = 0;
  const stub: typeof fetch = async () => {
    calls++;
    return json({});
  };
  for (const extra of [
    { enabled: false },
    { environment: 'production' },
    { gatewayUrl: 'https://production.invalid/api/v1' },
    { gatewayUrl: 'http://user:pass@127.0.0.1:3999/api/v1' },
    { gatewayUrl: 'http://localhost:3999/other' },
  ]) {
    const res = await handleBridge(request('users/me'), ['users', 'me'], config(stub, extra));
    assert.equal(res.status, 503);
  }
  assert.equal(calls, 0);
});
test('CSRF origin and encoded path traversal are rejected before fetch', async () => {
  let calls = 0;
  const stub: typeof fetch = async () => {
    calls++;
    return json({});
  };
  const cross = new Request('http://localhost:3006/api/frontend/users/me', {
    method: 'PATCH',
    headers: { origin: 'https://other.invalid' },
    body: '{}',
  });
  assert.equal((await handleBridge(cross, ['users', 'me'], config(stub))).status, 403);
  for (const id of ['..', '\u0000', 'demo-q-001', 'local-exam-001', ''])
    assert.equal((await handleBridge(request('tests/x'), ['tests', id], config(stub))).status, 400);
  assert.equal(calls, 0);
});
test('opaque IDs are encoded as one upstream segment without changing their value', async () => {
  let target = '';
  const stub: typeof fetch = async (input) => {
    target = String(input);
    return json(target.endsWith('/users/me') ? user : {});
  };
  const result = await handleBridge(request('tests/opaque'), ['tests', 'id/a? b'], config(stub));
  assert.equal(result.status, 200);
  assert.match(target, /tests\/id%2Fa%3F%20b$/);
});
test('successful login stores HttpOnly cookies and returns no tokens', async () => {
  const calls: string[] = [];
  const stub: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    return json(
      path.endsWith('/login')
        ? { accessToken: 'opaque-unit-access', refreshToken: 'opaque-unit-refresh' }
        : user,
    );
  };
  const res = await handleBridge(
    request('auth/login', 'POST', { email: user.email, password: 'test-only' }),
    ['auth', 'login'],
    config(stub),
  );
  assert.equal(res.status, 200);
  const result = await res.text();
  assert.ok(!result.includes('opaque-unit'));
  assert.equal(parseSessionUser(JSON.parse(result).user).id, user.id);
  const cookies = res.headers.get('set-cookie') ?? '';
  assert.match(cookies, /HttpOnly/);
  assert.match(cookies, /SameSite=Strict/);
  assert.match(cookies, /Path=\/api\/frontend/);
  assert.deepEqual(calls, ['/api/v1/auth/login', '/api/v1/users/me']);
});
test('CMS cannot register and login never accepts a non-active account', async () => {
  const stub: typeof fetch = async (input) =>
    json(
      String(input).endsWith('/login')
        ? { accessToken: 'unit-a', refreshToken: 'unit-r' }
        : { ...user, status: 'PENDING' },
    );
  assert.equal(
    (
      await handleBridge(
        request('auth/register', 'POST', {}),
        ['auth', 'register'],
        config(stub, { app: 'cms' }),
      )
    ).status,
    403,
  );
  const res = await handleBridge(
    request('auth/login', 'POST', {}),
    ['auth', 'login'],
    config(stub),
  );
  assert.equal(res.status, 403);
  assert.match(res.headers.get('set-cookie') ?? '', /Max-Age=0/);
});
test('session restoration verifies roles from me, not a client persona', async () => {
  const stub: typeof fetch = async () =>
    json({ ...user, roles: [{ code: 'CONTENT_ADMIN' }, { code: 'SYSTEM_ADMIN' }] });
  const res = await handleBridge(request('auth/session'), ['auth', 'session'], config(stub));
  assert.deepEqual(parseSessionUser((await res.json()).user).roles, [
    'CONTENT_ADMIN',
    'SYSTEM_ADMIN',
  ]);
});
test('concurrent 401 session reads rotate once and propagate fresh cookies', async () => {
  let refresh = 0;
  const stub: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/auth/refresh')) {
      refresh++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return json({ accessToken: 'fresh-unit-access', refreshToken: 'fresh-unit-refresh' });
    }
    return new Headers(init?.headers).get('Authorization') === 'Bearer fresh-unit-access'
      ? json(user)
      : json({}, 401);
  };
  const cookie = 'toeic_web_access=expired-unit; toeic_web_refresh=rotate-only-this-test';
  const responses = await Promise.all(
    [1, 2, 3].map(() =>
      handleBridge(
        request('auth/session', 'GET', undefined, cookie),
        ['auth', 'session'],
        config(stub),
      ),
    ),
  );
  assert.equal(refresh, 1);
  for (const res of responses) {
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie') ?? '', /fresh-unit-access/);
  }
});
test('failed refresh expires cookies; network failure preserves session for retry', async () => {
  const unauthorized: typeof fetch = async () => json({}, 401);
  const rejected = await handleBridge(
    request('auth/session'),
    ['auth', 'session'],
    config(unauthorized),
  );
  assert.equal(rejected.status, 401);
  assert.match(rejected.headers.get('set-cookie') ?? '', /Max-Age=0/);
  const broken: typeof fetch = async () => {
    throw new TypeError('offline');
  };
  const offline = await handleBridge(request('auth/session'), ['auth', 'session'], config(broken));
  assert.equal(offline.status, 502);
  assert.equal(offline.headers.get('set-cookie'), null);
});
test('logout clears local cookies even if Gateway revocation fails', async () => {
  const stub: typeof fetch = async (input) =>
    String(input).endsWith('/users/me') ? json(user) : json({}, 500);
  const result = await handleBridge(
    request('auth/logout', 'POST'),
    ['auth', 'logout'],
    config(stub),
  );
  assert.equal(result.status, 500);
  assert.match(result.headers.get('set-cookie') ?? '', /Max-Age=0/);
});
test('mutations are disabled until isolated test writes are explicitly configured', async () => {
  let calls = 0;
  const stub: typeof fetch = async () => {
    calls++;
    return json(user);
  };
  const result = await handleBridge(
    request('users/me', 'PATCH', { fullName: 'QA' }),
    ['users', 'me'],
    config(stub),
  );
  assert.equal(result.status, 503);
  assert.equal(calls, 0);
});
test('a 401 mutation is sent once and never replayed or silently refreshed', async () => {
  let mutations = 0,
    rotations = 0;
  const stub: typeof fetch = async (input, init) => {
    if (String(input).endsWith('/auth/refresh')) rotations++;
    if (init?.method === 'PATCH') {
      mutations++;
      return json({}, 401);
    }
    return json(user);
  };
  const result = await handleBridge(
    request('users/me', 'PATCH', { fullName: 'Changed' }),
    ['users', 'me'],
    config(stub, { writesEnabled: true }),
  );
  assert.equal(result.status, 401);
  assert.equal(mutations, 1);
  assert.equal(rotations, 0);
});
test('backend errors retain validation payload without forwarding cookies or auth headers', async () => {
  const stub: typeof fetch = async (input, init) =>
    init?.method === 'PATCH' ? json({ message: ['fullName must be a string'] }, 400) : json(user);
  const res = await handleBridge(
    request('users/me', 'PATCH', {}),
    ['users', 'me'],
    config(stub, { writesEnabled: true }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual((await res.json()).details.message, ['fullName must be a string']);
  assert.equal(res.headers.get('authorization'), null);
});
test('CMS multi-role access uses arrays and backend rules, metadata stays locked', async () => {
  const cookie = 'toeic_cms_access=unit-access; toeic_cms_refresh=unit-refresh';
  let business = 0;
  const stub: typeof fetch = async (input) =>
    String(input).endsWith('/users/me')
      ? json({ ...user, roles: [{ code: 'SYSTEM_ADMIN' }, { code: 'CONTENT_ADMIN' }] })
      : (business++, json({ items: [], total: 0, page: 1, size: 20 }));
  const opts = config(stub, { app: 'cms' });
  assert.equal(
    (
      await handleBridge(
        request('tests/cms-metadata', 'GET', undefined, cookie),
        ['tests', 'cms-metadata'],
        opts,
      )
    ).status,
    503,
  );
  assert.equal(business, 0);
  assert.equal(
    (await handleBridge(request('admin/users', 'GET', undefined, cookie), ['admin', 'users'], opts))
      .status,
    200,
  );
  const userOnly: typeof fetch = async () => json(user);
  assert.equal(
    (
      await handleBridge(
        request('admin/users', 'GET', undefined, cookie),
        ['admin', 'users'],
        config(userOnly, { app: 'cms' }),
      )
    ).status,
    403,
  );
  assert.deepEqual(requiredRoles('tests/cms-metadata', 'GET'), ['CONTENT_ADMIN']);
});
test('unsafe attempts, AI ownership and media lifecycle cannot be enabled by an arbitrary path', async () => {
  const stub: typeof fetch = async () => {
    throw new Error('should not call');
  };
  for (const [parts, method] of [
    [['tests', 'real-test', 'attempts'], 'POST'],
    [['attempts', 'real-attempt', 'submit'], 'POST'],
    [['ai', 'conversations'], 'POST'],
    [['questions', 'real-question', 'media', 'presign'], 'POST'],
  ] as const) {
    const res = await handleBridge(
      request(parts.join('/'), method, {}),
      [...parts],
      config(stub, { writesEnabled: true }),
    );
    assert.equal(res.status, 501);
  }
});
test('user adapters distinguish backend role objects from sanitized session arrays', () => {
  assert.deepEqual(parseUser(user).roles, ['USER']);
  assert.throws(() => parseUser({ ...user, roles: ['SYSTEM_ADMIN'] }), ContractError);
  assert.throws(() => parseUser({ ...user, id: '' }), ContractError);
  assert.throws(() => parseSessionUser({ ...user, roles: 'SYSTEM_ADMIN' }), ContractError);
});
test('vocabulary nullable media and topic counts use source field names', () => {
  const word = parseWord({
    id: 'v1',
    topicId: 't1',
    word: 'word',
    meaning: 'meaning',
    audioUrl: 'some/object.mp3',
    imageUrl: null,
  });
  assert.equal(word.audioUrl, null);
  assert.equal(word.pronunciation, null);
  assert.equal(parseTopic({ id: 't1', name: 'Topic', _count: { vocabularies: 4 } }).wordCount, 4);
  assert.throws(
    () => parseWord({ id: 'v1', topicId: 't1', word: 'word', definition: 'not meaning' }),
    ContractError,
  );
});
test('pagination is validated and never inferred from current page length', () => {
  assert.deepEqual(
    page({ items: [], total: 105, page: 7, size: 20 }, (v) => v),
    { items: [], total: 105, page: 7, size: 20 },
  );
  for (const data of [
    { items: [], total: -1, page: 1, size: 20 },
    { items: [], total: 0, page: 0, size: 20 },
    { items: [], total: 0, page: 1, size: 51 },
    { items: [1, 2], total: 2, page: 1, size: 1 },
  ])
    assert.throws(() => page(data, (v) => v), ContractError);
});
test('query allowlists omit demo URL controls and enforce request enums', () => {
  assert.equal(
    query(
      'tests',
      new URLSearchParams(
        'keyword=one&type=FULL&status=DRAFT&page=2&size=10&demoRole=SYSTEM_ADMIN&preview=error&catalogTotal=9',
      ),
    ),
    'keyword=one&type=FULL&status=DRAFT&page=2&size=10',
  );
  for (const bad of ['status=UNKNOWN', 'type=FULL_TEST', 'size=51', 'page=0'])
    assert.throws(() => query('tests', new URLSearchParams(bad)), ContractError);
  assert.equal(query('lessons', new URLSearchParams('category=Business&level=B1')), 'level=B1');
  assert.equal(query('audit', new URLSearchParams('keyword=actor&page=2')), 'page=2');
});
test('result adapter excludes placeholder score and hides grading while in progress', () => {
  const result = parseResult({
    attemptId: 'a1',
    testId: 't1',
    testTitle: 'Test',
    status: 'IN_PROGRESS',
    score: 900,
    totalCorrect: null,
    answers: [{ questionId: 'q1', selectedOption: 'A', isCorrect: true }],
  });
  assert.equal(result.answers[0].isCorrect, null);
  assert.equal('score' in result, false);
  const history = parseScores({
    items: [{ attemptId: 'a1', testType: 'FULL', score: 95, takenAt: '2026-10-29T00:00:00Z' }],
  });
  assert.equal('score' in history[0], false);
});
test('test metadata uses source Full/Mini and real structure, never synthesizes questions', () => {
  const test = parseTest({
    id: 't1',
    title: 'Test',
    type: 'FULL',
    status: 'PUBLISHED',
    durationSeconds: 7200,
    _count: { questions: 200 },
  });
  assert.equal(test.questions, null);
  assert.equal(test.questionCount, 200);
  assert.throws(
    () => parseTest({ ...test, type: 'FULL_TEST', _count: { questions: 200 } }),
    ContractError,
  );
  assert.throws(
    () => parseTest({ ...test, questions: [{ questionId: 'q', part: 8, orderNo: 1 }] }),
    ContractError,
  );
});
test('question detail and audit fields follow Prisma source, not list/demo projection', () => {
  const question = parseQuestion({
    id: 'q1',
    part: 5,
    type: 'SINGLE_CHOICE',
    stem: 'stem',
    difficulty: 'EASY',
    status: 'DRAFT',
    tags: [{ tag: { name: 'tag' } }],
    options: [{ optionKey: 'A', content: 'a', isCorrect: true }],
    explanation: null,
  });
  assert.deepEqual(question.tags, ['tag']);
  const audit = parseAudit({
    id: 'log',
    userId: 'actor',
    targetType: 'user',
    targetId: 'target',
    action: 'UPDATED',
    createdAt: '2026-10-29T00:00:00Z',
    metadata: { field: 'roles' },
  });
  assert.equal(audit.actorId, 'actor');
  assert.equal(audit.resourceType, 'user');
});
test('media URLs are never built from keys and dangerous protocols are rejected', () => {
  for (const source of [
    'audio/key.mp3',
    'javascript:alert(1)',
    'data:image/png,hello',
    'https://u:p@example.invalid/file',
  ])
    assert.equal(mediaUrl(source), null);
  assert.equal(
    mediaUrl('https://media.example.invalid/audio.mp3?signature=x'),
    'https://media.example.invalid/audio.mp3?signature=x',
  );
  for (const source of ['demo-id', 'local-id', ''])
    assert.throws(() => segment(source), ContractError);
  assert.equal(segment('id/a?b'), 'id%2Fa%3Fb');
});
test('completion acknowledgement requires the actual status and timestamp', () => {
  assert.throws(
    () => parseCompletion({ lessonId: 'l1', status: 'PENDING', completedAt: null }),
    ContractError,
  );
  assert.equal(
    parseCompletion({ lessonId: 'l1', status: 'COMPLETED', completedAt: '2026-10-29T00:00:00Z' })
      .lessonId,
    'l1',
  );
});
test('shared Markdown supports tables/code and never emits HTML or unsafe links', () => {
  const blocks = parseLessonMarkdown(
    '# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```html\n<script>alert(1)</script>\n```',
  );
  assert.ok(blocks.some((b) => b.kind === 'table'));
  assert.ok(blocks.some((b) => b.kind === 'code' && b.text.includes('<script>')));
  assert.equal(safeMarkdownHref('javascript:alert(1)'), undefined);
  assert.equal(safeMarkdownHref('//other.invalid'), undefined);
  assert.equal(safeMarkdownHref('https://example.invalid'), 'https://example.invalid');
});
test('CMS question/test writes use allowlisted DTOs without losing stored structure', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push({ path: String(input), method: init?.method ?? 'GET', body });
    return String(input).includes('/questions')
      ? json({ id: 'q1', status: 'DRAFT', ...body, tags: [], mediaUrl: null })
      : json({
          id: 't1',
          ...body,
          status: 'DRAFT',
          questions: [{ questionId: 'q1', part: 5, orderNo: 1 }],
        });
  };
  try {
    const draft = newQuestionDraft();
    draft.stem = 'Valid';
    draft.difficulty = 'EASY';
    draft.answer = 'A';
    draft.options = { A: 'a', B: 'b', C: 'c', D: 'd' };
    await cmsApi.saveQuestion(draft, 'q1');
    await cmsApi.saveTestMetadata({ title: 'Title', type: 'MINI', durationSeconds: 1800 }, 't1');
    assert.equal(requests[0].method, 'PATCH');
    assert.equal(requests[0].body.part, 5);
    assert.equal('transcript' in requests[0].body, false);
    assert.equal('mediaUrl' in requests[0].body, false);
    assert.equal('questions' in requests[1].body, false);
    assert.equal('status' in requests[1].body, false);
    assert.equal(requests[1].path, '/api/frontend/tests/t1');
    await assert.rejects(cmsApi.updateRoles('id', []));
    await assert.rejects(cmsApi.updateStatus('id', 'SUSPENDED'));
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('server validation maps only allowed fields and does not expose arbitrary server details', () => {
  const error = new GatewayError(400, 'Invalid', {
    details: { message: ['fullName must be a string', 'database secret should not appear'] },
  });
  const fields = validationFields(error, ['fullName', 'email']);
  assert.deepEqual(Object.keys(fields), ['fullName']);
  assert.ok(!JSON.stringify(fields).includes('database'));
});
test('timeout is explicit and does not clear a recoverable session', async () => {
  const stub: typeof fetch = async () => {
    throw new DOMException('Timed out', 'TimeoutError');
  };
  const result = await handleBridge(request('auth/session'), ['auth', 'session'], config(stub));
  assert.equal(result.status, 504);
  assert.equal(result.headers.get('set-cookie'), null);
});

test('registration is a real write and stays blocked before isolation is enabled', async () => {
  let calls = 0;
  const stub: typeof fetch = async (input) => {
    calls++;
    return json(
      String(input).endsWith('/register')
        ? { accessToken: 'unit-register-a', refreshToken: 'unit-register-r' }
        : user,
    );
  };
  const blocked = await handleBridge(
    request('auth/register', 'POST', {}),
    ['auth', 'register'],
    config(stub),
  );
  assert.equal(blocked.status, 503);
  assert.equal(calls, 0);
  assert.equal(blocked.headers.get('set-cookie'), null);
  const accepted = await handleBridge(
    request('auth/register', 'POST', {}),
    ['auth', 'register'],
    config(stub, { writesEnabled: true }),
  );
  assert.equal(accepted.status, 200);
  assert.equal(calls, 2);
});

test('explicit refresh rejects a locked or unknown account after rotation', async () => {
  for (const status of ['LOCKED', 'DISABLED', 'PENDING', 'FUTURE_STATUS']) {
    const stub: typeof fetch = async (input) =>
      json(
        String(input).endsWith('/refresh')
          ? { accessToken: 'rotated-a', refreshToken: 'rotated-r' }
          : { ...user, status },
      );
    const result = await handleBridge(
      request('auth/refresh', 'POST', {}, `toeic_web_refresh=refresh-status-${status}`),
      ['auth', 'refresh'],
      config(stub),
    );
    assert.equal(result.status, 403);
    assert.equal((await result.json()).code, 'ACCOUNT_NOT_ACTIVE');
    const cookies = result.headers.get('set-cookie') ?? '';
    assert.match(cookies, /toeic_web_access=;[^,]*Max-Age=0/);
    assert.match(cookies, /toeic_web_refresh=;[^,]*Max-Age=0/);
  }
});

test('network, timeout, invalid acknowledgements stop uncertain creates; validation allows correction', () => {
  for (const status of [0, 408, 500, 502, 503, 504])
    assert.equal(mutationOutcomeUnknown(new GatewayError(status, 'test')), true);
  assert.equal(mutationOutcomeUnknown(new ContractError('response.id')), true);
  for (const status of [400, 401, 403, 409, 422, 429])
    assert.equal(mutationOutcomeUnknown(new GatewayError(status, 'test')), false);
  assert.equal(mutationOutcomeUnknown(new Error('Local form validation')), false);
});

test('an in-progress result with premature grading never exposes correct-count or correctness', () => {
  const result = parseResult({
    attemptId: 'a',
    testId: 't',
    status: 'IN_PROGRESS',
    totalCorrect: 7,
    answers: [{ questionId: 'q', selectedOption: 'A', isCorrect: true }],
  });
  assert.equal(result.totalCorrect, null);
  assert.equal(result.answers[0].isCorrect, null);
});

test('entity acknowledgement must match the requested ID', () => {
  assert.throws(() => matchingId({ id: 'other' }, 'expected'), ContractError);
  assert.equal(matchingId({ id: 'expected' }, 'expected').id, 'expected');
});

test('repositories reject mismatched entity, attempt, review and analytics-range responses', async () => {
  const originalFetch = globalThis.fetch;
  const testValue = {
    id: 'wrong',
    title: 'Test',
    type: 'MINI',
    status: 'DRAFT',
    durationSeconds: 1800,
    questions: [],
  };
  const wordValue = { id: 'wrong', topicId: 't', word: 'word', meaning: 'meaning' };
  globalThis.fetch = async (input) => {
    const target = String(input);
    if (target.includes('admin/users')) return json({ ...user, id: 'wrong' });
    if (target.includes('analytics/progress'))
      return json({
        timeRange: 'ALL_TIME',
        lifetime: { totalStudyDays: 0, totalLessons: 0, totalVocabLearned: 0 },
        activitiesInRange: {},
      });
    if (target.includes('review-today'))
      return json([
        {
          vocabularyId: 'expected',
          repetition: 0,
          interval: 1,
          nextReviewAt: null,
          vocabulary: wordValue,
        },
      ]);
    if (target.includes('attempts'))
      return json({
        attemptId: 'wrong',
        testId: 't',
        status: 'SUBMITTED',
        totalCorrect: 0,
        answers: [],
      });
    if (target.includes('learning/lessons'))
      return json({
        id: 'wrong',
        title: 'Lesson',
        content: 'body',
        level: 'B1',
        status: 'PUBLISHED',
      });
    if (target.includes('questions'))
      return json({
        id: 'wrong',
        part: 5,
        type: 'SINGLE_CHOICE',
        stem: 'body',
        difficulty: 'EASY',
        status: 'DRAFT',
        tags: [],
        options: [],
      });
    return json(testValue);
  };
  try {
    await assert.rejects(cmsApi.question('expected'), ContractError);
    await assert.rejects(
      cmsApi.saveTestMetadata({ title: 'Title', type: 'MINI', durationSeconds: 1800 }, 'expected'),
      ContractError,
    );
    await assert.rejects(cmsApi.updateRoles('expected', ['USER']), ContractError);
    await assert.rejects(cmsApi.updateStatus('expected', 'ACTIVE'), ContractError);
    await assert.rejects(examApi.detail('expected'), ContractError);
    await assert.rejects(examApi.result('expected'), ContractError);
    await assert.rejects(learningApi.lesson('expected'), ContractError);
    await assert.rejects(learningApi.due(), ContractError);
    await assert.rejects(analyticsApi.progress('LAST_7_DAYS'), ContractError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unavailable contract and write flags produce specific Vietnamese client errors', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [code, expected] of [
      ['ISOLATED_TEST_WRITES_NOT_ENABLED', 'Thao tác ghi đang tắt.'],
      ['METADATA_RUNTIME_VERIFICATION_REQUIRED', 'Metadata chưa được kiểm chứng'],
      ['CONTRACT_BLOCKED', 'Chức năng chưa có đủ hợp đồng API'],
    ]) {
      globalThis.fetch = async () => json({ code }, 503);
      const { gateway } = await import('../../apps/web/src/lib/integration/client');
      await assert.rejects(
        gateway('users/me'),
        (error: unknown) => error instanceof GatewayError && error.message.startsWith(expected),
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
