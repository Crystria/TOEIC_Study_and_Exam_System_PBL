const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
const out = process.env.CMS_QA_OUT || path.resolve('tmp/cms-ui-session31/browser');
if (fs.existsSync(path.join(out, 'browser-report.json')))
  throw new Error('Choose a fresh CMS_QA_OUT');
fs.mkdirSync(out, { recursive: true });
const report = { checks: [], errors: [], forbiddenRequests: [], screenshots: [] };
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=',
  'base64',
);
const mp3 = fs.readFileSync(path.resolve('apps/web/public/demo/audio/vocabulary-delivery.mp3'));
let browser, page, width;
const check = (name) => {
  report.checks.push({ width, name });
  console.log('CHECK', width, name);
};
async function tab(label) {
  await page.locator('.ws-tabs').getByRole('link', { name: label, exact: true }).click();
  const routes = {
    'Bài học ngữ pháp': '/lessons',
    'Media cục bộ': '/media',
    'Chủ đề từ vựng': '/topics',
    'Từ vựng': '/vocabulary',
    'Nhóm câu hỏi': '/groups',
    'Ngân hàng câu hỏi': '/questions',
    'Đề thi': '/tests',
  };
  await page.waitForURL((url) => url.pathname === routes[label]);
  if (label === 'Media cục bộ') assert.equal(new URL(page.url()).searchParams.get('keyword'), null);
  await page.locator('.ws-root h1').waitFor();
}
async function preview() {
  await page.getByRole('button', { name: 'Xem trước và kiểm tra', exact: true }).click();
}
async function save() {
  await preview();
  await page.getByRole('button', { name: 'Cập nhật demo trong RAM', exact: true }).click();
  await page.getByRole('link', { name: 'Chỉnh sửa demo', exact: true }).waitFor();
  return new URL(page.url()).pathname.split('/')[2];
}
async function field(name, value) {
  await page.locator('#ws-' + name).fill(value);
}
async function select(name, value) {
  await page.locator('#ws-' + name).selectOption(value);
}
async function create(label, button) {
  await tab(label);
  await page.getByRole('link', { name: button, exact: true }).click();
}
async function edit() {
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+$/.test(url.pathname));
  await page.getByRole('link', { name: 'Chỉnh sửa demo', exact: true }).click();
  await page.locator('.ws-editor-grid form').waitFor();
}
async function geometry() {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(sizes.scroll <= sizes.client, JSON.stringify({ width, ...sizes }));
}
async function shot(name) {
  const target =
    name === 'question-part7'
      ? '.ws-options'
      : name === 'test-structure' || name === 'vocabulary-media'
        ? '.ws-panel article'
        : null;
  if (target) await page.locator(target).first().scrollIntoViewIfNeeded();
  await geometry();
  const file = `${name}-${width}.png`;
  await page.screenshot({ path: path.join(out, file) });
  report.screenshots.push(file);
}
async function backList() {
  await page.getByRole('link', { name: /← Về danh sách/ }).click();
}
async function filter(keyword) {
  await page.locator('input[name=keyword]').fill(keyword);
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await page.waitForURL((url) => url.searchParams.get('keyword') === keyword);
}
async function confirmDelete() {
  await page.getByRole('button', { name: 'Xóa demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận demo' }).click();
}

