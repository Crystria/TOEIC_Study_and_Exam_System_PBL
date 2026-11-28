// Read-only CMS users QA in isolated non-persistent contexts; no API interception.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT || path.resolve(__dirname, '../../docs/screenshots/cms-users-20261027');
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
  page.locator('.user-list > li').evaluateAll((items) => items.map((item) => item.dataset.userId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.user-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === undefined) return true;
    const params = new URLSearchParams(location.search);
    return (
      document
        .querySelector('.user-result-status')
        ?.textContent.startsWith(`${expected} người dùng`) &&
      document.querySelectorAll('.user-list > li').length ===
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
        ['keyword', 'status'].map((key) => [key, form.querySelector(`#user-${key}`).value.trim()]),
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
    ['keyword', 'status', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(28);
}
async function scenario(value) {
  const controls = page.locator('.user-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#user-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('userPreview') || 'normal') === value);
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
    // Observe writes without seeding or mocking data/auth/API.
    await context.addInitScript(() => {
      window.__cmsStorageWrites = [];
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.__cmsStorageWrites.push(method);
          return original.apply(this, args);
        };
      }
    });
    page = await context.newPage();
    observe();
    const go = async (query = '') => {
      // Capture instrumentation before a full document navigation resets it.
      if (page.url().startsWith(base))
        assert.deepEqual(await page.evaluate(() => window.__cmsStorageWrites), []);
      await page.goto(base + '/users?demoRole=SYSTEM_ADMIN' + query);
    };
    await go('&userPreview=slow');
    await page.locator('.user-loading').waitFor();
    await page.locator('.user-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(28);
    await scenario('normal');
    await ready(28);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('filters');
    await page.locator('.user-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    assert.equal((await ids()).length, 20);
    assert.equal(
      await page.locator('.user-list a, .user-list button, .user-list input').count(),
      0,
    );
    assert.equal(await page.locator('[data-user-id="demo-user-003"] .user-roles > li').count(), 1);
    assert.match(await page.locator('[data-user-id="demo-user-003"]').innerText(), /SYSTEM_ADMIN/);
    assert.doesNotMatch(
      await page.locator('[data-user-id="demo-user-003"]').innerText(),
      /CONTENT_ADMIN/,
    );
    assert.equal(await page.locator('[data-user-id="demo-user-005"] .user-roles > li').count(), 2);
    assert.equal(await page.locator('#user-role').count(), 0);
    check(
      'Read-only 28 fictional identities; default 20; no detail/actions or role inheritance/filter',
    );

    await page.getByLabel('Từ khóa', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await focus('#user-status');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Áp dụng bộ lọc', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator('#user-keyword').fill('MINH');
    assert.equal((await ids()).length, 20);
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'MINH');
    await ready(2);
    await focus('#user-keyword');
    assert.deepEqual(await ids(), ['demo-user-001', 'demo-user-005']);
    await page.reload();
    await ready(2);
    assert.equal(await page.locator('#user-keyword').inputValue(), 'MINH');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'SYSTEM_ADMIN');
    await page.locator('#user-status').selectOption('LOCKED');
    await apply();
    await ready(0);
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('combined-no-match');
    await page.goBack();
    await ready(2);
    assert.equal(await page.locator('#user-status').inputValue(), '');
    await page.goForward();
    await ready(0);
    assert.equal(await page.locator('#user-status').inputValue(), 'LOCKED');
    await page.locator('#user-keyword').fill('DEMO.USER02@');
    await apply();
    await ready(1);
    assert.deepEqual(await ids(), ['demo-user-002']);
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('combined-filters');
    await page.locator('.user-list').scrollIntoViewIfNeeded();
    await shot('combined-results');
    check(
      'Labels/Tab/Enter; draft waits for apply; name OR email with AND status; Back/Forward/reload',
    );

    await clear();
    for (const [status, total] of [
      ['ACTIVE', 7],
      ['LOCKED', 7],
      ['DISABLED', 6],
      ['PENDING', 6],
    ]) {
      await page.locator('#user-status').selectOption(status);
      await apply();
      await ready(total);
      assert.equal(await page.locator(`.user-status:not([data-status="${status}"])`).count(), 0);
    }
    await clear();
    await page.getByLabel('Số người mỗi trang', { exact: true }).selectOption('5');
    await page.waitForURL((url) => url.searchParams.get('size') === '5');
    await ready(28);
    assert.deepEqual(
      await ids(),
      [1, 2, 3, 4, 5].map((i) => 'demo-user-' + String(i).padStart(3, '0')),
    );
    assert.equal(
      await page.getByRole('button', { name: 'Trang trước', exact: true }).isDisabled(),
      true,
    );
    await page.locator('.user-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(28);
    await focus('#user-results-title');
    assert.equal((await ids())[0], 'demo-user-006');
    await page.reload();
    await ready(28);
    assert.equal((await ids())[0], 'demo-user-006');
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(28);
    await page.goForward();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await ready(28);
    await page.locator('#user-status').selectOption('ACTIVE');
    await apply();
    await ready(7);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'All source statuses, stable paging, boundaries, keyboard focus and history; filter resets page',
    );

    await page.locator('#user-keyword').fill('no-such-user');
    await apply();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy người dùng phù hợp', exact: true })
      .waitFor();
    await page.locator('.user-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await page.getByRole('button', { name: 'Xóa bộ lọc kết quả', exact: true }).click();
    await ready(28);
    assert.equal(await page.locator('#user-size').inputValue(), '5');
    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có người dùng trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.user-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    await page.locator('.user-state').scrollIntoViewIfNeeded();
    await shot('error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).focus();
    await page.keyboard.press('Enter');
    await ready(28);
    await focus('#user-results-title');
    await page.reload();
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.locator('#user-keyword').fill('draft retained');
    await ready(28);
    await focus('#user-keyword');
    assert.equal(await page.locator('#user-keyword').inputValue(), 'draft retained');
    check(
      'No-match/empty distinguishable; clear retains size; error/retry/reload; retry respects typing focus',
    );

    await scenario('slow');
    await page.locator('.user-loading').waitFor();
    await page.locator('#user-keyword').fill('DEMO.USER18@');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.searchParams.get('keyword') === 'DEMO.USER18@');
    await ready(1);
    assert.deepEqual(await ids(), ['demo-user-018']);
    await focus('#user-keyword');
    await clear();
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await page.waitForURL((url) => url.searchParams.get('page') === '2');
    await page.locator('.user-loading').waitFor();
    await page.locator('#user-keyword').fill('draft during paging');
    await ready(28);
    await focus('#user-keyword');
    assert.equal(await page.locator('#user-keyword').inputValue(), 'draft during paging');
    check('Stale slow reads cancel; typing focus and draft preserved during pagination');

    await go('&size=51&page=-1&role=USER&status=SUSPENDED&userPreview=wrong');
    await ready(28);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=SYSTEM_ADMIN');
    await go(
      '&keyword=a&keyword=b&status=ACTIVE&status=LOCKED&page=2&page=3&size=5&size=10&userPreview=error&userPreview=empty',
    );
    await ready(28);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=SYSTEM_ADMIN');
    const keyword = 'không tồn tại & 日本語';
    await go('&keyword=' + encodeURIComponent(keyword));
    await ready(0);
    await page.reload();
    await ready(0);
    assert.equal(await page.locator('#user-keyword').inputValue(), keyword);
    await go('&size=3&page=9007199254740991');
    await page.waitForURL((url) => url.searchParams.get('page') === '10');
    await ready(28);
    assert.deepEqual(await ids(), ['demo-user-028']);
    assert.equal(await page.locator('#user-size').inputValue(), '3');
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      (
        (await page.locator('[data-user-id="demo-user-028"]').innerText()).match(
          /Chưa có dữ liệu/g,
        ) || []
      ).length,
      4,
    );
    await page.locator('[data-user-id="demo-user-028"]').scrollIntoViewIfNeeded();
    await shot('missing-fields');
    await go('&size=3&page=9');
    await ready(28);
    assert.equal(await page.locator('[data-user-id="demo-user-025"] .user-roles > li').count(), 3);
    assert.equal(
      (
        (await page.locator('[data-user-id="demo-user-027"]').innerText()).match(
          /Chưa có dữ liệu/g,
        ) || []
      ).length,
      2,
    );
    await page.locator('[data-user-id="demo-user-025"]').scrollIntoViewIfNeeded();
    await shot('long-name-email-roles');
    await page.locator('[data-user-id="demo-user-027"]').scrollIntoViewIfNeeded();
    await shot('missing-roles-status');
    check(
      'Malformed/repeated/unsupported URL, invalid source enum, Unicode round trip, custom size, huge page, long name/email, multiple/missing roles/status',
    );

    await go('&keyword=MINH&status=ACTIVE&userPreview=error&page=99');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has('page'));
    await ready(2);
    assert.equal(await page.locator('#user-status').inputValue(), 'ACTIVE');
    assert.equal(await page.locator('#user-keyword').inputValue(), 'MINH');
    await go('&keyword=MINH&status=LOCKED&userPreview=error');
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).click();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy người dùng phù hợp', exact: true })
      .waitFor();
    check('Retry preserves query, survives clamp and recovers to no-match');

    await page.locator('#cms-demo-role').selectOption('CONTENT_ADMIN');
    await page.waitForURL('**/questions?demoRole=CONTENT_ADMIN');
    await page.goBack();
    await page.waitForURL(
      (url) => url.pathname === '/users' && url.searchParams.get('demoRole') === 'SYSTEM_ADMIN',
    );
    await page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__cmsStorageWrites), []);
    await page.goto(base + '/users?demoRole=CONTENT_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.user-library').count(), 0);
    await shot('content-persona-panel');
    await page.goto(base + '/users?demoRole=INVALID');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.user-library').count(), 0);
    await page.goto(base + '/users?demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=CONTENT_ADMIN');
    await page.goto(base + '/users');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.user-library').count(), 0);
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await page.evaluate(() => window.__cmsStorageWrites), []);
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check(
      'SYSTEM_ADMIN switch/Back; CONTENT_ADMIN/default/invalid/duplicate persona panels; storage writes absent',
    );
    await context.close();
    console.log('PASS users', width);
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
