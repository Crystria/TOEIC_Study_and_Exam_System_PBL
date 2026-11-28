const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WEB_QA_URL || 'http://localhost:3006';
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const out = path.resolve(
  process.env.DEMO_QA_OUT || 'tmp/frontend-integration-session33/browser-demo',
);
if (fs.existsSync(path.join(out, 'browser-report.json')))
  throw new Error('Use a fresh DEMO_QA_OUT');
fs.mkdirSync(out, { recursive: true });
const report = {
  kind: 'DEMO regression; not real account/API E2E',
  checks: [],
  errors: [],
  forbiddenRequests: [],
};
let browser;
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push({ width, message: error.message }));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/'))
        report.forbiddenRequests.push({ width, path: new URL(request.url()).pathname });
    });
    for (const route of [
      '/',
      '/dashboard',
      '/study/vocabulary',
      '/study/grammar',
      '/exam',
      '/history',
      '/analytics',
      '/ai-chat',
      '/profile',
      '/settings',
    ]) {
      await page.goto(base + route);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await page.waitForFunction(() => !document.querySelector('.dashboard-skeleton'));
      const size = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
      }));
      assert.ok(size.scroll <= size.width + 1, `${width} ${route}: ${JSON.stringify(size)}`);
      assert.equal(await page.getByText('API · Dữ liệu server', { exact: false }).count(), 0);
      report.checks.push({ width, route });
    }
    await page.goto(base + '/login');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('[aria-invalid=true]') === document.activeElement,
    );
    report.checks.push({ width, route: '/login', validation: true });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.forbiddenRequests, []);
  report.completed = true;
})()
  .catch((error) => {
    report.failure = error.stack;
    process.exitCode = 1;
    console.error(error.message);
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
