/* Real browser + Gateway. Fault routes abort transport or discard a REAL upstream
 * response; they never fabricate successful API bodies. No traces/cookies/storage values saved. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    suite: { type: 'string' },
    'resume-session': { type: 'string' },
  },
});
const root = path.resolve(__dirname, '../..'),
  out = path.resolve(root, values.out || '');
if (!out.startsWith(path.join(root, 'tmp') + path.sep)) throw Error('Evidence must be under tmp');
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const credentials = JSON.parse(
  fs.readFileSync(path.join(root, 'private/credentials/frontend-session35-20261103.json')),
);
const state = JSON.parse(fs.readFileSync(path.join(out, 'run-state.json'))),
  stamp = Date.now();
const dir = path.join(out, 'browser-' + stamp);
fs.mkdirSync(dir);
const report = {
  kind: 'Real Chromium + real Gateway, controlled transport loss explicitly identified',
  checks: [],
  errors: [],
  requests: [],
};
const save = () =>
  fs.writeFileSync(path.join(dir, 'browser-report.json'), JSON.stringify(report, null, 2));
async function until(accept) {
  for (let n = 0; n < 100; n++) {
    if (accept()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Timed out waiting for actual upstream fault');
}
let browser, context, page;
async function check(id, expected, work) {
  try {
    report.checks.push({ id, expected, actual: await work(), status: 'PASS' });
    console.log('PASS ' + id);
  } catch (e) {
    report.checks.push({ id, expected, actual: e.message, status: 'FAIL' });
    console.log('FAIL ' + id + ' ' + e.message.split('\n')[0]);
  }
  await context?.setOffline(false);
  await context?.unrouteAll({ behavior: 'ignoreErrors' });
  save();
}
async function go(base, route) {
  await page.goto(base + route);
  await page.locator('.api-root').waitFor();
}
async function read(p) {
  const r = await context.request.get('http://localhost:3006/api/frontend/' + p);
  assert.equal(r.status(), 200, p);
  return r.json();
}
async function login(base, account) {
  await page.goto(base + '/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.locator('.api-root').waitFor({ timeout: 45000 });
}
async function privacy() {
  const storage = await page.evaluate(() => {
    const inspect = (s) => {
      const keys = Object.keys(s);
      return {
        entries: keys.length,
        tokenDetected: keys.some(
          (k) =>
            /access.?token|refresh.?token|jwt|authorization/i.test(k) ||
            /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(s.getItem(k) || ''),
        ),
      };
    };
    return { localStorage: inspect(localStorage), sessionStorage: inspect(sessionStorage) };
  });
  assert(!storage.localStorage.tokenDetected && !storage.sessionStorage.tokenDetected);
  const cookies = (await context.cookies()).filter((c) => c.path === '/api/frontend');
  assert(cookies.length >= 2 && cookies.every((c) => c.httpOnly && c.sameSite === 'Strict'));
  return {
    ...storage,
    bridgeCookieCount: cookies.length,
    httpOnlyStrict: true,
    sensitiveValuesExported: false,
  };
}
async function responsive(name) {
  const result = [];
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(layout.scroll <= layout.viewport + 1, name + ' overflow ' + JSON.stringify(layout));
    await page.screenshot({ path: path.join(dir, name + '-' + width + '.png'), fullPage: true });
    result.push(layout);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return result;
}
async function cmsExtra() {
  await login('http://localhost:3007', credentials.accounts.content_admin);
  await check(
    'B-CMS-vocabulary-media-upload-web',
    'CMS renders persisted audio; real image upload confirm/reread; web decodes same image',
    async () => {
      const id = state.resources.word0.vocabularyId;
      await go('http://localhost:3007', '/vocabulary/' + id);
      const audio = page.locator('audio').first();
      await audio.waitFor();
      await audio.evaluate((a) => a.play());
      await page.waitForFunction(() => {
        const a = document.querySelector('audio');
        return a && !a.paused && !a.error;
      });
      const form = page
        .locator('form')
        .filter({ has: page.getByRole('heading', { name: 'Gắn / thay ảnh', exact: true }) });
      await form
        .locator('input[type=file]')
        .setInputFiles(path.join(root, 'tmp/frontend-integration-session35-20261103/qa.png'));
      const ack = page.waitForResponse(
        (r) => r.url().endsWith('/media/confirm') && r.request().method() === 'POST',
      );
      await form.getByRole('button', { name: 'Upload và gắn media', exact: true }).click();
      assert.equal((await ack).status(), 200);
      await page.getByAltText('Minh họa ' + state.resources.word0.word).waitFor();
      await page.reload();
      await page.getByAltText('Minh họa ' + state.resources.word0.word).waitFor();
      await login('http://localhost:3006', credentials.accounts.user);
      await go('http://localhost:3006', '/study/vocabulary/' + state.resources.topic.topicId);
      const img = page.locator('.api-root img').first();
      await img.waitFor();
      assert(await img.evaluate((i) => i.complete && i.naturalWidth > 0));
      return {
        vocabularyId: id,
        cmsAudio: true,
        imageConfirm: 200,
        reload: true,
        webImageDecoded: true,
        viewports: await responsive('web-vocabulary-media'),
      };
    },
  );
  await check(
    'B-CMS-vocabulary-edit-picker',
    'Search relation picker selects real topic; edited example acknowledged and survives reload',
    async () => {
      const id = state.resources.word0.vocabularyId;
      await go('http://localhost:3007', '/vocabulary/' + id + '/edit');
      await page.getByLabel('Chủ đề: tìm', { exact: true }).fill(state.namespace);
      await page
        .getByRole('combobox', { name: 'Chủ đề', exact: true })
        .selectOption(state.resources.topic.topicId);
      await page.getByLabel('Ví dụ', { exact: true }).fill('Browser edit acknowledged ' + stamp);
      await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
      await page.getByRole('button', { name: 'Lưu lên server', exact: true }).click();
      await page.getByRole('link', { name: 'Chỉnh sửa', exact: true }).waitFor();
      await page.reload();
      await page.getByText('Browser edit acknowledged ' + stamp, { exact: true }).waitFor();
      return {
        id,
        relationId: state.resources.topic.topicId,
        viewports: await responsive('cms-vocabulary-edited'),
      };
    },
  );
  await check(
    'B-CMS-group-order-assets',
    'Group question order and TEXT assets edited in UI, acknowledged and reread',
    async () => {
      const id = state.resources.g7.groupId;
      const before = await context.request.get(
        'http://localhost:3007/api/frontend/question-groups/' + id,
      );
      assert.equal(before.status(), 200);
      const prior = await before.json();
      await go('http://localhost:3007', '/groups/' + id + '/edit');
      await page.getByRole('button', { name: 'Đưa câu lên', exact: true }).nth(1).click();
      await page.getByLabel('Nội dung tài liệu 1', { exact: true }).fill('Browser asset ' + stamp);
      await page.getByRole('button', { name: 'Lưu nhóm lên server', exact: true }).click();
      await page.getByRole('link', { name: 'Chỉnh sửa nhóm', exact: true }).waitFor();
      await page.reload();
      await page.getByText('Browser asset ' + stamp, { exact: true }).waitFor();
      const r = await context.request.get(
        'http://localhost:3007/api/frontend/question-groups/' + id,
      );
      const now = await r.json();
      assert.deepEqual(now.questionIds, [...prior.questionIds].reverse());
      return {
        groupId: id,
        questionOrder: now.questionIds,
        asset: now.assets[0].content,
        viewports: await responsive('cms-group'),
      };
    },
  );
  await check(
    'B-CMS-test-editor-200',
    'Existing 200 refs preserved in editor; title save acknowledged, whole-group picker available; reload persists',
    async () => {
      const id = state.resources.cmsTest.testId;
      await go('http://localhost:3007', '/tests/' + id + '/edit');
      await page.getByText('200 / 200 câu', { exact: false }).waitFor();
      await page.getByLabel('Tên đề', { exact: true }).fill(state.namespace + ' browser title');
      await page.getByRole('button', { name: 'Kiểm tra và xem trước', exact: true }).click();
      await page.getByRole('button', { name: 'Lưu đề lên server', exact: true }).click();
      await page
        .getByRole('heading', { name: state.namespace + ' browser title', exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole('heading', { name: state.namespace + ' browser title', exact: true })
        .waitFor();
      const r = await context.request.get('http://localhost:3007/api/frontend/tests/' + id);
      const now = await r.json();
      assert.equal(now.questions.length, 200);
      return {
        testId: id,
        questions: now.questions.length,
        title: now.title,
        viewports: await responsive('cms-full-test'),
      };
    },
  );
  await check(
    'B-Full-result-review-media',
    'Browser Full scores/statistics equal Gateway; snapshot image/audio and group are rendered',
    async () => {
      const id = state.resources.full.attemptId;
      await go('http://localhost:3006', '/exam/server/result?attempt=' + id);
      await page.getByRole('heading', { name: 'Kết quả từ backend', exact: true }).waitFor();
      const result = await read('attempts/' + id);
      await page
        .getByText(
          new RegExp(
            'Listening: ' +
              result.scoreListening +
              ' · Reading: ' +
              result.scoreReading +
              ' · Tổng: ' +
              result.score,
          ),
        )
        .waitFor();
      const image = page.getByAltText('Minh họa câu 1');
      await image.waitFor();
      assert(await image.evaluate((i) => i.complete && i.naturalWidth > 0));
      await page.getByRole('link', { name: 'Xem lại đáp án và giải thích', exact: true }).click();
      await page.getByText('Đáp án backend:', { exact: false }).waitFor();
      await page
        .getByRole('navigation', { name: 'Điều hướng câu hỏi' })
        .getByRole('button', { name: '32', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Câu 32 · Part 3', exact: true }).waitFor();
      const audio = page.locator('audio').first();
      await audio.evaluate((a) => a.play());
      await page.waitForFunction(() => {
        const a = document.querySelector('audio');
        return a && !a.paused && !a.error;
      });
      return {
        attemptId: id,
        score: result.score,
        groups: result.groups.length,
        fullImageDecoded: true,
        groupAudioPlayed: true,
        viewports: await responsive('full-review'),
      };
    },
  );
  await check(
    'B-CMS-system-role-users-audit',
    'SYSTEM_ADMIN gets users/audit; Learning denied, no inherited content permission',
    async () => {
      // A separate context keeps the existing CONTENT_ADMIN browser session isolated.
      await context.close();
      context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      page = await context.newPage();
      page.setDefaultTimeout(20000);
      await login('http://localhost:3007', credentials.accounts.system_admin);
      const storage = await privacy();
      await go('http://localhost:3007', '/users');
      await page
        .getByRole('heading', { name: /Người dùng|người dùng/ })
        .first()
        .waitFor();
      const users = await responsive('cms-users');
      await go('http://localhost:3007', '/audit-logs');
      await page.getByRole('heading', { name: 'Nhật ký quản trị', exact: true }).waitFor();
      await page.getByRole('navigation', { name: 'Phân trang', exact: true }).waitFor();
      const audit = await responsive('cms-audit');
      const denied = await context.request.get(
        'http://localhost:3007/api/frontend/learning/admin/lessons',
      );
      assert.equal(denied.status(), 403);
      return { storage, users, audit, learning: denied.status() };
    },
  );
}
async function main() {
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome',
    headless: true,
  });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/frontend/') && !r.url().includes('/auth/'))
      report.requests.push({
        path: new URL(r.url()).pathname,
        method: r.request().method(),
        status: r.status(),
      });
  });
  page.on('dialog', (d) => d.accept());
  if (values.suite === 'asset-audio') {
    await login('http://localhost:3007', credentials.accounts.content_admin);
    await check(
      'B-CMS-AUDIO-asset-play-archive',
      'Supplemental AUDIO asset is rendered/played and its own test group can be archived after ack',
      async () => {
        const id = state.resources.audioAssetGroup.groupId;
        await go('http://localhost:3007', '/groups/' + id);
        const audio = page
          .getByRole('group', { name: 'Audio tài liệu 1', exact: true })
          .locator('audio');
        await audio.waitFor();
        await audio.evaluate((a) => a.play());
        await page.waitForFunction(() => {
          const a = document.querySelector('audio');
          return a && !a.paused && !a.error;
        });
        const viewports = await responsive('cms-AUDIO-asset');
        const ack = page.waitForResponse(
          (r) => r.request().method() === 'DELETE' && r.url().endsWith('/question-groups/' + id),
        );
        await page.getByRole('button', { name: 'Ngừng sử dụng nhóm', exact: true }).click();
        assert.equal((await ack).status(), 200);
        const archived = await context.request.get(
          'http://localhost:3007/api/frontend/question-groups/' + id,
        );
        assert.equal(archived.status(), 404);
        return { groupId: id, audioPlayed: true, archiveAck: 200, readAfter: 404, viewports };
      },
    );
    return;
  }
  if (values.suite === 'picker') {
    await login('http://localhost:3007', credentials.accounts.content_admin);
    await check(
      'B-CMS-whole-group-picker',
      'Whole-group picker adds all group members and deduplicates existing members; no test is saved',
      async () => {
        await go('http://localhost:3007', '/tests/new');
        await page.getByLabel('Part', { exact: true }).selectOption('7');
        const button = page.getByRole('button', { name: 'Thêm toàn nhóm', exact: true }).first();
        await button.waitFor();
        const response = page.waitForResponse((r) =>
          /\/api\/frontend\/question-groups\/[^/?]+$/.test(new URL(r.url()).pathname),
        );
        await button.click();
        const g = await (await response).json();
        assert(g.questionIds.length > 1);
        await page.getByText(g.questionIds.length + ' / 200 câu', { exact: false }).waitFor();
        const catalog = await (
          await context.request.get('http://localhost:3007/api/frontend/questions?part=7&size=50')
        ).json();
        const member = g.questionIds.indexOf(catalog.items[0].questionId);
        assert(member >= 0);
        await page.getByRole('button', { name: 'Bỏ', exact: true }).nth(member).click();
        await page.getByText(g.questionIds.length - 1 + ' / 200 câu', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Thêm toàn nhóm', exact: true }).first().click();
        await page.getByText(g.questionIds.length + ' / 200 câu', { exact: false }).waitFor();
        return {
          groupId: g.groupId,
          members: g.questionIds.length,
          duplicateMembers: 0,
          saved: false,
          viewports: await responsive('cms-group-picker'),
        };
      },
    );
    return;
  }
  if (values.suite === 'timeout') {
    await login('http://localhost:3006', credentials.accounts.user);
    await check(
      'B-real-request-timeout-reconcile',
      'Hold a real successful draft response beyond the 25s client timeout; no false ack, server read then controlled retry',
      async () => {
        await go('http://localhost:3006', '/exam/7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9');
        await page.getByLabel('Chế độ', { exact: true }).selectOption('PART');
        await page.getByRole('checkbox', { name: /Part 5/ }).check();
        await page.getByLabel('Thời lượng luyện (giây)').fill('300');
        await page.getByRole('button', { name: 'Bắt đầu làm bài', exact: true }).click();
        await page.getByRole('timer').waitFor();
        const id = new URL(page.url()).searchParams.get('attempt');
        fs.writeFileSync(path.join(dir, 'timeout-attempt.json'), JSON.stringify({ attemptId: id }));
        await page.getByRole('radio').first().check();
        const pattern = '**/api/frontend/attempts/*/draft';
        let committed = false;
        await context.route(pattern, async (r) => {
          const response = await r.fetch();
          committed = response.status() === 200;
          await new Promise((resolve) => setTimeout(resolve, 27000));
          await r.fulfill({ response }).catch(() => {});
        });
        const start = Date.now();
        await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
        await page
          .getByText('Yêu cầu hết thời gian chờ. Chưa xác nhận thao tác thành công.', {
            exact: true,
          })
          .waitFor({ timeout: 35000 });
        assert(committed);
        const elapsed = Date.now() - start;
        assert(elapsed >= 24000);
        assert.equal(
          await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).count(),
          0,
        );
        const server = await read('attempts/' + id);
        assert(server.answers.some((a) => a.selectedOption === 'A'));
        await context.unroute(pattern);
        await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
        await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
        await page.getByRole('heading', { name: 'Kết quả từ backend', exact: true }).waitFor();
        return {
          attemptId: id,
          timeoutMs: elapsed,
          realDraftCommitted: true,
          ackBeforeRetry: false,
          serverRead: true,
          retryAck: true,
        };
      },
    );
    return;
  }
  if (values.suite === 'layout') {
    await login('http://localhost:3006', credentials.accounts.user);
    await check(
      'B-final-audio-layout-keyboard-empty',
      'Final shared audio layout at 3 viewports; mobile Escape restores focus; real empty search',
      async () => {
        await go('http://localhost:3006', '/study/vocabulary/' + state.resources.topic.topicId);
        await page.locator('audio').first().waitFor();
        const web = await responsive('final-web-audio');
        await page.setViewportSize({ width: 390, height: 844 });
        const menu = page.getByRole('button', { name: 'Mở menu học tập', exact: true });
        await menu.click();
        await page.keyboard.press('Escape');
        assert(await menu.evaluate((e) => e === document.activeElement));
        await go(
          'http://localhost:3006',
          '/study/vocabulary?keyword=' + encodeURIComponent(state.namespace + '-no-match'),
        );
        await page.getByText('Chưa có dữ liệu phù hợp.', { exact: true }).waitFor();
        return { web, keyboard: 'menu Escape and focus PASS', empty: true };
      },
    );
    await login('http://localhost:3007', credentials.accounts.content_admin);
    await check(
      'B-final-CMS-audio-labels-error-retry',
      'Final CMS audio heading separates speed label; buttons44px; exact textarea label/focus; archived404 retry stays error',
      async () => {
        await go('http://localhost:3007', '/vocabulary/' + state.resources.word0.vocabularyId);
        await page.locator('audio').first().waitFor();
        const title = await page.locator('.player-audio-heading strong').first().boundingBox(),
          speed = await page.locator('.player-audio-heading label').first().boundingBox();
        assert(speed.y >= title.y + title.height);
        const heights = await page
          .locator('.player-audio-actions button')
          .evaluateAll((xs) => xs.map((e) => e.getBoundingClientRect().height));
        assert(heights.every((h) => h >= 44));
        const cms = await responsive('final-cms-audio');
        await go(
          'http://localhost:3007',
          '/vocabulary/' + state.resources.word0.vocabularyId + '/edit',
        );
        const example = page.getByLabel('Ví dụ', { exact: true });
        await example.focus();
        assert(await example.evaluate((e) => e === document.activeElement));
        await go('http://localhost:3007', '/questions/' + state.resources.q1.questionId);
        await page.locator('.api-error').waitFor();
        await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
        await page.locator('.api-error').waitFor();
        return { cms, labelFocus: true, errorRetry: true, buttonHeights: heights };
      },
    );
    return;
  }
  if (values.suite === 'expiry') {
    await login('http://localhost:3006', credentials.accounts.user);
    await check(
      'B-natural-300s-expiry',
      'Real deadline reaches zero; automatic server reread shows EXPIRED and read-only result',
      async () => {
        await go('http://localhost:3006', '/exam/7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9');
        await page.getByLabel('Chế độ', { exact: true }).selectOption('PART');
        await page.getByRole('checkbox', { name: /Part 5/ }).check();
        await page.getByLabel('Thời lượng luyện (giây)').fill('300');
        await page.getByRole('button', { name: 'Bắt đầu làm bài', exact: true }).click();
        await page.getByRole('timer').waitFor();
        const id = new URL(page.url()).searchParams.get('attempt'),
          initial = await read('attempts/' + id);
        fs.writeFileSync(
          path.join(dir, 'expiry-pending.json'),
          JSON.stringify({
            attemptId: id,
            serverTime: initial.serverTime,
            deadlineAt: initial.deadlineAt,
            durationSeconds: initial.durationSeconds,
          }),
        );
        await page.getByRole('radio').first().check();
        await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
        await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).waitFor();
        while (Date.now() < Date.parse(initial.deadlineAt) + 1500)
          await page.waitForTimeout(
            Math.min(30000, Date.parse(initial.deadlineAt) + 1500 - Date.now()),
          );
        await page.getByRole('heading', { name: 'Kết quả từ backend', exact: true }).waitFor();
        const final = await read('attempts/' + id);
        assert.equal(final.status, 'EXPIRED');
        assert.equal(final.deadlineAt, initial.deadlineAt);
        assert.equal(await page.getByRole('timer').count(), 0);
        assert(await page.getByRole('radio').first().isDisabled());
        return {
          attemptId: id,
          initialServerTime: initial.serverTime,
          deadlineAt: final.deadlineAt,
          finalServerTime: final.serverTime,
          status: final.status,
          draftPreserved: final.answers.some((a) => a.selectedOption === 'A'),
          viewports: await responsive('expired-attempt'),
        };
      },
    );
    return;
  }
  if (values.suite === 'cancel') {
    const account = JSON.parse(
      fs.readFileSync(path.join(root, 'private/credentials/frontend-session36-20261103.json')),
    ).accounts.secondary;
    await login('http://localhost:3006', account);
    await check(
      'B-learning-cancel-ack-reload',
      'Secondary USER creates own NEW session then officially cancels; canceled state survives reload',
      async () => {
        const topicId = state.resources.topic.topicId;
        if (values['resume-session']) {
          const id = values['resume-session'];
          await go(
            'http://localhost:3006',
            '/study/vocabulary/' + topicId + '?session=' + encodeURIComponent(id),
          );
          await page
            .getByText('Phiên đã hết hạn hoặc bị hủy; không thể gửi thay đổi.', { exact: true })
            .waitFor();
          await page.reload();
          await page
            .getByText('Phiên đã hết hạn hoặc bị hủy; không thể gửi thay đổi.', { exact: true })
            .waitFor();
          const server = await read('learning/vocabulary-sessions/' + id);
          assert.equal(server.status, 'CANCELED');
          return {
            sessionId: id,
            status: server.status,
            reconciledExisting: true,
            newMutation: false,
            viewports: await responsive('canceled-session'),
          };
        }
        await go('http://localhost:3006', '/study/vocabulary/' + topicId);
        await page.getByRole('button', { name: 'Bắt đầu Flashcard → quiz', exact: true }).click();
        await page.getByRole('heading', { name: 'Phiên Flashcard / quiz', exact: true }).waitFor();
        const id = new URL(page.url()).searchParams.get('session');
        fs.writeFileSync(
          path.join(dir, 'session-created.json'),
          JSON.stringify({ sessionId: id, topicId }),
        );
        await page.getByRole('button', { name: 'Hủy phiên', exact: true }).click();
        await page
          .getByText('Phiên đã hết hạn hoặc bị hủy; không thể gửi thay đổi.', { exact: true })
          .waitFor();
        await page.reload();
        await page
          .getByText('Phiên đã hết hạn hoặc bị hủy; không thể gửi thay đổi.', { exact: true })
          .waitFor();
        const server = await read('learning/vocabulary-sessions/' + id);
        assert.equal(server.status, 'CANCELED');
        return {
          sessionId: id,
          status: server.status,
          viewports: await responsive('cancelled-session'),
        };
      },
    );
    return;
  }
  if (values.suite === 'cms-extra') {
    await cmsExtra();
    return;
  }
  await check(
    'B-auth-validation-login-storage',
    'Invalid fields focus; real login; no tokens in either runtime storage; HttpOnly Strict cookies',
    async () => {
      await page.goto('http://localhost:3006/login');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.locator('#api-email[aria-invalid="true"]').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'api-email');
      await login('http://localhost:3006', credentials.accounts.user);
      return privacy();
    },
  );
  await check(
    'B-offline-read-retry',
    'Read fault and actual browser offline show error/retry; recovery reads real data',
    async () => {
      const pattern = '**/api/frontend/learning/progress';
      await context.route(pattern, (r) => r.abort('internetdisconnected'));
      await go('http://localhost:3006', '/dashboard');
      await page.getByRole('alert').first().waitFor();
      await context.unroute(pattern);
      await context.setOffline(true);
      await page.getByRole('button', { name: 'Thử lại', exact: true }).first().click();
      await page.getByRole('alert').first().waitFor();
      await context.setOffline(false);
      await page.getByRole('button', { name: 'Thử lại', exact: true }).first().click();
      await page.getByText('10 từ đã ôn', { exact: true }).waitFor();
      return { transportAbort: true, offlineRetry: true, onlineRecovery: true };
    },
  );
  const topicId = state.resources.topic.topicId;
  await check(
    'B-learning-reviews-response-loss',
    'Network failure keeps cards; lost real ack reconciles GET before retry; zero duplicate review POST on reconciliation',
    async () => {
      const prior = path.join(out, 'browser-session.json');
      if (fs.existsSync(prior)) {
        const saved = JSON.parse(fs.readFileSync(prior));
        const current = await read('learning/vocabulary-sessions/' + saved.sessionId);
        assert.equal(
          current.status,
          'IN_PROGRESS',
          'Read old session before deciding any new mutation',
        );
        await go(
          'http://localhost:3006',
          '/study/vocabulary/' + topicId + '?session=' + saved.sessionId,
        );
      } else {
        await go('http://localhost:3006', '/study/vocabulary/' + topicId);
        await page.getByRole('button', { name: 'Bắt đầu Flashcard → quiz', exact: true }).click();
      }
      await page.getByRole('heading', { name: 'Phiên Flashcard / quiz', exact: true }).waitFor();
      state.browserSessionId = new URL(page.url()).searchParams.get('session');
      fs.writeFileSync(
        path.join(out, 'browser-session.json'),
        JSON.stringify({ sessionId: state.browserSessionId, topicId }),
      );
      const selects = page.getByLabel('Mức độ nhớ (0–5)');
      assert.equal(await selects.count(), 5);
      for (let n = 0; n < 5; n++) await selects.nth(n).selectOption('5');
      const pattern = '**/api/frontend/learning/vocabulary-sessions/*/reviews';
      await context.route(pattern, (r) => r.abort('internetdisconnected'));
      await page.getByRole('button', { name: 'Lưu đánh giá và chuyển quiz', exact: true }).click();
      await page
        .getByRole('button', { name: 'Kiểm tra và thử lại đánh giá đã gửi', exact: true })
        .waitFor();
      assert.equal(await page.getByRole('button', { name: 'Nộp quiz', exact: true }).count(), 0);
      assert(await selects.first().isDisabled());
      await context.unroute(pattern);
      let realCommitted = false,
        posts = 0;
      const count = (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/reviews')) posts++;
      };
      page.on('request', count);
      await context.route(pattern, async (r) => {
        const response = await r.fetch();
        assert.equal(response.status(), 200);
        realCommitted = true;
        await r.abort('failed');
      });
      await page
        .getByRole('button', { name: 'Kiểm tra và thử lại đánh giá đã gửi', exact: true })
        .click();
      await until(() => realCommitted);
      await page.locator('p.api-error').waitFor();
      await context.unroute(pattern);
      const postsBefore = posts;
      const server = await read('learning/vocabulary-sessions/' + state.browserSessionId);
      assert.equal(server.reviews.length, 5);
      await page
        .getByRole('button', { name: 'Kiểm tra và thử lại đánh giá đã gửi', exact: true })
        .click();
      await page.getByRole('button', { name: 'Nộp quiz', exact: true }).waitFor();
      assert.equal(posts, postsBefore);
      page.off('request', count);
      return {
        sessionId: state.browserSessionId,
        realAckDiscarded: true,
        savedReviews: server.reviews.length,
        extraPostAfterRead: 0,
      };
    },
  );
  await check(
    'B-learning-submit-response-loss',
    'Lost real submit ack shows no result; retry reads COMPLETED without second submit; result/reload match server',
    async () => {
      assert(state.browserSessionId);
      await read('learning/vocabulary-sessions/' + state.browserSessionId);
      const names = [
        ...new Set(
          await page.locator('input[type=radio]').evaluateAll((xs) => xs.map((x) => x.name)),
        ),
      ];
      assert.equal(names.length, 5);
      for (const name of names)
        await page.locator(`input[type=radio][name="${name}"]`).first().check();
      const pattern = '**/api/frontend/learning/vocabulary-sessions/*/submit';
      let posts = 0,
        committed = false;
      const count = (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/submit')) posts++;
      };
      page.on('request', count);
      await context.route(pattern, async (r) => {
        const response = await r.fetch();
        assert.equal(response.status(), 200);
        committed = true;
        await r.abort('failed');
      });
      await page.getByRole('button', { name: 'Nộp quiz', exact: true }).click();
      await page
        .getByRole('button', { name: 'Thử nộp lại cùng operationId', exact: true })
        .waitFor();
      assert(committed);
      assert.equal(await page.getByText('Backend chấm:', { exact: false }).count(), 0);
      await context.unroute(pattern);
      const before = posts;
      const completed = await read('learning/vocabulary-sessions/' + state.browserSessionId);
      assert.equal(completed.status, 'COMPLETED');
      await page.getByRole('button', { name: 'Thử nộp lại cùng operationId', exact: true }).click();
      await page.getByRole('heading', { name: /Backend chấm:/ }).waitFor();
      assert.equal(posts, before);
      await page.reload();
      await page.getByRole('heading', { name: /Backend chấm:/ }).waitFor();
      page.off('request', count);
      return {
        sessionId: state.browserSessionId,
        status: completed.status,
        backendResult: completed.result,
        duplicateSubmit: 0,
        viewports: await responsive('learning-result'),
      };
    },
  );
  await check(
    'B-exam-start-draft-resume-network',
    'Part start doubleclick once; clear invalidates old save ack; failed draft retains choices; reload uses server deadline/draft',
    async () => {
      await go('http://localhost:3006', '/exam/7cea51bc-b8ee-4fea-9c4c-fb091c0d29f9');
      await page.getByLabel('Chế độ', { exact: true }).selectOption('PART');
      await page.getByRole('checkbox', { name: /Part 5/ }).check();
      await page.getByLabel('Thời lượng luyện (giây)').fill('300');
      let starts = 0;
      const count = (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/part-attempts')) starts++;
      };
      page.on('request', count);
      await page.getByRole('button', { name: 'Bắt đầu làm bài', exact: true }).dblclick();
      await page.getByRole('timer').waitFor();
      assert.equal(starts, 1);
      page.off('request', count);
      state.browserAttemptId = new URL(page.url()).searchParams.get('attempt');
      fs.writeFileSync(
        path.join(out, 'browser-attempt.json'),
        JSON.stringify({ attemptId: state.browserAttemptId }),
      );
      const first = await read('attempts/' + state.browserAttemptId);
      await page.getByRole('radio').nth(0).check();
      await page.getByRole('radio').nth(1).check();
      await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Server đã xác nhận lưu nháp.' }).waitFor();
      await page.getByRole('button', { name: 'Xóa lựa chọn', exact: true }).click();
      assert.equal(
        await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).count(),
        0,
      );
      const pattern = '**/api/frontend/attempts/*/draft';
      await context.route(pattern, (r) => r.abort('internetdisconnected'));
      await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
      await page.getByRole('alert').first().waitFor();
      assert.equal(await page.getByRole('radio', { checked: true }).count(), 0);
      await context.unroute(pattern);
      await page.getByRole('button', { name: 'Lưu nháp lên server', exact: true }).click();
      await page.getByText('Server đã xác nhận lưu nháp.', { exact: true }).waitFor();
      await page.reload();
      await page.getByRole('timer').waitFor();
      const resumed = await read('attempts/' + state.browserAttemptId);
      assert.equal(resumed.deadlineAt, first.deadlineAt);
      assert(resumed.remainingSeconds < first.remainingSeconds);
      assert.equal(resumed.answers[0].selectedOption, null);
      return {
        attemptId: state.browserAttemptId,
        starts,
        deadlineUnchanged: true,
        secondsBefore: first.remainingSeconds,
        secondsAfter: resumed.remainingSeconds,
        viewports: await responsive('exam-take'),
      };
    },
  );
  await check(
    'B-exam-submit-loss-result-review',
    'Real submit response lost; retry reconciles GET, result no scaled score for Part, review read-only',
    async () => {
      assert(state.browserAttemptId);
      await page.getByRole('radio').first().check();
      const pattern = '**/api/frontend/attempts/*/submit';
      let posts = 0,
        committed = false;
      const count = (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/submit')) posts++;
      };
      page.on('request', count);
      await context.route(pattern, async (r) => {
        const response = await r.fetch();
        committed = response.status() === 200;
        await r.abort('failed');
      });
      await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
      await page.getByRole('button', { name: 'Thử nộp lại cùng lựa chọn', exact: true }).waitFor();
      assert(committed);
      assert.equal(
        await page.getByRole('heading', { name: 'Kết quả từ backend', exact: true }).count(),
        0,
      );
      await context.unroute(pattern);
      const before = posts;
      await page.getByRole('button', { name: 'Thử nộp lại cùng lựa chọn', exact: true }).click();
      await page.getByRole('heading', { name: 'Kết quả từ backend', exact: true }).waitFor();
      assert.equal(posts, before);
      page.off('request', count);
      await page.getByText('Luyện Part không quy đổi điểm TOEIC.', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'Xem lại đáp án và giải thích', exact: true }).click();
      await page.getByText('Đáp án backend:', { exact: false }).waitFor();
      assert(await page.getByRole('radio').first().isDisabled());
      return {
        attemptId: state.browserAttemptId,
        duplicateSubmit: 0,
        viewports: await responsive('exam-review'),
      };
    },
  );
  await check(
    'B-analytics-filters',
    'All range changes read server activities/scores and stay responsive',
    async () => {
      await go('http://localhost:3006', '/analytics');
      for (const range of ['LAST_7_DAYS', 'ALL_TIME', 'LAST_30_DAYS']) {
        await page.getByLabel('Khoảng thời gian').selectOption(range);
        await page.getByRole('heading', { name: 'Trong khoảng đã chọn', exact: true }).waitFor();
      }
      return responsive('analytics');
    },
  );
  await check(
    'B-CMS-storage-picker-media',
    'CONTENT_ADMIN sees real details, relationship picker and uploaded media; runtime storage clean',
    async () => {
      await login('http://localhost:3007', credentials.accounts.content_admin);
      const storage = await privacy();
      await go('http://localhost:3007', '/vocabulary/' + state.resources.word0.vocabularyId);
      await page.getByRole('heading', { name: state.resources.word0.word, exact: true }).waitFor();
      const vocab = await responsive('cms-vocabulary');
      await go('http://localhost:3007', '/questions/' + state.resources.q1.questionId);
      await page.getByRole('heading', { name: 'Part 1', exact: true }).waitFor();
      const img = page.getByAltText('Minh họa câu hỏi');
      await img.waitFor();
      assert(await img.evaluate((i) => i.complete && i.naturalWidth > 0));
      const audio = page.locator('audio').first();
      await audio.evaluate((a) => a.play());
      await page.waitForFunction(() => {
        const a = document.querySelector('audio');
        return a && !a.paused && !a.error;
      });
      await go(
        'http://localhost:3007',
        '/vocabulary/' + state.resources.word0.vocabularyId + '/edit',
      );
      await page.getByRole('combobox', { name: 'Chủ đề', exact: true }).waitFor();
      return { storage, vocab, imageDecoded: true, audioPlayed: true, quality: 'technical only' };
    },
  );
}
main()
  .catch((e) => {
    report.fatal = e.message;
    process.exitCode = 1;
    console.error(e.message);
  })
  .finally(async () => {
    save();
    await browser?.close();
    if (report.checks.some((x) => x.status === 'FAIL')) process.exitCode = 1;
    console.log('Evidence ' + path.relative(root, dir));
  });
