/* Browser contract tests. Stubs here are deliberately separate from real HTTP probes. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const base = path.resolve(
  process.env.INTEGRATION_QA_OUT || 'tmp/frontend-integration-session34-20261103/browser',
);
const f = require(
  path.resolve(
    'tmp/frontend-integration-session34-20261103/integration-tests/scripts/qa/frontend-wire-fixtures.js',
  ),
);
const safeUser = { ...f.wireUser, id: f.wireUser.userId };
delete safeUser.userId;
const web = process.env.WEB_QA_URL || 'http://localhost:3006',
  cms = process.env.CMS_QA_URL || 'http://localhost:3007';
fs.mkdirSync(base, { recursive: true });
const report = {
  kind: 'Chromium frontend UI + current contract stubs; NOT authenticated backend E2E',
  checks: [],
  errors: [],
  realGatewayCheck: null,
};
const words = Array.from({ length: 5 }, (_, i) => ({
  ...f.wireWord,
  vocabularyId: '40000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
  word: 'Word ' + (i + 1),
}));
const vs = {
  sessionId: '50000000-0000-4000-8000-000000000001',
  topicId: f.wireTopic.topicId,
  status: 'IN_PROGRESS',
  vocabularies: words,
  quiz: words.map((w, i) => ({
    questionId: 'quiz-' + i,
    vocabularyId: w.vocabularyId,
    prompt: w.word,
    options: ['A', 'B', 'C', 'D'].map((code) => ({ code, text: 'Meaning ' + code })),
  })),
  reviews: [],
  result: null,
};
const state = {
  final: false,
  draft: [],
  question: null,
  lesson: f.wireLesson,
  topic: f.wireTopic,
  group: null,
  lastTest: null,
};
const counts = [6, 25, 39, 30, 30, 16, 54],
  refs = [];
for (let part = 1; part <= 7; part++)
  for (let i = 0; i < counts[part - 1]; i++)
    refs.push({
      questionId: `10000000-0000-4000-8000-${String(refs.length + 1).padStart(12, '0')}`,
      part,
      orderNo: refs.length + 1,
    });
const detail = { ...f.wireTest, questions: refs };
async function wire(route) {
  const r = route.request(),
    u = new URL(r.url()),
    p = u.pathname.replace('/api/frontend/', ''),
    m = r.method(),
    b = r.postData() ? JSON.parse(r.postData()) : undefined;
  let body;
  if (p === 'auth/session' || p === 'auth/login') {
    if (m === 'POST') assert.equal(typeof b.deviceId, 'string');
    body = { user: safeUser };
  } else if (p === 'auth/register') {
    assert.equal(b.confirmPassword, b.password);
    assert.ok(!('deviceId' in b));
    body = { activationRequired: true };
  } else if (p === 'users/me') {
    body = { ...f.wireUser, ...(m === 'PATCH' ? b : {}) };
  } else if (p === 'tests' && m === 'GET') body = f.wirePage([f.wireTest]);
  else if (p === `tests/${f.wireTest.testId}/parts`)
    body = { testId: f.wireTest.testId, parts: [{ part: 5, totalQuestions: 1, available: true }] };
  else if (p.endsWith('/part-attempts')) {
    assert.ok(r.headers()['idempotency-key']);
    assert.deepEqual(b.parts, [5]);
    body = f.wireAttempt();
  } else if (p === `tests/${f.wireTest.testId}`) {
    if (m === 'PATCH') {
      assert.equal(b.questions.length, 200);
      assert.equal('type' in b, false);
      assert.equal('status' in b, false);
      state.lastTest = b;
      body = { ...detail, title: b.title };
    } else body = detail;
  } else if (p === 'attempts') body = f.wirePage([f.wireAttempt(state.final)]);
  else if (p.endsWith('/draft')) {
    state.draft = b.answers;
    body = {
      attemptId: f.wireAttempt().attemptId,
      saved: b.answers.length,
      answeredAt: '2026-11-03T03:01:00Z',
    };
  } else if (p.endsWith('/submit') && p.startsWith('attempts/')) {
    state.final = true;
    body = f.wireAttempt(true);
  } else if (p.startsWith('attempts/'))
    body = { ...f.wireAttempt(state.final), ...(!state.final ? { answers: state.draft } : {}) };
  else if (p === 'questions' && m === 'POST') {
    assert.ok('questionText' in b);
    assert.ok(!('stem' in b));
    assert.equal(b.correctOption, 'B');
    assert.equal(b.options[0].optionCode, 'A');
    state.question = {
      ...b,
      questionId: '20000000-0000-4000-8000-000000000001',
      tags: [],
      isComplete: true,
    };
    body = state.question;
  } else if (p.startsWith('questions/')) body = state.question;
  else if (p === 'questions') body = f.wirePage([]);
  else if (p === 'learning/admin/lessons' && m === 'POST') {
    assert.ok(r.headers()['idempotency-key']);
    state.lesson = { ...f.wireLesson, ...b };
    body = state.lesson;
  } else if (p === 'learning/admin/lessons') body = f.wirePage([state.lesson]);
  else if (p.startsWith('learning/admin/lessons/')) body = state.lesson;
  else if (p === 'learning/admin/vocabulary-topics' && m === 'POST') {
    assert.ok(r.headers()['idempotency-key']);
    state.topic = { ...f.wireTopic, ...b };
    body = state.topic;
  } else if (p === 'learning/admin/vocabulary-topics') body = f.wirePage([state.topic]);
  else if (p.startsWith('learning/admin/vocabulary-topics/')) body = state.topic;
  else if (p === 'question-groups' && m === 'POST') {
    assert.equal(b.part, 7);
    assert.equal(b.questions.length, 1);
    state.group = { ...b, groupId: '30000000-0000-4000-8000-000000000001', questionIds: ['q-1'] };
    body = state.group;
  } else if (p === 'question-groups') body = f.wirePage(state.group ? [state.group] : []);
  else if (p.startsWith('question-groups/')) body = state.group;
  else if (p === 'learning/vocabulary-topics') body = f.wirePage([f.wireTopic]);
  else if (p === 'learning/vocabularies') body = f.wirePage(words);
  else if (p === 'learning/vocabulary-sessions' && m === 'POST') {
    assert.ok(r.headers()['idempotency-key']);
    body = vs;
  } else if (p.startsWith('learning/vocabulary-sessions/') && p.endsWith('/reviews')) {
    vs.reviews = b.reviews;
    body = { success: true };
  } else if (p.startsWith('learning/vocabulary-sessions/') && p.endsWith('/submit')) {
    vs.status = 'COMPLETED';
    vs.result = {
      sessionId: vs.sessionId,
      operationId: b.operationId,
      status: 'COMPLETED',
      quizScore: 5,
      quizTotal: 5,
      answers: b.answers.map((a) => ({ ...a, correctOption: 'A', isCorrect: true })),
      progress: [],
    };
    body = vs.result;
  } else if (p.startsWith('learning/vocabulary-sessions/')) body = vs;
  else if (p === 'sync/users/me') body = { projectionReady: true, progress: [], nextCursor: null };
  else if (p === 'learning/lessons') body = f.wirePage([f.wireLesson]);
  else if (p.startsWith('learning/lessons/') && p.endsWith('/complete')) {
    assert.equal(b.baseEntityRevision, '0');
    body = {
      operationId: b.operationId,
      progress: [
        {
          entityId: f.wireLesson.lessonId,
          entityType: 'LESSON',
          revision: '1',
          state: { completedAt: '2026-11-03T04:00:00Z' },
        },
      ],
    };
  } else if (p.startsWith('learning/lessons/')) body = f.wireLesson;
  else if (p === 'learning/progress')
    body = {
      reviewedVocabularies: 0,
      vocabulariesLearned: 0,
      dueVocabularies: 0,
      grammarLessonsCompleted: 0,
      sessionsCompleted: 0,
    };
  else if (p === 'analytics/streak') body = { learningStreakDays: 0, longestStreak: 0 };
  else throw Error(`Unexpected stub request: ${m} ${p}`);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome',
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/api/frontend/**', wire);
    const page = await context.newPage();
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => report.errors.push(e.message));
    async function check(name, run) {
      try {
        await run();
        report.checks.push({ name, passed: true });
      } catch (e) {
        report.currentPage = await page.locator('body').innerText();
        throw e;
      }
    }
    await check('login submits deviceId and enters dashboard', async () => {
      await page.goto(web + '/login');
      await page.getByLabel('Email', { exact: true }).fill('test@example.invalid');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('Test-Only-2026');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL('**/dashboard');
    });
    await check(
      'registration includes confirmPassword and shows activation instead of auto-login',
      async () => {
        await page.goto(web + '/register');
        await page.getByLabel('Họ và tên', { exact: true }).fill('Test User');
        await page.getByLabel('Email', { exact: true }).fill('register@example.invalid');
        await page.getByLabel('Mật khẩu', { exact: true }).fill('Test-Only-2026');
        await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('Test-Only-2026');
        await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'cần kích hoạt email' }).waitFor();
        assert.ok(page.url().endsWith('/register'));
      },
    );
    await check('Part selection reaches start and navigates to persisted attempt URL', async () => {
      await page.goto(web + '/exam/' + f.wireTest.testId);
      await page.getByLabel('Chế độ', { exact: true }).selectOption('PART');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Bắt đầu làm bài', exact: true }).click();
      await page.waitForURL('**/take?attempt=*');
      await page.getByRole('heading', { name: 'Câu 1 · Part 5' }).waitFor();
    });
    await check('answer draft is acknowledged and restored after reload', async () => {
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: 'Lưu nháp lên server' }).click();
      await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).waitFor();
      await page.reload();
      await page.getByRole('radio').first().waitFor();
      assert.equal(await page.getByRole('radio').first().isChecked(), true);
    });
    await check('submit uses backend result; Part has no scaled TOEIC score', async () => {
      await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
      await page.waitForURL('**/result?attempt=*');
      await page.getByText('Luyện Part không quy đổi điểm TOEIC.', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Xem lại đáp án và giải thích' }).click();
      await page.waitForURL('**/review?attempt=*');
      await page.getByText('A singular subject takes is.').waitFor();
    });
    await check('result layout fits desktop and mobile', async () => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
        );
      }
      await page.screenshot({ path: path.join(base, 'review-mobile.png'), fullPage: false });
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check(
      'Flashcard session saves reviews and submits quiz with an operationId',
      async () => {
        await page.goto(web + '/study/vocabulary/' + f.wireTopic.topicId);
        await page.getByRole('button', { name: 'Bắt đầu Flashcard → quiz', exact: true }).click();
        await page.waitForURL('**?session=*');
        await page.getByRole('heading', { name: 'Phiên Flashcard / quiz', exact: true }).waitFor();
        const selects = page.getByRole('combobox');
        assert.equal(await selects.count(), 5);
        for (let i = 0; i < 5; i++) await selects.nth(i).selectOption('3');
        await page
          .getByRole('button', { name: 'Lưu đánh giá và chuyển quiz', exact: true })
          .click();
        for (let i = 0; i < 5; i++)
          await page
            .getByRole('radio')
            .nth(i * 4)
            .check();
        await page.getByRole('button', { name: 'Nộp quiz', exact: true }).click();
        await page.getByRole('heading', { name: 'Backend chấm: 5 / 5', exact: true }).waitFor();
        await page.reload();
        await page.getByRole('heading', { name: 'Backend chấm: 5 / 5', exact: true }).waitFor();
      },
    );
    await check(
      'grammar completion sends server revision and matches operation acknowledgement',
      async () => {
        await page.goto(web + '/study/grammar/' + f.wireLesson.lessonId);
        await page.getByRole('button', { name: 'Đánh dấu hoàn thành', exact: true }).click();
        await page.getByText('Server xác nhận hoàn thành lúc', { exact: false }).waitFor();
      },
    );
    await check(
      'CMS question editor sends canonical optionCode/optionText and correctOption',
      async () => {
        await page.goto(cms + '/questions/new');
        await page.getByLabel('Nội dung câu hỏi', { exact: true }).fill('The agenda ___ ready.');
        for (const [code, value] of Object.entries({ A: 'are', B: 'is', C: 'be', D: 'been' }))
          await page.getByLabel('Phương án ' + code, { exact: true }).fill(value);
        await page.getByLabel('Đáp án đúng', { exact: true }).selectOption('B');
        await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
        await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
        await page.waitForURL('**/questions/20000000-*');
        await page.getByRole('heading', { name: 'Part 5', exact: true }).waitFor();
      },
    );
    await check('CMS lesson create supports Markdown, status and idempotency', async () => {
      await page.goto(cms + '/lessons/new');
      await page.getByLabel('Tiêu đề', { exact: true }).fill('Lesson from CMS');
      await page.getByLabel('Danh mục', { exact: true }).fill('Tenses');
      await page
        .getByLabel('Nội dung Markdown', { exact: true })
        .fill('# Lesson\n<script>unsafe</script>');
      await page.getByLabel('Trạng thái', { exact: true }).selectOption('PUBLISHED');
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      assert.equal(await page.locator('script').filter({ hasText: 'unsafe' }).count(), 0);
      await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
      await page.waitForURL('**/lessons/' + f.wireLesson.lessonId + '?*');
      await page.getByRole('heading', { name: 'Lesson from CMS', exact: true }).waitFor();
    });
    await check('CMS topic create uses topicName and server acknowledgement', async () => {
      await page.goto(cms + '/topics/new');
      await page.getByLabel('Tên chủ đề', { exact: true }).fill('Meetings');
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
      await page.waitForURL('**/topics/' + f.wireTopic.topicId + '?*');
      await page.getByRole('heading', { name: 'Meetings', exact: true }).waitFor();
    });
    await check('CMS group create includes nested questions and correct Part', async () => {
      await page.goto(cms + '/groups/new');
      await page.getByLabel('Đoạn văn', { exact: false }).fill('Read this passage.');
      await page.getByLabel('Nội dung câu hỏi', { exact: true }).fill('What is the purpose?');
      for (const code of ['A', 'B', 'C', 'D'])
        await page.getByLabel('Phương án ' + code, { exact: true }).fill('Option ' + code);
      await page.getByRole('button', { name: 'Lưu nhóm lên server', exact: true }).click();
      await page.waitForURL('**/groups/30000000-*');
      await page.getByText('Read this passage.', { exact: true }).waitFor();
    });
    await check(
      'CMS tests read canonical tests without old metadata verification gate',
      async () => {
        await page.goto(cms + '/tests');
        await page.getByRole('link', { name: f.wireTest.title, exact: true }).waitFor();
      },
    );
    await check(
      'CMS test edit preserves 200 references and sends no obsolete type/status',
      async () => {
        await page.goto(cms + '/tests/' + f.wireTest.testId + '/edit');
        await page.getByLabel('Tên đề', { exact: true }).fill('Updated Full Test');
        await page.getByRole('button', { name: 'Kiểm tra và xem trước', exact: true }).click();
        await page.getByRole('button', { name: 'Lưu đề lên server', exact: true }).click();
        await page.waitForURL('**/tests/' + f.wireTest.testId + '?*');
        assert.equal(state.lastTest.questions.length, 200);
      },
    );
    await context.close();
    const real = await browser.newContext(),
      realPage = await real.newPage();
    await realPage.goto(web + '/login');
    await realPage.getByLabel('Email', { exact: true }).fill('unconnected@example.invalid');
    await realPage.getByLabel('Mật khẩu', { exact: true }).fill('Transport-check-only');
    const response = realPage.waitForResponse((r) => r.url().endsWith('/api/frontend/auth/login'));
    await realPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const r = await response;
    report.realGatewayCheck = {
      kind: 'real frontend bridge request, no interception',
      status: r.status(),
      authenticatedFlowAccepted: false,
    };
    assert.equal(r.status(), 502);
    await real.close();
    assert.deepEqual(report.errors, []);
    report.completed = true;
  } catch (e) {
    report.failure = { message: e.message };
    report.completed = false;
    process.exitCode = 1;
  } finally {
    await browser?.close();
    fs.writeFileSync(path.join(base, 'browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
