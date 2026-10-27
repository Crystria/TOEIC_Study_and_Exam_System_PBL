const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/screenshots/student-regression-20261027');
fs.mkdirSync(out, { recursive: true });
const report = { checks: [], screenshots: [], errors: [], apiRequests: [], nativeDialogs: [] };
const base = 'http://localhost:3006';
const key = 'toeic.exam-demo.v1';
let browser, p;
const b = (name) => p.getByRole('button', { name, exact: true });
const h = (name) => p.getByRole('heading', { name, exact: true });
const raw = () => p.evaluate((k) => localStorage.getItem(k), key);
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log('PASS', name);
}
async function shot(name) {
  for (const width of [1440, 768, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await p.evaluate(() => scrollTo(0, 0));
    const png = await p.screenshot({
      path: path.join(out, `${name}-${width}.png`),
      fullPage: false,
    });
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), 900);
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
    );
    report.screenshots.push({ name, width, height: 900 });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
}
async function start(preview = '') {
  await p.goto(base + '/exam/full-test-01/prepare?mode=PRACTICE&scope=parts&parts=5,6,7' + preview);
  await b('Kiểm tra chuẩn bị').waitFor();
  for (const c of await p.getByRole('checkbox').all()) await c.check();
  await b('Kiểm tra chuẩn bị').click();
  await b('Bắt đầu phiên demo').click();
  await p.getByRole('radio').first().waitFor();
}
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => report.errors.push(e.message));
  p.on('request', (r) => {
    if (/\/api\/|localhost:3000/.test(r.url())) report.apiRequests.push(r.url());
  });
  p.on('dialog', async (d) => {
    report.nativeDialogs.push(d.type());
    await d.dismiss();
  });
  await check('Dashboard empty/insufficient/error/retry, select labels and loading', async () => {
    await p.goto(base + '/dashboard?preview=empty');
    await h('Chưa có điểm trong khoảng này').waitFor();
    await shot('dashboard-empty');
    await p.getByLabel('Khoảng thời gian thống kê', { exact: true }).selectOption('ALL_TIME');
    await h('Chưa có điểm trong khoảng này').waitFor();
    await p.goto(base + '/dashboard?preview=insufficient');
    await p.locator('.stat-card').first().waitFor();
    assert.match(await p.locator('main').innerText(), /Chưa đủ dữ liệu/);
    await p.goto(base + '/dashboard?preview=error');
    await h('Chưa tải được dữ liệu học tập').waitFor();
    await shot('dashboard-error');
    await b('Thử lại').focus();
    await p.keyboard.press('Enter');
    await p.locator('.stat-card').first().waitFor();
    assert.equal(await p.evaluate(() => document.activeElement.id), 'main-content');
  });
  await check('Vocabulary/Grammar empty/error/retry and search clearing', async () => {
    for (const [route, title, search] of [
      ['vocabulary', 'Thư viện từ vựng đang được chuẩn bị', 'Tìm chủ đề hoặc từ vựng'],
      ['grammar', 'Thư viện ngữ pháp đang được chuẩn bị', 'Tìm bài học'],
    ]) {
      await p.goto(`${base}/study/${route}?preview=empty`);
      await h(title).waitFor();
      await p.goto(`${base}/study/${route}?preview=error`);
      await h('Chưa tải được dữ liệu học tập').waitFor();
      await shot(route + '-load-error');
      await b('Thử lại').focus();
      await p.keyboard.press('Enter');
      await p.getByLabel(search, { exact: true }).waitFor();
      assert.equal(await p.evaluate(() => document.activeElement.id), 'main-content');
      await p.getByLabel(search, { exact: true }).fill('qqq-no-match');
      await b('Xóa bộ lọc').click();
      assert.equal(await p.getByLabel(search, { exact: true }).inputValue(), '');
    }
  });
  await check(
    'Grammar table-of-contents hash then Profile/Settings Back restores the lesson, not only its URL',
    async () => {
      await p.goto(base + '/study/grammar');
      await p.locator('a[href^="/study/grammar/"]').first().click();
      await p.locator('#lesson-title').waitFor();
      const title = await p.locator('#lesson-title').innerText();
      for (const [route, ready] of [
        ['profile', 'Chỉnh sửa thông tin'],
        ['settings', 'Thiết lập cài đặt demo'],
      ]) {
        await p.locator('.lesson-toc a').first().click();
        await p.waitForURL(/#lesson-section-/);
        const lessonUrl = p.url();
        await p.locator(`.desktop-sidebar .nav-link[href="/${route}"]`).click();
        await b(ready).waitFor();
        await p.goBack();
        await p.waitForURL(lessonUrl);
        await p.locator('#lesson-title').waitFor();
        assert.equal(await p.locator('#lesson-title').innerText(), title);
      }
    },
  );
  await check(
    'Exam library loading/empty/error/retry, search/filter, invalid selections preserve storage',
    async () => {
      await p.goto(base + '/exam?preview=loading');
      await p.getByRole('status', { name: 'Đang tải đề thi' }).waitFor();
      await shot('exam-loading');
      await p.getByRole('link', { name: 'Kết thúc xem thử loading', exact: true }).click();
      await p.getByLabel('Tìm đề thi', { exact: true }).waitFor();
      await p.getByLabel('Loại đề', { exact: true }).selectOption('MINI_TEST');
      await p.getByLabel('Có kỹ năng', { exact: true }).selectOption('READING');
      await p.getByLabel('Tìm đề thi', { exact: true }).fill('qqq-no-match');
      await h('Chưa tìm thấy đề phù hợp').waitFor();
      await b('Xóa bộ lọc').first().click();
      assert.equal(await p.getByLabel('Loại đề', { exact: true }).inputValue(), 'all');
      await p.goto(base + '/exam?preview=empty');
      await h('Thư viện đề thi đang được chuẩn bị').waitFor();
      await p.goto(base + '/exam?preview=error');
      await h('Chưa tải được đề thi').waitFor();
      await b('Thử lại').focus();
      await p.keyboard.press('Enter');
      await h('Thư viện đề thi').waitFor();
      const before = await p.evaluate(() => ({ ...localStorage }));
      for (const query of [
        '',
        '?mode=PRACTICE&scope=parts&parts=1,1',
        '?mode=bad&scope=full&parts=1',
        '?mode=PRACTICE&scope=parts&parts=9',
        '?mode=PRACTICE&mode=MOCK_TEST&scope=parts&parts=1',
      ]) {
        await p.goto(base + '/exam/full-test-01/prepare' + query);
        await h('Chưa thể chuẩn bị làm bài').waitFor();
        assert.equal(await b('Bắt đầu phiên demo').count(), 0);
        assert.deepEqual(await p.evaluate(() => ({ ...localStorage })), before);
      }
    },
  );
  await check(
    'Player loading/empty/error/retry retains actual answers and deadline; Reading highlight and map',
    async () => {
      await start();
      await p.getByRole('radio').nth(2).check();
      const takeUrl = p.url(),
        before = await raw();
      for (const state of ['loading', 'empty', 'error']) {
        await p.goto(takeUrl + '&preview=' + state);
        if (state === 'loading') {
          await p.getByRole('status', { name: 'Đang tải câu hỏi' }).waitFor();
          await b('Tải câu hỏi demo').click();
        } else {
          await h(
            state === 'empty' ? 'Chưa có câu hỏi trong phạm vi này' : 'Chưa tải được câu hỏi',
          ).waitFor();
          if (state === 'error') await shot('player-load-error');
          await b('Thử tải lại câu hỏi').focus();
          await p.keyboard.press('Enter');
        }
        await p.getByRole('radio').first().waitFor();
        assert.equal(await raw(), before);
      }
      const details = p.locator('.player-map details');
      if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
      await p.getByRole('button', { name: /^Câu 131,/ }).click();
      const highlight = p.getByRole('button', { name: /^Tô sáng đoạn/ }).first();
      await highlight.focus();
      await p.keyboard.press('Space');
      await shot('player-reading-highlight');
      const highlighted = JSON.parse(await raw());
      assert.equal(highlighted.highlightedIds.length, 1);
      await p.reload();
      // Explicit preview=error is intentionally reset by reload; retry its loader again.
      await b('Thử tải lại câu hỏi').click();
      await p.locator('.player-paragraph.is-highlighted').waitFor();
      assert.deepEqual(JSON.parse(await raw()).highlightedIds, highlighted.highlightedIds);
      assert.equal(await p.locator('audio').count(), 0);
      await p.getByLabel('Lọc bảng câu hỏi', { exact: true }).selectOption('flagged');
      await p.getByText('Không có câu hỏi trong bộ lọc này.', { exact: true }).waitFor();
    },
  );
  await check(
    'One active draft requires replacement confirmation and cancellation keeps original snapshot',
    async () => {
      const before = await raw();
      await p.goto(
        base + '/exam/full-test-01/prepare?mode=MOCK_TEST&scope=full&parts=1,2,3,4,5,6,7',
      );
      await b('Kiểm tra chuẩn bị').waitFor();
      for (const c of await p.getByRole('checkbox').all()) await c.check();
      await b('Kiểm tra chuẩn bị').click();
      await b('Bắt đầu phiên demo').click();
      await p.getByRole('dialog', { name: 'Thay thế bản nháp hiện tại?' }).waitFor();
      await p.keyboard.press('Escape');
      assert.equal(await raw(), before);
      await b('Tiếp tục phiên demo đang có').click();
      await p.getByRole('radio').first().waitFor();
      assert.equal(await raw(), before);
    },
  );
  await check(
    'Exam failed save warns on exit/Back/native reload; cancel and retry preserve draft',
    async () => {
      // A separate QA context ensures failure simulation cannot affect earlier fixtures.
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const original = p;
      p = await c.newPage();
      p.on('pageerror', (e) => report.errors.push(e.message));
      p.on('dialog', async (d) => {
        report.nativeDialogs.push(d.type());
        await d.dismiss();
      });
      await start('&preview=save-error');
      await p.getByRole('radio').nth(1).check();
      await p.getByText('Chưa lưu được bản nháp mới nhất.', { exact: true }).waitFor();
      const selected = await p.getByRole('radio').nth(1).inputValue();
      await b('Rời bài').click();
      await p.getByRole('dialog', { name: 'Rời bài khi chưa lưu được?' }).waitFor();
      await p.keyboard.press('Escape');
      assert.equal(await p.getByRole('radio').nth(1).isChecked(), true);
      await p.evaluate(() => history.back());
      await p.getByRole('dialog', { name: 'Rời bài khi chưa lưu được?' }).waitFor();
      await p.keyboard.press('Escape');
      await p.reload().catch(() => {});
      assert.ok(report.nativeDialogs.includes('beforeunload'));
      assert.equal(await p.getByRole('radio').nth(1).isChecked(), true);
      await shot('player-save-error');
      await b('Thử lưu lại bản nháp').focus();
      await p.keyboard.press('Enter');
      await p.getByText(/Bản nháp hiện tại đã có trên trình duyệt này/).waitFor();
      const saved = JSON.parse(await raw());
      assert.equal(saved.answers[saved.currentQuestionId], selected);
      await c.close();
      p = original;
    },
  );
  await check(
    'Learning save-error discloses RAM-only progress and does not claim a successful browser save',
    async () => {
      const original = p,
        c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      p = await c.newPage();
      p.on('pageerror', (e) => report.errors.push(e.message));
      await p.goto(base + '/study/vocabulary/business-office?preview=save-error');
      await b('Học bộ từ').click();
      await b('Lật thẻ xem nghĩa').click();
      await b(/.*Đã thuộc.*/).click();
      await p.getByText('Chưa lưu được thay đổi trên trình duyệt.', { exact: false }).waitFor();
      assert.equal(await p.evaluate(() => localStorage.getItem('toeic.learning-preview.v1')), null);
      assert.match(await p.locator('.flashcard-progress').innerText(), /2.*8/s);
      await shot('learning-save-error');
      await c.close();
      p = original;
    },
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.apiRequests, []);
  report.completed = true;
})()
  .catch(async (e) => {
    report.failure = e.stack;
    console.error(e);
    process.exitCode = 1;
    if (p) {
      report.failureUrl = p.url();
      await p
        .screenshot({ path: path.join(out, 'states-failure.png'), fullPage: false })
        .catch(() => {});
    }
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'states-report.json'), JSON.stringify(report, null, 2));
  });
