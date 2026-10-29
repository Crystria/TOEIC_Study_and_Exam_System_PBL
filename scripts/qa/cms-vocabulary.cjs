// Read-only CMS vocabulary QA in isolated non-persistent contexts; no API interception.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-vocabulary-20261027');
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
    .locator('.vocabulary-list > li')
    .evaluateAll((items) => items.map((item) => item.dataset.vocabularyId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.vocabulary-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === undefined) return true;
    const params = new URLSearchParams(location.search);
    return (
      document
        .querySelector('.vocabulary-result-status')
        ?.textContent.startsWith(`${expected} từ vựng`) &&
      document.querySelectorAll('.vocabulary-list > li').length ===
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
        ['keyword', 'topicId'].map((key) => [
          key,
          form.querySelector(`#vocabulary-${key === 'topicId' ? 'topic' : key}`).value.trim(),
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
    ['keyword', 'topicId', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(28);
}
async function scenario(value) {
  const controls = page.locator('.vocabulary-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#vocabulary-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('vocabularyPreview') || 'normal') === value);
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
    await page.goto(base + '/vocabulary?demoRole=CONTENT_ADMIN&vocabularyPreview=slow');
    await page.locator('.vocabulary-loading').waitFor();
    await page.locator('.vocabulary-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(28);
    await scenario('normal');
    await ready(28);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('filters');
    await page.locator('.vocabulary-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    assert.equal((await ids()).length, 20);
    assert.equal(
      await page
        .locator('.vocabulary-list button, .vocabulary-library audio, .vocabulary-library img')
        .count(),
      0,
    );
    assert.deepEqual(
      await page.locator('.vocabulary-list a').evaluateAll((links) =>
        links.map((link) => ({
          id: link.closest('li').dataset.vocabularyId,
          path: new URL(link.href).pathname,
        })),
      ),
      [
        { id: 'demo-vocabulary-001', path: '/vocabulary/demo-vocabulary-001' },
        { id: 'demo-vocabulary-002', path: '/vocabulary/demo-vocabulary-002' },
      ],
    );
    check(
      'Read-only 28-summary catalog; default 20; exact two detail links, no media/write actions',
    );

    await page.getByLabel('Từ khóa', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await focus('#vocabulary-topic');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Áp dụng bộ lọc', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator('#vocabulary-keyword').fill('BRIEF');
    assert.equal((await ids()).length, 20);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'BRIEF');
    await ready(1);
    await focus('#vocabulary-keyword');
    assert.deepEqual(await ids(), ['demo-vocabulary-002']);
    await page.reload();
    await ready(1);
    assert.equal(await page.locator('#vocabulary-keyword').inputValue(), 'BRIEF');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'CONTENT_ADMIN');
    await page.locator('#vocabulary-keyword').fill('BIÊN BẢN');
    await apply();
    await ready(1);
    assert.deepEqual(await ids(), ['demo-vocabulary-006']);
    await page.locator('#vocabulary-keyword').fill('HÀNG');
    await page.locator('#vocabulary-topic').selectOption('demo-topic-logistics');
    await apply();
    await ready(5);
    assert.deepEqual(await ids(), [
      'demo-vocabulary-007',
      'demo-vocabulary-009',
      'demo-vocabulary-010',
      'demo-vocabulary-011',
      'demo-vocabulary-012',
    ]);
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('combined-filters');
    await page.locator('.vocabulary-list').scrollIntoViewIfNeeded();
    await shot('combined-results');
    await page.goBack();
    await ready(1);
    assert.equal(await page.locator('#vocabulary-keyword').inputValue(), 'BIÊN BẢN');
    assert.equal(await page.locator('#vocabulary-topic').inputValue(), '');
    await page.goForward();
    await ready(5);
    assert.equal(await page.locator('#vocabulary-topic').inputValue(), 'demo-topic-logistics');
    check(
      'Associated labels/Tab/Enter; draft is not applied while typing; word OR meaning search AND topic; reload/Back/Forward',
    );
    await clear();
    for (const [topicId, total] of [
      ['demo-topic-office', 7],
      ['demo-topic-logistics', 6],
      ['demo-topic-finance', 6],
      ['demo-topic-events', 6],
    ]) {
      await page.locator('#vocabulary-topic').selectOption(topicId);
      await apply();
      await ready(total);
    }
    await clear();
    await page.getByLabel('Số từ mỗi trang', { exact: true }).selectOption('5');
    await page.waitForURL((url) => url.searchParams.get('size') === '5');
    await ready(28);
    assert.deepEqual(await ids(), [
      'demo-vocabulary-001',
      'demo-vocabulary-002',
      'demo-vocabulary-003',
      'demo-vocabulary-004',
      'demo-vocabulary-005',
    ]);
    await page.locator('.vocabulary-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(28);
    await focus('#vocabulary-results-title');
    assert.equal((await ids())[0], 'demo-vocabulary-006');
    await page.reload();
    await ready(28);
    assert.equal((await ids())[0], 'demo-vocabulary-006');
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(28);
    await page.goForward();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(28);
    await page.locator('#vocabulary-topic').selectOption('demo-topic-office');
    await apply();
    await ready(7);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'All topics; stable size/page results, keyboard pagination focus, reload/Back/Forward; filter resets page',
    );

    await page.locator('#vocabulary-keyword').fill('no-such-vocabulary');
    await apply();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy từ vựng phù hợp', exact: true })
      .waitFor();
    await page.locator('.vocabulary-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await page.getByRole('button', { name: 'Xóa bộ lọc kết quả', exact: true }).click();
    await ready(28);
    assert.equal(await page.locator('#vocabulary-size').inputValue(), '5');
    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có từ vựng trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.vocabulary-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.locator('.vocabulary-state').scrollIntoViewIfNeeded();
    await shot('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ready(28);
    await focus('#vocabulary-results-title');
    await page.reload();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.locator('#vocabulary-keyword').fill('draft retained');
    await ready(28);
    await focus('#vocabulary-keyword');
    assert.equal(await page.locator('#vocabulary-keyword').inputValue(), 'draft retained');
    check(
      'No-match differs from empty catalog; clear keeps size; error/retry/reload and focus respect input draft',
    );
    await scenario('slow');
    await page.locator('.vocabulary-loading').waitFor();
    await page.locator('#vocabulary-keyword').fill('reimbursement');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'reimbursement');
    await ready(1);
    assert.deepEqual(await ids(), ['demo-vocabulary-018']);
    await focus('#vocabulary-keyword');
    await clear();
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await page.locator('.vocabulary-loading').waitFor();
    await page.locator('#vocabulary-keyword').fill('draft during paging');
    await ready(28);
    await focus('#vocabulary-keyword');
    assert.equal(await page.locator('#vocabulary-keyword').inputValue(), 'draft during paging');
    check(
      'Slow stale reads cancel; typing focus/draft retained during query changes and pagination',
    );

    await page.goto(
      base +
        '/vocabulary?demoRole=CONTENT_ADMIN&size=51&page=-1&status=PUBLISHED&vocabularyPreview=wrong',
    );
    await ready(28);
    for (const key of ['page', 'size', 'status', 'vocabularyPreview'])
      assert.equal(new URL(page.url()).searchParams.has(key), false);
    await page.goto(
      base +
        '/vocabulary?demoRole=CONTENT_ADMIN&keyword=a&keyword=b&topicId=x&topicId=y&page=2&page=3&size=5&size=10&vocabularyPreview=error&vocabularyPreview=empty',
    );
    await ready(28);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=CONTENT_ADMIN');
    const unknown = 'không tồn tại & 日本語';
    await page.goto(
      base + '/vocabulary?demoRole=CONTENT_ADMIN&topicId=' + encodeURIComponent(unknown),
    );
    await ready(0);
    assert.equal(await page.locator('#vocabulary-topic').inputValue(), unknown);
    assert.ok(
      (await page.locator('#vocabulary-topic option:checked').innerText()).includes(
        'Chủ đề không có trong bộ demo',
      ),
    );
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('unknown-topic');
    await page.reload();
    await ready(0);
    await clear();
    await page.goto(base + '/vocabulary?demoRole=CONTENT_ADMIN&size=3&page=9007199254740991');
    await page.waitForURL((url) => url.searchParams.get('page') === '10');
    await ready(28);
    assert.deepEqual(await ids(), ['demo-vocabulary-028']);
    assert.equal(await page.locator('#vocabulary-size').inputValue(), '3');
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      (
        (await page.locator('[data-vocabulary-id="demo-vocabulary-028"]').innerText()).match(
          /Chưa có dữ liệu/g,
        ) || []
      ).length,
      4,
    );
    await page.locator('[data-vocabulary-id="demo-vocabulary-028"]').scrollIntoViewIfNeeded();
    await shot('missing-fields');
    await page.goto(base + '/vocabulary?demoRole=CONTENT_ADMIN&keyword=contingency');
    await ready(1);
    const row = page.locator('[data-vocabulary-id="demo-vocabulary-025"]');
    assert.equal(((await row.innerText()).match(/Chưa có dữ liệu/g) || []).length, 1);
    await row.scrollIntoViewIfNeeded();
    await shot('missing-topic');
    check(
      'Malformed/repeated URL; arbitrary string topicId is visible no-match; size=3 and huge page clamp; missing metadata/topic is not inferred or treated as unknown filter',
    );

    await page.goto(
      base +
        '/vocabulary?demoRole=CONTENT_ADMIN&keyword=H%C3%80NG&topicId=demo-topic-logistics&vocabularyPreview=error&page=99',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(5);
    assert.equal(await page.locator('#vocabulary-topic').inputValue(), 'demo-topic-logistics');
    await page.goto(
      base + '/vocabulary?demoRole=CONTENT_ADMIN&topicId=unknown&vocabularyPreview=error',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy từ vựng phù hợp', exact: true })
      .waitFor();
    check('Retry keeps keyword/topic, survives page clamp and may recover to no-match');

    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.goBack();
    await page.waitForURL(
      (url) =>
        url.pathname === '/vocabulary' && url.searchParams.get('demoRole') === 'CONTENT_ADMIN',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.goto(base + '/vocabulary?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.vocabulary-library').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check('Persona switch/Back/separation; no local/session storage, cookies or IndexedDB');
    await context.close();
    console.log('PASS vocabulary', width);
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
