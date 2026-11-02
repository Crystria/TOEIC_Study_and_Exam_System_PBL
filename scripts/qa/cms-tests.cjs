// Read-only CMS tests QA in isolated non-persistent contexts; no API interception.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT || path.resolve(__dirname, '../../docs/screenshots/cms-tests-20261027');
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
  page.locator('.test-list > li').evaluateAll((items) => items.map((item) => item.dataset.testId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.test-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === undefined) return true;
    const params = new URLSearchParams(location.search);
    return (
      document.querySelector('.test-result-status')?.textContent.startsWith(`${expected} đề thi`) &&
      document.querySelectorAll('.test-list > li').length ===
        Math.min(
          Number(params.get('size') || 20),
          Math.max(
            0,
            expected - (Number(params.get('page') || 1) - 1) * Number(params.get('size') || 20),
          ),
        )
    );
  }, total);
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
        ['keyword', 'type', 'status'].map((key) => [
          key,
          form.querySelector(`#test-${key}`).value.trim(),
        ]),
      ),
    );
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await page.waitForURL(
    (url) =>
      Object.entries(expected).every(
        ([key, value]) => (url.searchParams.get(key) || '') === value,
      ) && !url.searchParams.has('page'),
  );
  await ready();
}
async function clear() {
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await page.waitForURL((url) =>
    ['keyword', 'type', 'status', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(24);
}
async function scenario(value) {
  const controls = page.locator('.test-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#test-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('testPreview') || 'normal') === value);
}
function observe() {
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (
      url.origin !== new URL(base).origin ||
      /\/api\//.test(url.pathname) ||
      r.method() !== 'GET' ||
      r.headers().authorization
    )
      report.forbiddenRequests.push({ url: r.url(), method: r.method() });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) report.httpErrors.push({ url: r.url(), status: r.status() });
  });
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
    observe();
    await page.goto(base + '/tests?demoRole=CONTENT_ADMIN&testPreview=slow');
    await page.locator('.test-loading').waitFor();
    await page.locator('.test-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(24);
    await scenario('normal');
    await ready(24);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    await page.locator('.test-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    assert.equal((await ids()).length, 20);
    assert.equal(await page.locator('.test-list button').count(), 0);
    assert.equal(await page.locator('.test-list a').count(), 2);
    for (const id of ['demo-test-001', 'demo-test-002']) {
      assert.match(
        await page.locator(`[data-test-id="${id}"] a`).getAttribute('href'),
        new RegExp(`^/tests/${id}\\?`),
      );
    }
    assert.equal(await page.locator('[data-test-id="demo-test-003"] a').count(), 0);
    check(
      'Read-only catalog, 24 total, default 20, controlled loading; only two supported metadata links, no row actions',
    );

    await page.locator('#test-keyword').focus();
    await page.keyboard.press('Tab');
    await focus('#test-type');
    await page.keyboard.press('Tab');
    await focus('#test-status');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Áp dụng bộ lọc', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    check('Keyboard Tab follows keyword, type, status and apply; associated labels');
    await page.locator('#test-keyword').fill('GIAO TIẾP');
    assert.equal((await ids()).length, 20);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'GIAO TIẾP');
    await ready(2);
    await focus('#test-keyword');
    await page.reload();
    await ready(2);
    assert.equal(await page.locator('#test-keyword').inputValue(), 'GIAO TIẾP');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'CONTENT_ADMIN');
    await page.locator('#test-type').selectOption('MINI');
    await page.locator('#test-status').selectOption('PUBLISHED');
    await apply();
    await ready(1);
    assert.deepEqual(await ids(), ['demo-test-002']);
    await shot('combined-filters');
    await page.goBack();
    await ready(2);
    assert.equal(await page.locator('#test-status').inputValue(), '');
    await page.goForward();
    await ready(1);
    assert.equal(await page.locator('#test-status').inputValue(), 'PUBLISHED');
    check(
      'Title search applies on Enter, preserves focus/reload/persona; type+status+keyword AND and Back/Forward',
    );
    await clear();
    for (const type of ['FULL', 'MINI']) {
      await page.locator('#test-type').selectOption(type);
      await apply();
      await ready(12);
    }
    for (const [status, total] of [
      ['DRAFT', 4],
      ['PUBLISHED', 4],
      ['ARCHIVED', 3],
    ]) {
      await page.locator('#test-status').selectOption(status);
      await apply();
      await ready(total);
    }
    await clear();
    await page.locator('#test-size').selectOption('5');
    await page.waitForURL((url) => url.searchParams.get('size') === '5');
    await ready(24);
    assert.deepEqual(await ids(), [
      'demo-test-001',
      'demo-test-002',
      'demo-test-003',
      'demo-test-004',
      'demo-test-005',
    ]);
    await page.locator('.test-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(24);
    await focus('#test-results-title');
    assert.equal((await ids())[0], 'demo-test-006');
    await page.reload();
    await ready(24);
    assert.equal((await ids())[0], 'demo-test-006');
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(24);
    await page.goForward();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(24);
    await page.locator('#test-type').selectOption('FULL');
    await apply();
    await ready(12);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'All types/statuses; stable pagination; Enter transfers focus to results; reload/Back/Forward and filter resets page',
    );

    await page.locator('#test-keyword').fill('no-such-test');
    await apply();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy đề thi phù hợp', exact: true })
      .waitFor();
    await page.locator('.test-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await clear();
    assert.equal(await page.locator('#test-size').inputValue(), '5');
    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có đề thi trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.test-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.locator('.test-state').scrollIntoViewIfNeeded();
    await shot('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ready(24);
    await focus('#test-results-title');
    await page.reload();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.locator('#test-keyword').fill('draft retained');
    await ready(24);
    await focus('#test-keyword');
    assert.equal(await page.locator('#test-keyword').inputValue(), 'draft retained');
    check(
      'No-match differs from catalog empty; clear preserves size; error/retry/reload; retry respects user-moved focus and draft',
    );
    await scenario('slow');
    await page.locator('.test-loading').waitFor();
    await page.locator('#test-keyword').fill('Tuyển dụng');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'Tuyển dụng');
    await ready(1);
    assert.deepEqual(await ids(), ['demo-test-006']);
    await focus('#test-keyword');
    check('Stale slow reads cancel and typing focus is retained');

    await page.goto(
      base +
        '/tests?demoRole=CONTENT_ADMIN&type=FULL_TEST&status=ACTIVE&size=51&page=-1&testPreview=unknown',
    );
    await ready(24);
    assert.equal(await page.locator('#test-type').inputValue(), '');
    assert.equal(await page.locator('#test-status').inputValue(), '');
    assert.equal(await page.locator('#test-size').inputValue(), '20');
    await page.goto(base + '/tests?demoRole=CONTENT_ADMIN&type=FULL&type=MINI&page=2&page=3');
    await ready(24);
    assert.equal(await page.locator('#test-type').inputValue(), '');
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    await page.goto(base + '/tests?demoRole=CONTENT_ADMIN&size=3&page=9007199254740991');
    await page.waitForURL(/page=8/);
    await ready(24);
    assert.deepEqual(await ids(), ['demo-test-022', 'demo-test-023', 'demo-test-024']);
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      (
        (await page.locator('[data-test-id="demo-test-023"]').innerText()).match(
          /Chưa có dữ liệu/g,
        ) || []
      ).length,
      3,
    );
    await page.locator('[data-test-id="demo-test-023"]').scrollIntoViewIfNeeded();
    await shot('missing-metadata');
    check(
      'Malformed/repeated URLs; source size bounds and custom size=3; past-end page; absent duration/count/status never inferred',
    );

    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.goBack();
    await page.waitForURL(
      (url) => url.pathname === '/tests' && url.searchParams.get('demoRole') === 'CONTENT_ADMIN',
    );
    await ready(24);
    await page.goto(base + '/tests?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.test-library').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check(
      'Persona switch and Back preserved; SYSTEM_ADMIN sees shell explanation; storage/cookies/IndexedDB empty',
    );
    await context.close();
    console.log('PASS tests', width);
  }
  const context = await browser.newContext({
    viewport: { width: 320, height: 900 },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  observe();
  await page.goto(base + '/tests?demoRole=CONTENT_ADMIN&size=5');
  await ready(24);
  await shot('list');
  await page.locator('.test-list').scrollIntoViewIfNeeded();
  await shot('cards');
  await page.locator('.test-pagination').scrollIntoViewIfNeeded();
  await shot('pagination');
  check('320px form/cards/pagination without horizontal overflow');
  await context.close();
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