(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  for (width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    const writes = [];
    await context.exposeBinding('__cmsWrite', (_, type) => writes.push(type));
    await context.addInitScript(() => {
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const old = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.__cmsWrite(method);
          return old.apply(this, args);
        };
      }
    });
    page.on('pageerror', (e) => report.errors.push({ width, message: e.message }));
    page.on('request', (req) => {
      if (
        (!req.url().startsWith(base) && !req.url().startsWith('blob:')) ||
        req.url().includes('/api/') ||
        req.method() !== 'GET' ||
        req.headers().authorization
      )
        report.forbiddenRequests.push({ width, url: req.url(), method: req.method() });
    });
    page.on('response', (res) => {
      if (res.status() >= 400) report.errors.push({ width, status: res.status(), url: res.url() });
    });
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN');
    await page.getByRole('link', { name: 'Tạo bài học demo' }).click();
    await preview();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ws-title');
    await page.locator('#ws-title').press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ws-category');
    await field('title', 'Temporary draft');
    await page.getByRole('button', { name: 'Khôi phục form', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận demo' }).click();
    assert.equal(await page.locator('#ws-title').inputValue(), '');
    await field('title', `QA grammar ${width}`);
    await field('category', 'QA category');
    await field(
      'contentMarkdown',
      '# Grammar preview\n\n**Safe bold** and `code`\n\n<script>window.__unsafe=1</script>\n\n[unsafe](javascript:alert(1))\n\n- Work example.',
    );
    await preview();
    assert.equal(await page.locator('.ws-preview script').count(), 0);
    assert.equal(await page.locator('.ws-preview a[href^="javascript:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__unsafe), undefined);
    await field('title', `QA grammar updated ${width}`);
    assert.ok(await page.getByRole('button', { name: 'Cập nhật demo trong RAM' }).isDisabled());
    const lessonId = await save();
    assert.ok(lessonId.startsWith('demo-created-lessons-'));
    await geometry();
    await edit();
    await field('category', 'QA changed category');
    await save();
    await backList();
    await filter(`QA grammar updated ${width}`);
    assert.equal(await page.locator('.ws-catalog-card').count(), 1);
    await page.locator('.ws-catalog-card h2 a').click();
    await page.waitForURL((url) => url.pathname.includes(lessonId));
    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/lessons');
    assert.ok(new URL(page.url()).searchParams.get('keyword')?.includes('QA grammar'));
    await page.goForward();
    await page.waitForURL((url) => url.pathname.includes(lessonId));
    await page.getByRole('button', { name: 'Xóa demo', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Xóa demo');
    if (width === 1440) await shot('grammar-preview');
    check(
      'Grammar create/validation/safe Markdown/stale preview/update/filter/history/cancel focus',
    );

    await tab('Media cục bộ');
    const input = page.locator('input[type=file]');
    await input.setInputFiles({
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await page.locator('.ws-root [role=alert]').filter({ hasText: 'Chỉ nhận MP3' }).waitFor();
    await input.setInputFiles({
      name: 'huge.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await page.locator('.ws-root [role=alert]').filter({ hasText: 'không vượt 5 MB' }).waitFor();
    await input.setInputFiles({
      name: 'broken.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('not-mp3'),
    });
    await page
      .locator('.ws-root [role=alert]')
      .filter({ hasText: 'không đọc được file' })
      .waitFor();
    await input.setInputFiles({ name: 'qa-image.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('heading', { name: 'qa-image.png', exact: true }).waitFor();
    await input.setInputFiles({ name: 'qa-audio.mp3', mimeType: 'audio/mpeg', buffer: mp3 });
    await page.getByRole('heading', { name: 'qa-audio.mp3', exact: true }).waitFor();
    await page
      .getByRole('heading', { name: 'qa-audio.mp3', exact: true })
      .getByRole('link')
      .click();
    await page.locator('audio').evaluate(async (a) => {
      await a.play();
    });
    await page.waitForTimeout(300);
    assert.ok(await page.locator('audio').evaluate((a) => a.currentTime > 0));
    await page.locator('audio').evaluate((a) => a.pause());
    check('Media rejects format/oversize/corrupt files; decodes PNG and MP3; audio plays locally');
    await create('Chủ đề từ vựng', 'Tạo chủ đề demo');
    await field('name', `QA topic ${width}`);
    const topicId = await save();
    await create('Từ vựng', 'Tạo từ vựng demo');
    await preview();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ws-word');
    await field('word', `QA term ${width}`);
    await field('meaning', 'Từ vựng kiểm tra');
    await field('pronunciation', '/test/');
    await field('example', 'This is a workplace example.');
    await select('topicId', topicId);
    const imageId = await page
      .locator('#ws-imageId option')
      .filter({ hasText: 'qa-image.png' })
      .getAttribute('value');
    const audioId = await page
      .locator('#ws-audioId option')
      .filter({ hasText: 'qa-audio.mp3' })
      .getAttribute('value');
    await select('imageId', imageId);
    await select('audioId', audioId);
    const wordId = await save();
    assert.equal(await page.locator('img').count(), 1);
    assert.equal(await page.locator('audio').count(), 1);
    await page.getByRole('link', { name: `QA topic ${width}`, exact: true }).click();
    await edit();
    await field('name', `QA topic renamed ${width}`);
    await save();
    await page.getByRole('button', { name: 'Xóa demo', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận demo' }).click();
    await page.locator('.ws-root [role=alert]').waitFor();
    assert.ok(await page.locator('.ws-error').textContent());
    await page.getByRole('link', { name: `QA term ${width}`, exact: true }).click();
    await page.getByRole('link', { name: `QA topic renamed ${width}`, exact: true }).waitFor();
    await edit();
    await select('audioId', '');
    await save();
    assert.equal(await page.locator('audio').count(), 0);
    if (width === 768) await shot('vocabulary-media');
    check('Topics/words create/edit/join/preview; used-topic deletion blocks; media detaches');

    const groups = {};
    for (const part of [3, 4, 6, 7]) {
      await create('Nhóm câu hỏi', 'Tạo nhóm câu hỏi demo');
      await field('title', `QA group ${part} ${width}`);
      await select('part', String(part));
      if (part <= 4) {
        await field('transcript', 'Shared conversation transcript.');
        await select('audioId', audioId);
      } else await field('content', `# Shared Part ${part}\n\nPlease read the workplace notice.`);
      groups[part] = await save();
    }
    await edit();
    await field('content', '# Updated shared Part 7\n\nPlease read the updated notice.');
    await save();
    const questionIds = [];
    for (const part of [1, 2, 3, 3, 4, 5, 6, 7]) {
      await create('Ngân hàng câu hỏi', 'Tạo câu hỏi demo');
      await select('part', String(part));
      await field('stem', `QA question Part ${part} ${width}`);
      await select('difficulty', 'EASY');
      for (const key of ['A', 'B', 'C', 'D'])
        await field(`option-${key}`, `${key} workplace choice.`);
      await select('answer', 'B');
      await field('explanation', 'An original explanation for the demo.');
      if (groups[part]) await select('groupId', groups[part]);
      if (part <= 2) {
        await field('transcript', 'A short original listening transcript.');
        await select('audioId', audioId);
      }
      if (part === 1) await select('imageId', imageId);
      questionIds.push(await save());
      await geometry();
    }
    await edit();
    await field('explanation', 'Updated explanation.');
    await save();
    if (width === 390) await shot('question-part7');
    check(
      'All seven Part forms create/validate/preview; shared stimuli/media inheritance and edit',
    );

    await create('Đề thi', 'Tạo đề thi demo');
    await field('title', `QA Mini ${width}`);
    await select('status', 'DRAFT');
    for (const part of [3, 4, 6, 7])
      await page
        .locator('.ws-picker > div')
        .filter({ hasText: `QA group ${part} ${width}` })
        .getByRole('button', { name: 'Thêm nhóm', exact: true })
        .click();
    for (const part of [1, 2, 5])
      await page
        .locator('.ws-picker > div')
        .filter({ hasText: `QA question Part ${part} ${width}` })
        .getByRole('button', { name: 'Thêm câu', exact: true })
        .click();
    await preview();
    await page.locator('.ws-root [role=alert]').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Cập nhật demo trong RAM' }).isDisabled());
    await page.getByRole('button', { name: 'Sắp theo Part 1–7' }).click();
    await select('type', 'FULL');
    await field('durationSeconds', '7200');
    await preview();
    await page.locator('.ws-root [role=alert]').waitFor();
    await select('type', 'MINI');
    await field('durationSeconds', '1800');
    const testId = await save();
    assert.ok(await page.getByText(/8 câu · DRAFT/).count());
    await page
      .locator('.ws-panel details')
      .filter({ has: page.locator('summary').filter({ hasText: 'Câu 1' }) })
      .first()
      .locator('summary')
      .click();
    await edit();
    await page.getByRole('button', { name: 'Xuống mục 1', exact: true }).click();
    await preview();
    await page.locator('.ws-root [role=alert]').waitFor();
    await page.getByRole('button', { name: 'Sắp theo Part 1–7' }).click();
    await save();
    if (width === 320) await shot('test-structure');
    check(
      'Test adds questions/whole groups, sorts/reorders, validates duration/full count, previews and updates structure',
    );
    await tab('Ngân hàng câu hỏi');
    await filter(`QA question Part 1 ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await confirmDelete();
    await page.locator('.ws-root [role=alert]').waitFor();
    check('Question deletion protects test references');

    await tab('Media cục bộ');
    await page
      .getByRole('heading', { name: 'qa-image.png', exact: true })
      .getByRole('link')
      .click();
    await confirmDelete();
    await tab('Ngân hàng câu hỏi');
    await filter(`QA question Part 1 ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await page.locator('.ws-warning summary').click();
    await page.getByText(/Part 1 cần hình ảnh/).waitFor();
    assert.equal(await page.locator('img').count(), 0);
    check('Media deletion removes all references and exposes missing required data');

    await tab('Đề thi');
    await filter(`QA Mini ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await edit();
    await page.getByRole('button', { name: 'Loại câu', exact: true }).first().click();
    await save();
    await confirmDelete();
    await tab('Từ vựng');
    await filter(`QA term ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await confirmDelete();
    await tab('Chủ đề từ vựng');
    await filter(`QA topic renamed ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await confirmDelete();
    await tab('Nhóm câu hỏi');
    await filter(`QA group 7 ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await confirmDelete();
    await tab('Ngân hàng câu hỏi');
    await filter(`QA question Part 7 ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await page.locator('.ws-warning summary').click();
    await page.getByText('Part 6–7 cần nhóm có nội dung dùng chung.', { exact: true }).waitFor();
    await tab('Bài học ngữ pháp');
    await filter(`QA grammar updated ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();
    await confirmDelete();
    check(
      'Test removes a question and deletes; word/topic/group/lesson delete confirmations update lists and references',
    );
    await tab('Ngân hàng câu hỏi');
    await filter(`QA question Part 1 ${width}`);
    await page.locator('.ws-catalog-card h2 a').click();

    await page.reload();
    await page.getByRole('heading', { name: 'Không tìm thấy bản ghi demo' }).waitFor();
    await backList();
    await tab('Bài học ngữ pháp');
    await filter(`QA grammar updated ${width}`);
    assert.equal(await page.locator('.ws-catalog-card').count(), 0);
    check('Reload resets RAM and created IDs become explicit not-found');

    await page.locator('#cms-demo-role').selectOption('SYSTEM_ADMIN');
    await page
      .locator('.ws-catalog-card')
      .first()
      .getByRole('link', { name: 'Xem chi tiết', exact: true })
      .click();
    await edit();
    const oldRoles = await page.locator('#ws-roles input:checked').count();
    assert.ok(oldRoles);
    for (const input of await page.locator('#ws-roles input:checked').all()) await input.uncheck();
    await preview();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ws-roles');
    await page.locator('#ws-roles input').first().check();
    await select('status', 'DISABLED');
    await preview();
    await page.getByRole('button', { name: 'Cập nhật demo trong RAM' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
    assert.ok(page.url().includes('/edit'));
    await page.getByRole('button', { name: 'Cập nhật demo trong RAM' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận demo' }).click();
    await page.getByText('(DISABLED)', { exact: false }).waitFor();
    await backList();
    await page.locator('select[name=status]').selectOption('DISABLED');
    await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
    await page.locator('.ws-catalog-card').first().waitFor();
    await geometry();
    check(
      'User details/read-only identity, roles/status validation, cancel/confirm and filtered list consistency',
    );
    await page.goto(base + '/audit-logs?demoRole=SYSTEM_ADMIN');
    await page.locator('.audit-results[aria-busy=false]').waitFor();
    assert.equal(await page.getByRole('button', { name: /Xóa demo|Cập nhật demo/ }).count(), 0);
    await page.goto(base + '/lessons/new?demoRole=SYSTEM_ADMIN');
    assert.equal(await page.locator('#ws-title').count(), 0);
    await page.goto(base + '/users?demoRole=CONTENT_ADMIN');
    assert.equal(await page.locator('.ws-root').count(), 0);
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN&lessonPreview=error');
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await page.locator('.ws-catalog-card').first().waitFor();
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN&lessonPreview=empty');
    await page.getByRole('heading', { name: 'Chưa có kết quả' }).waitFor();
    await page.goto(base + '/lessons?demoRole=CONTENT_ADMIN&lessonPreview=slow');
    await page.locator('.ws-results[aria-busy=false] .ws-catalog-card').first().waitFor();
    await geometry();

    if (width < 1024) {
      await page.locator('.cms-menu-trigger').focus();
      await page.keyboard.press('Enter');
      await page.locator('.cms-drawer[open]').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(
        await page.evaluate(() => document.activeElement.classList.contains('cms-menu-trigger')),
        true,
      );
    }
    await page.goto(base + '/media/new?demoRole=CONTENT_ADMIN');
    await page.getByRole('heading', { name: 'Không tìm thấy bản ghi demo' }).waitFor();
    await page.goto(base + '/login');
    await page.locator('button[type=submit]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'cms-email');
    assert.equal(await page.locator('#cms-email').getAttribute('aria-invalid'), 'true');
    check('Keyboard field order, mobile menu Escape/focus and login validation regression');

    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));
    assert.deepEqual(storage, { local: 0, session: 0 });
    assert.equal(writes.length, 0);
    assert.deepEqual(await context.cookies(), []);
    check(
      'Audit stays read-only, persona routing, error/retry/empty/slow, no storage/API/auth writes',
    );
    await context.close();
  }
  report.completed = true;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.forbiddenRequests, []);
})()
  .catch((e) => {
    report.failure = e.stack;
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
    await browser?.close();
  });
