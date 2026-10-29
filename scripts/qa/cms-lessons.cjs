// Read-only CMS lessons QA in isolated non-persistent contexts; no API interception.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT || path.resolve(__dirname, '../../docs/screenshots/cms-lessons-20261027');
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
    .locator('.lesson-list > li')
    .evaluateAll((items) => items.map((item) => item.dataset.lessonId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.lesson-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === undefined) return true;
    const current = Number(new URLSearchParams(location.search).get('page') || 1);
    return (
      document
        .querySelector('.lesson-result-status')
        ?.textContent.startsWith(`${expected} bài học`) &&
      document.querySelectorAll('.lesson-list > li').length ===
        Math.min(6, Math.max(0, expected - (current - 1) * 6))
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
        ['keyword', 'category'].map((key) => [
          key,
          form.querySelector(`#lesson-${key}`).value.trim(),
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
    ['keyword', 'category', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(18);
}
async function scenario(value) {
  const controls = page.locator('.lesson-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#lesson-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('lessonPreview') || 'normal') === value);
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
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    observe();
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN&lessonPreview=slow');
    await page.locator('.lesson-loading').waitFor();
    await page.locator('.lesson-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(18);
    await scenario('normal');
    await ready(18);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('filters');
    await page.locator('.lesson-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    assert.equal((await ids()).length, 6);
    assert.equal(await page.locator('.lesson-list button').count(), 0);
    assert.deepEqual(
      await page
        .locator('.lesson-list a')
        .evaluateAll((links) =>
          links.map((link) => link.closest('[data-lesson-id]').dataset.lessonId),
        ),
      ['demo-lesson-001', 'demo-lesson-002'],
    );
    assert.equal(await page.locator('.lesson-library input, .lesson-library select').count(), 3);
    assert.ok(!(await page.locator('.lesson-library').innerText()).includes('Full Lesson'));
    check(
      'Read-only 18-summary catalog, 6 per local page; only 001/002 detail links, no row actions',
    );

    await page.getByLabel('Từ khóa', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await focus('#lesson-category');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Áp dụng bộ lọc', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByLabel('Từ khóa', { exact: true }).fill('EMAIL');
    assert.equal((await ids()).length, 6);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'EMAIL');
    await ready(2);
    await focus('#lesson-keyword');
    await page.reload();
    await ready(2);
    assert.equal(await page.locator('#lesson-keyword').inputValue(), 'EMAIL');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'CONTENT_ADMIN');
    await page.getByLabel('Danh mục minh họa', { exact: true }).selectOption('Cấu trúc câu');
    await apply();
    await ready(1);
    assert.deepEqual(await ids(), ['demo-lesson-010']);
    await page.locator('.lesson-list').scrollIntoViewIfNeeded();
    await shot('combined-results');
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('combined-filters');
    await page.goBack();
    await ready(2);
    assert.equal(await page.locator('#lesson-category').inputValue(), '');
    await page.goForward();
    await ready(1);
    assert.equal(await page.locator('#lesson-category').inputValue(), 'Cấu trúc câu');
    check(
      'Labels/Tab/Enter; draft applies on submit; title+category AND, reload and Back/Forward preserve form/persona/results',
    );
    await clear();
    for (const category of ['Thì động từ', 'Từ loại', 'Cấu trúc câu', 'Liên kết ý']) {
      await page.locator('#lesson-category').selectOption(category);
      await apply();
      await ready(4);
    }
    await clear();
    assert.deepEqual(await ids(), [
      'demo-lesson-001',
      'demo-lesson-002',
      'demo-lesson-003',
      'demo-lesson-004',
      'demo-lesson-005',
      'demo-lesson-006',
    ]);
    await page.locator('.lesson-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(18);
    await focus('#lesson-results-title');
    assert.equal((await ids())[0], 'demo-lesson-007');
    await page.reload();
    await ready(18);
    assert.equal((await ids())[0], 'demo-lesson-007');
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(18);
    await page.goForward();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(18);
    await page.locator('#lesson-category').selectOption('Từ loại');
    await apply();
    await ready(4);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'All four categories, stable pagination, keyboard page focus, reload/Back/Forward, filter resets page',
    );

    await page.locator('#lesson-keyword').fill('no-such-lesson');
    await apply();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy bài học phù hợp', exact: true })
      .waitFor();
    await page.locator('.lesson-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await page.getByRole('button', { name: 'Xóa bộ lọc kết quả', exact: true }).click();
    await ready(18);
    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có bài học trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.lesson-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.locator('.lesson-state').scrollIntoViewIfNeeded();
    await shot('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ready(18);
    await focus('#lesson-results-title');
    await page.reload();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.locator('#lesson-keyword').fill('draft retained');
    await ready(18);
    await focus('#lesson-keyword');
    assert.equal(await page.locator('#lesson-keyword').inputValue(), 'draft retained');
    check(
      'No-match vs empty catalog, clear, simulated error/retry via Enter, reload repeats error; retry respects typing focus/draft',
    );
    await scenario('slow');
    await page.locator('.lesson-loading').waitFor();
    await page.locator('#lesson-keyword').fill('Mệnh đề quan hệ');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'Mệnh đề quan hệ');
    await ready(1);
    assert.deepEqual(await ids(), ['demo-lesson-010']);
    await focus('#lesson-keyword');
    check('Slow stale reads cancel without overwriting newer results or stealing input focus');

    await page.goto(
      base +
        '/lessons?demoRole=CONTENT_ADMIN&size=50&level=EASY&status=PUBLISHED&page=-1&lessonPreview=unknown',
    );
    await ready(18);
    for (const key of ['size', 'level', 'status', 'page', 'lessonPreview'])
      assert.equal(new URL(page.url()).searchParams.has(key), false);
    await page.goto(
      base +
        '/lessons?demoRole=CONTENT_ADMIN&keyword=a&keyword=b&category=x&category=y&page=2&page=3&lessonPreview=error&lessonPreview=empty',
    );
    await ready(18);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=CONTENT_ADMIN');
    await page.goto(
      base +
        '/lessons?demoRole=CONTENT_ADMIN&category=' +
        encodeURIComponent('Danh mục chưa biết & 日本語'),
    );
    await ready(0);
    assert.equal(
      await page.locator('#lesson-category').inputValue(),
      'Danh mục chưa biết & 日本語',
    );
    await page.reload();
    await ready(0);
    await clear();
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN&page=9007199254740991');
    await page.waitForURL(/page=3/);
    await ready(18);
    assert.equal((await ids())[0], 'demo-lesson-013');
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      (
        (await page.locator('[data-lesson-id="demo-lesson-018"]').innerText()).match(
          /Chưa có dữ liệu/g,
        ) || []
      ).length,
      2,
    );
    await page.locator('[data-lesson-id="demo-lesson-018"]').scrollIntoViewIfNeeded();
    await shot('missing-fields');
    check(
      'Unsafe/repeated/unsupported URL params normalize; unknown Unicode category remains no-match; huge page clamps; absent title/category stay missing',
    );

    await page.goto(
      base +
        '/lessons?demoRole=CONTENT_ADMIN&keyword=EMAIL&category=' +
        encodeURIComponent('Cấu trúc câu') +
        '&lessonPreview=error&page=99',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(1);
    assert.deepEqual(await ids(), ['demo-lesson-010']);
    await page.goto(
      base + '/lessons?demoRole=CONTENT_ADMIN&keyword=no-such-lesson&lessonPreview=error',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy bài học phù hợp', exact: true })
      .waitFor();
    check('Retry keeps current filters, survives page clamp and can recover to no-match');

    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.goBack();
    await page.waitForURL(
      (url) => url.pathname === '/lessons' && url.searchParams.get('demoRole') === 'CONTENT_ADMIN',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.goto(base + '/lessons?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.lesson-library').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check('Persona separation/switch/Back; no local/session storage, cookies or IndexedDB');
    await context.close();
    console.log('PASS lessons', width);
  }
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
