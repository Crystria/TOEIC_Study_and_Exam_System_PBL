const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-test-detail-session21-20261028');
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
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
fs.mkdirSync(out, { recursive: true });
const check = (name) => {
  report.checks.push({ name, viewport: page.viewportSize() });
  console.log('CHECK', page.viewportSize().width, report.checks.length, name);
};
async function focus(selector) {
  assert.equal(
    await page.locator(selector).evaluate((el) => el === document.activeElement),
    true,
    selector + ' focus',
  );
}
async function ready(kind = 'found') {
  await page.waitForFunction(
    () => document.querySelector('.td-result')?.getAttribute('aria-busy') === 'false',
  );
  if (kind === 'found') await page.locator('.td-content').waitFor();
  const headings = {
    error: 'Chưa đọc được chi tiết demo',
    unsupported: 'Chưa có dữ liệu chi tiết demo',
    'not-found': 'Không tìm thấy đề thi',
  };
  if (headings[kind])
    await page.getByRole('heading', { name: headings[kind], exact: true }).waitFor();
}
async function shot(name, selector) {
  if (selector)
    await page.locator(selector).evaluate((el) => el.scrollIntoView({ block: 'center' }));
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
async function assertWrites() {
  if (page.url().startsWith(base)) {
    const writes = await page.evaluate(() => window.__cmsStorageWrites);
    report.storageWrites.push(...writes);
    assert.deepEqual(writes, []);
  }
}
async function visit(url) {
  await assertWrites();
  await page.goto(url);
}
const detail = (id = 'demo-test-001', suffix = '') =>
  visit(`${base}/tests/${encodeURIComponent(id)}?demoRole=CONTENT_ADMIN${suffix}`);
async function scenario(value) {
  const tool = page.locator('.td-preview');
  if ((await tool.getAttribute('open')) === null) await tool.locator('summary').click();
  await page.locator('#td-preview').selectOption(value);
  await page.waitForURL((u) => (u.searchParams.get('detailPreview') || 'normal') === value);
}
const retry = () => page.getByRole('button', { name: 'Thử lại chi tiết demo', exact: true });
async function listReady() {
  await page.waitForFunction(
    () => document.querySelector('.test-results')?.getAttribute('aria-busy') === 'false',
  );
}
async function metadata(expected) {
  assert.deepEqual(await page.locator('.td-metadata dd').allTextContents(), expected);
  assert.equal(await page.locator('.td-content button,.td-content input,.td-content a').count(), 0);
  assert.match(await page.locator('.td-content').innerText(), /không xác nhận đề đã được lắp đủ/);
  assert.match(await page.locator('.td-content').innerText(), /từ vựng trong source/);
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

    await detail('demo-test-001', '&detailPreview=slow');
    await page.locator('.td-loading').waitFor();
    assert.match(await page.locator('.td-status').innerText(), /Đang đọc/);
    await shot('loading', '.td-result');
    await ready();
    await scenario('normal');
    await ready();
    await metadata([
      'TOEIC tổng hợp · Bộ đề 01',
      'Full Test',
      '120 phút',
      '200 câu',
      'Bản nháp (DRAFT)',
    ]);
    await page.evaluate(() => scrollTo(0, 0));
    await shot('detail-full');
    await shot('metadata-full', '.td-content');
    await shot('state-tool', '.td-preview');
    const toolBox = await page.locator('.td-preview').boundingBox();
    assert.ok(toolBox.y >= 0 && toolBox.y + toolBox.height <= 900, JSON.stringify(toolBox));
    assert.equal(
      await page
        .locator('main')
        .getByRole('button', { name: /tạo|sửa|xóa|nhân bản|publish|xuất bản|export|bắt đầu/i })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator('main')
        .getByRole('heading', { name: /tác giả|lịch sử|hướng dẫn|mô tả|phân bố Part/ })
        .count(),
      0,
    );
    assert.match(await page.locator('.td-demo-note').innerText(), /demo-test-001 và demo-test-002/);
    check(
      'Full metadata matches catalog; source status caveat, count is not assembly; no unsupported fields/actions',
    );

    await detail('demo-test-002');
    await ready();
    await metadata([
      'Giao tiếp công sở · Bộ đề ngắn 01',
      'Mini Test',
      '30 phút',
      'Chưa có dữ liệu',
      'Đã xuất bản (PUBLISHED)',
    ]);
    await shot('metadata-mini', '.td-content');
    await page.reload();
    await ready();
    assert.equal(await page.locator('.td-id span').innerText(), 'demo-test-002');
    assert.equal(await page.locator('.td-metadata dd').nth(3).innerText(), 'Chưa có dữ liệu');
    check('Mini direct/reload preserves explicit duration, missing count and exact ID');

    const listUrl =
      base + '/tests?demoRole=CONTENT_ADMIN&keyword=B%E1%BB%99+%C4%91%E1%BB%81&page=2&size=1';
    await visit(listUrl);
    await listReady();
    const link = page.locator('[data-test-id="demo-test-002"] a');
    await link.focus();
    await page.keyboard.press('Enter');
    await ready();
    await focus('#cms-main');
    assert.equal(await page.locator('.td-back').getAttribute('href'), listUrl.slice(base.length));
    await page.goBack();
    await listReady();
    assert.equal(page.url(), listUrl);
    await page.goForward();
    await ready();
    await page.reload();
    await ready();
    await page.locator('.td-back').focus();
    await page.keyboard.press('Enter');
    await listReady();
    assert.equal(page.url(), listUrl);
    assert.equal(await page.locator('#test-keyword').inputValue(), 'Bộ đề');
    assert.equal(await page.locator('#test-size').inputValue(), '1');
    await shot('restored-filter-page', '.test-list');
    check(
      'Keyboard list page2 -> detail -> Back/Forward/reload -> literal return, filters/page/size restored and main focus',
    );

    const combined =
      base +
      '/tests?demoRole=CONTENT_ADMIN&keyword=c%C3%B4ng+s%E1%BB%9F&type=MINI&status=PUBLISHED&size=7&testPreview=slow';
    await visit(combined);
    await listReady();
    await page.locator('[data-test-id="demo-test-002"] a').click();
    await ready();
    assert.equal(await page.locator('.td-back').getAttribute('href'), combined.slice(base.length));
    await page.locator('.td-back').click();
    await listReady();
    assert.equal(page.url(), combined);
    assert.equal(await page.locator('#test-type').inputValue(), 'MINI');
    assert.equal(await page.locator('#test-status').inputValue(), 'PUBLISHED');
    await visit(base + '/tests?demoRole=CONTENT_ADMIN');
    await listReady();
    assert.equal(await page.locator('.test-list a').count(), 2);
    assert.equal(await page.locator('[data-test-id="demo-test-003"] a').count(), 0);
    check(
      'Every list param survives combined filters/custom size/slow preview; only two catalog rows link',
    );

    await detail('demo-test-003');
    await ready('unsupported');
    await shot('unsupported', '.td-result');
    await detail('demo-test-024', '&detailPreview=error');
    await ready('unsupported');
    await detail('unknown', '&detailPreview=error');
    await ready('not-found');
    await shot('not-found', '.td-result');
    const longId = 'unknown-' + 'VeryLongTestId'.repeat(35) + '<script>';
    await detail(longId);
    await ready('not-found');
    assert.equal(await page.locator('.td-id span').innerText(), longId);
    assert.equal(await page.locator('.td-id script').count(), 0);
    await shot('long-id', '.td-id');
    await page.reload();
    await ready('not-found');
    await scenario('slow');
    await ready('not-found');
    assert.equal(await page.locator('.td-id span').innerText(), longId);
    await detail('literal%2Fid');
    await ready('not-found');
    assert.equal(await page.locator('.td-id span').innerText(), 'literal%2Fid');
    check(
      'Unknown vs unsupported catalog ID, including error preview; long HTML-like and encoded ID safe across reload',
    );

    await detail();
    await ready();
    await scenario('missing');
    await ready();
    assert.deepEqual(
      await page.locator('.td-metadata dd').allTextContents(),
      Array(5).fill('Chưa có dữ liệu'),
    );
    await shot('missing-fields', '.td-content');
    await scenario('long');
    await ready();
    assert.match(await page.locator('.td-name dd').innerText(), /<strong>/);
    assert.equal(await page.locator('.td-name dd strong').count(), 0);
    await shot('long-title', '.td-name');
    await scenario('normal');
    await ready();
    await metadata([
      'TOEIC tổng hợp · Bộ đề 01',
      'Full Test',
      '120 phút',
      '200 câu',
      'Bản nháp (DRAFT)',
    ]);
    await scenario('empty');
    await ready('unsupported');
    await shot('simulated-empty', '.td-result');
    check(
      'Missing all metadata is explicit, no inference; long title escapes/wraps; normal restores fixture; simulated detail absence',
    );

    await scenario('error');
    await ready('error');
    await shot('error-retry', '.td-result');
    const errorUrl = page.url();
    await retry().focus();
    await page.keyboard.press('Enter');
    await ready();
    await focus('#td-title');
    assert.equal(page.url(), errorUrl);
    await page.reload();
    await ready('error');
    await page.locator('.td-preview summary').click();
    await retry().click();
    await page.locator('#td-preview').focus();
    await ready();
    await focus('#td-preview');
    assert.equal(page.url(), errorUrl);
    await detail('demo-test-002', '&detailPreview=error&size=3&page=2');
    await ready('error');
    const secondError = page.url();
    await retry().click();
    await ready();
    assert.equal(page.url(), secondError);
    assert.equal(await page.locator('.td-id span').innerText(), 'demo-test-002');
    assert.equal(await page.locator('.td-metadata dd').nth(3).innerText(), 'Chưa có dữ liệu');
    check(
      'Retry exact ID/query, keyboard heading focus, no focus theft from tool, reload restores error and recovery is scoped',
    );

    await visit(base + '/tests?demoRole=CONTENT_ADMIN');
    await listReady();
    await page.locator('[data-test-id="demo-test-001"] a').click();
    await ready();
    await scenario('slow');
    await page.locator('.td-loading').waitFor();
    await page.locator('.td-back').click();
    await listReady();
    await page.locator('[data-test-id="demo-test-002"] a').click();
    await ready();
    await page.goBack();
    await listReady();
    await page.goBack();
    await page.locator('.td-loading').waitFor();
    await page.goForward();
    await listReady();
    await page.goForward();
    await ready();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('.td-id span').innerText(), 'demo-test-002');
    assert.match(await page.locator('.td-name dd').innerText(), /Giao tiếp công sở/);
    check('Pending slow read discarded on real links and Back/Forward across IDs');

    await detail(
      'demo-test-001',
      '&keyword=a&keyword=b&type=bad&status=bad&page=-1&size=51&testPreview=bad&detailPreview=bad',
    );
    await ready();
    assert.equal(new URL(page.url()).search, '?demoRole=CONTENT_ADMIN');
    await shot('normalized-url', '.td-normalization');
    await detail(
      'demo-test-001',
      '&type=FULL&type=MINI&status=DRAFT&status=PUBLISHED&page=2&page=3&size=3&size=7&testPreview=slow&testPreview=error&detailPreview=error&detailPreview=slow',
    );
    await ready();
    assert.equal(new URL(page.url()).search, '?demoRole=CONTENT_ADMIN');
    for (const returnTo of [
      'https://outside.test/tests',
      '//outside.test',
      '/users',
      '/tests/../users',
    ]) {
      await detail(
        'demo-test-001',
        '&returnTo=' + encodeURIComponent(returnTo) + '&returnTo=%2Ftests',
      );
      await ready();
      assert.equal(
        await page.locator('.td-back').getAttribute('href'),
        '/tests?demoRole=CONTENT_ADMIN',
      );
      // Reading the local fixture may finish before Next's URL replacement.
      // Wait for that independent effect; retain the existing assertion below.
      await page.waitForURL((url) => !url.searchParams.has('returnTo'));
      assert.equal(new URL(page.url()).searchParams.has('returnTo'), false);
    }
    const special = 'tiếng Việt & <b>demo</b>';
    await detail(
      'demo-test-001',
      '&keyword=' +
        encodeURIComponent(special) +
        '&type=FULL&status=DRAFT&page=999&size=3&testPreview=empty',
    );
    await ready();
    const back = new URL(await page.locator('.td-back').getAttribute('href'), base);
    assert.equal(back.searchParams.get('keyword'), special);
    assert.equal(back.searchParams.get('page'), '999');
    assert.equal(back.searchParams.get('testPreview'), 'empty');
    assert.equal(await page.locator('.td-id span').innerText(), 'demo-test-001');
    await page.reload();
    await ready();
    await page.locator('.td-back').click();
    await listReady();
    await page.getByRole('heading', { name: 'Chưa có đề thi trong bộ demo' }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('page'), false);
    check(
      'Invalid/repeated params normalize; returnTo rejected; Unicode safe, ID independent of filters, list clamps return page and preserves preview',
    );

    await visit(base + '/tests/demo-test-001?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.test-detail').count(), 0);
    assert.match(await page.locator('main').innerText(), /quản trị nội dung/);
    await shot('system-persona-panel');
    for (const suffix of [
      '',
      '?demoRole=invalid',
      '?demoRole=CONTENT_ADMIN&demoRole=SYSTEM_ADMIN',
    ]) {
      await visit(base + '/tests/demo-test-001' + suffix);
      await ready();
      assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    }
    await visit(base + '/tests/demo-test-001?demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.test-detail').count(), 0);
    await detail();
    await ready();
    if (width < 1024) {
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      assert.match(
        await page.locator('dialog[open] nav [aria-current="page"]').innerText(),
        /Đề thi/,
      );
      await shot('mobile-menu');
      await page.keyboard.press('Escape');
      await focus('.cms-menu-trigger');
    } else
      assert.match(
        await page.locator('.cms-desktop-sidebar nav [aria-current="page"]').innerText(),
        /Đề thi/,
      );
    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.goBack();
    await ready();
    check(
      'Personas and duplicate fallback unchanged; SYSTEM_ADMIN panel only; active test menu, mobile Escape and role history',
    );

    await assertWrites();
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check('Fresh context has no storage writes, cookies or IndexedDB');
    await context.close();
    console.log('PASS test detail', width);
  }
  for (const key of ['errors', 'forbiddenRequests', 'httpErrors', 'storageWrites'])
    assert.deepEqual(report[key], []);
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
