/* Real frontend HTTP/browser smoke, without response stubs or credentials.
 * This does not establish authenticated Gateway/backend integration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const web = process.env.WEB_QA_URL || 'http://127.0.0.1:3106';
const cms = process.env.CMS_QA_URL || 'http://127.0.0.1:3107';
const out = path.resolve(
  process.env.LOCAL_QA_OUT || 'tmp/frontend-integration-session33/browser-local',
);
if (fs.existsSync(path.join(out, 'browser-report.json')))
  throw new Error('Use a fresh LOCAL_QA_OUT');
fs.mkdirSync(out, { recursive: true });
const report = {
  kind: 'real read-only frontend HTTP/browser; no response stubs; no authenticated backend acceptance',
  http: [],
  checks: [],
  errors: [],
  mutationRequests: [],
  authenticatedBackend: 'NOT_VERIFIED',
};
let browser;
(async () => {
  for (const base of [web, cms]) {
    const response = await fetch(base + '/login');
    assert.equal(response.status, 200);
    const html = await response.text();
    const assets = [
      ...new Set(
        [...html.matchAll(/(?:src|href)="([^" ]+\.(?:css|js)(?:\?[^" ]*)?)"/g)].map((m) => m[1]),
      ),
    ];
    assert.ok(
      assets.some((a) => a.includes('.css')),
      'Missing stylesheet',
    );
    assert.ok(
      assets.some((a) => a.includes('.js')),
      'Missing JavaScript chunks',
    );
    for (const asset of assets) {
      const result = await fetch(new URL(asset.replaceAll('&amp;', '&'), base));
      assert.equal(result.status, 200, asset);
      const contentType = result.headers.get('content-type') || '';
      assert.match(contentType, asset.includes('.css') ? /text\/css/ : /javascript/);
      await result.body?.cancel();
      report.http.push({
        app: base === web ? 'web' : 'cms',
        asset: asset.split('?')[0],
        status: result.status,
        contentType,
      });
    }
    for (const [endpoint, expected] of [
      ['auth/session', 401],
      ['users/me', 401],
      ['ai/conversations', 501],
    ]) {
      const result = await fetch(`${base}/api/frontend/${endpoint}`);
      assert.equal(result.status, expected, endpoint);
      assert.match(result.headers.get('cache-control') || '', /no-store/);
      const payload = await result.json();
      report.http.push({
        app: base === web ? 'web' : 'cms',
        endpoint,
        status: result.status,
        code: payload.code,
      });
    }
  }
  const metadata = await fetch(`${cms}/api/frontend/tests/cms-metadata`);
  assert.equal(metadata.status, 503);
  assert.equal((await metadata.json()).code, 'METADATA_RUNTIME_VERIFICATION_REQUIRED');
  report.checks.push({
    name: 'real HTTP/CSS/chunks, anonymous session denial and blocked contracts',
  });
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push({ width, message: e.message }));
    page.on('request', (r) => {
      if (!['GET', 'HEAD'].includes(r.method()))
        report.mutationRequests.push({ path: new URL(r.url()).pathname, method: r.method() });
    });
    page.on('response', (r) => {
      if (new URL(r.url()).pathname.startsWith('/_next/') && r.status() >= 400)
        report.errors.push({ width, status: r.status(), asset: new URL(r.url()).pathname });
    });
    for (const [base, route] of [
      [web, '/login'],
      [web, '/register'],
      [web, '/dashboard'],
      [cms, '/login'],
      [cms, '/users'],
    ]) {
      await page.goto(base + route);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      if (route === '/register') {
        await page.getByText('Đăng ký đang tắt', { exact: false }).waitFor();
        assert.ok(
          await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).isDisabled(),
        );
        assert.ok(await page.getByLabel('Email', { exact: true }).isDisabled());
      } else if (route === '/dashboard' || route === '/users') {
        await page.getByRole('link', { name: 'Đăng nhập để tiếp tục', exact: true }).waitFor();
        assert.equal(await page.locator('aside.cms-desktop-sidebar').count(), 0);
      } else {
        const submit = page.getByRole('button', { name: 'Đăng nhập', exact: true });
        await submit.waitFor();
        await page.waitForFunction(() => !document.querySelector('form button').disabled);
        await submit.click();
        await page.waitForFunction(
          () => document.querySelector('[aria-invalid=true]') === document.activeElement,
        );
      }
      const size = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.ok(size.scroll <= size.client + 1);
      report.checks.push({ width, app: base === web ? 'web' : 'cms', route });
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.mutationRequests, []);
  report.completed = true;
})()
  .catch((e) => {
    report.failure = e.stack;
    process.exitCode = 1;
    console.error(e.message);
  })
  .finally(async () => {
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(
      JSON.stringify({
        completed: report.completed,
        checks: report.checks.length,
        errors: report.errors.length,
      }),
    );
  });
