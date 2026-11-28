import assert from 'node:assert/strict';
import test from 'node:test';
import { readAuditParams, auditHref, selectAuditPage } from '../src/lib/audit-logs/query';
import { AUDIT_LOG_FIXTURES, DEMO_AUDIT_ACTIONS } from '../src/lib/audit-logs/fixtures';
import {
  DEFAULT_AUDIT_QUERY,
  AUDIT_DEMO_PAGE_SIZES,
  describeAuditAction,
  formatAuditTime,
} from '../src/lib/audit-logs/types';
import { demoAuditRepository } from '../src/lib/audit-logs/demo-repository';

test('Audit UI paging is explicitly local; invalid, repeated and unsupported URL params normalize', () => {
  assert.deepEqual(readAuditParams(new URLSearchParams()).query, DEFAULT_AUDIT_QUERY);
  for (const size of AUDIT_DEMO_PAGE_SIZES)
    assert.equal(readAuditParams(new URLSearchParams(`size=${size}`)).query.size, size);
  // Not users 1..50, and not a claim about the audit backend accepting/rejecting sizes.
  for (const bad of ['0', '-1', '1.5', '1e2', 'Infinity', '9007199254740992']) {
    const parsed = readAuditParams(new URLSearchParams(`page=${bad}&size=50&auditPreview=wrong`));
    assert.deepEqual(parsed.query, DEFAULT_AUDIT_QUERY);
    assert.equal(parsed.preview, 'normal');
    assert.equal(parsed.corrected, true);
  }
  const parsed = readAuditParams(
    new URLSearchParams(
      'keyword=a&keyword=b&action=USER_LOGIN&action=USER_REGISTERED&page=2&page=3&size=12&size=24&auditPreview=error&auditPreview=empty&demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN',
    ),
  );
  assert.deepEqual(parsed.query, DEFAULT_AUDIT_QUERY);
  assert.equal(parsed.role, 'CONTENT_ADMIN');
  assert.equal(parsed.preview, 'normal');
  assert.equal(parsed.corrected, true);
  assert.equal(readAuditParams(new URLSearchParams('actor=demo&targetType=user')).corrected, true);
});

test('Unknown action is an open string no-match, with Unicode/special chars and persona round trip', () => {
  const current = new URLSearchParams('demoRole=SYSTEM_ADMIN');
  const query = {
    ...DEFAULT_AUDIT_QUERY,
    keyword: 'A&B 日本語',
    action: 'UNKNOWN & <demo>',
    page: 2,
    size: 12,
  };
  const parsed = readAuditParams(
    new URL(auditHref(current, query, 'slow'), 'http://local').searchParams,
  );
  assert.deepEqual(parsed.query, query);
  assert.equal(parsed.role, 'SYSTEM_ADMIN');
  assert.equal(parsed.preview, 'slow');
  assert.equal(parsed.corrected, false);
  assert.equal(selectAuditPage(AUDIT_LOG_FIXTURES, parsed.query).total, 0);
});

test('Search literal IDs/action/type with exact action AND; never infer actor, outcome or missing fields', () => {
  const query = { ...DEFAULT_AUDIT_QUERY, keyword: 'DEMO-AUDIT-USER-001', size: 24 };
  assert.deepEqual(
    selectAuditPage(AUDIT_LOG_FIXTURES, query).items.map((i) => i.id),
    ['demo-audit-001', 'demo-audit-005', 'demo-audit-009', 'demo-audit-013'],
  );
  assert.equal(
    selectAuditPage(AUDIT_LOG_FIXTURES, { ...query, action: 'USER_REGISTERED' }).total,
    1,
  );
  assert.equal(
    selectAuditPage(AUDIT_LOG_FIXTURES, { ...query, action: 'user_registered' }).total,
    0,
  );
  for (const keyword of ['Chưa có dữ liệu', 'SYSTEM_ADMIN', 'thành công', 'UTC+07:00'])
    assert.equal(selectAuditPage(AUDIT_LOG_FIXTURES, { ...query, keyword }).total, 0);
  assert.equal(
    selectAuditPage(AUDIT_LOG_FIXTURES, { ...query, keyword: 'demo_target_type' }).total,
    1,
  );
});

