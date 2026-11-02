const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-questions-20261027');
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
const report = {
  base,
  checks: [],
  screenshots: [],
  errors: [],
  forbiddenRequests: [],
  httpErrors: [],
};
let browser, page;
fs.mkdirSync(out, { recursive: true });
const check = (name) => report.checks.push({ name, viewport: page.viewportSize() });
const ids = () =>
  page
    .locator('.question-list > li')
    .evaluateAll((items) => items.map((item) => item.dataset.questionId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.question-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === null) return true;
    const params = new URLSearchParams(location.search);
    const size = Number(params.get('size') || 20);
    const pageNumber = Number(params.get('page') || 1);
    const count = document.querySelectorAll('.question-list > li').length;
    return (
      document
        .querySelector('.question-result-status')
        ?.textContent.startsWith(`${expected} câu hỏi`) &&
      count === Math.min(size, Math.max(0, expected - (pageNumber - 1) * size))
    );
  }, total ?? null);
  if (total !== undefined)
    assert.match(
      await page.locator('.question-result-status').innerText(),
      new RegExp(`^${total} câu hỏi`),
    );
}
async function focus(selector) {
  assert.equal(
    await page.locator(selector).evaluate((el) => el === document.activeElement),
    true,
    selector + ' focus',
  );
}
async function shot(name) {
  const viewport = page.viewportSize();
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.equal(geometry.width, viewport.width);
  assert.equal(geometry.height, viewport.height);
  assert.ok(geometry.scroll <= geometry.client, JSON.stringify(geometry));
  const file = `${name}-${viewport.width}.png`;
  const png = await page.screenshot({ path: path.join(out, file), fullPage: false });
  assert.equal(png.readUInt32BE(16), viewport.width);
  assert.equal(png.readUInt32BE(20), viewport.height);
  report.screenshots.push({ file, viewport, geometry });
}
async function apply() {
  const expected = await page
    .locator('form')
    .evaluate((form) =>
      Object.fromEntries(
        ['keyword', 'part', 'difficulty', 'tag'].map((key) => [
          key,
          form.querySelector(`#question-${key}`).value.trim(),
        ]),
      ),
    );
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await page.waitForFunction((fields) => {
    const params = new URLSearchParams(location.search);
    return (
      Object.entries(fields).every(([key, value]) => (params.get(key) || '') === value) &&
      !params.has('page')
    );
  }, expected);
  await ready();
}
async function clear() {
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await page.waitForURL((url) =>
    ['keyword', 'part', 'difficulty', 'tag', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(28);
}
async function scenario(value) {
  const disclosure = page.locator('.question-preview-controls');
  if ((await disclosure.getAttribute('open')) === null) await disclosure.locator('summary').click();
  await page.locator('#question-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('questionPreview') || 'normal') === value);
}
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  report.browser = browser.version();
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push(e.message));
    page.on('request', (r) => {
      if (
        /\/api\/|localhost:3000/.test(r.url()) ||
        r.method() !== 'GET' ||
        r.headers().authorization
      )
        report.forbiddenRequests.push({ url: r.url(), method: r.method() });
    });
    page.on('response', (r) => {
      if (r.status() >= 400) report.httpErrors.push({ url: r.url(), status: r.status() });
    });
    await page.goto(base + '/questions?demoRole=CONTENT_ADMIN&questionPreview=slow');
    await page.locator('.question-loading').waitFor();
    await page.locator('.question-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(28);
    assert.equal((await ids()).length, 20);
    await scenario('normal');
    await ready(28);
    await page.locator('.question-preview-controls summary').click();
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    await page.locator('.question-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    await page.locator('.question-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    check('Initial loading, ready list, 28 demo records and 20-row default');

    await page.locator('#question-keyword').fill('RELOCATION');
    await focus('#question-keyword');
    assert.equal(new URL(page.url()).searchParams.has('keyword'), false);
    await page.keyboard.press('Enter');
    await ready(1);
    await focus('#question-keyword');
    assert.deepEqual(await ids(), ['demo-q-009']);
    await page.reload();
    await ready(1);
    assert.equal(await page.locator('#question-keyword').inputValue(), 'RELOCATION');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'CONTENT_ADMIN');
    check(
      'Search in explanation, case-insensitive; explicit Enter apply keeps focus; reload retains query',
    );

    await clear();
    for (const part of [1, 2, 3, 4, 5, 6, 7]) {
      await page.locator('#question-part').selectOption(String(part));
      await apply();
      await ready(4);
      assert.deepEqual(
        await page.locator('.question-part strong').allTextContents(),
        Array(4).fill(`Part ${part}`),
      );
    }
    await page.locator('#question-part').selectOption('5');
    await page.locator('#question-difficulty').selectOption('EASY');
    await page.locator('#question-tag').fill('recruitment');
    await apply();
    assert.deepEqual(await ids(), ['demo-q-019']);
    const combinedUrl = page.url();
    await page.goBack();
    await page.waitForURL(
      (url) => url.searchParams.get('part') === '7' && !url.searchParams.has('tag'),
    );
    await ready(4);
    assert.equal(await page.locator('#question-part').inputValue(), '7');
    assert.equal(await page.locator('#question-difficulty').inputValue(), '');
    assert.equal(await page.locator('#question-tag').inputValue(), '');
    await page.goForward();
    await page.waitForURL(combinedUrl);
    await ready(1);
    assert.equal(await page.locator('#question-part').inputValue(), '5');
    assert.equal(await page.locator('#question-difficulty').inputValue(), 'EASY');
    assert.equal(await page.locator('#question-tag').inputValue(), 'recruitment');
    await page.locator('.question-results-header').scrollIntoViewIfNeeded();
    await shot('combined-filters');
    check(
      'All seven Parts and intersected filters produce expected records; Back/Forward restore applied filter fields',
    );

    await clear();
    await page.locator('#question-size').selectOption('5');
    await page.waitForURL((url) => url.searchParams.get('size') === '5');
    await ready(28);
    assert.deepEqual(
      await ids(),
      [1, 2, 3, 4, 5].map((n) => `demo-q-${String(n).padStart(3, '0')}`),
    );
    const firstPage = page.url();
    const next = page.getByRole('button', { name: 'Trang sau', exact: true });
    await next.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/page=2/);
    await ready(28);
    await focus('#question-results-title');
    assert.deepEqual(
      await ids(),
      [6, 7, 8, 9, 10].map((n) => `demo-q-${String(n).padStart(3, '0')}`),
    );
    await page.reload();
    await ready(28);
    assert.equal(await page.locator('#question-size').inputValue(), '5');
    await page.goBack();
    await page.waitForURL(firstPage);
    await ready(28);
    assert.equal((await ids())[0], 'demo-q-001');
    await page.goForward();
    await page.waitForURL(/page=2/);
    await ready(28);
    assert.equal((await ids())[0], 'demo-q-006');
    await page.locator('#question-keyword').fill('zz-no-such-question');
    await apply();
    await ready(0);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    await page
      .getByRole('heading', { name: 'Không tìm thấy câu hỏi phù hợp', exact: true })
      .waitFor();
    await page.locator('.question-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await page.getByRole('button', { name: 'Xóa bộ lọc kết quả', exact: true }).click();
    await ready(28);
    check(
      'Pagination size/page, keyboard focus, Back/Forward/reload, reset page on apply, no-match and clear',
    );

    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có câu hỏi trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.question-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.locator('.question-state').scrollIntoViewIfNeeded();
    await shot('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ready(28);
    await focus('#question-results-title');
    await page.reload();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.locator('#question-keyword').fill('draft kept while loading');
    await ready(28);
    await focus('#question-keyword');
    assert.equal(await page.locator('#question-keyword').inputValue(), 'draft kept while loading');
    check(
      'Empty catalog differs from no-match; controlled error/retry and reload; retry preserves user-moved focus and draft',
    );

    await scenario('slow');
    await page.locator('.question-loading').waitFor();
    await page.locator('#question-keyword').fill('refund');
    await page.keyboard.press('Enter');
    await ready(1);
    await focus('#question-keyword');
    assert.deepEqual(await ids(), ['demo-q-020']);
    check('Changing query during slow load cancels stale request and retains typing focus');

    await page.goto(
      base +
        '/questions?demoRole=CONTENT_ADMIN&part=99&difficulty=BOGUS&size=51&page=-1&tag=not-a-fixture&questionPreview=unknown',
    );
    await ready(0);
    assert.equal(await page.locator('#question-part').inputValue(), '');
    assert.equal(await page.locator('#question-difficulty').inputValue(), '');
    assert.equal(await page.locator('#question-size').inputValue(), '20');
    assert.equal(await page.locator('#question-tag').inputValue(), 'not-a-fixture');
    assert.equal(new URL(page.url()).searchParams.get('tag'), 'not-a-fixture');
    await page.goto(base + '/questions?demoRole=CONTENT_ADMIN&size=3&page=999999');
    await page.waitForURL(/page=10/);
    await ready(28);
    assert.equal((await ids()).length, 1);
    assert.equal(await page.locator('#question-size').inputValue(), '3');
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    await page.goto(base + '/questions?demoRole=CONTENT_ADMIN&part=1&part=2&page=2&page=3');
    await ready(28);
    assert.equal(await page.locator('#question-part').inputValue(), '');
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'Invalid/repeated URL params normalize; unknown tag stays valid; custom size and out-of-range page clamp',
    );

    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.getByRole('heading', { name: 'Người dùng & vai trò', exact: true }).waitFor();
    await page.goBack();
    await page.waitForURL(
      (url) =>
        url.pathname === '/questions' && url.searchParams.get('demoRole') === 'CONTENT_ADMIN',
    );
    await ready(28);
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    await page.goto(base + '/questions?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.question-library').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check(
      'Existing role switch/Back and cross-role explanation retained; storage/cookies/IndexedDB empty',
    );
    await context.close();
    console.log('PASS questions', width);
  }
  const c = await browser.newContext({
    viewport: { width: 320, height: 900 },
    deviceScaleFactor: 1,
  });
  page = await c.newPage();
  await page.goto(base + '/questions?demoRole=CONTENT_ADMIN&size=5');
  await ready(28);
  await shot('list');
  await page.locator('.question-list').scrollIntoViewIfNeeded();
  await shot('cards');
  await page.locator('.question-pagination').scrollIntoViewIfNeeded();
  await shot('pagination');
  check('320px form/cards/pagination viewport without horizontal overflow');
  await c.close();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.forbiddenRequests, []);
  assert.deepEqual(report.httpErrors, []);
  report.completed = true;
})()
  .catch(async (e) => {
    report.failure = e.stack;
    process.exitCode = 1;
    console.error(e);
    if (page && !page.isClosed())
      await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  });
