// CMS preview QA. Every viewport gets a fresh, non-persistent browser context.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = process.env.CMS_QA_OUT || path.join(root, 'docs/screenshots/cms-shell-20261027');
const report = {
  base: process.env.CMS_QA_URL || 'http://localhost:3007',
  checks: [],
  screenshots: [],
  errors: [],
  forbiddenRequests: [],
  httpErrors: [],
};
const content = [
  ['/questions', 'Ngân hàng câu hỏi'],
  ['/tests', 'Đề thi'],
  ['/lessons', 'Bài học ngữ pháp'],
  ['/vocabulary', 'Từ vựng'],
];
const system = [
  ['/users', 'Người dùng & vai trò'],
  ['/audit-logs', 'Nhật ký quản trị'],
];
let browser;
let page;
fs.mkdirSync(out, { recursive: true });
const check = (name, data = {}) =>
  report.checks.push({ name, viewport: page.viewportSize(), ...data });
const focused = async (selector) =>
  assert.equal(
    await page.locator(selector).evaluate((el) => el === document.activeElement),
    true,
    selector + ' focused',
  );

async function shot(name) {
  const viewport = page.viewportSize();
  const size = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.equal(size.width, viewport.width);
  assert.equal(size.height, viewport.height);
  assert.ok(size.scroll <= size.client, JSON.stringify(size));
  const file = name + '-' + viewport.width + '.png';
  const bytes = await page.screenshot({ path: path.join(out, file), fullPage: false });
  assert.equal(bytes.readUInt32BE(16), viewport.width);
  assert.equal(bytes.readUInt32BE(20), viewport.height);
  report.screenshots.push({ file, viewport, size });
}

async function ready() {
  await page.locator('#cms-demo-role:not(:disabled)').waitFor();
}

async function navScope() {
  if (page.viewportSize().width >= 1024) return page.locator('.cms-desktop-sidebar');
  await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
  await page.locator('dialog[open]').waitFor();
  return page.getByRole('dialog', { name: 'Menu quản trị', exact: true });
}

async function verifyMenu(items, role) {
  const nav = await navScope();
  const links = nav.locator('nav a');
  assert.deepEqual(
    await links.allTextContents(),
    items.map(
      ([p, label]) =>
        ({
          '/questions': 'CH',
          '/tests': 'ĐT',
          '/lessons': 'NP',
          '/vocabulary': 'TV',
          '/users': 'ND',
          '/audit-logs': 'NK',
        })[p] + label,
    ),
  );
  for (const [href] of items)
    assert.equal(await nav.locator(`nav a[href="${href}?demoRole=${role}"]`).count(), 1);
  if (page.viewportSize().width < 1024) {
    if (role === 'SYSTEM_ADMIN') await shot('system-menu');
    await page.keyboard.press('Escape');
    await focused('.cms-menu-trigger');
  }
}

async function visitItems(items, role) {
  for (const [href, label] of items) {
    const nav = await navScope();
    await nav.getByRole('link', { name: new RegExp(label.replace('&', '\\&') + '$') }).click();
    await page.waitForURL(`**${href}?demoRole=${role}`);
    await page.getByRole('heading', { name: label, exact: true }).waitFor();
    assert.equal(await page.locator('main h1').innerText(), label);
    assert.equal(await page.locator('dialog[open]').count(), 0);
    const selected = page.locator(
      page.viewportSize().width >= 1024
        ? '.cms-desktop-sidebar nav a[aria-current="page"]'
        : 'dialog nav a[aria-current="page"]',
    );
    assert.equal(await selected.count(), 1);
    assert.equal(await selected.getAttribute('href'), `${href}?demoRole=${role}`);
    await shot(href.slice(1));
  }
  check('All role destinations: URL, heading, selected item and closed drawer', {
    role,
    routes: items.map(([p]) => p),
  });
}

