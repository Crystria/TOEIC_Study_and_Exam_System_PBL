/* UI contract stubs only. This never counts as real backend end-to-end evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const web = process.env.WEB_QA_URL || 'http://localhost:3006';
const cms = process.env.CMS_QA_URL || 'http://localhost:3007';
const out = path.resolve(
  process.env.INTEGRATION_QA_OUT || 'tmp/frontend-integration-session33/browser-api',
);
if (fs.existsSync(path.join(out, 'browser-report.json')))
  throw new Error('Use a fresh INTEGRATION_QA_OUT');
fs.mkdirSync(out, { recursive: true });
const report = {
  kind: 'frontend UI contract stubs; NOT real Gateway/backend E2E',
  checks: [],
  errors: [],
  requests: [],
  screenshots: [],
  unavailableEngines: ['Firefox', 'WebKit/Safari'],
  humanPronunciation: 'NOT ACCEPTED',
};
const safeUser = {
  id: 'qa-user-01',
  email: 'ui-contract@example.invalid',
  fullName: 'Tài khoản kiểm thử UI',
  phoneNumber: null,
  avatarUrl: null,
  status: 'ACTIVE',
  roles: ['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'],
};
const wireUser = () => ({
  ...safeUser,
  roles: safeUser.roles.map((code) => ({ code, name: code })),
});
const word = {
  id: 'qa-word-01',
  topicId: 'qa-topic-01',
  word: 'availability',
  meaning: 'sự có sẵn',
  pronunciation: null,
  example: 'Please confirm availability.',
  audioUrl: null,
  imageUrl: null,
};
const question = {
  id: 'qa-question-01',
  part: 5,
  type: 'SINGLE_CHOICE',
  stem: 'The report is ready.',
  difficulty: 'EASY',
  status: 'DRAFT',
  tags: [],
  options: ['A', 'B', 'C', 'D'].map((optionKey, i) => ({
    optionKey,
    content: `Option ${optionKey}`,
    isCorrect: i === 0,
    mediaUrl: null,
  })),
  explanation: 'A is correct.',
  mediaUrl: null,
};
const test = {
  id: 'qa-test-01',
  title: 'Đề kiểm thử UI',
  type: 'MINI',
  status: 'PUBLISHED',
  durationSeconds: 1800,
  _count: { questions: 1 },
  questions: [{ questionId: question.id, part: 5, orderNo: 1 }],
};
const lesson = {
  id: 'qa-lesson-01',
  title: 'Nội dung từ contract stub',
  content:
    '# Ví dụ\n\n**Đậm** và *nghiêng*.\n\n| A | B |\n| --- | --- |\n| Một | Hai |\n\n<script>window.__xss=true</script>\n\n[Nguy hiểm](javascript:alert(1))',
  level: 'B1',
  status: 'PUBLISHED',
};
const paged = (items) => ({ items, total: items.length, page: 1, size: 20 });
let browser;
function check(width, name) {
  report.checks.push({ width, name });
  console.log('CHECK', width, name);
}
async function geometry(page) {
  const g = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  assert.ok(g.scroll <= g.width + 1, JSON.stringify(g));
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name), fullPage: false });
  report.screenshots.push(name);
}
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const staticLogin = await noScript.newPage();
  await staticLogin.goto(web + '/login');
  assert.ok(await staticLogin.getByRole('button', { name: 'Đăng nhập', exact: true }).isDisabled());
  check(1440, 'authentication form cannot submit before hydration');
  await noScript.close();
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      window.__toeicWrites = [];
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith('toeic')) window.__toeicWrites.push(String(key));
        return original.call(this, key, value);
      };
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ width, message: error.message }));
    page.on('response', (response) => {
      const pathname = new URL(response.url()).pathname;
      if (pathname.startsWith('/_next/') && response.status() >= 400)
        report.errors.push({
          width,
          message: `Static asset HTTP ${response.status()}: ${pathname}`,
        });
    });
    let profileError = false,
      profileWrongId = false,
      questionError = false,
      questionNetwork = false,
      accountLocked = false,
      sessionExpired = false,
      emptyTopics = false,
      failLesson = false;
    let roles = [...safeUser.roles],
      reviews = 0,
      completed = 0,
      questionSaves = 0;
    await context.route('**/api/frontend/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        p = url.pathname.replace('/api/frontend/', '');
      report.requests.push({
        width,
        app: url.port === '3007' ? 'cms' : 'web',
        path: p,
        method: req.method(),
      }); // no query strings, bodies, headers or tokens
      let body,
        status = 200;
      if (p === 'auth/session') {
        if (sessionExpired) {
          status = 401;
          body = {};
        } else body = { user: { ...safeUser, roles } };
      } else if (p === 'auth/login') {
        status = 401;
        body = {};
      } else if (p === 'users/me') {
        if (req.method() === 'PATCH') {
          const data = req.postDataJSON();
          if (accountLocked) {
            status = 403;
            body = { code: 'ACCOUNT_NOT_ACTIVE' };
          } else if (profileWrongId) {
            body = { ...wireUser(), id: 'another-account' };
          } else if (profileError) {
            status = 400;
            body = { details: { message: ['fullName must be valid'] } };
          } else {
            safeUser.fullName = data.fullName;
            safeUser.phoneNumber = data.phoneNumber;
            body = wireUser();
          }
        } else body = wireUser();
      } else if (p === 'learning/vocabulary-topics')
        body = emptyTopics
          ? []
          : [
              {
                id: word.topicId,
                name: 'Công việc',
                description: null,
                _count: { vocabularies: 1 },
              },
            ];
      else if (p === 'learning/vocabularies') body = paged([word]);
      else if (p === 'learning/review-today')
        body = reviews
          ? []
          : [
              {
                vocabularyId: word.id,
                repetition: 0,
                interval: 1,
                nextReviewAt: '2026-10-29T00:00:00Z',
                vocabulary: word,
              },
            ];
      else if (p.endsWith('/review')) {
        reviews++;
        body = {
          vocabularyId: word.id,
          repetition: reviews,
          interval: 3,
          nextReviewAt: '2026-11-01T00:00:00Z',
        };
      } else if (p === 'learning/progress')
        body = {
          vocabulary: { total: 1, reviewed: reviews ? 1 : 0, dueToday: reviews ? 0 : 1 },
          lessons: { total: 1, completed },
        };
      else if (p === 'learning/lessons') body = [lesson];
      else if (p === `learning/lessons/${lesson.id}`) {
        if (failLesson) {
          status = 500;
          body = {};
        } else body = lesson;
      } else if (p.endsWith('/complete')) {
        completed = 1;
        body = { lessonId: lesson.id, status: 'COMPLETED', completedAt: '2026-10-29T12:00:00Z' };
      } else if (p === 'tests') body = paged([test]);
      else if (p === `tests/${test.id}`) body = test;
      else if (p === 'analytics/streak') body = { currentStreak: 2, longestStreak: 3 };
      else if (p === 'analytics/progress')
        body = {
          timeRange: url.searchParams.get('time_range') || 'LAST_30_DAYS',
          lifetime: {
            totalStudyDays: 2,
            totalLessons: completed,
            totalVocabLearned: reviews ? 1 : 0,
          },
          activitiesInRange:
            url.searchParams.get('time_range') === 'LAST_7_DAYS'
              ? {}
              : { LESSON_COMPLETED: completed },
        };
      else if (p === 'analytics/scores')
        body = {
          items: [
            {
              attemptId: 'qa-attempt-01',
              testType: 'FULL',
              score: 800,
              takenAt: '2026-10-29T00:00:00Z',
            },
          ],
        };
      else if (p === 'analytics/weak-areas') body = { items: [] };
      else if (p === 'analytics/prediction')
        body = {
          available: true,
          predictedScore: 900,
          recentAttempts: 3,
          method: 'PLACEHOLDER_MEAN',
        };
      else if (p === 'attempts/qa-attempt-01')
        body = {
          attemptId: 'qa-attempt-01',
          testId: test.id,
          testTitle: test.title,
          status: 'SUBMITTED',
          score: 900,
          totalCorrect: 1,
          answers: [{ questionId: question.id, selectedOption: 'A', isCorrect: true }],
        };
      else if (p === 'questions' && req.method() === 'GET')
        body = paged([{ ...question, tags: [] }]);
      else if (p === `questions/${question.id}` && req.method() === 'GET')
        body = { ...question, tags: [] };
      else if (p.startsWith('questions') && ['POST', 'PATCH'].includes(req.method())) {
        questionSaves++;
        if (questionNetwork) {
          await route.abort('connectionfailed');
          return;
        }
        if (questionError) {
          status = 400;
          body = { details: { message: ['stem must be valid'] } };
        } else body = { ...question, ...req.postDataJSON(), tags: [] };
      } else if (p === 'admin/users')
        body = paged([
          wireUser(),
          {
            ...wireUser(),
            id: 'qa-other-user',
            fullName: 'Tài khoản khác',
            email: 'other@example.invalid',
            roles: [{ code: 'USER', name: 'User' }],
          },
        ]);
      else if (p.endsWith('/roles'))
        body = {
          ...wireUser(),
          id: 'qa-other-user',
          roles: req.postDataJSON().roles.map((code) => ({ code, name: code })),
        };
      else if (p.endsWith('/status'))
        body = { ...wireUser(), id: 'qa-other-user', status: req.postDataJSON().status };
      else if (p === 'admin/audit-logs')
        body = paged([
          {
            id: 'qa-audit',
            userId: safeUser.id,
            action: 'USER_LOGIN',
            targetType: 'user',
            targetId: safeUser.id,
            createdAt: '2026-10-29T00:00:00Z',
            metadata: { source: 'UI contract stub' },
          },
        ]);
      else {
        status = 404;
        body = {};
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(web);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await geometry(page);
    assert.ok(await page.getByText('API · Môi trường local / test.', { exact: false }).isVisible());
    if (width === 1440) await screenshot(page, 'home-1440.png');
    check(width, 'home / focus / no overflow');
    await page.goto(web + '/login');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'api-email');
    assert.equal(
      await page.locator('#api-email').evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByLabel('Email', { exact: true }).fill('ui-contract@example.invalid');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('not-a-real-credential');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByText('Email hoặc mật khẩu chưa đúng.').waitFor();
    check(width, 'login validation / error / retained input');
    await page.goto(web + '/dashboard');
    await page.getByRole('heading', { name: 'Mỗi ngày, tiến thêm một bước' }).waitFor();
    await page.getByText('2 ngày hiện tại', { exact: false }).waitFor();
    await geometry(page);
    check(width, 'server-shaped dashboard totals / no demo metrics');
    await page.goto(web + `/study/vocabulary/${word.topicId}`);
    await page.getByRole('heading', { name: word.word, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Lật thẻ' }).click();
    await page.getByText(word.meaning, { exact: true }).waitFor();
    await page.getByLabel('Chất lượng nhớ (SM-2)').selectOption('4');
    await page.getByRole('button', { name: 'Gửi đánh giá' }).dblclick();
    await page.getByText('Đã đồng bộ.', { exact: false }).waitFor();
    assert.equal(reviews, 1);
    await geometry(page);
    if (width === 390) await screenshot(page, 'learning-390.png');
    check(width, 'flashcard ack / duplicate click / missing media');
    await page.goto(web + '/study/vocabulary?review=today');
    await page.getByText('Chưa có dữ liệu phù hợp.', { exact: true }).waitFor();
    check(width, 'server review schedule refresh / empty state');
    failLesson = true;
    await page.goto(web + `/study/grammar/${lesson.id}`);
    await page.getByRole('button', { name: 'Thử lại' }).waitFor();
    failLesson = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await page.getByRole('heading', { name: 'Ví dụ', exact: true }).waitFor();
    assert.equal(await page.locator('.lesson-markdown table').count(), 1);
    assert.equal(await page.evaluate(() => window.__xss || false), false);
    assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
    await page.getByRole('button', { name: 'Đánh dấu hoàn thành' }).click();
    await page.getByText('Server xác nhận hoàn thành lúc', { exact: false }).waitFor();
    assert.equal(completed, 1);
    check(width, 'grammar retry / safe Markdown / completion ack');
    await page.goto(web + '/exam');
    await page.getByRole('link', { name: test.title, exact: true }).click();
    await page.getByRole('heading', { name: test.title, exact: true }).waitFor();
    await page.getByLabel('Chế độ muốn làm').selectOption('PRACTICE');
    assert.ok(await page.getByRole('button', { name: 'Bắt đầu · chưa khả dụng' }).isDisabled());
    assert.equal(
      report.requests.filter((r) => r.width === width && r.path.endsWith('/attempts')).length,
      0,
    );
    check(width, 'exam list/detail / mode choices / no unsafe start');
    await page.goBack();
    await page.getByRole('heading', { name: 'Thư viện đề thi', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: test.title, exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Bắt đầu · chưa khả dụng' }).waitFor();
    check(width, 'Back / Forward / reload preserve server ID without creating attempts');
    await page.goto(web + '/history');
    await page.getByRole('link', { name: 'Mở kết quả lượt qa-attempt-01' }).click();
    await page.getByText('Số câu đúng server trả về:', { exact: false }).waitFor();
    assert.equal(await page.getByText('900', { exact: true }).count(), 0);
    await geometry(page);
    if (width === 320) await screenshot(page, 'result-320.png');
    check(width, 'history/result / no placeholder TOEIC score');
    await page.goto(web + '/analytics');
    await page.getByText('Công thức dự đoán backend chưa khớp đặc tả.', { exact: false }).waitFor();
    assert.equal(await page.getByText('900', { exact: true }).count(), 0);
    await page.getByLabel('Khoảng thời gian hoạt động').selectOption('LAST_7_DAYS');
    await page.getByText('Chưa có hoạt động.', { exact: true }).waitFor();
    check(width, 'analytics filtering / lifetime labels / prediction withheld');
    await page.goto(web + '/profile');
    await page.getByLabel('Họ và tên').fill('Tên được giữ khi lỗi');
    profileError = true;
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await page.getByText('Server từ chối giá trị này.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Họ và tên').inputValue(), 'Tên được giữ khi lỗi');
    profileError = false;
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await page.getByText('Server đã xác nhận cập nhật hồ sơ.').waitFor();
    check(width, 'profile server validation / retained input / ack');
    profileWrongId = true;
    await page.getByLabel('Họ và tên').fill('Không được nhận sai ID');
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await page.getByText('Dữ liệu server không hợp lệ: response.id.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Họ và tên').inputValue(), 'Không được nhận sai ID');
    assert.equal(await page.getByText('Server đã xác nhận cập nhật hồ sơ.').count(), 0);
    profileWrongId = false;
    check(width, 'wrong profile acknowledgement retains input without success');
    accountLocked = true;
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await page.getByRole('link', { name: 'Đăng nhập để tiếp tục' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Lưu hồ sơ' }).count(), 0);
    accountLocked = false;
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.getByRole('heading', { name: 'Hồ sơ của bạn', exact: true }).waitFor();
    check(
      width,
      'inactive-account response removes private UI and retry restores validated session',
    );
    for (const route of ['/settings', '/ai-chat']) {
      await page.goto(web + route);
      await page.locator('.api-blocked').first().waitFor();
      await geometry(page);
    }
    check(width, 'settings / AI explicit blocked UI');
    await page.goto(cms + '/questions');
    await page.getByRole('link', { name: question.stem, exact: true }).waitFor();
    await geometry(page);
    assert.ok(await page.locator('aside.cms-desktop-sidebar a[href="/users"]').count());
    assert.ok(await page.locator('aside.cms-desktop-sidebar a[href="/questions"]').count());
    if (width === 768) await screenshot(page, 'cms-768.png');
    check(width, 'CMS list / union of backend roles');
    if (width < 1024) {
      const trigger = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
      await trigger.click();
      await page.getByRole('dialog', { name: 'Menu quản trị', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page
        .getByRole('dialog', { name: 'Menu quản trị', exact: true })
        .waitFor({ state: 'hidden' });
      await page.waitForFunction(
        () =>
          document.querySelector('.cms-menu-trigger')?.getAttribute('aria-expanded') === 'false',
      );
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
    }
    check(width, 'CMS responsive menu / Escape / focus restoration');
    await page.goto(cms + '/questions/new');
    await page.getByRole('button', { name: 'Xem trước và kiểm tra', exact: true }).click();
    assert.ok(await page.locator('[aria-invalid=true]').count());
    await page.getByLabel('Nội dung *', { exact: true }).fill('Câu hỏi API giữ input');
    await page.getByLabel('Độ khó *', { exact: true }).selectOption('EASY');
    for (const key of ['A', 'B', 'C', 'D'])
      await page.getByLabel(`Phương án ${key} *`, { exact: true }).fill(`Nội dung ${key}`);
    await page.getByLabel('Đáp án đúng *', { exact: true }).selectOption('A');
    await page.getByRole('button', { name: 'Xem trước và kiểm tra', exact: true }).click();
    questionError = true;
    await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
    await page.getByText('Dữ liệu chưa hợp lệ.', { exact: false }).waitFor();
    assert.equal(
      await page.getByLabel('Nội dung *', { exact: true }).inputValue(),
      'Câu hỏi API giữ input',
    );
    assert.equal(questionSaves, 1);
    check(width, 'CMS API question editor / server error retains draft');
    questionError = false;
    questionNetwork = true;
    await page.getByRole('button', { name: 'Xem trước và kiểm tra', exact: true }).click();
    await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
    await page.getByText('Chưa biết server đã tạo hay chưa.', { exact: false }).waitFor();
    assert.equal(
      await page.getByLabel('Nội dung *', { exact: true }).inputValue(),
      'Câu hỏi API giữ input',
    );
    assert.ok(await page.getByRole('button', { name: 'Lưu lên server', exact: true }).isDisabled());
    assert.equal(questionSaves, 2);
    questionNetwork = false;
    check(width, 'network loss blocks duplicate create and retains draft');
    await page.goto(cms + '/tests');
    await page
      .getByText('Transport metadata lượt 24–27 tiếp tục bị khóa:', { exact: false })
      .waitFor();
    assert.equal(
      report.requests.filter((r) => r.width === width && r.path.startsWith('tests/cms-metadata'))
        .length,
      0,
    );
    check(width, 'existing metadata transport remains locked');
    await page.goto(cms + '/users');
    await page.getByRole('link', { name: safeUser.fullName, exact: true }).waitFor();
    await page.getByRole('link', { name: safeUser.fullName, exact: true }).click();
    assert.ok(await page.getByRole('button', { name: 'Lưu vai trò', exact: true }).isDisabled());
    check(width, 'current account cannot self-change roles');
    await page.goto(cms + '/audit-logs');
    await page.getByRole('heading', { name: 'USER_LOGIN', exact: true }).waitFor();
    await page.getByText('Metadata', { exact: true }).click();
    await page.getByText('UI contract stub', { exact: false }).waitFor();
    assert.equal(
      report.requests.filter(
        (r) => r.width === width && r.path === 'admin/audit-logs' && r.method !== 'GET',
      ).length,
      0,
    );
    check(width, 'audit read-only / source field mapping');
    for (const route of ['/lessons', '/vocabulary', '/topics', '/groups', '/media']) {
      await page.goto(cms + route);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await geometry(page);
    }
    check(width, 'remaining CMS domains / blocked contracts / responsive');
    roles = ['USER'];
    if (width >= 1024) {
      await page.locator('aside.cms-desktop-sidebar a[href="/users"]').click();
    } else {
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Menu quản trị', exact: true })
        .locator('a[href="/users"]')
        .click();
    }
    await page.getByRole('heading', { name: 'Không có quyền quản trị' }).waitFor();
    check(width, 'CMS navigation revalidates revoked backend roles');
    roles = [...safeUser.roles];
    sessionExpired = true;
    await page.goto(web + '/dashboard');
    await page.getByRole('link', { name: 'Đăng nhập để tiếp tục' }).waitFor();
    check(width, 'expired session / no private or demo view');
    sessionExpired = false;
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Mỗi ngày, tiến thêm một bước', exact: true })
      .waitFor();
    check(width, 'session retry succeeds without reloading or showing stale private data');
    emptyTopics = true;
    await page.goto(web + '/study/vocabulary');
    await page.getByText('Chưa có dữ liệu phù hợp.', { exact: true }).waitFor();
    emptyTopics = false;
    check(width, 'API empty response never becomes fixture catalog');
    const storage = await page.evaluate(() => window.__toeicWrites);
    assert.deepEqual(storage, []);
    check(width, 'API never writes demo learning/session/history storage');
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.completed = true;
})()
  .catch((error) => {
    report.failure = error.stack;
    process.exitCode = 1;
    console.error(error.message);
  })
  .finally(async () => {
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
  });
