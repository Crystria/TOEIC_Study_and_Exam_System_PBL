const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-question-form-session28-20261029');
if (fs.existsSync(path.join(out, 'browser-report.json')))
  throw new Error('Choose a fresh CMS_QA_OUT');
fs.mkdirSync(out, { recursive: true });
const report = {
  base,
  checks: [],
  screenshots: [],
  errors: [],
  forbiddenRequests: [],
  httpErrors: [],
  storageWrites: [],
};
let browser, page;
const check = (name) => {
  report.checks.push({ name, viewport: page.viewportSize() });
  console.log('CHECK', page.viewportSize().width, name);
};
const submit = () => page.getByRole('button', { name: 'Xem trước câu hỏi', exact: true }).click();
const ready = () => page.locator('#qf-stem').waitFor();
const focused = async (id) =>
  assert.equal(await page.evaluate(() => document.activeElement?.id), id);
const listReady = () =>
  page.waitForFunction(
    () => document.querySelector('.question-results')?.getAttribute('aria-busy') === 'false',
  );
async function shot(name, selector) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(geometry.scroll <= geometry.client, JSON.stringify(geometry));
  const file = `${name}-${viewport.width}.png`;
  const png = await page.screenshot({ path: path.join(out, file), fullPage: false });
  assert.equal(png.readUInt32BE(16), viewport.width);
  assert.equal(png.readUInt32BE(20), viewport.height);
  report.screenshots.push({ file, viewport, geometry });
}
async function queryEquals(expected) {
  const href = await page.locator('.qf-back a').first().getAttribute('href');
  assert.equal(href, '/questions?' + expected);
}

