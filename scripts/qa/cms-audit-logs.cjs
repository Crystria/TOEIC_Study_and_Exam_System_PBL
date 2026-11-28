// Read-only CMS audit logs QA in isolated non-persistent contexts; no API interception.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-audit-logs-20261028');
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
    .locator('.audit-list > li')
    .evaluateAll((items) => items.map((item) => item.dataset.auditId));
async function ready(total) {
  await page.waitForFunction((expected) => {
    if (document.querySelector('.audit-results')?.getAttribute('aria-busy') !== 'false')
      return false;
    if (expected === undefined) return true;
    const params = new URLSearchParams(location.search);
    return (
      document
        .querySelector('.audit-result-status')
        ?.textContent.startsWith(`${expected} bản ghi`) &&
      document.querySelectorAll('.audit-list > li').length ===
        Math.min(
          Number(params.get('size') || 6),
          Math.max(
            0,
            expected - (Number(params.get('page') || 1) - 1) * Number(params.get('size') || 6),
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
        ['keyword', 'action'].map((key) => [key, form.querySelector(`#audit-${key}`).value.trim()]),
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
    ['keyword', 'action', 'page'].every((key) => !url.searchParams.has(key)),
  );
  await ready(18);
}
async function scenario(value) {
  const controls = page.locator('.audit-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#audit-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('auditPreview') || 'normal') === value);
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
    async function writesAbsent() {
      if (page.url().startsWith(base))
        assert.deepEqual(await page.evaluate(() => window.__cmsStorageWrites), []);
    }
    const visit = async (url) => {
      await writesAbsent();
      await page.goto(url);
    };
    const go = (query = '') => visit(base + '/audit-logs?demoRole=SYSTEM_ADMIN' + query);
    const reload = async () => {
      await writesAbsent();
      await page.reload();
    };
    const retry = () => page.getByRole('button', { name: 'Thử lại dữ liệu demo', exact: true });
    const row = (n) => page.locator(`[data-audit-id="demo-audit-${String(n).padStart(3, '0')}"]`);
    await go('&auditPreview=slow');
    await page.locator('.audit-loading').waitFor();
    await page.locator('.audit-results-header').scrollIntoViewIfNeeded();
    await shot('loading');
    await ready(18);
    await scenario('normal');
    await ready(18);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('list');
    // Capture the entire filter form and both actions in each actual viewport.
    await page.locator('form').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const formBox = await page.locator('form').boundingBox();
    assert.ok(formBox.y >= 0 && formBox.y + formBox.height <= 900, JSON.stringify(formBox));
    await shot('complete-filter-controls');
    await page.locator('.audit-list > li').first().scrollIntoViewIfNeeded();
    await shot('rows');
    assert.equal((await ids()).length, 6);
    assert.equal(
      await page.locator('.audit-list a,.audit-list button,.audit-list input').count(),
      0,
    );
    assert.match(await row(1).innerText(), /USER_LOGIN/);
    assert.match(await row(1).innerText(), /17:50:00/);
    assert.equal(await row(1).locator('time').getAttribute('datetime'), '2026-10-28T10:50:00Z');
    const initialTimes = await page.locator('.audit-list time').allTextContents();
    await reload();
    await ready(18);
    assert.deepEqual(await page.locator('.audit-list time').allTextContents(), initialTimes);
    assert.match(await page.locator('.audit-pagination-note').innerText(), /UTC\+07:00/);
    for (const selector of ['#audit-actor', '#audit-target', '#audit-severity', '#audit-outcome'])
      assert.equal(await page.locator(selector).count(), 0);
    check(
      '18 read-only fictional records; no inferred actor/target/outcome, no raw payload, deterministic time zone',
    );

    await page.getByLabel('Từ khóa', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await focus('#audit-action');
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByRole('button', { name: 'Áp dụng bộ lọc', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator('#audit-keyword').fill('DEMO-AUDIT-USER-001');
    assert.equal((await ids()).length, 6);
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.searchParams.get('keyword') === 'DEMO-AUDIT-USER-001');
    await ready(4);
    await focus('#audit-keyword');
    assert.deepEqual(await ids(), [
      'demo-audit-001',
      'demo-audit-005',
      'demo-audit-009',
      'demo-audit-013',
    ]);
    await page.locator('#audit-action').selectOption('USER_REGISTERED');
    await apply();
    await ready(1);
    assert.deepEqual(await ids(), ['demo-audit-009']);
    await page.locator('form').scrollIntoViewIfNeeded();
    await shot('combined-filters');
    await page.locator('.audit-list').scrollIntoViewIfNeeded();
    await shot('combined-results');
    await page.goBack();
    await ready(4);
    assert.equal(await page.locator('#audit-action').inputValue(), '');
    await page.goForward();
    await ready(1);
    assert.equal(await page.locator('#audit-action').inputValue(), 'USER_REGISTERED');
    await reload();
    await ready(1);
    assert.equal(await page.locator('#audit-keyword').inputValue(), 'DEMO-AUDIT-USER-001');
    assert.equal(new URL(page.url()).searchParams.get('demoRole'), 'SYSTEM_ADMIN');
    check(
      'Label/Tab/Enter; draft applies on submit; literal ID search AND exact action; Back/Forward/reload',
    );

    await clear();
    for (const [action, total] of [
      ['USER_LOGIN', 11],
      ['USER_REGISTERED', 5],
    ]) {
      await page.locator('#audit-action').selectOption(action);
      await apply();
      await ready(total);
    }
    await clear();
    await page.locator('#audit-size').selectOption('12');
    await page.waitForURL((u) => u.searchParams.get('size') === '12');
    await ready(18);
    assert.equal((await ids()).length, 12);
    assert.equal(
      await page.getByRole('button', { name: 'Trang trước', exact: true }).isDisabled(),
      true,
    );
    await page.locator('.audit-pagination').scrollIntoViewIfNeeded();
    await shot('pagination');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.searchParams.get('page') === '2');
    await ready(18);
    await focus('#audit-results-title');
    assert.equal((await ids())[0], 'demo-audit-013');
    assert.equal(
      await page.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(),
      true,
    );
    await reload();
    await ready(18);
    assert.equal((await ids())[0], 'demo-audit-013');
    await page.goBack();
    await page.waitForURL((u) => !u.searchParams.has('page'));
    await ready(18);
    await page.goForward();
    await page.waitForURL((u) => u.searchParams.get('page') === '2');
    await ready(18);
    await page.locator('#audit-action').selectOption('USER_LOGIN');
    await apply();
    await ready(11);
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'Fixture string filters, local size choices, same-dataset count/paging, boundaries and keyboard focus/history',
    );

    await page.locator('#audit-keyword').fill('no-such-record');
    await apply();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy nhật ký phù hợp', exact: true })
      .waitFor();
    await page.locator('.audit-state').scrollIntoViewIfNeeded();
    await shot('no-match');
    await page.getByRole('button', { name: 'Xóa bộ lọc kết quả', exact: true }).click();
    await ready(18);
    assert.equal(await page.locator('#audit-size').inputValue(), '12');
    await scenario('empty');
    await ready(0);
    await page
      .getByRole('heading', { name: 'Chưa có nhật ký trong bộ demo', exact: true })
      .waitFor();
    await page.locator('.audit-state').scrollIntoViewIfNeeded();
    await shot('empty-catalog');
    await scenario('error');
    await retry().waitFor();
    await page.locator('.audit-state').scrollIntoViewIfNeeded();
    await shot('error');
    await retry().focus();
    await page.keyboard.press('Enter');
    await ready(18);
    await focus('#audit-results-title');
    await reload();
    await retry().click();
    await page.locator('#audit-keyword').fill('draft retained');
    await ready(18);
    await focus('#audit-keyword');
    assert.equal(await page.locator('#audit-keyword').inputValue(), 'draft retained');
    check(
      'Loading/catalog empty/no-match/error are distinct; retry keeps query, reload repeats error; typing focus retained',
    );

    await scenario('slow');
    await page.locator('.audit-loading').waitFor();
    await page.locator('#audit-keyword').fill('demo-audit-014');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.searchParams.get('keyword') === 'demo-audit-014');
    await ready(1);
    assert.deepEqual(await ids(), ['demo-audit-014']);
    await focus('#audit-keyword');
    // Wait beyond the superseded read's deadline before asserting no overwrite.
    await page.waitForTimeout(1500);
    assert.deepEqual(await ids(), ['demo-audit-014']);
    await clear();
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await page.waitForURL((u) => u.searchParams.get('page') === '2');
    await page.locator('.audit-loading').waitFor();
    await page.locator('#audit-keyword').fill('draft during paging');
    await ready(18);
    await focus('#audit-keyword');
    assert.equal(await page.locator('#audit-keyword').inputValue(), 'draft during paging');
    check('Superseded reads abort; no late overwrite; paging retains typing focus and draft');

    await go('&size=50&page=-1&actor=demo&targetType=user&auditPreview=wrong');
    await ready(18);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=SYSTEM_ADMIN');
    await go(
      '&keyword=a&keyword=b&action=USER_LOGIN&action=USER_REGISTERED&page=2&page=3&size=12&size=24&auditPreview=error&auditPreview=empty',
    );
    await ready(18);
    assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=SYSTEM_ADMIN');
    await go('&action=' + encodeURIComponent('UNKNOWN & <demo>'));
    await ready(0);
    assert.equal(await page.locator('#audit-action').inputValue(), 'UNKNOWN & <demo>');
    assert.match(await page.locator('#audit-action').innerText(), /Mã ngoài bộ demo/);
    await reload();
    await ready(0);
    assert.equal(await page.locator('#audit-action').inputValue(), 'UNKNOWN & <demo>');
    const keyword = 'không tồn tại & 日本語';
    await go('&keyword=' + encodeURIComponent(keyword));
    await ready(0);
    await reload();
    await ready(0);
    assert.equal(await page.locator('#audit-keyword').inputValue(), keyword);
    await go('&page=9007199254740991');
    await page.waitForURL((u) => u.searchParams.get('page') === '3');
    await ready(18);
    assert.deepEqual(
      await ids(),
      [13, 14, 15, 16, 17, 18].map((n) => 'demo-audit-' + String(n).padStart(3, '0')),
    );
    assert.match(await row(15).innerText(), /Chưa có dữ liệu/);
    assert.equal(((await row(16).innerText()).match(/Chưa có dữ liệu/g) || []).length, 2);
    assert.equal(((await row(18).innerText()).match(/Chưa có dữ liệu/g) || []).length, 5);
    await row(15).scrollIntoViewIfNeeded();
    await shot('missing-related-user');
    await row(16).scrollIntoViewIfNeeded();
    await shot('missing-target');
    await row(17).scrollIntoViewIfNeeded();
    await shot('long-action-ids-summary');
    await row(18).scrollIntoViewIfNeeded();
    await shot('missing-fields');
    check(
      'Invalid/repeated/unsupported URL safely normalizes; open unknown action no-match; huge page clamp, long and missing fields',
    );

    await go('&keyword=demo-audit-user-001&action=USER_REGISTERED&auditPreview=error&page=99');
    await retry().click();
    await page.waitForURL((u) => !u.searchParams.has('page'));
    await ready(1);
    assert.deepEqual(await ids(), ['demo-audit-009']);
    assert.equal(await page.locator('#audit-action').inputValue(), 'USER_REGISTERED');
    await go('&keyword=absent&action=USER_LOGIN&auditPreview=error');
    await retry().click();
    await ready(0);
    await page
      .getByRole('heading', { name: 'Không tìm thấy nhật ký phù hợp', exact: true })
      .waitFor();
    check('Retry preserves filters and recovers after page clamp or to no-match');

    await page.locator('#cms-demo-role').selectOption('CONTENT_ADMIN');
    await page.waitForURL('**/questions?demoRole=CONTENT_ADMIN');
    await page.goBack();
    await page.waitForURL(
      (u) => u.pathname === '/audit-logs' && u.searchParams.get('demoRole') === 'SYSTEM_ADMIN',
    );
    await retry().waitFor();
    for (const suffix of [
      '?demoRole=CONTENT_ADMIN',
      '?demoRole=INVALID',
      '?demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN',
      '',
    ]) {
      await visit(base + '/audit-logs' + suffix);
      await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
      assert.equal(await page.locator('.audit-library').count(), 0);
      if (suffix.includes('&demoRole='))
        assert.equal(new URL(page.url()).searchParams.toString(), 'demoRole=CONTENT_ADMIN');
      if (suffix === '?demoRole=CONTENT_ADMIN') await shot('content-persona-panel');
    }
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    await writesAbsent();
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check(
      'SYSTEM_ADMIN list; shell CONTENT_ADMIN/default/invalid/duplicate panels; persona history; no storage writes/cookies/IndexedDB',
    );
    await context.close();
    console.log('PASS audit logs', width);
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
