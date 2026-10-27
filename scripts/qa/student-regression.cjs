// Run against the existing dev server. Every scenario uses an isolated browser context.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/screenshots/student-regression-20261027');
fs.mkdirSync(out, { recursive: true });
const base = 'http://localhost:3006';
const report = {
  checks: [],
  screenshots: [],
  errors: [],
  apiRequests: [],
  dialogs: [],
  physicalListeningVerified: false,
};
const learningKey = 'toeic.learning-preview.v1';
const examKey = 'toeic.exam-demo.v1';
const settingsKey = 'toeic.learning-settings-demo.v1';
let browser;
let p;
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log('PASS', name);
}
async function page(context) {
  const q = await context.newPage();
  q.on('pageerror', (e) => report.errors.push({ url: q.url(), message: e.message }));
  q.on('request', (r) => {
    if (/\/api\/|localhost:3000/.test(r.url())) report.apiRequests.push(r.url());
  });
  q.on('dialog', async (d) => {
    report.dialogs.push(d.type());
    await d.dismiss();
  });
  return q;
}
async function go(route, locator) {
  await p.goto(base + route);
  if (locator) await locator().waitFor();
  await p.locator('main h1').first().waitFor();
}
const button = (name) => p.getByRole('button', { name, exact: true });
const heading = (name) => p.getByRole('heading', { name, exact: true });
const raw = (key) => p.evaluate((k) => localStorage.getItem(k), key);
const snapshot = async (key) => JSON.parse(await raw(key));
async function shots(name, target) {
  for (const width of [1440, 768, 390]) {
    await p.setViewportSize({ width, height: 900 });
    if (target) await target().scrollIntoViewIfNeeded();
    else await p.evaluate(() => scrollTo(0, 0));
    await p.evaluate(() => document.fonts.ready);
    const png = await p.screenshot({
      path: path.join(out, `${name}-${width}.png`),
      fullPage: false,
    });
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), 900);
    const sizes = await p.evaluate(() => ({
      innerWidth,
      innerHeight,
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(sizes.innerWidth, width);
    assert.equal(sizes.innerHeight, 900);
    assert.ok(
      sizes.scroll <= sizes.client,
      `${name} overflows at ${width}: ${JSON.stringify(sizes)}`,
    );
    report.screenshots.push({
      name,
      width,
      height: 900,
      pngWidth: png.readUInt32BE(16),
      pngHeight: png.readUInt32BE(20),
      ...sizes,
    });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
async function start(route) {
  await go(route, () => button('Kiểm tra chuẩn bị'));
  assert.equal(await button('Bắt đầu phiên demo').isDisabled(), true);
  await button('Kiểm tra chuẩn bị').click();
  assert.equal(await button('Bắt đầu phiên demo').isDisabled(), true);
  for (const c of await p.getByRole('checkbox').all()) await c.check();
  await button('Kiểm tra chuẩn bị').click();
  await button('Bắt đầu phiên demo').click();
  await p.getByRole('radio').first().waitFor();
}
async function end() {
  await button('Kết thúc phiên demo').click();
  const dialog = p.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Kết thúc tại trình duyệt', exact: true }).click();
  await heading('Phiên demo đã kết thúc').waitFor();
}
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  report.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  p = await page(context);
  p.setDefaultTimeout(10000);
  await check(
    'Login/Register validation, labels, keyboard, preview only, Dashboard entry',
    async () => {
      for (const intent of ['login', 'register']) {
        await go('/' + intent, () => button(intent === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'));
        const form = p.getByRole('form');
        await button(intent === 'login' ? 'Đăng nhập' : 'Tạo tài khoản').click();
        const invalid = form.locator('[aria-invalid=true]');
        assert.equal(await invalid.count(), intent === 'login' ? 2 : 4);
        assert.equal(await invalid.first().evaluate((e) => e === document.activeElement), true);
        for (const field of await invalid.all()) {
          assert.ok(await field.getAttribute('aria-describedby'));
          assert.ok(await field.evaluate((e) => e.labels.length));
        }
        await shots(intent + '-validation');
        if (intent === 'register') await p.locator('#fullName').fill('QA Học viên');
        await p.locator('#email').fill('qa@example.test');
        await p.locator('#password').fill('DemoTest123');
        if (intent === 'register') await p.locator('#confirmPassword').fill('DemoTest123');
        const submit = button(intent === 'login' ? 'Đăng nhập' : 'Tạo tài khoản');
        await submit.focus();
        await p.keyboard.press('Enter');
        await p.getByText(/Thông tin đã hợp lệ\./).waitFor();
        assert.deepEqual(await p.evaluate(() => ({ ...localStorage })), {});
        await p.getByRole('link', { name: 'Xem thử không gian học tập' }).click();
        await p.waitForURL('**/dashboard');
        await p.locator('.stat-card').first().waitFor();
        assert.match(await p.locator('.profile-label').innerText(), /Khách xem thử/);
      }
      await shots('dashboard');
    },
  );
  const dashboardBefore = await p.locator('main').innerText();
  await go('/analytics', () => p.locator('.analytics-stat-card,.stat-card').first());
  const analyticsBefore = await p.locator('main').innerText();
  await check(
    'Sidebar, account header, skip link, mobile modal focus, Escape, navigation and Back',
    async () => {
      await go('/dashboard', () => p.locator('.stat-card').first());
      await p.locator('.skip-link').focus();
      await p.keyboard.press('Enter');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'main-content');
      await p.locator('.profile-menu summary').focus();
      await p.keyboard.press('Enter');
      await p.locator('.profile-dropdown a[href="/profile"]').click();
      await p.waitForURL('**/profile');
      await button('Chỉnh sửa thông tin').waitFor();
      assert.equal(await p.locator('.profile-menu').getAttribute('open'), null);
      await p.goBack();
      await p.waitForURL(/\/dashboard(#.*)?$/);
      await p.locator('.stat-card').first().waitFor();
      for (const width of [768, 390]) {
        await p.setViewportSize({ width, height: 900 });
        const open = button('Mở menu học tập');
        await open.focus();
        await p.keyboard.press('Enter');
        const dialog = p.getByRole('dialog', { name: 'Menu học tập' });
        await dialog.waitFor();
        for (let i = 0; i < 18; i++) {
          await p.keyboard.press('Tab');
          // Chromium may focus browser chrome (activeElement=body) at a native modal's edge.
          // Background page controls must remain inert; the next Tab returns to the modal.
          const focus = await dialog.evaluate((d) => ({
            inside: d.contains(document.activeElement) || document.activeElement === document.body,
            active: document.activeElement.outerHTML.slice(0, 250),
            open: d.open,
          }));
          assert.equal(focus.inside, true, JSON.stringify({ width, i, ...focus }));
        }
        const png = await p.screenshot({
          path: path.join(out, `menu-${width}.png`),
          fullPage: false,
        });
        assert.equal(png.readUInt32BE(16), width);
        report.screenshots.push({ name: 'menu', width, height: 900 });
        await p.keyboard.press('Escape');
        assert.equal(await open.evaluate((e) => e === document.activeElement), true);
        await open.click();
        await dialog.getByRole('link', { name: 'Ngữ pháp', exact: true }).click();
        await p.waitForURL('**/study/grammar');
        assert.equal(await dialog.isVisible(), false);
        await p.goBack();
        await p.waitForURL(/\/dashboard(#.*)?$/);
        await p.locator('.stat-card').first().waitFor();
      }
      await p.setViewportSize({ width: 1440, height: 900 });
      for (const href of [
        '/study/vocabulary',
        '/study/grammar',
        '/practice',
        '/exam',
        '/history',
        '/analytics',
        '/ai-chat',
        '/settings',
        '/profile',
        '/dashboard',
      ]) {
        await p.locator(`.desktop-sidebar .nav-link[href="${href}"]`).click();
        await p.waitForURL(base + href);
        assert.equal(
          await p
            .locator(`.desktop-sidebar .nav-link[href="${href}"]`)
            .getAttribute('aria-current'),
          'page',
        );
      }
    },
  );
  await check(
    'Vocabulary search, flashcards, MP3, pause/resume session and persisted quiz answers',
    async () => {
      await go('/study/vocabulary', () => p.getByLabel('Tìm chủ đề hoặc từ vựng', { exact: true }));
      await shots('vocabulary-library');
      await p.getByLabel('Tìm chủ đề hoặc từ vựng', { exact: true }).fill('qqq-no-match');
      await heading('Chưa tìm thấy chủ đề phù hợp').waitFor();
      await p.getByLabel('Tìm chủ đề hoặc từ vựng', { exact: true }).fill('');
      await p.locator('.topic-open').first().click();
      await button('Học bộ từ').waitFor();
      await shots('vocabulary-topic');
      await button('Học bộ từ').click();
      await button('Lật thẻ xem nghĩa').waitFor();
      await button('Nghe lại từ đầu').click();
      await p.waitForFunction(() => {
        const a = document.querySelector('audio');
        return a && a.currentTime > 0.15 && !a.paused && a.duration > 0;
      });
      await p.locator('audio').evaluate((a) => a.pause());
      await shots('flashcard');
      await shots('flashcard-actions', () => p.locator('.flashcard-rating'));
      await button('Lật thẻ xem nghĩa').focus();
      await p.keyboard.press('Space');
      await button(/.*Đã thuộc.*/).click();
      const before = await raw(learningKey);
      await p.getByRole('link', { name: 'Tạm dừng và về thư viện', exact: true }).click();
      await p.getByRole('link', { name: 'Tiếp tục', exact: true }).click();
      await p.waitForURL('**/study/vocabulary/business-office');
      await button('Lật thẻ xem nghĩa').waitFor();
      assert.equal(await raw(learningKey), before);
      await p.reload();
      await button('Lật thẻ xem nghĩa').waitFor();
      assert.equal(await raw(learningKey), before);
      for (let i = 1; i < 8; i++) {
        await button('Lật thẻ xem nghĩa').click();
        await button(/.*Đã thuộc.*/).click();
      }
      await button('Nộp bài quiz').waitFor();
      await button('Nộp bài quiz').click();
      await p.getByText('Vui lòng trả lời đủ 5 câu trước khi nộp bài.', { exact: true }).waitFor();
      assert.equal(
        await p
          .getByRole('radio')
          .first()
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await p.locator('.quiz-question').first().getByRole('radio').nth(1).check();
      const quizBefore = await raw(learningKey);
      await p.reload();
      await button('Nộp bài quiz').waitFor();
      assert.equal(await raw(learningKey), quizBefore);
      assert.equal(
        await p.locator('.quiz-question').first().getByRole('radio').nth(1).isChecked(),
        true,
      );
      await shots('vocabulary-quiz');
      await shots('vocabulary-quiz-submit', () => p.locator('.quiz-submit'));
      for (const question of await p.locator('.quiz-question').all())
        await question.getByRole('radio').first().check();
      await button('Nộp bài quiz').click();
      await heading('Thêm một bước tiến hôm nay!').waitFor();
      await shots('vocabulary-result');
      await shots('vocabulary-result-review', () => p.locator('.quiz-review'));
      const done = await raw(learningKey);
      await p.reload();
      await heading('Thêm một bước tiến hôm nay!').waitFor();
      assert.equal(await raw(learningKey), done);
    },
  );
  await check(
    'Grammar lesson, table scrolling, completion/reload and isolated Dashboard/Analytics',
    async () => {
      await go('/study/grammar', () => p.locator('a[href^="/study/grammar/"]').first());
      await shots('grammar-library');
      await p.locator('a[href^="/study/grammar/"]').first().click();
      await button('Đánh dấu hoàn thành').waitFor();
      await shots('grammar-lesson');
      await shots('grammar-table', () =>
        p.locator('.grammar-article .learning-table-wrap').first(),
      );
      await shots('grammar-completion', () => p.locator('.grammar-completion'));
      await button('Đánh dấu hoàn thành').click();
      await button('Đã hoàn thành bài học').waitFor();
      const completed = await raw(learningKey);
      await p.reload();
      await button('Đã hoàn thành bài học').waitFor();
      assert.equal(await raw(learningKey), completed);
      await go('/dashboard', () => p.locator('.stat-card').first());
      assert.equal(await p.locator('main').innerText(), dashboardBefore);
      await go('/analytics', () => p.locator('.analytics-stat-card,.stat-card').first());
      assert.equal(await p.locator('main').innerText(), analyticsBefore);
    },
  );
  await check(
    'Exam library, invalid Part, preparation and Back preserve submitted selection',
    async () => {
      await go('/exam', () => p.locator('a[href^="/exam/full-test-01"]').first());
      await shots('exam-library');
      await go('/exam/full-test-01?entry=practice', () => button('Kiểm tra lựa chọn'));
      await button('Kiểm tra lựa chọn').click();
      assert.equal(
        await p
          .locator('fieldset[aria-invalid=true]')
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await p.getByRole('checkbox', { name: /^Part 1 ·/ }).check();
      await p.getByRole('checkbox', { name: /^Part 3 ·/ }).check();
      await shots('exam-selection');
      await button('Tiếp tục chuẩn bị').click();
      await p.waitForURL('**/prepare?*');
      await button('Kiểm tra chuẩn bị').waitFor();
      const selectionUrl = p.url();
      await shots('exam-prepare');
      await shots('exam-readiness', () => button('Kiểm tra chuẩn bị'));
      await p.goBack();
      await button('Tiếp tục chuẩn bị').waitFor();
      assert.equal(await p.getByRole('radio', { name: /^Luyện tập/ }).isChecked(), true);
      assert.equal(await p.getByRole('checkbox', { name: /^Part 3 ·/ }).isChecked(), true);
      assert.equal(await button('Tiếp tục chuẩn bị').isEnabled(), true);
      await p.reload();
      await button('Tiếp tục chuẩn bị').waitFor();
      assert.equal(await p.getByRole('checkbox', { name: /^Part 1 ·/ }).isChecked(), true);
      await button('Tiếp tục chuẩn bị').click();
      await p.waitForURL(selectionUrl);
    },
  );
  await check(
    'Exam answers/flags/mode/Parts/duration/deadline survive navigation, reload and resume',
    async () => {
      await start('/exam/full-test-01/prepare?mode=PRACTICE&scope=parts&parts=1,3,5,6,7');
      await p.getByRole('radio').nth(1).focus();
      await p.keyboard.press('Space');
      await button('Đánh dấu xem lại câu 1').click();
      const before = await snapshot(examKey);
      assert.deepEqual(before.selection, {
        mode: 'PRACTICE',
        scope: 'parts',
        partIds: [1, 3, 5, 6, 7],
      });
      await shots('exam-player-listening');
      await shots('exam-question', () => p.locator('.player-question').first());
      await button('Câu tiếp').click();
      await button('Câu trước').click();
      assert.equal(await p.getByRole('radio').nth(1).isChecked(), true);
      const takeUrl = p.url();
      await p.reload();
      await p.getByRole('radio').first().waitFor();
      const after = await snapshot(examKey);
      for (const k of [
        'selection',
        'answers',
        'flaggedIds',
        'durationSeconds',
        'startedAt',
        'deadlineAt',
      ])
        assert.deepEqual(after[k], before[k], k);
      report.examPersistence = {
        mode: after.selection.mode,
        parts: after.selection.partIds,
        duration: after.durationSeconds,
        deadlineBefore: before.deadlineAt,
        deadlineAfter: after.deadlineAt,
      };
      await button('Rời bài').click();
      await p.waitForURL(/\/exam\/full-test-01(\?|$)/);
      await p.goto(takeUrl);
      await p.getByRole('radio').first().waitFor();
      assert.deepEqual((await snapshot(examKey)).answers, before.answers);
      assert.equal((await snapshot(examKey)).deadlineAt, before.deadlineAt);
      await end();
      await shots('exam-ended');
      await button('Xem thông tin phiên').click();
      await heading('Thông tin phiên đã kết thúc').waitFor();
      await shots('exam-result');
      const resultUrl = p.url();
      assert.match(await p.locator('main').innerText(), /Chưa có kết quả chấm từ server/);
      await p.goto(resultUrl.replace('/result?', '/review?'));
      await heading('Xem lại lựa chọn đã lưu').waitFor();
      assert.equal(await p.locator('.review-solution').count(), 0);
      assert.equal(await p.getByRole('radio').count(), 0);
      await shots('exam-review');
      await go('/history', () => p.locator('.history-entry').first());
      await shots('exam-history');
      await go('/history/example/review', () => heading('Xem lại ví dụ Reading'));
      await shots('reading-example');
    },
  );
  await check(
    'Single Part and full MOCK_TEST preserve actual selection and close without client scoring',
    async () => {
      for (const [parts, mode, scope, count] of [
        ['2', 'PRACTICE', 'parts', 25],
        ['1,2,3,4,5,6,7', 'MOCK_TEST', 'full', 200],
      ]) {
        await start(`/exam/full-test-01/prepare?mode=${mode}&scope=${scope}&parts=${parts}`);
        const current = await snapshot(examKey);
        assert.equal(current.questionIds.length, count);
        assert.equal(current.selection.mode, mode);
        assert.deepEqual(current.selection.partIds, parts.split(',').map(Number));
        await p.reload();
        await p.getByRole('radio').first().waitFor();
        assert.equal((await snapshot(examKey)).deadlineAt, current.deadlineAt);
        await end();
      }
    },
  );
  await check(
    'Expiry uses existing 15-second QA scenario and locks answers after reload',
    async () => {
      await start(
        '/exam/full-test-01/prepare?mode=PRACTICE&scope=parts&parts=5&preview=short-timer',
      );
      await p.getByRole('radio').first().check();
      const deadline = (await snapshot(examKey)).deadlineAt;
      await p.reload();
      await p.getByRole('radio').first().waitFor();
      assert.equal((await snapshot(examKey)).deadlineAt, deadline);
      await heading('Đã hết thời gian làm bài').waitFor({ timeout: 20000 });
      assert.equal(await p.getByRole('radio').count(), 0);
      assert.equal((await snapshot(examKey)).status, 'expired');
    },
  );
  await check(
    'Settings persists locally, Profile/chat reset on reload and never write another module',
    async () => {
      await go('/settings', () => button('Thiết lập cài đặt demo'));
      await button('Thiết lập cài đặt demo').click();
      await shots('settings');
      await p.locator('[name="dailyVocabularyGoal"]').fill('17');
      await button('Lưu thay đổi').click();
      await p
        .getByRole('status')
        .filter({ hasText: 'Đã lưu cài đặt demo trên thiết bị này' })
        .waitFor();
      const before = await p.evaluate(() => ({ ...localStorage }));
      await p.reload();
      await p.locator('[name="dailyVocabularyGoal"]').waitFor();
      assert.equal(await p.locator('[name="dailyVocabularyGoal"]').inputValue(), '17');
      assert.equal(await raw(settingsKey), before[settingsKey]);
      await go('/profile', () => button('Chỉnh sửa thông tin'));
      await shots('profile');
      await shots('profile-form', () => button('Chỉnh sửa thông tin'));
      const name = await p.locator('[name="fullName"]').inputValue();
      await button('Chỉnh sửa thông tin').click();
      await p.locator('[name="fullName"]').fill('QA sửa trong trang');
      await button('Lưu thông tin demo').click();
      await p
        .getByRole('status')
        .filter({ hasText: 'Đã lưu họ tên và số điện thoại demo' })
        .waitFor();
      assert.deepEqual(await p.evaluate(() => ({ ...localStorage })), before);
      await p.reload();
      await button('Chỉnh sửa thông tin').waitFor();
      assert.equal(await p.locator('[name="fullName"]').inputValue(), name);
      await go('/ai-chat', () => p.getByRole('textbox'));
      await p.waitForFunction(() => {
        const e = document.querySelector('#chat-content');
        return e && !e.disabled;
      });
      await shots('ai-chat');
      await shots('ai-chat-composer', () => p.locator('.chat-composer'));
      await p.getByRole('textbox').fill('Giải thích thì hiện tại đơn');
      await p.getByRole('textbox').press('Enter');
      await p.locator('.chat-message--assistant .lesson-markdown').waitFor();
      assert.deepEqual(await p.evaluate(() => ({ ...localStorage })), before);
      await p.reload();
      await p.getByRole('textbox').waitFor();
      assert.equal(await p.locator('.chat-message--assistant').count(), 0);
      await go('/analytics', () => p.locator('.analytics-stat-card,.stat-card').first());
      await shots('analytics');
      assert.equal(await p.locator('main').innerText(), analyticsBefore);
      await go('/dashboard', () => p.locator('.stat-card').first());
      assert.equal(await p.locator('main').innerText(), dashboardBefore);
    },
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.apiRequests, []);
  report.completed = true;
})()
  .catch(async (e) => {
    report.failure = e.stack;
    console.error(e);
    if (p) {
      report.failureUrl = p.url();
      await p.screenshot({ path: path.join(out, 'failure.png'), fullPage: false }).catch(() => {});
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  });
