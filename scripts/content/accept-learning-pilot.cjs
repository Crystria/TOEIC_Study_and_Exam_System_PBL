/* Real Gateway API acceptance. UI remains a separate mandatory gate. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { saveAtomic, hash } = require('./import-toeic.cjs');
const out = process.argv[2],
  stateFile = process.argv[3] || 'data/toeic/ets-2023-test-01/import-state.local.json';
if (!out)
  throw Error(
    'Usage: node scripts/content/accept-learning-pilot.cjs <evidence-directory> [import-state]',
  );
const base = 'http://127.0.0.1:3000/api/v1',
  events = [];
let ledger = fs.existsSync(path.join(out, 'ledger.json'))
  ? JSON.parse(fs.readFileSync(path.join(out, 'ledger.json')))
  : { createKey: 'ets-2023-test-01-learning-pilot-' + randomUUID(), operationId: randomUUID() };
function checkpoint() {
  saveAtomic(path.join(out, 'ledger.json'), ledger);
}
async function request(token, method, url, body, key, expected) {
  const response = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  events.push({ method, path: url, status: response.status });
  saveAtomic(path.join(out, 'requests.json'), events);
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${url}`);
    return data;
  }
  assert(response.ok, `${method} ${url}: HTTP ${response.status}`);
  return data;
}
async function login(account, deviceId) {
  return request(null, 'POST', '/auth/login', {
    email: account.email,
    password: account.password,
    deviceId,
  });
}
async function main() {
  checkpoint();
  const credentials = JSON.parse(
    fs.readFileSync('private/credentials/local-role-accounts-20261109.json', 'utf8'),
  );
  const admin = await login(
    { email: process.env.TOEIC_IMPORT_EMAIL, password: process.env.TOEIC_IMPORT_PASSWORD },
    'test1-content-api-acceptance',
  );
  const user = await login(credentials.accounts.user, 'test1-student-api-acceptance');
  const maps = JSON.parse(fs.readFileSync(stateFile)),
    data = JSON.parse(fs.readFileSync('data/toeic/ets-2023-test-01/dataset.json'));
  const topicId = maps.records['ets-2023-test-01-topic-office'].id,
    lessonId = maps.records['ets-2023-test-01-lesson-1'].id;
  await request(null, 'GET', '/learning/vocabulary-topics', null, null, 401);
  await request(user.accessToken, 'GET', '/learning/admin/lessons', null, null, 403);
  const topics = await request(user.accessToken, 'GET', '/learning/vocabulary-topics?size=50');
  assert(topics.items.some((t) => t.topicId === topicId && t.vocabularyCount === 20));
  const vocab = await request(
    user.accessToken,
    'GET',
    `/learning/vocabularies?topicId=${topicId}&size=50`,
  );
  assert.equal(vocab.items.length, 20);
  assert.equal(new Set(vocab.items.map((v) => v.vocabularyId)).size, 20);
  const lesson = await request(admin.accessToken, 'GET', `/learning/admin/lessons/${lessonId}`);
  assert.equal(lesson.status, 'DRAFT');
  assert(lesson.contentHtml.includes('<h1>'));
  assert(!/<script\b|<iframe\b/i.test(lesson.contentHtml));
  await request(user.accessToken, 'GET', `/learning/lessons/${lessonId}`, null, null, 404);
  await request(
    user.accessToken,
    'POST',
    `/learning/lessons/${lessonId}/complete`,
    { operationId: (ledger.draftLessonProbeOperationId ||= randomUUID()), baseEntityRevision: '0' },
    null,
    404,
  );
  checkpoint();
  const before = await request(user.accessToken, 'GET', '/learning/progress');
  ledger.before ??= before;
  checkpoint();
  let session;
  if (ledger.sessionId)
    session = await request(
      user.accessToken,
      'GET',
      `/learning/vocabulary-sessions/${ledger.sessionId}`,
    );
  else {
    session = await request(
      user.accessToken,
      'POST',
      '/learning/vocabulary-sessions',
      { topicId, mode: 'NEW' },
      ledger.createKey,
    );
    ledger.sessionId = session.sessionId;
    checkpoint();
  }
  assert.equal(session.vocabularies.length, 5);
  assert.equal(session.quiz.length, 5);
  assert(
    session.quiz.every(
      (q) =>
        q.options.length === 4 &&
        new Set(q.options.map((o) => o.text)).size === 4 &&
        !('correctOption' in q),
    ),
  );
  await request(
    admin.accessToken,
    'GET',
    `/learning/vocabulary-sessions/${ledger.sessionId}`,
    null,
    null,
    404,
  );
  if (session.status !== 'COMPLETED') {
    const reviews = session.vocabularies.map((v) => ({ vocabularyId: v.vocabularyId, quality: 4 }));
    await request(
      user.accessToken,
      'POST',
      `/learning/vocabulary-sessions/${ledger.sessionId}/reviews`,
      { reviews },
    );
    const resumed = await request(
      user.accessToken,
      'GET',
      `/learning/vocabulary-sessions/${ledger.sessionId}`,
    );
    assert.equal(resumed.reviews.length, 5);
    const answers = resumed.quiz.map((q) => {
      const v = vocab.items.find((v) => v.vocabularyId === q.vocabularyId),
        option = q.options.find((o) => o.text === v.definition);
      assert(option, 'Quiz has exactly one matching edited definition');
      return { questionId: q.questionId, selectedOption: option.code };
    });
    const result = await request(
      user.accessToken,
      'POST',
      `/learning/vocabulary-sessions/${ledger.sessionId}/submit`,
      { operationId: ledger.operationId, reviews, answers },
    );
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.quizScore, 5);
    ledger.resultHash = hash(result);
    checkpoint();
  }
  const final = await request(
    user.accessToken,
    'GET',
    `/learning/vocabulary-sessions/${ledger.sessionId}`,
  );
  assert.equal(final.status, 'COMPLETED');
  assert.equal(final.result.quizScore, 5);
  const progress = await request(user.accessToken, 'GET', '/learning/progress');
  const due = await request(
    user.accessToken,
    'GET',
    `/learning/review-today?topicId=${topicId}&size=50`,
  );
  const report = {
    at: new Date().toISOString(),
    evidenceType: 'REAL_GATEWAY_API',
    catalogWords: 20,
    catalogTopics: 1,
    lesson: {
      id: lessonId,
      status: 'DRAFT',
      adminMarkdownPreview: 'PASS',
      studentDraftHidden: 'PASS',
      studentCompletion: 'BLOCKED: publication held for UI acceptance',
    },
    vocabulary: {
      sessionId: ledger.sessionId,
      status: final.status,
      quizScore: final.result.quizScore,
      quizTotal: 5,
      draftReload: 'PASS',
      completedReload: 'PASS',
      ownerIsolation: 'PASS',
      qaRating: 4,
      qaRatingPurpose: 'Controlled acceptance input; not a claim about real learner proficiency',
    },
    progressBefore: ledger.before,
    progressAfter: progress,
    due,
    reviewAcceptance: 'NOT_RUN: require at least five genuinely due items',
    uiAcceptance: 'BLOCKED: browser origin permission denied; API is not UI evidence',
    fullExpansion: false,
  };
  saveAtomic(path.join(out, 'report.json'), report);
  maps.acceptance = {
    ...(maps.acceptance || {}),
    learningPilotApi: true,
    learningPilot: false,
    ui: false,
    evidence: path.join(out, 'report.json'),
  };
  saveAtomic(stateFile, maps);
  console.log(JSON.stringify(report, null, 2));
  for (const session of [user, admin])
    await request(session.accessToken, 'POST', '/auth/logout', {
      refreshToken: session.refreshToken,
    });
}
main().catch((e) => {
  saveAtomic(path.join(out, 'failure.json'), {
    at: new Date().toISOString(),
    message: e.message,
    ledger,
  });
  console.error(e.message);
  process.exitCode = 1;
});