async function storageEmpty(context) {
  assert.deepEqual(
    await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
    { local: {}, session: {} },
  );
  assert.deepEqual(await context.cookies(), []);
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
    page.on('request', (req) => {
      if (
        /\/api\/|localhost:3000/.test(req.url()) ||
        req.method() !== 'GET' ||
        req.headers().authorization
      )
        report.forbiddenRequests.push({ method: req.method(), url: req.url() });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) report.httpErrors.push({ status: res.status(), url: res.url() });
    });
    await page.goto(report.base + '/');
    await page.waitForURL('**/login');
    const submit = page.getByRole('button', { name: 'Kiểm tra đăng nhập (xem thử)', exact: true });
    await submit.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    assert.equal(await page.locator('html').getAttribute('lang'), 'vi');
    await shot('login');
    await page.locator('.cms-demo-entry').scrollIntoViewIfNeeded();
    await shot('login-demo-entry');
    await page.evaluate(() => window.scrollTo(0, 0));
    await submit.focus();
    await page.keyboard.press('Enter');
    await page.locator('form [role="alert"]').waitFor();
    await focused('#cms-email');
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 2);
    assert.equal(
      await page.locator('#cms-email').getAttribute('aria-describedby'),
      'cms-email-error',
    );
    await shot('login-errors');
    await page.getByLabel('Địa chỉ email').fill('not-an-email');
    await page.keyboard.press('Enter');
    await focused('#cms-email');
    assert.match(await page.locator('#cms-email-error').innerText(), /định dạng/);
    await page.getByLabel('Địa chỉ email').fill('preview@example.com');
    await page.keyboard.press('Enter');
    await focused('#cms-password');
    await page.getByLabel(/^Mật khẩu/).fill('x'); // login only requires a nonempty password
    const show = page.getByRole('button', { name: 'Hiện mật khẩu', exact: true });
    await show.focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#cms-password').getAttribute('type'), 'text');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#cms-password').getAttribute('type'), 'password');
    await submit.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('form').getAttribute('aria-busy') === 'true',
    );
    assert.equal(await page.locator('button[type="submit"]').isDisabled(), true);
    await shot('login-loading');
    await page.getByRole('status').filter({ hasText: 'Biểu mẫu hợp lệ' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(await page.locator('#cms-password').inputValue(), '');
    await focused('button[type="submit"]');
    await shot('login-preview-complete');
    await storageEmpty(context);
    check(
      'Login: required/format errors, focus, Enter, password toggle, loading, local completion, no authentication',
    );
    await page.reload();
    await submit.waitFor();
    assert.equal(await page.locator('#cms-email').inputValue(), '');
    assert.equal(await page.locator('#cms-password').inputValue(), '');

    await page.getByRole('link', { name: /Xem thử quản trị nội dung/ }).click();
    await ready();
    await verifyMenu(content, 'CONTENT_ADMIN');
    await visitItems(content, 'CONTENT_ADMIN');
    await page.goBack();
    await page.waitForURL('**/lessons?demoRole=CONTENT_ADMIN');
    assert.equal(await page.locator('main h1').innerText(), 'Bài học ngữ pháp');
    await page.reload();
    await ready();
    assert.equal(await page.locator('main h1').innerText(), 'Bài học ngữ pháp');
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    check('Content Back/reload keeps role, URL and page content');

    if (width < 1024) {
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).focus();
      await page.keyboard.press('Enter');
      await focused('.cms-drawer-close');
      await page.keyboard.press('Shift+Tab');
      assert.equal(
        await page.locator('dialog').evaluate((el) => el.contains(document.activeElement)),
        true,
      );
      await page.keyboard.press('Tab');
      await focused('.cms-drawer-close');
      await shot('content-menu');
      await page.keyboard.press('Escape');
      await focused('.cms-menu-trigger');
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.getByRole('button', { name: 'Đóng menu', exact: true }).click();
      await focused('.cms-menu-trigger');
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.mouse.click(width - 5, 400);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await focused('.cms-menu-trigger');
      await navScope();
      await page.goBack();
      await page.waitForURL('**/tests?demoRole=CONTENT_ADMIN');
      await page.getByRole('heading', { name: 'Đề thi', exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await focused('#cms-main');
      check(
        'Mobile dialog: keyboard open, initial focus, Tab trap, Escape, close/backdrop, restored trigger focus and Back while open',
      );
    }

    const summary = page.locator('.cms-account summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.cms-account').getAttribute('open'), '');
    await page.keyboard.press('Tab');
    await focused('.cms-account-panel a');
    await shot('account-menu');
    await page.keyboard.press('Escape');
    await focused('.cms-account summary');
    assert.equal(await page.locator('.cms-account').getAttribute('open'), null);
    await summary.click();
    await page.locator('#cms-demo-role').focus();
    assert.equal(await page.locator('.cms-account').getAttribute('open'), null);
    await summary.click();
    await page.locator('main h1').click();
    assert.equal(await page.locator('.cms-account').getAttribute('open'), null);
    check('Account disclosure: Enter/Tab/Escape and focus return; closes on outside click/focus');

    await page.locator('#cms-demo-role').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/users?demoRole=SYSTEM_ADMIN');
    await page.getByRole('heading', { name: 'Người dùng & vai trò', exact: true }).waitFor();
    await focused('#cms-main');
    await verifyMenu(system, 'SYSTEM_ADMIN');
    await visitItems(system, 'SYSTEM_ADMIN');
    await page.reload();
    await ready();
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'SYSTEM_ADMIN');
    assert.equal(await page.locator('main h1').innerText(), 'Nhật ký quản trị');
    check('Keyboard role preview switch, destination focus and system reload');
    await page.locator('#cms-demo-role').selectOption('CONTENT_ADMIN');
    await page.waitForURL('**/questions?demoRole=CONTENT_ADMIN');
    await page.getByRole('heading', { name: 'Ngân hàng câu hỏi', exact: true }).waitFor();
    await page.goBack();
    await page.waitForURL('**/audit-logs?demoRole=SYSTEM_ADMIN');
    await page.getByRole('heading', { name: 'Nhật ký quản trị', exact: true }).waitFor();
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'SYSTEM_ADMIN');
    check('Back restores both demo role and content after role change');

    await page.locator('.cms-skip').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**#cms-main');
    await focused('#cms-main');
    const hashUrl = page.url();
    await summary.click();
    await page.getByRole('link', { name: 'Thoát không gian xem thử', exact: true }).click();
    await page.waitForURL('**/login');
    await page.goBack();
    await page.waitForURL(hashUrl);
    await ready();
    assert.equal(await page.locator('main h1').innerText(), 'Nhật ký quản trị');
    check('Skip link focus and account exit/Back after hash restore matching URL/content');

    await page.goto(report.base + '/users?demoRole=CONTENT_ADMIN');
    await ready();
    await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
    assert.match(
      await page.locator('main').innerText(),
      /chưa tải dữ liệu hoặc kiểm tra quyền truy cập thật/,
    );
    await shot('different-role-route');
    await page.goto(report.base + '/questions?demoRole=unexpected');
    await ready();
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    await page.goto(report.base + '/questions');
    await ready();
    assert.equal(await page.locator('#cms-demo-role').inputValue(), 'CONTENT_ADMIN');
    check('Direct links: cross-role explanation; missing/invalid role defaults to content preview');

    if (width < 1024) {
      await page.getByRole('button', { name: 'Mở menu quản trị', exact: true }).click();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      await focused('#cms-main');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
      await page.setViewportSize({ width, height: 900 });
      check('Resize to desktop closes drawer and restores body scrolling');
    }
    await page.goto(report.base + '/login');
    await page.getByRole('link', { name: /Xem thử quản trị hệ thống/ }).click();
    await ready();
    assert.equal(await page.locator('main h1').innerText(), 'Người dùng & vai trò');
    await storageEmpty(context);
    assert.equal(await page.evaluate(async () => (await indexedDB.databases()).length), 0);
    check('System entry without credentials; storage/cookies/IndexedDB remain empty');
    await context.close();
    console.log('PASS CMS preview', width);
  }
  const narrow = await browser.newContext({
    viewport: { width: 320, height: 900 },
    deviceScaleFactor: 1,
  });
  page = await narrow.newPage();
  await page.goto(report.base + '/login');
  await page.getByRole('button', { name: 'Kiểm tra đăng nhập (xem thử)', exact: true }).waitFor();
  await shot('login');
  await page.getByRole('link', { name: /Xem thử quản trị nội dung/ }).click();
  await ready();
  await shot('questions');
  await navScope();
  await shot('content-menu');
  await page.keyboard.press('Escape');
  check('Additional 320px viewport: login, shell and drawer without horizontal overflow');
  await narrow.close();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.forbiddenRequests, []);
  report.completed = true;
})()
  .catch(async (e) => {
    report.failure = e.stack;
    console.error(e);
    if (page && !page.isClosed())
      await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  });