(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  report.browser = browser.version();
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    await context.exposeBinding('__recordCmsWrite', (_source, write) =>
      report.storageWrites.push({ width, ...write }),
    );
    await context.addInitScript(() => {
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.__recordCmsWrite({ type: 'Storage.' + method });
          return original.apply(this, args);
        };
      }
      const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(Document.prototype, 'cookie', {
        ...cookie,
        set(value) {
          window.__recordCmsWrite({ type: 'cookie' });
          return cookie.set.call(this, value);
        },
      });
      for (const method of ['add', 'put', 'delete', 'clear']) {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (...args) {
          window.__recordCmsWrite({ type: 'IndexedDB.' + method });
          return original.apply(this, args);
        };
      }
    });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(base).origin ||
        /\/api\//.test(url.pathname) ||
        request.method() !== 'GET' ||
        request.headers().authorization ||
        request.headers().cookie
      )
        report.forbiddenRequests.push({ url: request.url(), method: request.method() });
    });
    page.on('response', (response) => {
      if (response.status() >= 400)
        report.httpErrors.push({ url: response.url(), status: response.status() });
    });

    await page.goto(`${base}/questions/new?demoRole=CONTENT_ADMIN`);
    await ready();
    assert.equal(await page.locator('#qf-stem').inputValue(), '');
    assert.equal(await page.locator('#qf-difficulty').inputValue(), '');
    assert.equal(await page.locator('input[name="qf-answer"]:checked').count(), 0);
    assert.equal(await page.locator('.qd-content').count(), 0);
    await shot('new-empty');
    check('Static new route opens a blank draft without ID, answer or difficulty defaults');

    await submit();
    await focused('qf-stem');
    assert.equal(await page.locator('.cms-field-error').count(), 7);
    await shot('validation', '#qf-stem');
    await page.locator('#qf-stem').fill('The team will _____ the report.');
    await submit();
    await focused('qf-difficulty');
    assert.equal(await page.locator('#qf-stem').inputValue(), 'The team will _____ the report.');
    await page.locator('#qf-difficulty').selectOption('EASY');
    for (const key of ['A', 'B', 'D'])
      await page.locator(`#qf-option-${key}`).fill('Choice ' + key);
    await submit();
    await focused('qf-option-C');
    await page.locator('#qf-option-C').fill('submit');
    await submit();
    await focused('qf-answer');
    assert.equal(await page.locator('.qf-preview-content').count(), 0);
    check(
      'Per-field validation retains input and focuses stem, difficulty, missing option and answer',
    );

    await page.locator('input[name="qf-answer"][value="B"]').check();
    await page.locator('input[name="qf-answer"][value="B"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('input[name="qf-answer"]:checked').inputValue(), 'C');
    await page.locator('#qf-stem').focus();
    for (const id of [
      'qf-difficulty',
      'qf-option-A',
      'qf-option-B',
      'qf-option-C',
      'qf-option-D',
      'qf-answer-C',
      'qf-explanation',
    ]) {
      await page.keyboard.press('Tab');
      await focused(id);
    }
    const outline = await page
      .locator('#qf-explanation')
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    assert.notEqual(outline, 'none');
    await shot('keyboard-focus', '#qf-explanation');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Xem trước câu hỏi', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Enter');
    await focused('qf-preview-title');
    assert.equal(
      await page.locator('.qf-preview-stem').innerText(),
      'The team will _____ the report.',
    );
    assert.equal(await page.locator('.qf-correct .qf-option-key').innerText(), 'C');
    assert.match(await page.locator('.qf-preview-explanation').innerText(), /Chưa nhập lời giải/);
    await shot('preview-valid', '.qf-preview-content');
    check(
      'Native radio arrow keys, sequential Tab, visible focus, optional explanation and preview heading focus',
    );

    const long =
      '<img data-qf-injected src="x" onerror="alert(1)">\n' + 'LongLiteralText'.repeat(150);
    await page.locator('#qf-stem').fill(long);
    await page.locator('#qf-option-D').fill(long);
    await page.locator('#qf-explanation').fill(long);
    assert.equal(await page.locator('.qf-stale').isVisible(), true);
    await page.locator('input[name="qf-answer"][value="D"]').check();
    await submit();
    assert.equal(await page.locator('.qf-preview-stem').textContent(), long);
    assert.equal(await page.locator('[data-qf-injected]').count(), 0);
    assert.equal(await page.locator('.qf-correct .qf-option-key').innerText(), 'D');
    assert.equal(await page.locator('.qf-stale').count(), 0);
    await shot('long-literal-preview', '.qf-preview-stem');
    await shot('long-literal-explanation', '.qf-preview-explanation');
    check(
      'Long unbroken text and HTML stay literal without overflow; stale preview is clearly labeled',
    );

    await page.getByRole('button', { name: 'Xóa bản nháp', exact: true }).click();
    await focused('qf-stem');
    assert.equal(await page.locator('#qf-stem').inputValue(), '');
    assert.equal(await page.locator('.qf-preview-content').count(), 0);
    assert.equal(await page.locator('#qf-difficulty').inputValue(), '');
    assert.equal(await page.locator('input[name="qf-answer"]:checked').count(), 0);
    await page.locator('#qf-stem').fill('Reload should discard this');
    await page.reload();
    await ready();
    assert.equal(await page.locator('#qf-stem').inputValue(), '');
    check('Clear draft removes input/preview; reload starts a new blank RAM draft');

    const listQuery = 'demoRole=CONTENT_ADMIN&part=5&page=2&size=1';
    await page.goto(`${base}/questions?${listQuery}`);
    await listReady();
    const beforeList = await page.locator('.question-results').innerText();
    await page.getByRole('link', { name: 'Thử tạo câu hỏi', exact: true }).click();
    await ready();
    await queryEquals(listQuery);
    await page.locator('#qf-stem').fill('Unsubmitted draft');
    await page.getByRole('link', { name: '← Danh sách câu hỏi', exact: true }).click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    assert.equal(await page.locator('.question-results').innerText(), beforeList);
    await page.goBack();
    await ready();
    assert.equal(await page.locator('#qf-stem').inputValue(), '');
    check('List → create → fixed return preserves pagination and catalog; Back discards draft');

    const filterQuery =
      'demoRole=CONTENT_ADMIN&keyword=deadline&part=5&difficulty=MEDIUM&tag=office&size=7&questionPreview=slow';
    await page.goto(`${base}/questions?${filterQuery}`);
    await listReady();
    await page.locator('a[href^="/questions/demo-q-017?"]').click();
    await page.locator('.qd-content').waitFor();
    const originalDetail = await page.locator('.qd-content').innerText();
    await page.getByRole('link', { name: 'Thử chỉnh sửa', exact: true }).click();
    await ready();
    await queryEquals(filterQuery);
    assert.match(await page.locator('#qf-stem').inputValue(), /expense reports/);
    assert.equal(await page.locator('#qf-difficulty').inputValue(), 'MEDIUM');
    assert.equal(await page.locator('input[name="qf-answer"]:checked').inputValue(), 'B');
    await page.locator('#qf-stem').fill('Changed copy only');
    await page.locator('input[name="qf-answer"][value="A"]').check();
    await submit();
    assert.equal(await page.locator('.qf-preview-stem').innerText(), 'Changed copy only');
    await shot('edit-preview', '.qf-preview-content');
    await page.getByRole('button', { name: 'Khôi phục bản mẫu', exact: true }).click();
    await focused('qf-stem');
    assert.match(await page.locator('#qf-stem').inputValue(), /expense reports/);
    assert.equal(await page.locator('input[name="qf-answer"]:checked').inputValue(), 'B');
    assert.equal(await page.locator('.qf-preview-content').count(), 0);
    await shot('edit-restored', '#qf-stem');
    await page.locator('#qf-option-B').fill('Transient copy');
    await page.reload();
    await ready();
    assert.equal(await page.locator('#qf-option-B').inputValue(), 'submit');
    await page.getByRole('link', { name: 'Xem bản gốc demo', exact: true }).click();
    await page.locator('.qd-content').waitFor();
    assert.equal(await page.locator('.qd-content').innerText(), originalDetail);
    await page.getByRole('link', { name: 'Thử chỉnh sửa', exact: true }).click();
    await ready();
    await page.getByRole('link', { name: '← Danh sách câu hỏi', exact: true }).click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.toString(), filterQuery);
    check(
      'Detail → edit copy → preview/reset/reload → original/list preserves every filter and original content',
    );

    await page.goto(`${base}/questions/demo-q-018?demoRole=CONTENT_ADMIN`);
    await page.locator('.qd-content').waitFor();
    assert.equal(await page.getByRole('link', { name: 'Thử chỉnh sửa', exact: true }).count(), 0);
    for (const [id, title] of [
      ['demo-q-018', 'Ngoài phạm vi chỉnh sửa demo'],
      ['demo-q-001', 'Ngoài phạm vi chỉnh sửa demo'],
      ['unknown', 'Không tìm thấy câu hỏi'],
    ]) {
      await page.goto(`${base}/questions/${id}/edit?demoRole=CONTENT_ADMIN`);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(await page.locator('form').count(), 0);
      await shot(id === 'unknown' ? 'not-found' : 'out-of-scope-' + id);
    }
    check('Only 017 links to editing; existing out-of-scope and unknown IDs have distinct panels');

    await page.goto(
      `${base}/questions/new?${filterQuery}&detailPreview=error&returnTo=https%3A%2F%2Fevil.test&random=x`,
    );
    await ready();
    await queryEquals(filterQuery);
    await page.locator('.qf-back a').first().click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.toString(), filterQuery);
    check(
      'Outbound links remove returnTo, detail tools and unknown params through existing allowlist',
    );

    for (const route of ['/questions/new', '/questions/demo-q-017/edit']) {
      await page.goto(`${base}${route}?demoRole=SYSTEM_ADMIN`);
      await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
      assert.equal(await page.locator('.question-form').count(), 0);
      assert.equal(await page.locator('form').count(), 0);
    }
    await shot('system-persona-panel');
    check('SYSTEM_ADMIN gets existing explanatory shell panel on both form routes');

    await page.goto(`${base}/questions/new?demoRole=CONTENT_ADMIN`);
    await ready();
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
      await menu.click();
      await page.keyboard.press('Escape');
      assert.equal(await menu.evaluate((el) => el === document.activeElement), true);
      assert.equal(await page.locator('dialog[open]').count(), 0);
    } else
      assert.equal(await page.locator('.cms-desktop-sidebar [aria-current="page"]').count(), 1);
    const storage = await page.evaluate(async () => ({
      local: localStorage.length,
      session: sessionStorage.length,
      databases: (await indexedDB.databases()).length,
    }));
    assert.deepEqual(storage, { local: 0, session: 0, databases: 0 });
    assert.deepEqual(await context.cookies(), []);
    check(
      'Form remains in question navigation; mobile Escape restores focus; all stores and cookies empty',
    );
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.forbiddenRequests, []);
  assert.deepEqual(report.httpErrors, []);
  assert.deepEqual(report.storageWrites, []);
  report.completed = true;
})()
  .catch((error) => {
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        completed: report.completed,
        checks: report.checks.length,
        screenshots: report.screenshots.length,
        failure: report.failure,
      }),
    );
  });
