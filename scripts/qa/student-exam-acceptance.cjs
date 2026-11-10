/* Real local Gateway/BFF acceptance using fresh, activated USER fixtures only.
 * Credentials, activation tokens and cookies remain in memory. No content is changed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const web = 'http://localhost:3006';
const gateway = 'http://127.0.0.1:3000';
const mail = 'http://127.0.0.1:8025';
const testId = process.argv[2];
if (!testId) throw Error('Usage: node scripts/qa/student-exam-acceptance.cjs <existing-test-id>');
const out = path.resolve('tmp/student-exam-20261110/live-' + Date.now());
fs.mkdirSync(out, { recursive: true });
const report = { completed: false, testId, checks: [], attempts: [], fixtureUsers: [] };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));

async function request(url, method = 'GET', body, headers = {}, expected) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (expected === undefined)
    assert(response.ok, `${method} ${new URL(url).pathname}: ${response.status}`);
  else assert.equal(response.status, expected, `${method} ${new URL(url).pathname}`);
  return { response, data };
}
async function fixture() {
  const email = `exam-acceptance-${randomUUID()}@example.invalid`;
  const password = `ExamQa9!${randomUUID()}`;
  await request(
    gateway + '/api/v1/auth/register',
    'POST',
    {
      email,
      password,
      confirmPassword: password,
      fullName: 'Exam acceptance fixture',
    },
    {},
    201,
  );
  let token;
  for (let n = 0; n < 20; n++) {
    const { data } = await request(
      mail + '/api/v1/search?query=' + encodeURIComponent('to:' + email),
    );
    if (data.messages?.length) {
      const message = (await request(mail + '/api/v1/message/' + data.messages[0].ID)).data;
      token = (message.Text || '').match(/[?&]token=([a-zA-Z0-9_-]+)/)?.[1];
      if (token) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(token, 'Local activation mail was delivered');
  await request(gateway + '/api/v1/auth/verify-email', 'POST', { token }, {}, 200);
  let cookie = '';
  async function api(route, method = 'GET', body, key, expected) {
    const result = await request(
      web + '/api/frontend/' + route,
      method,
      body,
      {
        origin: web,
        cookie,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      expected,
    );
    const updates = result.response.headers.getSetCookie();
    if (updates.length) cookie = updates.map((value) => value.split(';')[0]).join('; ');
    return result.data;
  }
  const login = await api('auth/login', 'POST', { email, password, deviceId: randomUUID() });
  assert.deepEqual(login.user.roles, ['USER']);
  report.fixtureUsers.push(login.user.id);
  return api;
}
const check = (name) => {
  report.checks.push(name);
  save();
  console.log('PASS ' + name);
};

async function main() {
  const readiness = (await request(gateway + '/ready')).data;
  assert.equal(readiness.status, 'ready');
  const api = await fixture();
  check('fresh activated USER authenticates through the real frontend bridge');
  const test = await api('tests/' + testId);
  assert.equal(test.questions.length, 200);
  const available = await api(`tests/${testId}/parts`);
  assert.equal(available.parts.length, 7);
  assert(available.parts.every((part) => part.available));
  check('ETS test has 200 questions and seven available Parts');
  const key = randomUUID();
  const full = await api(`tests/${testId}/attempts`, 'POST', undefined, key);
  report.attempts.push(full.attemptId);
  assert.equal(full.mode, 'FULL');
  assert.equal(full.questions.length, 200);
  assert.equal(full.durationSeconds, 7200);
  assert(full.remainingSeconds > 7100);
  assert(full.questions.every((q) => q.correctOption === undefined && q.transcript === undefined));
  assert(full.groups.every((g) => g.transcript === undefined));
  assert.equal(
    (await api(`tests/${testId}/attempts`, 'POST', undefined, key)).attemptId,
    full.attemptId,
  );
  assert.equal(
    (await api(`tests/${testId}/attempts`, 'POST', undefined, randomUUID())).attemptId,
    full.attemptId,
  );
  check('Full start, same-key replay and active-attempt resume reuse one private snapshot');
  const answers = full.questions
    .slice(0, 2)
    .map((q) => ({ questionId: q.questionId, selectedOption: q.options[0].optionCode }));
  const draft = await api(`attempts/${full.attemptId}/draft`, 'PUT', { answers });
  assert.equal(draft.saved, 2);
  const resumed = await api('attempts/' + full.attemptId);
  assert.equal(resumed.deadlineAt, full.deadlineAt);
  for (const answer of answers)
    assert.equal(
      resumed.answers.find((a) => a.questionId === answer.questionId).selectedOption,
      answer.selectedOption,
    );
  await api(`attempts/${full.attemptId}/answers/${answers[0].questionId}`, 'PUT', {
    selectedOption: null,
  });
  const cleared = await api('attempts/' + full.attemptId);
  assert.equal(
    cleared.answers.find((a) => a.questionId === answers[0].questionId).selectedOption,
    null,
  );
  check('draft save, reload/resume, unchanged deadline and explicit answer clearing');
  const urls = [
    ...full.questions.flatMap((q) => [q.audioUrl, q.imageUrl]),
    ...full.groups.flatMap((g) => [g.audioUrl, ...g.assets.map((a) => a.publicUrl)]),
  ].filter(Boolean);
  assert(urls.length > 0);
  for (const url of [...new Set(urls)]) {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    assert(response.ok, 'Snapshot media is accessible: ' + new URL(url).pathname);
  }
  check(`snapshot audio/images are accessible (${new Set(urls).size} media files)`);
  const other = await fixture();
  await other('attempts/' + full.attemptId, 'GET', undefined, undefined, 403);
  await other(`attempts/${full.attemptId}/draft`, 'PUT', { answers }, undefined, 403);
  await other(`attempts/${full.attemptId}/submit`, 'POST', { answers }, undefined, 403);
  check('another USER cannot read, save or submit the attempt');
  const result = await api(`attempts/${full.attemptId}/submit`, 'POST', { answers });
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(result.answers.length, 200);
  assert.equal(result.score, result.scoreListening + result.scoreReading);
  assert(result.scoreDisclaimer);
  const correct = result.questions.filter((q) =>
    answers.some((a) => a.questionId === q.questionId && a.selectedOption === q.correctOption),
  ).length;
  assert.equal(result.correctCount, correct);
  const repeated = await api(`attempts/${full.attemptId}/submit`, 'POST', { answers: [] });
  assert.equal(repeated.score, result.score);
  assert.equal(repeated.correctCount, correct);
  check(
    'Full submit grades all 200 answers, exposes review only after completion and is idempotent',
  );
  const part = await api(
    `tests/${testId}/part-attempts`,
    'POST',
    { parts: [5, 6], durationSeconds: 300 },
    randomUUID(),
  );
  report.attempts.push(part.attemptId);
  assert.equal(part.mode, 'PART');
  assert.equal(part.questions.length, 46);
  const partResult = await api(`attempts/${part.attemptId}/submit`, 'POST', { answers: [] });
  assert.equal(partResult.status, 'SUBMITTED');
  assert.equal(partResult.correctCount, 0);
  assert.equal(partResult.score, null);
  assert.equal(partResult.scoreListening, null);
  assert.equal(partResult.scoreReading, null);
  check('multiple-Part practice grades real questions and never converts a TOEIC score');
  const history = await api(`attempts?testId=${testId}&page=1&size=20`);
  assert(history.items.some((a) => a.attemptId === full.attemptId && a.status === 'SUBMITTED'));
  assert(history.items.some((a) => a.attemptId === part.attemptId && a.status === 'SUBMITTED'));
  const foreignHistory = await other(`attempts?testId=${testId}`);
  assert(!foreignHistory.items.some((a) => report.attempts.includes(a.attemptId)));
  await api('auth/logout', 'POST');
  await other('auth/logout', 'POST');
  check('owner history contains results, excludes other users, and fixture sessions log out');
  report.completed = true;
  save();
  console.log('Evidence: ' + path.join(out, 'report.json'));
}
main().catch((error) => {
  report.error = error.message;
  save();
  console.error(error.message);
  process.exitCode = 1;
});
