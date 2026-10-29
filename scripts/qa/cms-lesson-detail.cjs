// Real Chromium contexts; no API interception, accounts or persistent browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-lesson-detail-session29-20261029');
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
const titles = ['Hiện tại đơn trong email công việc', 'Hiện tại tiếp diễn khi mô tả hoạt động'];
let browser, page;
const check = (name) => {
  report.checks.push({ name, viewport: page.viewportSize() });
  console.log('CHECK', page.viewportSize().width, name);
};
const listReady = () =>
  page.waitForFunction(
    () => document.querySelector('.lesson-results')?.getAttribute('aria-busy') === 'false',
  );
const focused = async (id) =>
  assert.equal(await page.evaluate(() => document.activeElement?.id), id);
async function detail(id = 'demo-lesson-001', query = 'demoRole=CONTENT_ADMIN') {
  await page.goto(`${base}/lessons/${encodeURIComponent(id)}?${query}`);
}
async function normal(index = 0) {
  await page.getByRole('heading', { name: titles[index], exact: true }).waitFor();
  await page.locator('.ld-content').waitFor();
  await page.waitForFunction(() => !document.querySelector('#ld-preview')?.disabled);
}
async function scenario(value) {
  const controls = page.locator('.ld-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#ld-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('detailPreview') || 'normal') === value);
}
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

    for (const [index, id] of ['demo-lesson-001', 'demo-lesson-002'].entries()) {
      await detail(id);
      await normal(index);
      assert.match(await page.locator('.ld-category').innerText(), /Thì động từ/);
      assert.match(
        await page.locator('.ld-examples li').first().innerText(),
        index === 0 ? /sends a weekly update/ : /is reviewing the expense reports/,
      );
      assert.equal(await page.locator('.ld-content h2').count(), 4);
      assert.equal(await page.locator('.ld-content h3').count(), 3);
      assert.equal(
        await page
          .locator('.ld-content button,.ld-content input,.ld-content form,.ld-content a')
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole('button', { name: /sửa|xóa|hoàn thành|publish|lưu/i }).count(),
        0,
      );
      await page.reload();
      await normal(index);
      await shot('lesson-' + (index + 1));
      await shot('structures-' + (index + 1), '#ld-structures');
      await shot('examples-' + (index + 1), '#ld-examples');
      await shot('notes-' + (index + 1), '#ld-notes');
    }
    check(
      'Two exact titles/categories and independent original bodies, direct links/reload and read-only content',
    );

    const query = new URLSearchParams({
      demoRole: 'CONTENT_ADMIN',
      keyword: 'hiện tại',
      category: 'Thì động từ',
      lessonPreview: 'slow',
    }).toString();
    await page.goto(`${base}/lessons?${query}`);
    await listReady();
    const before = await page.locator('.lesson-results').innerText();
    assert.equal(await page.locator('.lesson-list a').count(), 2);
    assert.equal(await page.locator('[data-lesson-id="demo-lesson-004"] a').count(), 0);
    const first = page.locator('[data-lesson-id="demo-lesson-001"] a');
    await first.focus();
    await page.keyboard.press('Enter');
    await normal();
    assert.equal(await page.locator('.ld-back').getAttribute('href'), '/lessons?' + query);
    await page.locator('.ld-back').click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.toString(), query);
    assert.equal(await page.locator('.lesson-results').innerText(), before);
    await page.goBack();
    await normal();
    await page.goBack();
    await listReady();
    await page.goForward();
    await normal();
    await page.reload();
    await normal();
    assert.equal(new URL(page.url()).searchParams.toString(), query);
    check(
      'List filters/persona/slow scenario survive keyboard detail entry, fixed return, Back/Forward/reload; catalog unchanged',
    );

    const pageQuery = 'demoRole=CONTENT_ADMIN&page=2';
    await detail('demo-lesson-002', pageQuery);
    await normal(1);
    assert.equal(await page.locator('.ld-back').getAttribute('href'), '/lessons?' + pageQuery);
    await page.locator('.ld-back').click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.get('page'), '2');
    assert.equal(
      await page.locator('.lesson-list li').first().getAttribute('data-lesson-id'),
      'demo-lesson-007',
    );
    await page.goBack();
    await normal(1);
    check(
      'Direct detail preserves valid page2 on return and never changes the selected lesson to match page contents',
    );

    await detail('demo-lesson-001', query);
    await normal();
    await page.locator('.ld-back').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .locator('.ld-preview-controls summary')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .locator('.ld-outline a')
        .first()
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.hash === '#ld-structures');
    await focused('ld-structures');
    assert.notEqual(
      await page.locator('#ld-structures').evaluate((el) => getComputedStyle(el).outlineStyle),
      'none',
    );
    await shot('keyboard-anchor', '#ld-structures');
    await page.reload();
    await normal();
    assert.equal(new URL(page.url()).hash, '#ld-structures');
    await page.goBack();
    await normal();
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(new URL(page.url()).searchParams.toString(), query);
    for (const link of await page.locator('.ld-outline a').all()) {
      const href = await link.getAttribute('href');
      assert.equal(new URL(href, base).searchParams.toString(), query);
      assert.equal(await page.locator(new URL(href, base).hash).count(), 1);
    }
    check(
      'Keyboard Tab/Enter reaches named section anchors, heading focus is visible, hash history/reload retain query',
    );

    await scenario('missing');
    await page
      .getByRole('heading', { name: 'Chưa có dữ liệu tiêu đề bài học', exact: true })
      .waitFor();
    assert.match(await page.locator('.ld-category').innerText(), /Chưa có dữ liệu danh mục/);
    assert.equal(await page.locator('.ld-missing').count(), 4);
    await shot('missing-title');
    await shot('missing-sections', '.ld-content');
    assert.equal(await page.locator('.ld-back').getAttribute('href'), '/lessons?' + query);
    await scenario('long');
    assert.equal(await page.locator('.ld-scenario-note').isVisible(), true);
    assert.equal(
      await page.locator('.ld-content strong,.ld-content img,[data-ld-injected]').count(),
      0,
    );
    assert.match(await page.locator('.ld-structures dd').innerText(), /<strong>/);
    assert.match(await page.locator('.ld-sentence').innerText(), /<img/);
    await shot('long-title', '.ld-intro');
    await shot('long-structure', '.ld-structures');
    await shot('long-example', '.ld-examples');
    await shot('long-notes', '#ld-notes');
    await scenario('normal');
    await normal();
    assert.equal(await page.locator('.ld-scenario-note').count(), 0);
    assert.match(await page.locator('.ld-examples').innerText(), /sends a weekly update/);
    check(
      'Explicit missing metadata/sections and long literal HTML/text render safely; normal restores original without mutation',
    );

    for (const [id, title] of [
      ['demo-lesson-003', 'Ngoài phạm vi chi tiết demo'],
      ['demo-lesson-018', 'Ngoài phạm vi chi tiết demo'],
      ['unknown', 'Không tìm thấy bài học'],
    ]) {
      await detail(id, 'demoRole=CONTENT_ADMIN&detailPreview=long');
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(await page.locator('.ld-content,.ld-preview-controls').count(), 0);
      await shot(id === 'unknown' ? 'not-found' : 'out-of-scope-' + id);
    }
    const opaque = '<script>literal</script>/' + 'LongId'.repeat(30) + '%2F';
    await detail(opaque);
    await page.getByRole('heading', { name: 'Không tìm thấy bài học', exact: true }).waitFor();
    assert.equal(await page.locator('.ld-id span').textContent(), opaque);
    assert.equal(await page.locator('.ld-id script').count(), 0);
    await page.reload();
    assert.equal(await page.locator('.ld-id span').textContent(), opaque);
    await shot('opaque-escaped-id', '.ld-id');
    check(
      'Unsupported catalog IDs differ from unknown IDs; long encoded IDs decode once without content fallback or HTML',
    );

    await detail(
      'demo-lesson-002',
      'keyword=a&keyword=b&category=x&category=y&page=-1&size=50&level=EASY&status=PUBLISHED&detailPreview=error&returnTo=https%3A%2F%2Fevil.test',
    );
    await normal(1);
    await page.waitForURL((url) => url.searchParams.toString() === 'demoRole=CONTENT_ADMIN');
    assert.equal(
      await page.locator('.ld-back').getAttribute('href'),
      '/lessons?demoRole=CONTENT_ADMIN',
    );
    await detail(
      'demo-lesson-001',
      query + '&returnTo=%2F%2Fevil.test&detailPreview=missing&random=x',
    );
    await page.waitForURL(
      (url) => url.searchParams.toString() === query + '&detailPreview=missing',
    );
    assert.equal(await page.locator('.ld-back').getAttribute('href'), '/lessons?' + query);
    check(
      'Repeated/invalid query values normalize through existing list parser; returnTo/unsupported params never affect destinations',
    );

    await page.goto(`${base}/lessons/demo-lesson-001#ld-examples`);
    await normal();
    await page.waitForURL((url) => url.searchParams.get('demoRole') === 'CONTENT_ADMIN');
    assert.equal(new URL(page.url()).hash, '#ld-examples');
    check('Query normalization preserves an existing section hash on direct URLs');

    for (const id of ['demo-lesson-001', 'demo-lesson-002']) {
      await detail(id, 'demoRole=SYSTEM_ADMIN');
      await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
      assert.equal(await page.locator('.lesson-detail').count(), 0);
      assert.equal(await page.locator('.ld-content').count(), 0);
    }
    await shot('system-persona-panel');
    await detail();
    await normal();
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
      await menu.click();
      assert.match(
        await page.locator('dialog [aria-current="page"]').innerText(),
        /Bài học ngữ pháp/,
      );
      await page.keyboard.press('Escape');
      assert.equal(await menu.evaluate((el) => el === document.activeElement), true);
      assert.equal(await page.locator('dialog[open]').count(), 0);
    } else
      assert.match(
        await page.locator('.cms-desktop-sidebar [aria-current="page"]').innerText(),
        /Bài học ngữ pháp/,
      );
    check(
      'SYSTEM_ADMIN cannot mount details; content lesson menu stays active and mobile Escape restores trigger focus',
    );

    assert.deepEqual(await context.cookies(), []);
    assert.deepEqual(
      await page.evaluate(async () => ({
        local: localStorage.length,
        session: sessionStorage.length,
        databases: (await indexedDB.databases()).length,
      })),
      { local: 0, session: 0, databases: 0 },
    );
    check(
      'Fresh context has empty cookies/local/session/IndexedDB; writes observed across all navigations',
    );
    await context.close();
  }
  for (const key of ['errors', 'forbiddenRequests', 'httpErrors', 'storageWrites'])
    assert.deepEqual(report[key], [], key);
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
