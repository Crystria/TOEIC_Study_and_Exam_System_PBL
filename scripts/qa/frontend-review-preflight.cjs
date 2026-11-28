/* Read-only Learning preflight via the real Gateway. Never creates a learning session,
 * reviews, quiz submits, seeds or progress changes. Auth tokens stay in memory. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { parseArgs, isDeepStrictEqual } = require('node:util');
const { values } = parseArgs({ options: { out: { type: 'string' } } });
const root = path.resolve(__dirname, '../..');
const out = path.resolve(root, values.out || '');
if (!values.out || !out.startsWith(path.join(root, 'tmp') + path.sep))
  throw Error('Provide --out <fresh folder under tmp>');
if (fs.existsSync(out)) throw Error('Evidence output exists; choose a fresh folder');
fs.mkdirSync(out, { recursive: true });
const credentials = JSON.parse(
  fs.readFileSync(path.join(root, 'private/credentials/frontend-session35-20261103.json')),
).accounts.user;
const report = {
  kind: 'real HTTP through Gateway; no Learning mutations',
  checks: [],
  requests: [],
};
const save = () =>
  fs.writeFileSync(path.join(out, 'review-preflight.json'), JSON.stringify(report, null, 2) + '\n');
let session;
async function request(p, method = 'GET', body) {
  const response = await fetch('http://localhost:3000/api/v1/' + p, {
    method,
    headers: {
      ...(session ? { Authorization: 'Bearer ' + session.accessToken } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000),
  });
  const value = await response.json().catch(() => null);
  const metadata = {
    path: p,
    method,
    status: response.status,
    date: response.headers.get('date'),
    correlationId: response.headers.get('x-correlation-id'),
  };
  report.requests.push(metadata);
  assert.equal(response.status, 200, p + ': ' + String(value?.code || 'HTTP_ERROR'));
  return { value, ...metadata };
}
async function pages(p) {
  const first = await request(p + (p.includes('?') ? '&' : '?') + 'page=1&size=50');
  assert(
    Number.isInteger(first.value.total) &&
      first.value.total >= 0 &&
      Array.isArray(first.value.items),
    'paged response',
  );
  const count = Math.ceil(first.value.total / 50);
  assert(count <= 100, 'Preflight page bound exceeded; inspect manually');
  const items = [...first.value.items];
  for (let page = 2; page <= count; page++)
    items.push(
      ...(await request(p + (p.includes('?') ? '&' : '?') + 'page=' + page + '&size=50')).value
        .items,
    );
  assert.equal(items.length, first.value.total, 'complete paged read');
  return { ...first, value: { ...first.value, items } };
}
async function main() {
  const ready = await fetch('http://localhost:3000/ready', { signal: AbortSignal.timeout(5000) });
  assert.equal(ready.status, 200, 'Gateway readiness');
  report.readiness = { status: ready.status, value: await ready.json() };
  const login = await request('auth/login', 'POST', {
    email: credentials.email,
    password: credentials.password,
    deviceId: 'frontend-review-' + crypto.randomUUID(),
  });
  session = login.value;
  assert.equal(session.user.userId, credentials.userId, 'private test identity');
  const me = await request('users/me');
  assert.equal(me.value.userId, credentials.userId);
  const before = await request('learning/progress');
  const due = await pages('learning/review-today');
  assert(due.date && Number.isFinite(Date.parse(due.date)), 'actual HTTP server Date required');
  report.serverDate = due.date;
  // Presentation of the server's Date using the UTC+7 policy in Learning sm2.ts.
  report.learningDay = new Date(Date.parse(due.date) + 7 * 3600000).toISOString().slice(0, 10);
  report.timePolicy =
    'Learning vietnamDate: UTC+7; read-only conversion of HTTP Date, no clock change';
  report.due = due.value;
  assert.equal(
    new Set(due.value.items.map((i) => i.entityId)).size,
    due.value.total,
    'no duplicate due IDs',
  );
  const projection = [],
    cursors = new Set();
  let cursor;
  for (let n = 0; n < 100; n++) {
    const r = await request(
      'sync/users/me' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
    );
    assert(r.value.projectionReady === true, 'progress projection must be ready');
    assert(Array.isArray(r.value.progress));
    projection.push(...r.value.progress);
    cursor = r.value.nextCursor;
    if (!cursor) break;
    assert(!cursors.has(cursor), 'projection cursor must advance');
    cursors.add(cursor);
  }
  assert(!cursor, 'projection pagination bound');
  report.projection = projection;
  report.nextReviewDates = [
    ...new Set(
      projection
        .filter((p) => p.entityType === 'VOCABULARY')
        .map((p) => p.state?.nextReviewDate)
        .filter(Boolean),
    ),
  ].sort();
  report.checks.push({
    id: 'P-date-due',
    expected: 'Read current server day and all due snapshots without mutation',
    actual: {
      serverDate: due.date,
      learningDay: report.learningDay,
      due: due.value.total,
      nextReviewDates: report.nextReviewDates,
    },
    status: 'PASS',
  });
  const dueByTopic = new Map();
  for (const item of due.value.items) {
    const word = (await request('learning/vocabularies/' + encodeURIComponent(item.entityId)))
      .value;
    dueByTopic.set(word.topicId, [...(dueByTopic.get(word.topicId) || []), item.entityId]);
  }
  report.topics = [];
  for (const [topicId, ids] of dueByTopic) {
    const words = await pages('learning/vocabularies?topicId=' + encodeURIComponent(topicId));
    const definitions = new Set(
      words.value.items.map((w) => w.definition.normalize('NFC').trim().toLowerCase()),
    );
    report.topics.push({
      topicId,
      dueCount: ids.length,
      distinctDefinitions: definitions.size,
      candidate: ids.length >= 5 && definitions.size >= 4,
    });
  }
  const eligible = report.topics.filter((t) => t.candidate);
  report.review = {
    status: eligible.length ? 'READY' : 'BLOCKED',
    globalDue: due.value.total,
    eligibleTopics: eligible.map((t) => t.topicId),
    sessionCreated: false,
    progressMutations: 0,
    acceptanceStatus: 'CHUA_KIEM',
    reason: eligible.length
      ? 'Candidates meet preflight; backend still validates create. No review was submitted by preflight.'
      : 'Need at least 5 real due words in the same active topic and 4 distinct normalized definitions.',
  };
  const after = await request('learning/progress');
  assert.deepEqual(after.value, before.value, 'Learning counters/updatedAt unchanged');
  report.progressBefore = before.value;
  report.progressAfter = after.value;
  report.checks.push({
    id: 'P-no-learning-mutation',
    expected: 'Learning progress and session counters unchanged',
    actual: after.value,
    status: 'PASS',
  });
  const old = JSON.parse(
    fs.readFileSync(
      path.join(root, 'tmp/frontend-integration-session37-20261103/final-readback.json'),
    ),
  );
  const oldProjection = old.paths.find((p) => p.path === 'sync/users/me').value.progress;
  const canonical = (rows) =>
    [...rows]
      .sort((a, b) => (a.entityType + a.entityId).localeCompare(b.entityType + b.entityId))
      .map((p) => ({
        entityType: p.entityType,
        entityId: p.entityId,
        revision: p.revision,
        state: p.state,
      }));
  const unchangedSince37 = isDeepStrictEqual(canonical(projection), canonical(oldProjection));
  report.checks.push({
    id: 'P-progress-compared-since37',
    expected:
      'Compare revisions/SM-2 with final readback37; legitimate later learning may change them',
    actual: { snapshots: projection.length, unchanged: unchangedSince37 },
    status: 'PASS',
  });
  save();
  console.log(
    JSON.stringify({
      serverDate: report.serverDate,
      learningDay: report.learningDay,
      due: due.value.total,
      nextReviewDates: report.nextReviewDates,
      review: report.review.status,
      progressMutations: 0,
      unchangedSince37,
      snapshots: projection.length,
    }),
  );
}
main()
  .catch((error) => {
    report.error = { name: error.name, message: error.message };
    process.exitCode = 1;
    console.error(error.name + ': ' + error.message);
  })
  .finally(async () => {
    if (session) {
      try {
        await request('auth/logout', 'POST', { refreshToken: session.refreshToken });
        report.authSessionCleanedUp = true;
      } catch {
        report.authSessionCleanedUp = false;
      }
    }
    assert(
      report.requests.every((r) => r.method === 'GET' || /^auth\/(login|logout)$/.test(r.path)),
      'Learning mutation forbidden',
    );
    save();
  });
