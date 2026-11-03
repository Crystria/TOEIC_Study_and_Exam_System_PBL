/* Real Gateway acceptance. Credentials stay in memory; each output is a new evidence run.
 * Never resets/seeds databases. Resume reuses the durable IDs/keys in run-state.json. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { values } = parseArgs({ options: { out: { type: 'string' }, phase: { type: 'string' } } });
const root = path.resolve(__dirname, '../..');
const out = path.resolve(root, values.out || '');
if (
  !out.startsWith(path.join(root, 'tmp') + path.sep) ||
  !fs.existsSync(path.join(out, 'database-verification.json'))
)
  throw Error('Use a fresh tmp evidence folder with verified databases first');
const databases = JSON.parse(fs.readFileSync(path.join(out, 'database-verification.json')));
assert.equal(databases.length, 5);
assert(databases.every((d) => d.verified && d.database.endsWith('_frontend_s34_20261103')));
const credentials = JSON.parse(
  fs.readFileSync(path.join(root, 'private/credentials/frontend-session35-20261103.json')),
);
credentials.accounts.secondary = JSON.parse(
  fs.readFileSync(path.join(root, 'private/credentials/frontend-session36-20261103.json')),
).accounts.secondary;
const statePath = path.join(out, 'run-state.json');
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath))
  : { namespace: 'frontend-s37-' + Date.now(), keys: {}, resources: {}, pending: {} };
const checks = [],
  requests = [],
  sessions = [];
const save = (name, value) =>
  fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const persist = () => save('run-state.json', state);
const key = (name) => {
  state.keys[name] ??= crypto.randomUUID();
  persist();
  return state.keys[name];
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
let nextLogin = 0;
async function api(p, method = 'GET', body, token, headers = {}) {
  const r = await fetch('http://localhost:3000/api/v1/' + p, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000),
  });
  const value = await r.json().catch(() => null);
  requests.push({
    at: new Date().toISOString(),
    path: p,
    method,
    status: r.status,
    correlationId: r.headers.get('x-correlation-id'),
  });
  return { status: r.status, value, date: r.headers.get('date') };
}
function expect(r, code, label) {
  assert.equal(
    r.status,
    code,
    label + ' ' + JSON.stringify(r.value?.code || r.value?.message || ''),
  );
  return r.value;
}
async function login(name) {
  await pause(Math.max(0, nextLogin - Date.now()));
  nextLogin = Date.now() + 7100;
  const a = credentials.accounts[name];
  const r = expect(
    await api('auth/login', 'POST', {
      email: a.email,
      password: a.password,
      deviceId: 's37-' + crypto.randomUUID(),
    }),
    200,
    'login ' + name,
  );
  assert.equal(r.user.userId, a.userId);
  sessions.push(r);
  return r.accessToken;
}
async function check(id, expected, work) {
  try {
    const actual = await work();
    checks.push({ id, expected, actual, status: 'PASS', kind: 'real HTTP via Gateway' });
    console.log('PASS ' + id);
  } catch (e) {
    checks.push({ id, expected, actual: e.message, status: 'FAIL', kind: 'real HTTP via Gateway' });
    console.log('FAIL ' + id + ': ' + e.message);
  }
  save(values.phase + '-matrix.json', { at: new Date().toISOString(), checks, requests });
}
async function create(name, p, body, token, idField, idempotent = false) {
  if (state.resources[name]) return state.resources[name];
  if (state.pending[name] && !idempotent)
    throw Error('Uncertain create ' + name + ': reconcile server; do not replay');
  state.pending[name] = true;
  persist();
  const r = await api(p, 'POST', body, token, idempotent ? { 'Idempotency-Key': key(name) } : {});
  // Explicit validation failures have not committed; network/5xx outcomes remain pending.
  if (r.status >= 400 && r.status < 500) {
    delete state.pending[name];
    persist();
  }
  const v = expect(r, 201, 'create ' + name);
  assert(v[idField]);
  state.resources[name] = v;
  delete state.pending[name];
  persist();
  return v;
}
const testId = '7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9';
async function read() {
  const u = await login('user');
  await check(
    'ENV-runtime-database',
    'Running service connections use all five manifest databases',
    async () => {
      const dotenv = require('dotenv'),
        dir = path.join(root, 'services/auth-service');
      const env = dotenv.parse(fs.readFileSync(path.join(dir, '.env'))),
        url = new URL(env.DATABASE_URL);
      url.pathname = '/auth_frontend_s34_20261103';
      const { PrismaClient } = require(path.join(dir, 'src/generated/prisma'));
      const db = new PrismaClient({ datasourceUrl: url.href });
      try {
        const rows = await db.$queryRawUnsafe(
          "SELECT datname, count(*)::int AS connections FROM pg_stat_activity WHERE backend_type='client backend' GROUP BY datname",
        );
        for (const d of databases)
          assert(rows.some((r) => r.datname === d.database && r.connections > 0));
        save('runtime-databases.json', rows);
        return rows.filter((r) => databases.some((d) => d.database === r.datname));
      } finally {
        await db.$disconnect();
      }
    },
  );
  await check(
    'L-due-backend-date',
    'Read actual due list and nextReviewDate without clock/progress changes',
    async () => {
      const due = await api('learning/review-today?size=50', 'GET', undefined, u);
      expect(due, 200, 'due');
      const progress = expect(await api('learning/progress', 'GET', undefined, u), 200, 'progress');
      const sync = expect(await api('sync/users/me', 'GET', undefined, u), 200, 'sync');
      save('learning-current-readback.json', { date: due.date, due: due.value, progress, sync });
      const count = due.value.total ?? due.value.items?.length ?? 0;
      checks.push({
        id: 'L-positive-REVIEW',
        expected: 'At least 5 actually due words; REVIEW/reviews/quiz/next SM-2',
        actual: count + ' due; backend Date ' + due.date,
        status: count >= 5 ? 'CHUA_KIEM' : 'BLOCKED',
        evidence: 'learning-current-readback.json',
      });
      return { date: due.date, due: count, progress };
    },
  );
  await check(
    'E-catalog-parts',
    'Full remains 200 questions and all 7 Parts available',
    async () => {
      const t = expect(await api('tests/' + testId, 'GET', undefined, u), 200, 'test');
      const parts = expect(
        await api('tests/' + testId + '/parts', 'GET', undefined, u),
        200,
        'parts',
      );
      assert.equal(t.questions.length, 200);
      assert.equal(parts.parts.length, 7);
      assert(parts.parts.every((p) => p.available));
      state.originalTest = t;
      persist();
      save('original-test.json', t);
      return { testId, count: t.questions.length, parts: parts.parts };
    },
  );
}
async function exams() {
  const u = await login('user'),
    other = await login('secondary');
  await check(
    'E-expiry-start',
    'Legal minimum 300s Part attempt; persist same key/deadline and draft for real expiry',
    async () => {
      const a = await create(
        'expiry',
        'tests/' + testId + '/part-attempts',
        { parts: [5], durationSeconds: 300 },
        u,
        'attemptId',
        true,
      );
      const answer = { questionId: a.questions[0].questionId, selectedOption: 'B' };
      expect(
        await api('attempts/' + a.attemptId + '/draft', 'PUT', { answers: [answer] }, u),
        200,
        'expiry draft',
      );
      state.expiryDraft = answer;
      persist();
      return {
        attemptId: a.attemptId,
        serverTime: a.serverTime,
        deadline: a.deadlineAt,
        seconds: a.durationSeconds,
      };
    },
  );
  await check(
    'E-full-start-duplicate',
    'Concurrent Full starts reuse one snapshot without grading; changed key payload409',
    async () => {
      const k = key('full'),
        results = await Promise.all([
          api('tests/' + testId + '/attempts', 'POST', undefined, u, { 'Idempotency-Key': k }),
          api('tests/' + testId + '/attempts', 'POST', undefined, u, { 'Idempotency-Key': k }),
        ]);
      const a = expect(results[0], 201, 'full start'),
        b = expect(results[1], 201, 'duplicate start');
      assert.equal(a.attemptId, b.attemptId);
      assert.equal(a.questions.length, 200);
      assert(!JSON.stringify(a).includes('correctOption'));
      state.resources.full = a;
      persist();
      save('full-in-progress.json', a);
      expect(
        await api(
          'tests/' + testId + '/part-attempts',
          'POST',
          { parts: [5], durationSeconds: 300 },
          u,
          { 'Idempotency-Key': k },
        ),
        409,
        'key conflict',
      );
      return {
        attemptId: a.attemptId,
        questions: a.questions.length,
        snapshotVersion: a.snapshotVersion,
        deadline: a.deadlineAt,
        sameId: true,
      };
    },
  );
  await check(
    'E-draft-resume-isolation',
    'Choose/change/null merge, immutable snapshot/deadline; other USER gets404',
    async () => {
      const a = state.resources.full;
      assert(a);
      const p = 'attempts/' + a.attemptId;
      const q = a.questions;
      expect(
        await api(
          p + '/draft',
          'PUT',
          {
            answers: [
              { questionId: q[0].questionId, selectedOption: 'A' },
              { questionId: q[1].questionId, selectedOption: 'B' },
            ],
          },
          u,
        ),
        200,
        'draft',
      );
      expect(
        await api(
          p + '/draft',
          'PUT',
          {
            answers: [
              { questionId: q[0].questionId, selectedOption: 'C' },
              { questionId: q[1].questionId, selectedOption: null },
            ],
          },
          u,
        ),
        200,
        'change/clear',
      );
      const b = expect(await api(p, 'GET', undefined, u), 200, 'resume');
      assert.equal(b.deadlineAt, a.deadlineAt);
      assert.deepEqual(b.questions, a.questions);
      assert.equal(b.answers.find((x) => x.questionId === q[0].questionId).selectedOption, 'C');
      assert.equal(b.answers.find((x) => x.questionId === q[1].questionId).selectedOption, null);
      assert(b.remainingSeconds <= a.remainingSeconds);
      for (const [m, suffix, body] of [
        ['GET', '', undefined],
        ['PUT', '/draft', { answers: [] }],
        ['POST', '/submit', { answers: [] }],
      ])
        expect(await api(p + suffix, m, body, other), 404, 'other owner');
      save('full-resume.json', b);
      return {
        attemptId: a.attemptId,
        snapshotEqual: true,
        deadlineEqual: true,
        otherUser: [404, 404, 404],
      };
    },
  );
  await check(
    'E-full-submit-review',
    'Concurrent submit commits once; backend Full scores/perPart/review stay identical on reread',
    async () => {
      const a = state.resources.full;
      assert(a);
      const p = 'attempts/' + a.attemptId;
      const answers = a.questions
        .slice(0, 5)
        .map((q) => ({ questionId: q.questionId, selectedOption: 'A' }));
      const r = await Promise.all([
        api(p + '/submit', 'POST', { answers }, u),
        api(p + '/submit', 'POST', { answers }, u),
      ]);
      const final = expect(r[0], 201, 'submit'),
        dup = expect(r[1], 201, 'duplicate submit');
      assert.equal(final.status, 'SUBMITTED');
      assert.equal(final.score, final.scoreListening + final.scoreReading);
      assert.equal(dup.score, final.score);
      assert.equal(final.answers.length, 200);
      assert.equal(
        final.partStats.reduce((n, p) => n + p.totalQuestions, 0),
        200,
      );
      assert.equal(
        final.partStats.reduce((n, p) => n + p.correctCount, 0),
        final.correctCount,
      );
      assert(final.questions.every((q) => q.correctOption));
      const reread = expect(await api(p, 'GET', undefined, u), 200, 'final read');
      assert.deepEqual(reread.answers, final.answers);
      state.resources.fullResult = final;
      persist();
      save('full-result.json', final);
      return {
        attemptId: a.attemptId,
        status: final.status,
        score: final.score,
        listening: final.scoreListening,
        reading: final.scoreReading,
        correct: final.correctCount,
        partStats: final.partStats,
        disclaimer: final.scoreDisclaimer,
      };
    },
  );
  await check(
    'E-multiple-Parts',
    'Multi Part [2,5] has55 questions, rejects Part2 D, no TOEIC scale',
    async () => {
      const a = await create(
        'multi',
        'tests/' + testId + '/part-attempts',
        { parts: [2, 5], durationSeconds: 600 },
        u,
        'attemptId',
        true,
      );
      assert.equal(a.questions.length, 55);
      expect(
        await api(
          'attempts/' + a.attemptId + '/draft',
          'PUT',
          {
            answers: [
              { questionId: a.questions.find((q) => q.part === 2).questionId, selectedOption: 'D' },
            ],
          },
          u,
        ),
        400,
        'Part2 optionD',
      );
      const final = expect(
        await api(
          'attempts/' + a.attemptId + '/submit',
          'POST',
          { answers: [{ questionId: a.questions[0].questionId, selectedOption: 'A' }] },
          u,
        ),
        201,
        'multi submit',
      );
      assert.equal(final.score, null);
      assert.equal(final.scoreListening, null);
      assert.equal(final.scoreReading, null);
      state.resources.multiResult = final;
      persist();
      save('multi-result.json', final);
      return {
        attemptId: a.attemptId,
        parts: final.parts,
        total: final.totalQuestions,
        score: final.score,
      };
    },
  );
}
async function expiry() {
  const u = await login('user');
  await check(
    'E-natural-expiry',
    'Real 300s deadline passed; late body ignored; saved draft used; no clock/DB change',
    async () => {
      const a = state.resources.expiry;
      assert(a, 'Start expiry first');
      const now = expect(
        await api('attempts/' + a.attemptId, 'GET', undefined, u),
        200,
        'expiry read',
      );
      if (now.status === 'IN_PROGRESS')
        throw Error(
          'Deadline still pending: ' +
            now.remainingSeconds +
            's; rerun expiry phase after real deadline',
        );
      const late = expect(
        await api(
          'attempts/' + a.attemptId + '/submit',
          'POST',
          { answers: [{ ...state.expiryDraft, selectedOption: 'D' }] },
          u,
        ),
        201,
        'late submit',
      );
      assert.equal(late.status, 'EXPIRED');
      assert.equal(late.deadlineAt, a.deadlineAt);
      assert.equal(
        late.answers.find((x) => x.questionId === state.expiryDraft.questionId).selectedOption,
        state.expiryDraft.selectedOption,
      );
      save('expired-result.json', late);
      return {
        attemptId: late.attemptId,
        status: late.status,
        deadline: late.deadlineAt,
        score: late.score,
        storedDraftWon: true,
      };
    },
  );
}
async function analytics() {
  const u = await login('user');
  await check(
    'AN-ranges-cursor-linkage',
    'Full/Part visible exactly once; range/cursor pages agree without duplicate IDs',
    async () => {
      const scoreId = state.resources.full?.attemptId,
        partId = state.resources.multi?.attemptId;
      let scores, practices;
      for (let i = 0; i < 20; i++) {
        scores = expect(await api('analytics/scores?size=50', 'GET', undefined, u), 200, 'scores');
        practices = expect(
          await api('analytics/practices?size=50', 'GET', undefined, u),
          200,
          'practices',
        );
        if (
          scores.items.some((x) => x.attemptId === scoreId) &&
          practices.items.some((x) => x.attemptId === partId)
        )
          break;
        await pause(1000);
      }
      assert.equal(scores.items.filter((x) => x.attemptId === scoreId).length, 1);
      assert.equal(practices.items.filter((x) => x.attemptId === partId).length, 1);
      const ranges = [];
      for (const range of ['LAST_7_DAYS', 'LAST_30_DAYS', 'ALL_TIME']) {
        const all = expect(
          await api('analytics/progress?timeRange=' + range + '&limit=50', 'GET', undefined, u),
          200,
          'progress',
        );
        const pages = [];
        let cursor;
        for (let n = 0; n < 20; n++) {
          const p = expect(
            await api(
              'analytics/progress?timeRange=' +
                range +
                '&limit=1' +
                (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
              'GET',
              undefined,
              u,
            ),
            200,
            'cursor',
          );
          pages.push(p);
          cursor = p.scoreTrendNextCursor;
          if (!cursor) break;
        }
        const ids = pages.flatMap((p) => p.scoreTrend.map((x) => x.attemptId));
        assert.equal(new Set(ids).size, ids.length, 'no duplicate cursor entries');
        assert.deepEqual(
          [...ids].sort(),
          all.scoreTrend.map((x) => x.attemptId).sort(),
          'cursor union matches full window',
        );
        for (const page of pages) assert.equal(page.timeRange, range);
        ranges.push({ range, all, pages });
      }
      save('analytics-readback.json', { scores, practices, ranges });
      return {
        scoreHistory: scores.items.length,
        practiceHistory: practices.items.length,
        ranges: ranges.map((r) => ({ range: r.range, pages: r.pages.length })),
      };
    },
  );
}
async function cursorSetup() {
  const u = await login('user');
  await check(
    'E-cursor-full-sample',
    'Additional own Full result supplies positive cursor pagination; same durable key on resume',
    async () => {
      const a = await create(
        'cursorFull',
        'tests/' + testId + '/attempts',
        undefined,
        u,
        'attemptId',
        true,
      );
      const final = expect(
        await api('attempts/' + a.attemptId + '/submit', 'POST', { answers: [] }, u),
        201,
        'cursor sample submit',
      );
      state.resources.cursorResult = final;
      persist();
      return { attemptId: a.attemptId, status: final.status, score: final.score };
    },
  );
}
async function recheck() {
  const u = await login('user'),
    other = await login('secondary');
  await check(
    'E-owner-final-recheck',
    'Source uses403 for another owner; final backend answer set is stable independent of row order',
    async () => {
      const a = state.resources.full;
      assert(a);
      const p = 'attempts/' + a.attemptId;
      for (const [method, suffix, body] of [
        ['GET', '', undefined],
        ['PUT', '/draft', { answers: [] }],
        ['POST', '/submit', { answers: [] }],
      ])
        expect(await api(p + suffix, method, body, other), 403, 'owner forbidden');
      const final = expect(await api(p, 'GET', undefined, u), 200, 'final');
      const dup = expect(
        await api(p + '/submit', 'POST', { answers: [] }, u),
        201,
        'repeat finalization',
      );
      const sorted = (a) => [...a].sort((x, y) => x.questionId.localeCompare(y.questionId));
      assert.deepEqual(sorted(final.answers), sorted(dup.answers));
      assert.equal(final.status, 'SUBMITTED');
      assert.equal(final.answers.length, 200);
      assert.equal(final.score, final.scoreListening + final.scoreReading);
      assert.equal(
        final.partStats.reduce((n, p) => n + p.correctCount, 0),
        final.correctCount,
      );
      assert(final.questions.every((q) => q.correctOption && q.explanation));
      state.resources.fullResult = final;
      persist();
      save('full-result.json', final);
      return {
        attemptId: a.attemptId,
        sameAnswerSet: true,
        otherOwner: [403, 403, 403],
        correctCount: final.correctCount,
        score: final.score,
        listening: final.scoreListening,
        reading: final.scoreReading,
        partStats: final.partStats,
      };
    },
  );
}
const question = (part, name) => ({
  part,
  type: 'SINGLE_CHOICE',
  questionText: state.namespace + ' ' + name,
  difficulty: 'MEDIUM',
  correctOption: 'A',
  explanation: 'Technical QA: option A.',
  transcript: part < 5 ? 'Synthetic technical playback QA.' : null,
  tags: [state.namespace],
  options: ['A', 'B', 'C', 'D']
    .slice(0, part === 2 ? 3 : 4)
    .map((optionCode) => ({ optionCode, optionText: 'QA ' + optionCode })),
});
async function bankUpload(scope, itemId, kind, token) {
  const image = kind === 'IMAGE',
    contentType = image ? 'image/png' : 'audio/mpeg';
  const ticket = expect(
    await api(
      scope + '/' + itemId + '/media/presign',
      'POST',
      { fileName: image ? 'qa.png' : 'qa.mp3', contentType, mediaType: kind },
      token,
      { 'Idempotency-Key': key(scope + itemId + kind) },
    ),
    201,
    'bank presign',
  );
  const media = fs.readFileSync(
    path.join(root, 'tmp/frontend-integration-session35-20261103', image ? 'qa.png' : 'qa.mp3'),
  );
  const put = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: media,
  });
  assert.equal(put.status, 200, 'storage PUT');
  const attached = expect(
    await api(
      scope + '/' + itemId,
      'PATCH',
      { [image ? 'imageKey' : 'audioKey']: ticket.storageKey },
      token,
    ),
    200,
    'attach media',
  );
  const url = image ? attached.imageUrl : attached.audioUrl;
  const get = await fetch(url);
  assert.equal(get.status, 200, 'public media');
  return {
    attached,
    evidence: {
      scope,
      itemId,
      kind,
      presign: 201,
      put: put.status,
      attach: 200,
      get: get.status,
      contentType: get.headers.get('content-type'),
      bytes: (await get.arrayBuffer()).byteLength,
    },
  };
}
async function cms() {
  const ca = await login('content_admin'),
    sa = await login('system_admin'),
    u = await login('user');
  await check(
    'CMS-roles-users-audit',
    'USER denied CMS writes; CONTENT_ADMIN denied users; SYSTEM_ADMIN denied Learning but can read users/audit',
    async () => {
      expect(
        await api('learning/admin/vocabulary-topics', 'POST', { topicName: state.namespace }, u, {
          'Idempotency-Key': key('denied'),
        }),
        403,
        'user write',
      );
      expect(await api('admin/users', 'GET', undefined, ca), 403, 'content users');
      expect(await api('learning/admin/lessons', 'GET', undefined, sa), 403, 'system learning');
      const users = expect(
        await api('admin/users?size=1&page=1', 'GET', undefined, sa),
        200,
        'users',
      );
      const audit = expect(
        await api('admin/audit-logs?size=5&page=1', 'GET', undefined, sa),
        200,
        'audit',
      );
      save('users-audit.json', { users: { total: users.total, count: users.items.length }, audit });
      return {
        userWrite: 403,
        contentUsers: 403,
        systemLearning: 403,
        systemUsers: 200,
        systemAudit: 200,
      };
    },
  );
  await check(
    'CMS-learning-create-update-read',
    'New namespace topic/5 distinct words/PUBLISHED lesson; validation400; web reads persisted updates',
    async () => {
      expect(
        await api('learning/admin/vocabulary-topics', 'POST', { topicName: '' }, ca, {
          'Idempotency-Key': key('invalid-topic'),
        }),
        400,
        'topic validation',
      );
      const topic = await create(
        'topic',
        'learning/admin/vocabulary-topics',
        { topicName: state.namespace + ' Network QA' },
        ca,
        'topicId',
        true,
      );
      for (let n = 0; n < 5; n++)
        await create(
          'word' + n,
          'learning/admin/vocabularies',
          {
            topicId: topic.topicId,
            word: state.namespace + '-word' + n,
            definition: 'Distinct QA definition ' + n,
            phonetic: null,
            example: 'QA example ' + n,
          },
          ca,
          'vocabularyId',
          true,
        );
      const lesson = await create(
        'lesson',
        'learning/admin/lessons',
        {
          lessonTitle: state.namespace + ' Published',
          category: 'QA',
          contentMarkdown: '# QA\n\nTechnical lesson.',
          status: 'DRAFT',
        },
        ca,
        'lessonId',
        true,
      );
      expect(
        await api('learning/lessons/' + lesson.lessonId, 'GET', undefined, u),
        404,
        'draft hidden',
      );
      expect(
        await api(
          'learning/admin/lessons/' + lesson.lessonId,
          'PATCH',
          { status: 'PUBLISHED', contentMarkdown: '# QA updated\n\nServer acknowledged.' },
          ca,
        ),
        200,
        'publish',
      );
      const read = expect(
        await api('learning/lessons/' + lesson.lessonId, 'GET', undefined, u),
        200,
        'web lesson',
      );
      assert.equal(read.status, 'PUBLISHED');
      assert(read.contentMarkdown.includes('updated'));
      const words = expect(
        await api('learning/vocabularies?topicId=' + topic.topicId, 'GET', undefined, u),
        200,
        'web words',
      );
      assert.equal(words.total, 5);
      const word = state.resources.word0;
      expect(
        await api(
          'learning/admin/vocabularies/' + word.vocabularyId,
          'PATCH',
          { example: 'Edited through Gateway' },
          ca,
        ),
        200,
        'word edit',
      );
      assert.equal(
        expect(
          await api('learning/vocabularies/' + word.vocabularyId, 'GET', undefined, u),
          200,
          'reread word',
        ).example,
        'Edited through Gateway',
      );
      return {
        topicId: topic.topicId,
        words: words.total,
        lessonId: lesson.lessonId,
        published: true,
      };
    },
  );
  await check(
    'CMS-Parts1-7-groups-tags-order',
    'Create/update all Parts in own namespace; tags, group membership/order/assets persist',
    async () => {
      for (const part of [1, 2, 5]) {
        const q = await create(
          'q' + part,
          'questions',
          question(part, 'Part' + part),
          ca,
          'questionId',
        );
        const edited = expect(
          await api(
            'questions/' + q.questionId,
            'PATCH',
            { tags: [state.namespace, 'edited'], explanation: 'QA explanation edited.' },
            ca,
          ),
          200,
          'question edit',
        );
        assert(edited.tags.includes('edited'));
        assert.equal(edited.options.length, part === 2 ? 3 : 4);
        const read = expect(
          await api('questions/' + q.questionId, 'GET', undefined, ca),
          200,
          'question reread',
        );
        assert.equal(read.explanation, 'QA explanation edited.');
      }
      expect(
        await api('questions', 'POST', { ...question(2, 'invalid'), correctOption: 'D' }, ca),
        400,
        'Part2 D validation',
      );
      for (const part of [3, 4, 6, 7]) {
        const group = await create(
          'g' + part,
          'question-groups',
          {
            part,
            type: 'SINGLE_PASSAGE',
            instruction: state.namespace + ' group Part' + part,
            transcript: part < 5 ? 'Technical QA transcript.' : null,
            passageText: part === 6 ? 'QA [[1]] and [[2]].' : 'QA passage.',
            assets: [
              { kind: 'TEXT', content: 'QA document A', orderNo: 1 },
              { kind: 'TEXT', content: 'QA document B', orderNo: 2 },
            ],
            questions: [question(part, 'first'), question(part, 'second')],
          },
          ca,
          'groupId',
        );
        const order = [...group.questionIds].reverse();
        expect(
          await api(
            'question-groups/' + group.groupId,
            'PATCH',
            {
              questionOrder: order,
              assets: [
                { kind: 'TEXT', content: 'QA document B', orderNo: 1 },
                { kind: 'TEXT', content: 'QA document A updated', orderNo: 2 },
              ],
            },
            ca,
          ),
          200,
          'group reorder',
        );
        const read = expect(
          await api('question-groups/' + group.groupId, 'GET', undefined, ca),
          200,
          'group reread',
        );
        assert.deepEqual(read.questionIds, order);
        assert.equal(read.assets[0].content, 'QA document B');
        const q = expect(
          await api('questions/' + order[0], 'GET', undefined, ca),
          200,
          'group question',
        );
        assert.equal(q.groupId, group.groupId);
        assert.equal(q.positionInGroup, 1);
        expect(
          await api(
            'questions/' + q.questionId,
            'PATCH',
            { explanation: 'Edited grouped question' },
            ca,
          ),
          200,
          'group question edit',
        );
      }
      return { singleParts: [1, 2, 5], groupedParts: [3, 4, 6, 7], tagsAndOrder: true };
    },
  );
  await check(
    'MEDIA-question-group-learning',
    'Presign/PUT/attach or confirm/readback200; technical media only',
    async () => {
      const evidence = [];
      for (const [name, kind] of [
        ['q1', 'IMAGE'],
        ['q1', 'AUDIO'],
        ['q2', 'AUDIO'],
      ])
        evidence.push(
          (await bankUpload('questions', state.resources[name].questionId, kind, ca)).evidence,
        );
      for (const name of ['g3', 'g4'])
        evidence.push(
          (await bankUpload('question-groups', state.resources[name].groupId, 'AUDIO', ca))
            .evidence,
        );
      const vocabularyId = state.resources.word0.vocabularyId,
        bytes = fs.readFileSync(
          path.join(root, 'tmp/frontend-integration-session35-20261103/qa.mp3'),
        );
      const k = key('learning-media'),
        base = 'learning/vocabularies/' + vocabularyId + '/media';
      const t = expect(
        await api(
          base + '/presign',
          'POST',
          { kind: 'AUDIO', contentType: 'audio/mpeg', sizeBytes: bytes.length },
          ca,
          { 'Idempotency-Key': k },
        ),
        200,
        'learning presign',
      );
      const put = await fetch(t.putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: bytes,
      });
      assert.equal(put.status, 200);
      const confirmed = expect(
        await api(base + '/confirm', 'POST', { uploadId: t.uploadId }, ca, {
          'Idempotency-Key': k,
        }),
        200,
        'learning confirm',
      );
      const word = expect(
        await api('learning/vocabularies/' + vocabularyId, 'GET', undefined, u),
        200,
        'web media read',
      );
      assert.equal(word.audioUrl, confirmed.url);
      assert.equal((await fetch(word.audioUrl)).status, 200);
      evidence.push({
        scope: 'Learning',
        vocabularyId,
        presign: 200,
        put: 200,
        confirm: 200,
        web: 200,
      });
      save('media-lifecycle.json', {
        kind: 'technical transport media QA; no human content-quality acceptance',
        evidence,
      });
      return evidence;
    },
  );
  await check(
    'CMS-test-metadata-full-structure',
    'Create own test referencing original200 (no question reseed); update title, reread, archive only own test',
    async () => {
      const original = state.originalTest;
      assert(original);
      const body = {
        title: state.namespace + ' CMS Test',
        durationSeconds: 7200,
        questions: original.questions.map((q) => ({
          questionId: q.questionId,
          part: q.part,
          orderNo: q.orderNo,
        })),
      };
      expect(
        await api('tests', 'POST', { ...body, questions: body.questions.slice(0, 199) }, ca),
        400,
        '199 rejected',
      );
      const test = await create('cmsTest', 'tests', body, ca, 'testId');
      expect(
        await api(
          'tests/' + test.testId,
          'PATCH',
          { title: state.namespace + ' CMS Test edited' },
          ca,
        ),
        200,
        'test metadata edit',
      );
      const read = expect(await api('tests/' + test.testId, 'GET', undefined, u), 200, 'web test');
      assert.equal(read.questions.length, 200);
      assert(read.title.endsWith('edited'));
      save('cms-test-readback.json', read);
      return { testId: test.testId, count: read.questions.length, questionReseed: false };
    },
  );
}
async function cooperation() {
  const sa = await login('system_admin');
  await check(
    'BE-admin-user-detail-absent',
    'Existing source has list/role/status only; GET admin user-by-ID remains404',
    async () => {
      expect(
        await api('admin/users/' + credentials.accounts.user.userId, 'GET', undefined, sa),
        404,
        'missing admin detail',
      );
      return {
        status: 404,
        source: 'services/auth-service/src/modules/users/admin-users.controller.ts',
        frontend: 'apps/admin-cms/src/components/integration/api-application.tsx',
      };
    },
  );
  const sources = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.isSymbolicLink() ||
        /^(generated|node_modules|dist|__pycache__|\.venv)$/.test(entry.name)
      )
        continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (/\.(ts|py)$/.test(file))
        sources.push({
          file: path.relative(root, file).replaceAll('\\', '/'),
          text: fs.readFileSync(file, 'utf8'),
        });
    }
  }
  for (const dir of [
    'services/auth-service/src',
    'services/learning-service/src',
    'services/question-bank-service/src',
    'services/exam-service/src',
    'services/api-gateway/src',
    'services/ai-chatbox-service/app',
  ])
    scan(path.join(root, dir));
  const evidence = (file, pattern) => {
    const source = sources.find((s) => s.file === file);
    assert(source, file);
    return source.text
      .split('\n')
      .flatMap((line, index) =>
        pattern.test(line) ? [{ file, line: index + 1, text: line.trim() }] : [],
      );
  };
  const review = {
    at: new Date().toISOString(),
    kind: 'current backend source review; no backend modifications',
    settings: {
      status: 'BLOCKED',
      settingsControllers: sources
        .filter(
          (s) =>
            s.file.endsWith('.controller.ts') &&
            /@(?:Get|Post|Patch|Put)\([^\n]*settings/i.test(s.text),
        )
        .map((s) => s.file),
      acceptance:
        'GET/PATCH settings for JWT subject; agreed fields/defaults/bounds/timezone; per-user persistence; 400/401/403 and reread',
    },
    ai: {
      status: 'BLOCKED',
      identity: evidence(
        'services/ai-chatbox-service/app/api/routes_conversations.py',
        /user_id|Depends\(/,
      ),
      quotas: evidence(
        'services/ai-chatbox-service/app/core/config.py',
        /AI_DAILY_MESSAGE_LIMIT|AI_LLM_TIMEOUT_MS/,
      ),
      ownership: evidence(
        'services/ai-chatbox-service/app/services/chat_service.py',
        /user_id =|result.user_id|AI_DAILY_MESSAGE_LIMIT|LLMTimeoutError|refund_rate_limit/,
      ),
      acceptance:
        'JWT subject authoritative for every operation; two USER isolation; stable quota/timeout/fallback response contract',
    },
    media: {
      status: 'PARTIAL',
      controllers: sources
        .filter((s) => s.file.endsWith('.controller.ts') && /presign|confirm/.test(s.text))
        .map((s) => s.file),
      acceptance:
        'Resource upload/attach/confirm works; add agreed global catalog/cursor/filter and reference-aware delete only if CMS global management is required',
    },
    adminUserDetail: {
      status: 'BLOCKED',
      http: 404,
      evidence: evidence(
        'services/auth-service/src/modules/users/admin-users.controller.ts',
        /@Get|@Patch/,
      ),
      acceptance:
        'GET admin/users/:id with SYSTEM_ADMIN, complete User shape, 404 vs403; stable deep links independent of list page',
    },
  };
  save('backend-coordination.json', review);
}
async function archive() {
  const ca = await login('content_admin'),
    u = await login('user');
  await check(
    'CMS-archive-own-resources',
    'Archive only IDs created in this run; bank/test disappear; Learning soft-delete visible to admin and hidden on web',
    async () => {
      const evidence = [];
      for (const name of ['q1', 'q2', 'q5', 'g3', 'g4', 'g6', 'g7', 'cmsTest']) {
        const item = state.resources[name];
        assert(item);
        const p = name.startsWith('q')
          ? 'questions/' + item.questionId
          : name.startsWith('g')
            ? 'question-groups/' + item.groupId
            : 'tests/' + item.testId;
        if (!state.resources[name + 'Archived']) {
          const r = expect(await api(p, 'DELETE', undefined, ca), 200, 'archive ' + name);
          assert.equal(r.success, true);
          state.resources[name + 'Archived'] = true;
          persist();
        }
        expect(await api(p, 'GET', undefined, u), 404, 'archived read');
        evidence.push({ name, path: p, archive: 200, userRead: 404 });
      }
      const lesson = state.resources.lesson;
      if (!state.resources.lessonArchived) {
        assert.equal(
          expect(
            await api('learning/admin/lessons/' + lesson.lessonId, 'DELETE', undefined, ca),
            200,
            'archive lesson',
          ).success,
          true,
        );
        state.resources.lessonArchived = true;
        persist();
      }
      expect(
        await api('learning/lessons/' + lesson.lessonId, 'GET', undefined, u),
        404,
        'hidden lesson',
      );
      const topic = await create(
        'disposableTopic',
        'learning/admin/vocabulary-topics',
        { topicName: state.namespace + ' disposable' },
        ca,
        'topicId',
        true,
      );
      const word = await create(
        'disposableWord',
        'learning/admin/vocabularies',
        {
          topicId: topic.topicId,
          word: state.namespace + ' disposable',
          definition: 'Disposable QA word',
        },
        ca,
        'vocabularyId',
        true,
      );
      for (const [name, resource, id] of [
        ['disposableWord', 'vocabularies', word.vocabularyId],
        ['disposableTopic', 'vocabulary-topics', topic.topicId],
      ]) {
        if (!state.resources[name + 'Archived']) {
          assert.equal(
            expect(
              await api('learning/admin/' + resource + '/' + id, 'DELETE', undefined, ca),
              200,
              'archive ' + name,
            ).success,
            true,
          );
          state.resources[name + 'Archived'] = true;
          persist();
        }
        expect(
          await api('learning/' + resource + '/' + id, 'GET', undefined, u),
          404,
          'web hidden',
        );
        const admin = expect(
          await api('learning/admin/' + resource + '/' + id, 'GET', undefined, ca),
          200,
          'admin tombstone',
        );
        assert(admin.deletedAt);
        evidence.push({ name, id, adminTombstone: true, web: 404 });
      }
      save('archive-readback.json', evidence);
      return {
        archived: evidence,
        retainedLearningTopic: state.resources.topic.topicId,
        reason: 'Keep genuine progress/due data; no deletion of previous sessions',
      };
    },
  );
}
async function final() {
  const u = await login('user');
  const readback = { at: new Date().toISOString(), kind: 'real Gateway final readback', paths: [] };
  for (const p of [
    'learning/progress',
    'learning/review-today?size=50',
    'sync/users/me',
    'analytics/progress?timeRange=ALL_TIME',
    'attempts?size=50',
  ]) {
    const r = await api(p, 'GET', undefined, u);
    expect(r, 200, p);
    readback.paths.push({ path: p, date: r.date, value: r.value });
  }
  const original = expect(await api('tests/' + testId, 'GET', undefined, u), 200, 'original test');
  assert.deepEqual(
    original.questions,
    state.originalTest.questions,
    'previous Full refs unchanged',
  );
  assert.equal(original.title, state.originalTest.title);
  const finalScore = expect(
    await api('attempts/' + state.resources.full.attemptId, 'GET', undefined, u),
    200,
    'Full final',
  );
  const listening = JSON.parse(
      fs.readFileSync(path.join(root, 'services/exam-service/src/scoring/ets-listening.json')),
    ),
    reading = JSON.parse(
      fs.readFileSync(path.join(root, 'services/exam-service/src/scoring/ets-reading.json')),
    );
  assert.equal(finalScore.scoreListening, listening.table[finalScore.correctListeningCount]);
  assert.equal(finalScore.scoreReading, reading.table[finalScore.correctReadingCount]);
  readback.scoring = {
    method: finalScore.scoring.method,
    tableVersion: finalScore.scoring.tableVersion,
    official: finalScore.scoring.official,
    correctListening: finalScore.correctListeningCount,
    correctReading: finalScore.correctReadingCount,
    scoreListening: finalScore.scoreListening,
    scoreReading: finalScore.scoreReading,
    score: finalScore.score,
    lookupMatches: true,
    disclaimer: finalScore.scoreDisclaimer,
  };
  readback.originalTest = { testId, count: original.questions.length, unchanged: true };
  save('final-readback.json', readback);
  await check(
    'FINAL-preserved-original-score',
    'Old Full200 unchanged; grade matches current backend lookup tables; learning/analytics reread',
    async () => readback.scoring,
  );
}
async function search() {
  const ca = await login('content_admin'),
    sa = await login('system_admin');
  await check(
    'CMS-search-index-readback',
    'Question picker contains every active test DB question after official SYSTEM_ADMIN reindex if needed',
    async () => {
      const dotenv = require('dotenv'),
        dir = path.join(root, 'services/question-bank-service'),
        env = dotenv.parse(fs.readFileSync(path.join(dir, '.env'))),
        url = new URL(env.DATABASE_URL);
      url.pathname = '/question_bank_frontend_s34_20261103';
      const { PrismaClient } = require(path.join(dir, 'src/generated/prisma')),
        db = new PrismaClient({ datasourceUrl: url.href });
      let active;
      try {
        active = await db.question.count({
          where: { deletedAt: null, OR: [{ groupId: null }, { group: { deletedAt: null } }] },
        });
      } finally {
        await db.$disconnect();
      }
      const before = expect(
        await api('questions?size=50', 'GET', undefined, ca),
        200,
        'question list before',
      );
      let reindex = null;
      if (before.total !== active) {
        // Repair only this isolated stack's search projection via the official endpoint.
        const r = await api('questions/reindex', 'POST', undefined, sa);
        reindex = { status: r.status, value: r.value };
        assert(
          [201, 504].includes(r.status),
          'reindex accepted or response timeout; reconcile by reads',
        );
      }
      let after;
      for (let n = 0; n < 30; n++) {
        after = expect(
          await api('questions?size=50', 'GET', undefined, ca),
          200,
          'question list after',
        );
        if (after.total === active) break;
        await pause(1000);
      }
      assert.equal(after.total, active);
      const ids = [];
      for (let page = 1; page <= Math.ceil(active / 50); page++) {
        const r = expect(
          await api('questions?size=50&page=' + page, 'GET', undefined, ca),
          200,
          'question pagination',
        );
        ids.push(...r.items.map((q) => q.questionId));
      }
      assert.equal(new Set(ids).size, active);
      assert(state.originalTest.questions.every((q) => ids.includes(q.questionId)));
      const evidence = {
        before: before.total,
        activeDatabaseQuestions: active,
        reindex,
        after: after.total,
        uniqueIds: ids.length,
        allOriginalRefsAvailable: true,
      };
      save('search-index-readback.json', evidence);
      return evidence;
    },
  );
}
async function audioAsset() {
  const ca = await login('content_admin');
  await check(
    'MEDIA-group-AUDIO-asset',
    'AUDIO supplemental asset is attached through existing group media contract and reread',
    async () => {
      const g = await create(
        'audioAssetGroup',
        'question-groups',
        {
          part: 7,
          type: 'SINGLE_PASSAGE',
          instruction: state.namespace + ' audio asset',
          passageText: 'Technical supplemental audio QA.',
          questions: [question(7, 'audio asset')],
        },
        ca,
        'groupId',
      );
      const { attached } = await bankUpload('question-groups', g.groupId, 'AUDIO', ca);
      const updated = expect(
        await api(
          'question-groups/' + g.groupId,
          'PATCH',
          {
            audioKey: null,
            assets: [{ kind: 'AUDIO', storageKey: attached.audioKey, content: null, orderNo: 1 }],
          },
          ca,
        ),
        200,
        'AUDIO asset',
      );
      assert.equal(updated.assets[0].kind, 'AUDIO');
      assert.equal((await fetch(updated.assets[0].publicUrl)).status, 200);
      save('group-audio-asset.json', updated);
      return { groupId: g.groupId, kind: 'AUDIO', get: 200 };
    },
  );
}
async function main() {
  const ready = await fetch('http://localhost:3000/ready', { signal: AbortSignal.timeout(5000) });
  assert.equal(ready.status, 200, 'Gateway readiness');
  save('readiness-current.json', {
    at: new Date().toISOString(),
    status: ready.status,
    body: await ready.json(),
  });
  persist();
  const phase = {
    read,
    exams,
    expiry,
    analytics,
    recheck,
    cms,
    cursorSetup,
    cooperation,
    archive,
    final,
    search,
    audioAsset,
  }[values.phase];
  if (!phase) throw Error('phase must be read/exams/expiry/analytics/recheck/cms');
  await phase();
}
main()
  .catch((e) => {
    console.error(e.name + ': ' + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const s of sessions)
      await api('auth/logout', 'POST', { refreshToken: s.refreshToken }, s.accessToken).catch(
        () => {},
      );
    save(values.phase + '-matrix.json', { at: new Date().toISOString(), checks, requests });
    if (checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
  });
