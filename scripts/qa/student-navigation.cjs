// Focused regression for Back after in-page links. Uses only fresh QA contexts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/screenshots/student-regression-20261027');
const report = { checks: [], errors: [], apiRequests: [], base: 'http://localhost:3006' };
let browser;
async function restored(p, url, title) {
  await p.goBack();
  await p.waitForURL(url);
  await p.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(await p.locator('main h1').first().innerText(), title);
  report.checks.push({ url: p.url(), title, viewport: p.viewportSize() });
}
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  report.browser = browser.version();
  for (const width of [1440, 768, 390]) {
    const c = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const p = await c.newPage();
    p.on('pageerror', (e) => report.errors.push(e.message));
    p.on('request', (r) => {
      if (/\/api\/|localhost:3000/.test(r.url())) report.apiRequests.push(r.url());
    });
    await p.goto(report.base + '/dashboard');
    await p.locator('.stat-card').first().waitFor();
    const title = await p.locator('main h1').first().innerText();
    await p.locator('.skip-link').focus();
    await p.keyboard.press('Enter');
    await p.waitForURL('**/dashboard#main-content');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'main-content');
    const dashboardUrl = p.url();
    await p.locator('.profile-menu summary').click();
    await p.locator('.profile-dropdown a[href="/profile"]').click();
    await p.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).waitFor();
    await restored(p, dashboardUrl, title);

    await p.goto(report.base + '/study/grammar');
    await p.locator('a[href^="/study/grammar/"]').first().click();
    await p.locator('#lesson-title').waitFor();
    const lessonTitle = await p.locator('#lesson-title').innerText();
    for (const [route, ready] of [
      ['profile', 'Chỉnh sửa thông tin'],
      ['settings', 'Thiết lập cài đặt demo'],
    ]) {
      if (width === 390) {
        const toc = p.locator('.lesson-mobile-toc');
        if ((await toc.getAttribute('open')) === null) await toc.locator('summary').click();
        await toc.locator('a').first().click();
      } else await p.locator('.lesson-toc a').first().click();
      await p.waitForURL(/#lesson-section-/);
      const lessonUrl = p.url();
      await p.locator('.profile-menu summary').click();
      await p.locator(`.profile-dropdown a[href="/${route}"]`).click();
      await p.getByRole('button', { name: ready, exact: true }).waitFor();
      await restored(p, lessonUrl, lessonTitle);
    }
    assert.deepEqual(await p.evaluate(() => ({ ...localStorage })), {});
    await c.close();
    console.log('PASS Back URL and content at', width);
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.apiRequests, []);
  report.completed = true;
})()
  .catch((e) => {
    report.failure = e.stack;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'navigation-report.json'), JSON.stringify(report, null, 2));
  });
