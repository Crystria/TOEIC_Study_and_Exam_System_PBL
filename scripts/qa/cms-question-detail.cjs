const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-question-detail-session20-20261028');
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
  console.log('CHECK', page.viewportSize().width, report.checks.length, name.slice(0, 55));
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
    () => document.querySelector('.qd-result')?.getAttribute('aria-busy') === 'false',
  );
  if (kind === 'found') await page.locator('.qd-content').waitFor();
  if (kind === 'error')
    await page.getByRole('heading', { name: 'Chưa đọc được chi tiết demo', exact: true }).waitFor();
  if (kind === 'unsupported')
    await page
      .getByRole('heading', { name: 'Chưa có dữ liệu chi tiết demo', exact: true })
      .waitFor();
  if (kind === 'not-found')
    await page.getByRole('heading', { name: 'Không tìm thấy câu hỏi', exact: true }).waitFor();
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
const detail = (id = 'demo-q-017', suffix = '') =>
  visit(`${base}/questions/${encodeURIComponent(id)}?demoRole=CONTENT_ADMIN${suffix}`);
async function scenario(value) {
  const tool = page.locator('.qd-preview');
  if ((await tool.getAttribute('open')) === null) await tool.locator('summary').click();
  await page.locator('#qd-preview').selectOption(value);
  await page.waitForURL((u) => (u.searchParams.get('detailPreview') || 'normal') === value);
}
const retry = () => page.getByRole('button', { name: 'Thử lại chi tiết demo', exact: true });
async function listReady() {
  await page.waitForFunction(
    () => document.querySelector('.question-results')?.getAttribute('aria-busy') === 'false',
  );
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

    await detail('demo-q-017', '&detailPreview=slow');
    await page.locator('.qd-loading').waitFor();
    await shot('loading', '.qd-result');
    await ready();
    await scenario('normal');
    await ready();
    await page.evaluate(() => scrollTo(0, 0));
    await shot('detail');
    await shot('state-tool', '.qd-preview');
    const toolBox = await page.locator('.qd-preview').boundingBox();
    assert.ok(toolBox.y >= 0 && toolBox.y + toolBox.height <= 900, JSON.stringify(toolBox));
    await shot('stem-options', '.qd-options');
    await shot('answer-explanation', '.qd-explanation');
    assert.match(await page.locator('.qd-stem').innerText(), /must _____/);
    assert.equal(await page.locator('.qd-options li').count(), 4);
    assert.equal(await page.locator('.qd-correct .qd-option-key').innerText(), 'B');
    assert.match(await page.locator('.qd-answer').innerText(), /Phương án B/);
    assert.equal(
      await page.locator('.qd-content button,.qd-content input,.qd-content a').count(),
      0,
    );
    assert.match(await page.locator('.qd-explanation').innerText(), /Không phải kết quả chấm bài/);
    assert.equal(
      await page
        .locator('main')
        .getByRole('button', { name: /tạo|sửa|xóa|nhân bản|xuất bản|export/i })
        .count(),
      0,
    );
    check(
      'Read-only original Part5, explicit B, four labeled options, demo/grading distinction, no unimplemented actions',
    );

    for (const [id, answer, stem] of [
      ['demo-q-018', 'C', 'Passengers'],
      ['demo-q-019', 'A', 'Candidates'],
    ]) {
      await detail(id);
      await ready();
      assert.match(await page.locator('.qd-stem').innerText(), new RegExp(stem));
      assert.equal(await page.locator('.qd-correct .qd-option-key').innerText(), answer);
      await shot(id, '.qd-content');
    }
    await page.reload();
    await ready();
    assert.match(await page.locator('.qd-id').innerText(), /demo-q-019/);
    check('All three catalog IDs direct/reload, exact authored answers B/C/A');

    const listUrl =
      base + '/questions?demoRole=CONTENT_ADMIN&keyword=sentence&part=5&page=2&size=1';
    await visit(listUrl);
    await listReady();
    assert.equal(await page.locator('[data-question-id="demo-q-018"]').count(), 1);
    const link = page.locator('[data-question-id="demo-q-018"] a');
    await link.focus();
    await page.keyboard.press('Enter');
    await ready();
    await focus('#cms-main');
    assert.match(page.url(), /\/questions\/demo-q-018\?/);
    assert.equal(await page.locator('.qd-back').getAttribute('href'), listUrl.slice(base.length));
    await page.goBack();
    await listReady();
    assert.equal(page.url(), listUrl);
    await page.goForward();
    await ready();
    await page.reload();
    await ready();
    await page.locator('.qd-back').focus();
    await page.keyboard.press('Enter');
    await listReady();
    assert.equal(page.url(), listUrl);
    assert.equal(await page.locator('#question-keyword').inputValue(), 'sentence');
    assert.equal(await page.locator('#question-part').inputValue(), '5');
    assert.equal(await page.locator('#question-size').inputValue(), '1');
    await shot('restored-page-filter', '.question-list');
    check(
      'List page2 size1 keyword/Part -> keyboard detail -> Back/Forward/reload -> return restores query, main focus',
    );

    const combined =
      base +
      '/questions?demoRole=CONTENT_ADMIN&keyword=deadline&part=5&difficulty=MEDIUM&tag=office&size=7&questionPreview=slow';
    await visit(combined);
    await listReady();
    await page.locator('[data-question-id="demo-q-017"] a').click();
    await ready();
    assert.equal(await page.locator('.qd-back').getAttribute('href'), combined.slice(base.length));
    await page.locator('.qd-back').click();
    await listReady();
    assert.equal(page.url(), combined);
    assert.equal(await page.locator('#question-difficulty').inputValue(), 'MEDIUM');
    assert.equal(await page.locator('#question-tag').inputValue(), 'office');
    await visit(base + '/questions?demoRole=CONTENT_ADMIN&part=5');
    await listReady();
    assert.equal(await page.locator('.question-list a').count(), 3);
    assert.equal(await page.locator('[data-question-id="demo-q-020"] a').count(), 0);
    check(
      'All actual filters, custom size and list preview survive; only three supported rows link',
    );

    await detail('demo-q-020');
    await ready('unsupported');
    await shot('unsupported', '.qd-result');
    await detail('demo-q-001');
    await ready('unsupported');
    await detail('unknown');
    await ready('not-found');
    await shot('not-found', '.qd-result');
    const longId = 'demo-unknown-' + 'VeryLongQuestionId'.repeat(30) + '<script>';
    await detail(longId);
    await ready('not-found');
    assert.equal(await page.locator('.qd-id span').innerText(), longId);
    assert.equal(await page.locator('.qd-id script').count(), 0);
    await shot('long-id', '.qd-id');
    await page.reload();
    await ready('not-found');
    assert.equal(await page.locator('.qd-id span').innerText(), longId);
    await page.locator('.qd-preview summary').click();
    await page.locator('#qd-preview').selectOption('slow');
    await ready('not-found');
    assert.equal(await page.locator('.qd-id span').innerText(), longId);
    await page.reload();
    await ready('not-found');
    assert.equal(await page.locator('.qd-id span').innerText(), longId);
    check(
      'Unknown ID vs existing unsupported ID; long and HTML-like ID rendered as safe wrapped text',
    );

    await detail();
    await ready();
    await scenario('missing');
    await ready();
    assert.match(await page.locator('.qd-stem').innerText(), /Chưa có dữ liệu/);
    assert.match(
      await page.locator('.qd-options li').nth(2).innerText(),
      /Chưa có dữ liệu phương án/,
    );
    assert.equal(await page.locator('.qd-correct').count(), 0);
    assert.match(await page.locator('.qd-answer').innerText(), /Chưa có dữ liệu đáp án/);
    assert.match(await page.locator('.qd-explanation').innerText(), /Chưa có dữ liệu lời giải/);
    await shot('missing-options', '.qd-options');
    await shot('missing-answer-explanation', '.qd-explanation');
    await scenario('long');
    await ready();
    assert.match(await page.locator('.qd-stem').innerText(), /<strong>/);
    assert.equal(
      await page.locator('.qd-stem strong,.qd-options p strong,.qd-explanation p strong').count(),
      0,
    );
    for (const [name, selector] of [
      ['long-stem', '.qd-stem'],
      ['long-options', '.qd-options li'],
      ['long-explanation', '.qd-explanation .qd-text'],
    ])
      await shot(name, selector + (selector === '.qd-options li' ? ':first-child' : ''));
    await scenario('empty');
    await ready('unsupported');
    await shot('simulated-empty', '.qd-result');
    check(
      'Missing fields never infer answer; long stem/options/explanation wrap and escape HTML; UI-only empty scenario',
    );

    await scenario('error');
    await ready('error');
    await shot('error-retry', '.qd-result');
    const errorUrl = page.url();
    await retry().focus();
    await page.keyboard.press('Enter');
    await ready();
    await focus('#qd-title');
    assert.equal(page.url(), errorUrl);
    await page.reload();
    await ready('error');
    await page.locator('.qd-preview summary').click();
    await retry().click();
    await page.locator('#qd-preview').focus();
    await ready();
    await focus('#qd-preview');
    assert.equal(page.url(), errorUrl);
    await detail('demo-q-018', '&detailPreview=error&size=3&page=2');
    await ready('error');
    const secondErrorUrl = page.url();
    await retry().click();
    await ready();
    assert.equal(page.url(), secondErrorUrl);
    assert.match(await page.locator('.qd-answer').innerText(), /Phương án C/);
    check(
      'Retry exact current ID/query; Enter moves focus only after removed control; tool focus preserved; reload/error scope reset',
    );

    // Real Next links/history, leaving a slow read pending before opening another ID.
    await visit(base + '/questions?demoRole=CONTENT_ADMIN&part=5');
    await listReady();
    await page.locator('[data-question-id="demo-q-017"] a').click();
    await ready();
    await scenario('slow');
    await page.locator('.qd-loading').waitFor();
    await page.locator('.qd-back').click();
    await listReady();
    await page.locator('[data-question-id="demo-q-018"] a').click();
    await ready();
    await page.goBack();
    await listReady();
    await page.goBack();
    await page.locator('.qd-loading').waitFor();
    await page.goForward();
    await listReady();
    await page.goForward();
    await ready();
    assert.match(await page.locator('.qd-id').innerText(), /demo-q-018/);
    assert.match(await page.locator('.qd-stem').innerText(), /Passengers/);
    await page.waitForTimeout(1500);
    assert.match(await page.locator('.qd-stem').innerText(), /Passengers/);
    check('Slow dynamic ID switch and Back/Forward discard stale reads');

    const invalid =
      'keyword=a&keyword=b&part=8&difficulty=bad&tag=a&tag=b&page=-1&size=51&detailPreview=bad&questionPreview=bad';
    await detail('demo-q-017', '&' + invalid);
    await ready();
    assert.equal(new URL(page.url()).search, '?demoRole=CONTENT_ADMIN');
    await shot('normalized-url', '.qd-normalization');
    await detail(
      'demo-q-017',
      '&page=2&page=3&size=1&size=2&part=5&part=1&difficulty=EASY&difficulty=HARD&detailPreview=error&detailPreview=slow',
    );
    await ready();
    assert.equal(new URL(page.url()).search, '?demoRole=CONTENT_ADMIN');
    for (const returnTo of [
      'https://outside.test/questions',
      '//outside.test/questions',
      '/users',
      '/questions?demoRole=SYSTEM_ADMIN',
    ]) {
      await detail(
        'demo-q-017',
        '&returnTo=' + encodeURIComponent(returnTo) + '&returnTo=%2F%2Foutside.test',
      );
      await ready();
      assert.equal(
        await page.locator('.qd-back').getAttribute('href'),
        '/questions?demoRole=CONTENT_ADMIN',
      );
      assert.equal(new URL(page.url()).origin, new URL(base).origin);
      assert.equal(new URL(page.url()).searchParams.has('returnTo'), false);
    }
    const special = 'tiếng Việt & <b>demo</b>';
    await detail(
      'demo-q-017',
      '&keyword=' +
        encodeURIComponent(special) +
        '&tag=' +
        encodeURIComponent('tag & <demo>') +
        '&size=3',
    );
    await ready();
    const back = new URL(await page.locator('.qd-back').getAttribute('href'), base);
    assert.equal(back.searchParams.get('keyword'), special);
    assert.equal(back.searchParams.get('tag'), 'tag & <demo>');
    await page.reload();
    await ready();
    check(
      'Invalid/repeated params safely canonicalize; external/internal returnTo ignored; Unicode literal query survives reload',
    );

    await visit(base + '/questions/demo-q-017?demoRole=SYSTEM_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.question-detail').count(), 0);
    assert.match(await page.locator('main').innerText(), /quản trị nội dung/);
    await shot('system-persona-panel');
    for (const suffix of [
      '',
      '?demoRole=invalid',
      '?demoRole=CONTENT_ADMIN&demoRole=SYSTEM_ADMIN',
    ]) {
      await visit(base + '/questions/demo-q-017' + suffix);
      await ready();
      assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    }
    await visit(base + '/questions/demo-q-017?demoRole=SYSTEM_ADMIN&demoRole=CONTENT_ADMIN');
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.equal(await page.locator('.question-detail').count(), 0);
    await detail();
    await ready();
    if (width < 1024) {
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      const dialog = page.locator('dialog[open]');
      assert.equal(
        await dialog.locator('nav [aria-current="page"]').innerText(),
        'CH\nNgân hàng câu hỏi',
      );
      await shot('mobile-menu');
      await page.keyboard.press('Escape');
      await focus('.cms-menu-trigger');
    } else
      assert.equal(await page.locator('.cms-desktop-sidebar nav [aria-current="page"]').count(), 1);
    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.goBack();
    await ready();
    check(
      'CONTENT_ADMIN details; SYSTEM_ADMIN explanatory shell, default/invalid/duplicate persona unchanged, menu and history',
    );

    await assertWrites();
    assert.deepEqual(
      await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
      { local: {}, session: {} },
    );
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check('No storage writes/cookies/IndexedDB; isolated fresh context');
    await context.close();
    console.log('PASS question detail', width);
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
