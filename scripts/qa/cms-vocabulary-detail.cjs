// Real Chromium, fresh contexts, local demo only. No interception or account/storage seed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CMS_QA_URL || 'http://localhost:3007';
const out =
  process.env.CMS_QA_OUT ||
  path.resolve(__dirname, '../../docs/screenshots/cms-vocabulary-detail-session30-20261029/detail');
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
  credentialReads: [],
};
const words = [
  {
    id: 'demo-vocabulary-001',
    word: 'agenda',
    meaning: 'chương trình cuộc họp',
    pronunciation: '/əˈdʒendə/',
    example: 'Please add the budget review to the agenda for Monday’s meeting.',
  },
  {
    id: 'demo-vocabulary-002',
    word: 'briefing',
    meaning: 'buổi phổ biến thông tin',
    pronunciation: '/ˈbriːfɪŋ/',
    example: 'The team leader will hold a briefing before the new office opens.',
  },
];
let browser, page;
const check = (name) => {
  report.checks.push({ name, viewport: page.viewportSize() });
  console.log('CHECK', page.viewportSize().width, name);
};
async function detail(id = words[0].id, query = 'demoRole=CONTENT_ADMIN') {
  await page.goto(`${base}/vocabulary/${encodeURIComponent(id)}?${query}`);
}
async function normal(index = 0) {
  await page.getByRole('heading', { name: words[index].word, exact: true }).waitFor();
  await page.locator('.vd-content').waitFor();
  await page.locator('#vd-preview:not(:disabled)').waitFor({ state: 'attached' });
}
async function listReady() {
  await page.waitForFunction(
    () => document.querySelector('.vocabulary-results')?.getAttribute('aria-busy') === 'false',
  );
}
async function scenario(value) {
  const controls = page.locator('.vd-preview-controls');
  if ((await controls.getAttribute('open')) === null) await controls.locator('summary').click();
  await page.locator('#vd-preview').selectOption(value);
  await page.waitForURL((url) => (url.searchParams.get('detailPreview') || 'normal') === value);
}
async function shot(name, selector) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
  const viewport = page.viewportSize();
  const geometry = await page.evaluate(() => ({
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
    await context.exposeBinding('__recordCredentialRead', (_source, read) =>
      report.credentialReads.push({ width, ...read }),
    );
    await context.addInitScript(() => {
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          window.__recordCmsWrite({ type: 'Storage.' + method });
          return original.apply(this, args);
        };
      }
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (/token|credential|password|authorization/i.test(key))
          window.__recordCredentialRead({ key });
        return getItem.call(this, key);
      };
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
    context.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(base).origin ||
        /\/api\/|__vd-never-request/.test(url.pathname) ||
        request.method() !== 'GET' ||
        request.headers().authorization ||
        request.headers().cookie
      )
        report.forbiddenRequests.push({ url: request.url(), method: request.method() });
    });
    context.on('response', (response) => {
      if (response.status() >= 400)
        report.httpErrors.push({ url: response.url(), status: response.status() });
    });
    page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));

    for (const [index, item] of words.entries()) {
      await detail(item.id);
      await normal(index);
      assert.equal(await page.locator('.vd-id span').textContent(), item.id);
      assert.equal(await page.locator('[data-vd-field=meaning]').textContent(), item.meaning);
      assert.equal(
        await page.locator('[data-vd-field=pronunciation]').textContent(),
        item.pronunciation,
      );
      assert.equal(
        await page.locator('[data-vd-field=topic]').textContent(),
        'Văn phòng và thư tín',
      );
      assert.equal(await page.locator('.vd-example').textContent(), item.example);
      assert.equal(await page.locator('#vd-title').getAttribute('lang'), 'en');
      assert.equal(await page.locator('.vd-example').getAttribute('lang'), 'en');
      assert.equal(
        await page
          .locator(
            '.vocabulary-detail button,.vocabulary-detail form,.vocabulary-detail input,.vocabulary-detail audio,.vocabulary-detail img,.vocabulary-detail video',
          )
          .count(),
        0,
      );
      await page.reload();
      await normal(index);
      await shot('word-' + (index + 1));
      await shot('example-' + (index + 1), '.vd-example');
    }
    check(
      'Both exact words/metadata/independent examples, English lang, direct/reload, no write/media/student controls',
    );

    // Each history entry owns its ID even when filters would select another catalog row.
    await detail(words[0].id, 'demoRole=CONTENT_ADMIN&keyword=briefing&size=3');
    await normal(0);
    await detail(words[1].id, 'demoRole=CONTENT_ADMIN&keyword=agenda&size=7');
    await normal(1);
    await page.goBack();
    await normal(0);
    assert.equal(new URL(page.url()).searchParams.get('keyword'), 'briefing');
    assert.equal(new URL(page.url()).searchParams.get('size'), '3');
    await page.goForward();
    await normal(1);
    assert.equal(new URL(page.url()).searchParams.get('keyword'), 'agenda');
    assert.equal(new URL(page.url()).searchParams.get('size'), '7');
    check(
      'Both ID history entries retain independent word/query under Back/Forward, regardless of filters',
    );

    const query =
      'demoRole=CONTENT_ADMIN&keyword=i&topicId=demo-topic-office&size=1&vocabularyPreview=slow';
    // i matches briefing and subsequent office words; page1 contains briefing, not agenda.
    await page.goto(`${base}/vocabulary?${query}`);
    await listReady();
    const before = await page.locator('.vocabulary-results').innerText();
    assert.equal(await page.locator('.vocabulary-list a').count(), 1);
    assert.equal(
      await page.locator('.vocabulary-list li').first().getAttribute('data-vocabulary-id'),
      words[1].id,
    );
    await page.locator('.vocabulary-list a').focus();
    await page.keyboard.press('Enter');
    await normal(1);
    assert.equal(await page.locator('.vd-back').getAttribute('href'), '/vocabulary?' + query);
    await page.locator('.vd-back').click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.toString(), query);
    assert.equal(await page.locator('.vocabulary-results').innerText(), before);
    await page.goBack();
    await normal(1);
    await page.goBack();
    await listReady();
    await page.goForward();
    await normal(1);
    await page.reload();
    await normal(1);
    assert.equal(new URL(page.url()).searchParams.toString(), query);
    check(
      'Keyboard list-detail-return, keyword/topic/size/persona/slow scenario and Back/Forward/reload retain catalog results',
    );

    const paged =
      'demoRole=CONTENT_ADMIN&topicId=demo-topic-office&page=2&size=1&vocabularyPreview=slow';
    await page.goto(`${base}/vocabulary?${paged}`);
    await listReady();
    await page.locator('.vocabulary-list a').click();
    await normal(1);
    await scenario('missing');
    assert.equal(await page.locator('.vd-back').getAttribute('href'), '/vocabulary?' + paged);
    await page.locator('.vd-back').click();
    await listReady();
    assert.equal(new URL(page.url()).searchParams.toString(), paged);
    assert.equal(
      await page.locator('.vocabulary-list li').first().getAttribute('data-vocabulary-id'),
      words[1].id,
    );
    await page.goBack();
    await page.waitForURL((url) => url.searchParams.get('detailPreview') === 'missing');
    assert.match(await page.locator('#vd-title').innerText(), /Chưa có dữ liệu từ vựng/);
    await detail(words[0].id, paged);
    await normal();
    await page.locator('.vd-back').click();
    await listReady();
    assert.equal(
      await page.locator('.vocabulary-list li').first().getAttribute('data-vocabulary-id'),
      words[1].id,
    );
    await page.goBack();
    await normal();
    check(
      'Page2/custom size and scenario survive return; tool stays detail-only; direct agenda remains agenda even with briefing list page',
    );

    await detail();
    await normal();
    await page.locator('.vd-back').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .locator('.vd-preview-controls summary')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.notEqual(
      await page
        .locator('.vd-preview-controls summary')
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      'none',
    );
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(
      await page.locator('#vd-preview').evaluate((el) => el === document.activeElement),
      true,
    );
    await shot('keyboard-tool', '.vd-preview-controls');
    check('Tab/Enter reaches preview disclosure and select with visible focus');

    await scenario('missing');
    await page.getByRole('heading', { name: 'Chưa có dữ liệu từ vựng', exact: true }).waitFor();
    for (const [field, text] of [
      ['meaning', 'Chưa có dữ liệu nghĩa.'],
      ['pronunciation', 'Chưa có dữ liệu phiên âm.'],
      ['topic', 'Chưa có dữ liệu mã chủ đề (topicId).'],
    ])
      assert.equal(await page.locator(`[data-vd-field=${field}]`).textContent(), text);
    assert.equal(await page.locator('.vd-missing').textContent(), 'Chưa có dữ liệu câu ví dụ.');
    await shot('missing-fields', '.vd-content');
    await scenario('topic-missing');
    assert.equal(
      await page.locator('[data-vd-field=topic]').textContent(),
      'Chưa có dữ liệu mã chủ đề (topicId).',
    );
    assert.equal(await page.locator('#vd-title').textContent(), words[0].word);
    await shot('topic-missing', '[data-vd-field=topic]');
    await scenario('topic-unknown');
    assert.match(
      await page.locator('[data-vd-field=topic]').innerText(),
      /Không tìm thấy chủ đề khớp mã.*demo-topic-not-in-catalog/,
    );
    assert.equal(await page.locator('.vd-example').textContent(), words[0].example);
    await shot('topic-unresolved', '[data-vd-field=topic]');
    check(
      'Missing word/meaning/IPA/example and missing versus unresolved topic are explicit without fallback',
    );

    await scenario('long');
    assert.equal(await page.locator('.vd-scenario-note').isVisible(), true);
    assert.match(await page.locator('[data-vd-field=meaning]').innerText(), /<strong>/);
    assert.match(await page.locator('.vd-example').innerText(), /<img data-vd-injected/);
    assert.equal(
      await page.locator('.vd-content strong,.vd-content img,[data-vd-injected]').count(),
      0,
    );
    for (const [name, selector] of [
      ['long-word', '.vd-intro'],
      ['long-meaning', '[data-vd-field=meaning]'],
      ['long-ipa', '[data-vd-field=pronunciation]'],
      ['long-topic', '[data-vd-field=topic]'],
      ['long-example', '.vd-example'],
    ])
      await shot(name, selector);
    await scenario('normal');
    await normal();
    assert.equal(await page.locator('.vd-scenario-note').count(), 0);
    assert.equal(await page.locator('.vd-example').textContent(), words[0].example);
    check(
      'Long/unbroken fields and literal HTML have no overflow, injected element/request or mutation on normal restore',
    );

    for (const [id, heading] of [
      ['demo-vocabulary-003', 'Ngoài phạm vi chi tiết demo'],
      ['demo-vocabulary-028', 'Ngoài phạm vi chi tiết demo'],
      ['unknown', 'Không tìm thấy từ vựng'],
    ]) {
      await detail(id, 'demoRole=CONTENT_ADMIN&detailPreview=long');
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await page.locator('.vd-content,.vd-preview-controls').count(), 0);
      await shot(id === 'unknown' ? 'not-found' : 'unsupported-' + id);
    }
    for (const id of [
      'demo-vocabulary-001%2F',
      'tiếng Việt 日本語/?#&=',
      'literal%252F',
      '<script>literal</script>/' + 'LongId'.repeat(30),
      'bad%encoding',
    ]) {
      await detail(id, 'demoRole=CONTENT_ADMIN&returnTo=%2Fusers');
      await page.getByRole('heading', { name: 'Không tìm thấy từ vựng', exact: true }).waitFor();
      await page.waitForURL((url) => !url.searchParams.has('returnTo'));
      assert.equal(await page.locator('.vd-id span').textContent(), id);
      assert.equal(await page.locator('.vd-id script').count(), 0);
      assert.equal(new URL(page.url()).pathname, '/vocabulary/' + encodeURIComponent(id));
      await page.reload();
      await page.getByRole('heading', { name: 'Không tìm thấy từ vựng', exact: true }).waitFor();
      assert.equal(await page.locator('.vd-id span').textContent(), id);
    }
    await shot('opaque-id', '.vd-id');
    check(
      'Unknown versus unsupported, Unicode/slash/percent/HTML IDs preserve opaque identity through normalization and reload',
    );

    await detail(
      words[1].id,
      'keyword=a&keyword=b&topicId=x&topicId=y&page=-1&size=51&detailPreview=error&returnTo=https%3A%2F%2Fevil.test',
    );
    await normal(1);
    await page.waitForURL((url) => url.searchParams.toString() === 'demoRole=CONTENT_ADMIN');
    assert.equal(
      await page.locator('.vd-back').getAttribute('href'),
      '/vocabulary?demoRole=CONTENT_ADMIN',
    );
    await detail(
      words[0].id,
      query + '&detailPreview=missing&returnTo=%2F%2Fevil.test&pathname=/users&random=x',
    );
    await page.waitForURL(
      (url) => url.searchParams.toString() === query + '&detailPreview=missing',
    );
    assert.equal(await page.locator('.vd-back').getAttribute('href'), '/vocabulary?' + query);
    check(
      'Repeated/invalid queries normalize using vocabulary allowlist; fixed back ignores arbitrary paths and detail tool',
    );

    for (const item of words) {
      await detail(item.id, 'demoRole=SYSTEM_ADMIN');
      await page.getByText('PHẠM VI VAI TRÒ DEMO', { exact: true }).waitFor();
      assert.equal(await page.locator('.vocabulary-detail,.vd-content').count(), 0);
    }
    await shot('system-persona-panel');
    await detail();
    await normal();
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
      await menu.click();
      assert.match(await page.locator('dialog [aria-current=page]').innerText(), /Từ vựng/);
      await page.keyboard.press('Tab');
      assert.equal(
        await page.locator('dialog').evaluate((el) => el.contains(document.activeElement)),
        true,
      );
      await shot('mobile-menu');
      await page.keyboard.press('Escape');
      assert.equal(await menu.evaluate((el) => el === document.activeElement), true);
      assert.equal(await page.locator('dialog[open]').count(), 0);
    } else
      assert.match(
        await page.locator('.cms-desktop-sidebar [aria-current=page]').innerText(),
        /Từ vựng/,
      );
    check(
      'System persona never mounts detail; content menu active, mobile keyboard/Escape restores focus',
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
      'Empty cookies/local/session/IndexedDB after all actions, with credential reads and persistence writes monitored',
    );
    await context.close();
  }
  for (const key of [
    'errors',
    'forbiddenRequests',
    'httpErrors',
    'storageWrites',
    'credentialReads',
  ])
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