test('One dataset counts, stable paging, safe clamp before offset and empty versus no-match', () => {
  const first = selectAuditPage(AUDIT_LOG_FIXTURES, DEFAULT_AUDIT_QUERY);
  assert.equal(first.total, 18);
  assert.equal(first.items.length, 6);
  assert.equal(first.totalPages, 3);
  const last = selectAuditPage(AUDIT_LOG_FIXTURES, {
    ...DEFAULT_AUDIT_QUERY,
    page: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(last.page, 3);
  assert.equal(last.items[0].id, 'demo-audit-013');
  assert.equal(last.items.at(-1)?.id, 'demo-audit-018');
  const empty = selectAuditPage([], { ...DEFAULT_AUDIT_QUERY, page: 99 });
  const noMatch = selectAuditPage(AUDIT_LOG_FIXTURES, {
    ...DEFAULT_AUDIT_QUERY,
    action: 'outside',
  });
  assert.equal(empty.page, 1);
  assert.equal(empty.catalogTotal, 0);
  assert.equal(noMatch.catalogTotal, 18);
  assert.equal(noMatch.total, 0);
});

test('Fixture safe allowlist: fake IDs, no identity join, raw metadata or authentication data', () => {
  assert.equal(new Set(AUDIT_LOG_FIXTURES.map((i) => i.id)).size, 18);
  for (const item of AUDIT_LOG_FIXTURES) {
    assert.deepEqual(
      Object.keys(item).sort(),
      ['id', 'userId', 'action', 'targetType', 'targetId', 'createdAt'].sort(),
    );
    for (const field of [item.id, item.userId, item.targetId])
      if (field) assert.match(field, /^demo-/);
    if (item.createdAt) assert.match(item.createdAt, /^2026-10-28T\d{2}:\d{2}:00Z$/);
  }
  assert.equal(AUDIT_LOG_FIXTURES[14].userId, null);
  assert.equal(AUDIT_LOG_FIXTURES[15].targetId, null);
  assert.equal(AUDIT_LOG_FIXTURES[17].action, null);
  assert.equal(DEMO_AUDIT_ACTIONS.length, 3);
  assert.doesNotMatch(
    JSON.stringify(AUDIT_LOG_FIXTURES),
    /password|hash|token|metadata|before_data|after_data|@/i,
  );
});

test('Only confirmed source call sites receive summaries; fixed time zone and missing time', () => {
  assert.match(describeAuditAction('USER_LOGIN'), /luồng đăng nhập/);
  assert.match(describeAuditAction('USER_REGISTERED'), /luồng đăng ký/);
  assert.equal(describeAuditAction('UNRECOGNIZED'), describeAuditAction(null));
  assert.match(formatAuditTime('2026-10-28T10:50:00Z'), /17:50:00/);
  assert.match(formatAuditTime('2026-10-28T10:50:00Z'), /28\/10\/2026/);
  assert.equal(formatAuditTime(null), 'Chưa có dữ liệu');
  assert.equal(formatAuditTime('invalid'), 'Chưa có dữ liệu');
});

test('Repository rejects pre-aborted and cancels pending reads without stale completion', async () => {
  const controller = new AbortController();
  const pending = demoAuditRepository.list(DEFAULT_AUDIT_QUERY, {
    signal: controller.signal,
    preview: 'slow',
    retry: false,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(
    demoAuditRepository.list(DEFAULT_AUDIT_QUERY, {
      signal: controller.signal,
      preview: 'normal',
      retry: false,
    }),
    { name: 'AbortError' },
  );
});

test('Retry preserves query and clamps; simulated error, empty and no-match remain separate', async () => {
  const options = { signal: new AbortController().signal, preview: 'error' as const, retry: false };
  const query = {
    ...DEFAULT_AUDIT_QUERY,
    keyword: 'demo-audit-user-001',
    action: 'USER_REGISTERED',
    page: 99,
  };
  await assert.rejects(demoAuditRepository.list(query, options));
  const recovered = await demoAuditRepository.list(query, { ...options, retry: true });
  assert.equal(recovered.total, 1);
  assert.equal(recovered.page, 1);
  assert.equal(recovered.items[0].id, 'demo-audit-009');
  assert.equal(
    (await demoAuditRepository.list(query, { ...options, preview: 'empty' })).catalogTotal,
    0,
  );
  assert.equal(
    (await demoAuditRepository.list({ ...query, keyword: 'absent' }, { ...options, retry: true }))
      .total,
    0,
  );
});
