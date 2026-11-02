import assert from 'node:assert/strict';
import test from 'node:test';
import { readUserParams, userHref, selectUserPage } from '../src/lib/users/query';
import { USER_FIXTURES } from '../src/lib/users/fixtures';
import { DEFAULT_USER_QUERY, USER_STATUSES } from '../src/lib/users/types';
import { demoUserRepository } from '../src/lib/users/demo-repository';

test('Auth/User paging bounds and supported source status domain; malformed/repeated values normalize', () => {
  assert.deepEqual(readUserParams(new URLSearchParams()).query, DEFAULT_USER_QUERY);
  for (const size of [1, 3, 20, 50])
    assert.equal(readUserParams(new URLSearchParams(`size=${size}`)).query.size, size);
  for (const bad of ['-1', '0', '1.5', 'Infinity', '1e3', '9007199254740992']) {
    const parsed = readUserParams(
      new URLSearchParams(`page=${bad}&size=51&status=SUSPENDED&userPreview=wrong`),
    );
    assert.deepEqual(parsed.query, DEFAULT_USER_QUERY);
    assert.equal(parsed.preview, 'normal');
    assert.equal(parsed.corrected, true);
  }
  for (const status of USER_STATUSES)
    assert.equal(readUserParams(new URLSearchParams(`status=${status}`)).query.status, status);
  const parsed = readUserParams(
    new URLSearchParams(
      'keyword=a&keyword=b&status=ACTIVE&status=LOCKED&page=2&page=3&size=5&size=10&userPreview=error&userPreview=empty&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN',
    ),
  );
  assert.deepEqual(parsed.query, DEFAULT_USER_QUERY);
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.role, 'CONTENT_ADMIN');
  assert.equal(parsed.corrected, true);
  assert.equal(readUserParams(new URLSearchParams('role=USER')).corrected, true);
});

test('Canonical URL round trips Unicode and special characters, query, scenario and SYSTEM_ADMIN', () => {
  const current = new URLSearchParams(
    'demoRole=SYSTEM_ADMIN&keyword=%20A%26B+日本語%20&status=PENDING&size=3&page=2&userPreview=slow',
  );
  const parsed = readUserParams(current);
  assert.equal(parsed.query.keyword, 'A&B 日本語');
  assert.deepEqual(
    readUserParams(
      new URL(userHref(current, parsed.query, parsed.preview), 'http://local').searchParams,
    ),
    parsed,
  );
});

test('Email OR name substring with AND exact status; roles and placeholder labels are not searchable fields', () => {
  const page = selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, keyword: 'MINH' });
  assert.deepEqual(
    page.items.map((u) => u.id),
    ['demo-user-001', 'demo-user-005'],
  );
  assert.equal(
    selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, keyword: 'DEMO.USER01@' }).items[0].id,
    'demo-user-001',
  );
  assert.equal(
    selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, keyword: 'minh', status: 'LOCKED' })
      .total,
    0,
  );
  for (const keyword of ['SYSTEM_ADMIN', 'Chưa có dữ liệu'])
    assert.equal(selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, keyword }).total, 0);
  for (const [status, total] of [
    ['ACTIVE', 7],
    ['LOCKED', 7],
    ['DISABLED', 6],
    ['PENDING', 6],
  ] as const)
    assert.equal(selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, status }).total, total);
});

test('All roles survive reads; missing/empty roles and status never gain defaults', () => {
  const last = selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, page: 2 });
  assert.deepEqual(last.items.find((u) => u.id === 'demo-user-025')!.roles, [
    'SYSTEM_ADMIN',
    'CONTENT_ADMIN',
    'USER',
  ]);
  assert.deepEqual(last.items.find((u) => u.id === 'demo-user-027')!.roles, []);
  const missing = last.items.find((u) => u.id === 'demo-user-028')!;
  assert.deepEqual(
    [missing.fullName, missing.email, missing.roles, missing.status],
    [null, null, null, null],
  );
  assert.equal(
    selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, status: 'ACTIVE' }).items.some(
      (u) => u.status === null,
    ),
    false,
  );
});

test('Stable paging has no duplicates, clamps huge pages before arithmetic, distinguishes empty from no-match', () => {
  const before = JSON.stringify(USER_FIXTURES);
  for (const size of [1, 3, 20, 50]) {
    const ids = Array.from(
      { length: Math.ceil(USER_FIXTURES.length / size) },
      (_, i) => i + 1,
    ).flatMap((page) =>
      selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, size, page }).items.map((u) => u.id),
    );
    assert.equal(ids.length, 28);
    assert.equal(new Set(ids).size, 28);
  }
  const last = selectUserPage(USER_FIXTURES, {
    ...DEFAULT_USER_QUERY,
    size: 3,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(last.page, 10);
  assert.equal(last.items[0].id, 'demo-user-028');
  assert.equal(
    selectUserPage(USER_FIXTURES, { ...DEFAULT_USER_QUERY, keyword: 'no-such-user' }).catalogTotal,
    28,
  );
  assert.equal(selectUserPage([], DEFAULT_USER_QUERY).catalogTotal, 0);
  assert.equal(JSON.stringify(USER_FIXTURES), before);
});

test('Only the minimal public summary fields and fictional example.com identities exist in fixtures', () => {
  for (const user of USER_FIXTURES) {
    assert.deepEqual(Object.keys(user).sort(), ['email', 'fullName', 'id', 'roles', 'status']);
    if (user.email) assert.match(user.email, /^[^@]+@example\.com$/);
    if (user.fullName) assert.ok(user.fullName.startsWith('Nhân vật demo · '));
  }
});

test('Local reads cancel; retry preserves query including clamp/no-match; error reload is reproducible', async () => {
  const controller = new AbortController();
  const pending = demoUserRepository.list(DEFAULT_USER_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(
    demoUserRepository.list(DEFAULT_USER_QUERY, {
      signal: controller.signal,
      preview: 'normal',
      retry: false,
    }),
    { name: 'AbortError' },
  );
  const signal = new AbortController().signal;
  const query = { ...DEFAULT_USER_QUERY, keyword: 'MINH', status: 'ACTIVE' as const, page: 99 };
  await assert.rejects(
    demoUserRepository.list(query, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
  const result = await demoUserRepository.list(query, { signal, preview: 'error', retry: true });
  assert.equal(result.total, 2);
  assert.equal(result.page, 1);
  assert.equal(
    (
      await demoUserRepository.list(
        { ...query, status: 'LOCKED' },
        { signal, preview: 'error', retry: true },
      )
    ).total,
    0,
  );
  assert.equal(
    (await demoUserRepository.list(query, { signal, preview: 'empty', retry: false })).catalogTotal,
    0,
  );
  await assert.rejects(
    demoUserRepository.list(query, { signal, preview: 'error', retry: false }),
    /mô phỏng/,
  );
});
