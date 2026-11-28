/* Real browser/Gateway RBAC acceptance. Mutates only the newly registered target
 * whose provenance is in this run's target-preparation.json. No tokens/traces saved. */
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { values } = parseArgs({
  options: { out: { type: 'string' }, suite: { type: 'string', default: 'readback' } },
});
const root = path.resolve(__dirname, '../..'),
  out = path.resolve(root, values.out || '');
if (!out.startsWith(path.join(root, 'tmp') + path.sep))
  throw Error('Use session evidence under tmp');
const preparation = JSON.parse(fs.readFileSync(path.join(out, 'target-preparation.json')));
const own = JSON.parse(fs.readFileSync(path.join(root, preparation.privateCredentials)));
assert.equal(own.createdBy, 'frontend-admin-access-qa');
assert.equal(own.target.userId, preparation.targetId);
assert.equal(own.namespace, preparation.namespace);
assert(own.target.email.startsWith(own.namespace + '@'));
const actors = JSON.parse(
  fs.readFileSync(path.join(root, 'private/credentials/frontend-session35-20261103.json')),
).accounts;
assert(
  !Object.values(actors).some((a) => a.userId === own.target.userId),
  'Never mutate an existing account',
);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const dir = path.join(out, 'browser-' + Date.now());
fs.mkdirSync(dir);
const report = {
  at: new Date().toISOString(),
  kind: 'real Chrome UI + bridge + Gateway; transport response loss explicitly identified',
  targetId: own.target.userId,
  namespace: own.namespace,
  checks: [],
  requests: [],
  errors: [],
};
const save = () =>
  fs.writeFileSync(path.join(dir, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let browser, context, page, targetContext, targetPage;
const nativeSessions = [];
let nextLogin = 0;
async function authPace() {
  await wait(Math.max(0, nextLogin - Date.now()));
  nextLogin = Date.now() + 7100;
}
async function native(p, method = 'GET', body, token) {
  const r = await fetch('http://localhost:3000/api/v1/' + p, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(25000),
  });
  const value = await r.json().catch(() => null);
  report.requests.push({ surface: 'Gateway', path: p, method, status: r.status });
  return { status: r.status, value };
}
async function nativeLogin() {
  await authPace();
  const r = await native('auth/login', 'POST', {
    email: own.target.email,
    password: own.target.password,
    deviceId: 's39-rbac-' + crypto.randomUUID(),
  });
  assert.equal(r.status, 200, 'target login');
  assert.equal(r.value.user.userId, own.target.userId);
  nativeSessions.push(r.value);
  return r.value;
}
async function login(p, base, account) {
  await authPace();
  await p.goto(base + '/login');
  await p.getByLabel('Email', { exact: true }).fill(account.email);
  await p.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
  await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await p.locator('.api-root').waitFor({ timeout: 45000 });
}
async function actorRead(p) {
  const r = await context.request.get('http://localhost:3007/api/frontend/' + p);
  assert.equal(r.status(), 200, p);
  return r.json();
}
async function target() {
  const data = await actorRead(
    'admin/users?keyword=' + encodeURIComponent(own.target.email) + '&size=50',
  );
  const user = data.items.find((u) => u.userId === own.target.userId);
  assert(user && user.email === own.target.email, 'Filtered target identity');
  return user;
}
async function openEditor() {
  await page.goto(
    'http://localhost:3007/users?keyword=' + encodeURIComponent(own.target.email) + '&size=1',
  );
  await page.getByRole('link', { name: own.target.fullName, exact: true }).click();
  await page.getByRole('heading', { name: own.target.fullName, exact: true }).waitFor();
}
async function check(id, expected, work) {
  try {
    report.checks.push({ id, expected, actual: await work(), status: 'PASS' });
    console.log('PASS ' + id);
  } catch (e) {
    report.checks.push({ id, expected, actual: e.message, status: 'FAIL' });
    console.log('FAIL ' + id + ' ' + e.message.split('\n')[0]);
    await page
      .screenshot({ path: path.join(dir, id + '-failure.png'), fullPage: true })
      .catch(() => {});
  }
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await guardTarget();
  save();
}
async function responsive(name) {
  const result = [];
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const x = await page.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(x.scroll <= x.viewport + 1, name + ' overflow');
    await page.screenshot({ path: path.join(dir, name + '-' + width + '.png'), fullPage: true });
    result.push(x);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return result;
}
async function revoke(session, label) {
  let latest;
  for (let n = 0; n < 36; n++) {
    latest = await native('users/me', 'GET', undefined, session.accessToken);
    if (latest.status === 401) break;
    await wait(1000);
  }
  assert.equal(latest.status, 401, label + ' access revoked');
  await authPace();
  const refresh = await native('auth/refresh', 'POST', { refreshToken: session.refreshToken });
  assert.equal(refresh.status, 401, label + ' refresh revoked');
  return { access: latest.status, refresh: refresh.status };
}
function mutationAck() {
  return page.getByRole('status').filter({ hasText: 'Server đã xác nhận thay đổi.' });
}
const applyButton = () => page.getByRole('button', { name: 'Áp dụng', exact: true });
const roleSelect = () => page.getByRole('combobox', { name: 'Vai trò tài khoản', exact: true });
const statusSelect = () =>
  page.getByRole('combobox', { name: 'Trạng thái tài khoản', exact: true });

async function inspect() {
  await check(
    'I-ack-invalidated-on-new-draft',
    'Editing roles after an acknowledged save clears the previous success notice',
    async () => {
      await roleSelect().selectOption('CONTENT_ADMIN');
      await applyButton().click();
      await mutationAck().waitFor();
      assert.deepEqual((await target()).roles, ['CONTENT_ADMIN']);
      await roleSelect().selectOption('USER');
      const stale = await mutationAck().isVisible();
      report.observedStaleSuccess = stale;
      assert.equal(stale, false, 'stale successful mutation notice remains on unsaved roles');
      return { cleared: true };
    },
  );
  await check(
    'I-ambiguous-role-change-reconcile',
    'Losing both the committed response and initial readback freezes the draft until manual readback',
    async () => {
      let committed = false;
      let lostReadback = false;
      const pattern = '**/api/frontend/admin/users/' + own.target.userId + '/roles';
      await context.route(pattern, async (r) => {
        const response = await r.fetch();
        committed = response.status() === 200;
        await r.abort('failed');
      });
      await context.route('**/api/frontend/admin/users?*', async (route) => {
        const url = new URL(route.request().url());
        if (committed && !lostReadback && url.searchParams.get('keyword') === own.target.email) {
          lostReadback = true;
          return route.abort('failed');
        }
        return route.fallback();
      });
      await applyButton().click();
      await page.locator('p.api-error').waitFor();
      assert(committed);
      assert(lostReadback);
      const server = await target();
      assert.deepEqual(server.roles, ['USER']);
      report.lostAckCommitted = { roles: server.roles, status: server.status };
      assert(await roleSelect().isDisabled(), 'role input remains editable after uncertain commit');
      await page
        .getByRole('button', { name: 'Kiểm tra trạng thái từ server', exact: true })
        .click();
      await page
        .getByRole('status')
        .filter({ hasText: 'Đã kiểm tra dữ liệu từ server.' })
        .waitFor();
      assert(!(await roleSelect().isDisabled()));
      return { committed: true, frozen: true, manualReadback: true };
    },
  );
}
async function guardTarget() {
  await context.route('**/api/frontend/admin/users/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (
      request.method() === 'PATCH' &&
      ![
        '/api/frontend/admin/users/' + own.target.userId + '/roles',
        '/api/frontend/admin/users/' + own.target.userId + '/status',
      ].includes(url.pathname)
    ) {
      report.guardViolation = url.pathname;
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}
async function keyboardReadback() {
  let patches = 0;
  page.on('request', (r) => {
    if (r.method() === 'PATCH') patches++;
  });
  await check(
    'B-keyboard-final-readback',
    'Keyboard role/status selectors, menu and metadata work without mutation; target remains USER ACTIVE',
    async () => {
      await roleSelect().focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await roleSelect().inputValue(), 'CONTENT_ADMIN');
      assert(!(await applyButton().isDisabled()));
      await page.keyboard.press('ArrowUp');
      assert.equal(await roleSelect().inputValue(), 'USER');
      assert(await applyButton().isDisabled());
      await statusSelect().focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await statusSelect().inputValue(), 'SUSPENDED');
      await applyButton().focus();
      page.removeAllListeners('dialog');
      page.once('dialog', (d) => d.dismiss());
      await page.keyboard.press('Space');
      page.on('dialog', (d) => d.accept());
      await statusSelect().focus();
      await page.keyboard.press('ArrowUp');
      assert.equal(await statusSelect().inputValue(), 'ACTIVE');
      await page.setViewportSize({ width: 390, height: 844 });
      const menu = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
      await menu.click();
      await page.keyboard.press('Escape');
      assert(await menu.evaluate((e) => e === document.activeElement));
      await context.route('**/api/frontend/admin/audit-logs?*', async (route) => {
        const response = await route.fetch();
        await wait(750);
        await route.fulfill({ response });
      });
      await page.goto(
        'http://localhost:3007/audit-logs?targetUserId=' + own.target.userId + '&size=1',
      );
      await page.locator('.api-root').waitFor();
      await page.getByText('Đang tải dữ liệu server…', { exact: true }).waitFor();
      const metadata = page.getByText('Metadata', { exact: true });
      await metadata.focus();
      await page.keyboard.press('Enter');
      assert(await metadata.evaluate((e) => e.parentElement.open));
      const current = await target();
      assert.deepEqual(current.roles, ['USER']);
      assert.equal(current.status, 'ACTIVE');
      assert.equal(patches, 0);
      return {
        roles: current.roles,
        status: current.status,
        patches: 0,
        roleSelectKeyboard: true,
        statusSelectKeyboard: true,
        menuEscapeFocus: true,
        metadataKeyboard: true,
        loadingObserved: true,
      };
    },
  );
}
async function acceptance(resume = false) {
  const auditPath =
    'admin/audit-logs?targetUserId=' +
    own.target.userId +
    '&actorUserId=' +
    actors.system_admin.userId;
  const auditBefore = await actorRead(auditPath + '&size=50');
  const beforeIds = new Set(auditBefore.items.map((a) => a.auditId));
  let userSession, contentSession, recoveredContent, finalUser;
  let mutationCount = 0;
  const timeline = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/frontend/admin/users')) {
      timeline.push({ method: request.method(), path: url.pathname });
      if (request.method() === 'PATCH') mutationCount++;
    }
  });
  if (!resume) {
    await check(
      'B-role-validation-confirmation',
      'An unchanged role cannot save; canceled confirmation sends no PATCH; target USER cannot call admin APIs',
      async () => {
        userSession = await nativeLogin();
        assert.deepEqual(userSession.user.roles, ['USER']);
        assert.equal(
          (await native('admin/users', 'GET', undefined, userSession.accessToken)).status,
          403,
        );
        assert.equal(
          (await native('learning/admin/lessons', 'GET', undefined, userSession.accessToken))
            .status,
          403,
        );
        targetContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
        targetPage = await targetContext.newPage();
        await login(targetPage, 'http://localhost:3006', own.target);
        assert.equal(await roleSelect().inputValue(), 'USER');
        assert.deepEqual(
          await roleSelect()
            .locator('option')
            .evaluateAll((options) => options.map((option) => option.value)),
          ['USER', 'CONTENT_ADMIN'],
        );
        assert(await applyButton().isDisabled());
        await roleSelect().selectOption('CONTENT_ADMIN');
        const before = mutationCount;
        page.removeAllListeners('dialog');
        page.once('dialog', (d) => d.dismiss());
        await applyButton().click();
        page.on('dialog', (d) => d.accept());
        assert.equal(mutationCount, before);
        assert.deepEqual((await target()).roles, ['USER']);
        return {
          unchangedRoleDisabled: true,
          confirmationCanceled: true,
          patches: 0,
          permissions: [403, 403],
        };
      },
    );
    await check(
      'B-grant-role-lost-ack-reconcile-revocation',
      'The app reads back a lost role response without another PATCH; the prior session is revoked',
      async () => {
        assert(userSession);
        let committed = false;
        const pattern = '**/api/frontend/admin/users/' + own.target.userId + '/roles';
        await context.route(pattern, async (route) => {
          const response = await route.fetch();
          committed = response.status() === 200;
          await route.abort('failed');
        });
        const before = mutationCount;
        const start = timeline.length;
        await applyButton().click();
        await mutationAck().waitFor();
        assert(committed);
        assert.deepEqual(
          timeline.slice(start).map(({ method }) => method),
          ['GET', 'PATCH', 'GET'],
        );
        const granted = await target();
        assert.deepEqual(granted.roles, ['CONTENT_ADMIN']);
        assert.equal(await roleSelect().inputValue(), 'CONTENT_ADMIN');
        const reconciledViews = await responsive('roles-confirmed');
        await context.unroute(pattern);
        assert.equal(mutationCount - before, 1);
        const revoked = await revoke(userSession, 'role grant');
        const expiredCookie = await targetContext.request.get(
          'http://localhost:3006/api/frontend/auth/session',
        );
        assert.equal(expiredCookie.status(), 401);
        await targetPage.reload();
        await targetPage.getByRole('heading', { name: 'Tài khoản của bạn', exact: true }).waitFor();
        await roleSelect().selectOption('USER');
        assert.equal(await mutationAck().count(), 0, 'notice cleared on role edit');
        await roleSelect().selectOption('CONTENT_ADMIN');
        return {
          roles: granted.roles,
          patches: 1,
          extraPatchOnReconcile: 0,
          revoked,
          expiredBrowserCookie: 401,
          noticeCleared: true,
          viewports: reconciledViews,
        };
      },
    );
  }
  await check(
    'B-suspend-network-failure-controlled-retry',
    'Failed transport before commit does not save; read mismatch keeps pending data; retry reads before PATCH and suspends once',
    async () => {
      const current = await target();
      assert(current.roles.includes('CONTENT_ADMIN') && current.status === 'ACTIVE');
      contentSession = await nativeLogin();
      assert.equal(
        (await native('learning/admin/lessons', 'GET', undefined, contentSession.accessToken))
          .status,
        200,
      );
      assert.equal(
        (await native('admin/users', 'GET', undefined, contentSession.accessToken)).status,
        403,
      );
      assert.equal(
        (await native('admin/audit-logs', 'GET', undefined, contentSession.accessToken)).status,
        403,
      );
      await targetContext?.close();
      targetContext = await browser.newContext();
      targetPage = await targetContext.newPage();
      await login(targetPage, 'http://localhost:3007', own.target);
      assert.equal(await statusSelect().inputValue(), 'ACTIVE');
      const pattern = '**/api/frontend/admin/users/' + own.target.userId + '/status';
      await context.route(pattern, (r) => r.abort('internetdisconnected'));
      await statusSelect().selectOption('SUSPENDED');
      await applyButton().click();
      await page
        .getByRole('button', { name: 'Kiểm tra trạng thái từ server', exact: true })
        .waitFor();
      assert.equal(await mutationAck().count(), 0);
      assert.equal((await target()).status, 'ACTIVE');
      assert(await statusSelect().isDisabled());
      await page
        .getByRole('button', { name: 'Kiểm tra trạng thái từ server', exact: true })
        .click();
      await page
        .getByText('Dữ liệu server chưa khớp yêu cầu đã gửi. Có thể thử lại.', {
          exact: true,
        })
        .waitFor();
      assert.equal(await mutationAck().count(), 0);
      await context.unroute(pattern);
      const start = timeline.length;
      await page.getByRole('button', { name: 'Thử lại cùng thay đổi', exact: true }).click();
      await mutationAck().waitFor();
      const retry = timeline.slice(start);
      assert(retry[0].method === 'GET' && retry[1].method === 'PATCH', 'read before retry');
      assert.equal((await target()).status, 'SUSPENDED');
      const revoked = await revoke(contentSession, 'suspension');
      const expiredCookie = await targetContext.request.get(
        'http://localhost:3007/api/frontend/auth/session',
      );
      assert.equal(expiredCookie.status(), 401);
      await targetPage.reload();
      await targetPage.getByRole('heading', { name: 'Tài khoản của bạn', exact: true }).waitFor();
      await authPace();
      const deniedLogin = await native('auth/login', 'POST', {
        email: own.target.email,
        password: own.target.password,
        deviceId: 's39-suspended-login',
      });
      assert.equal(deniedLogin.status, 403);
      return {
        failedTransportDidNotCommit: true,
        readMismatchKeptPending: true,
        retryOrder: retry.map((x) => x.method),
        status: 'SUSPENDED',
        revoked,
        expiredBrowserCookie: 401,
        suspendedLogin: 403,
        contentAdminUsersAudit: [403, 403],
        contentAdminLearning: 200,
      };
    },
  );
  await check(
    'B-restore-status-lost-ack-no-duplicate',
    'Readback confirms ACTIVE after a lost response with one PATCH and no old-session revival',
    async () => {
      assert.equal((await target()).status, 'SUSPENDED');
      assert.equal(await statusSelect().inputValue(), 'SUSPENDED');
      const pattern = '**/api/frontend/admin/users/' + own.target.userId + '/status';
      let committed = false;
      await context.route(pattern, async (r) => {
        const response = await r.fetch();
        committed = response.status() === 200;
        await r.abort('failed');
      });
      const before = mutationCount;
      const start = timeline.length;
      await statusSelect().selectOption('ACTIVE');
      await applyButton().click();
      await mutationAck().waitFor();
      assert(committed);
      assert.deepEqual(
        timeline.slice(start).map(({ method }) => method),
        ['PATCH', 'GET'],
      );
      assert.equal((await target()).status, 'ACTIVE');
      await context.unroute(pattern);
      assert.equal(mutationCount - before, 1);
      const revoked = await revoke(contentSession, 'old session after ACTIVE restoration');
      recoveredContent = await nativeLogin();
      assert.equal(
        (await native('learning/admin/lessons', 'GET', undefined, recoveredContent.accessToken))
          .status,
        200,
      );
      await page.reload();
      await page.getByRole('heading', { name: own.target.fullName, exact: true }).waitFor();
      assert.equal(await statusSelect().inputValue(), 'ACTIVE');
      assert.equal(await roleSelect().inputValue(), 'CONTENT_ADMIN');
      return {
        status: 'ACTIVE',
        patches: 1,
        extraPatchOnReadback: 0,
        revoked,
        loginRecovery: 200,
        reload: true,
        viewports: await responsive('roles-active-restored'),
      };
    },
  );
  await check(
    'B-remove-role-doubleclick-reload',
    'Doubleclick emits one mutation; removing CONTENT_ADMIN revokes old access; fresh USER has no admin permission; reload shows final state',
    async () => {
      assert(recoveredContent);
      await roleSelect().selectOption('USER');
      const pattern = '**/api/frontend/admin/users/' + own.target.userId + '/roles';
      await context.route(pattern, async (route) => {
        const response = await route.fetch();
        await wait(350);
        await route.fulfill({ response });
      });
      const before = mutationCount;
      await applyButton().dblclick();
      await mutationAck().waitFor();
      assert.equal(mutationCount - before, 1);
      await context.unroute(pattern);
      const current = await target();
      assert.deepEqual(current.roles, ['USER']);
      assert.equal(current.status, 'ACTIVE');
      const revoked = await revoke(recoveredContent, 'role removal');
      finalUser = await nativeLogin();
      assert.deepEqual(finalUser.user.roles, ['USER']);
      const denied = [];
      for (const p of ['admin/users', 'admin/audit-logs', 'learning/admin/lessons'])
        denied.push((await native(p, 'GET', undefined, finalUser.accessToken)).status);
      assert.deepEqual(denied, [403, 403, 403]);
      await page.reload();
      await page.getByRole('heading', { name: own.target.fullName, exact: true }).waitFor();
      assert.equal(await roleSelect().inputValue(), 'USER');
      return {
        roles: current.roles,
        status: current.status,
        patches: 1,
        revoked,
        freshUserDenied: denied,
        reload: true,
      };
    },
  );
  await check(
    'B-self-account-read-only',
    'Actor can view their account and sends no mutation',
    async () => {
      const me = await actorRead('users/me');
      const before = mutationCount;
      await page.goto(
        'http://localhost:3007/users/' +
          actors.system_admin.userId +
          '?keyword=' +
          encodeURIComponent(actors.system_admin.email),
      );
      await page.getByRole('heading', { name: me.fullName, exact: true }).waitFor();
      assert.equal(await applyButton().count(), 0);
      assert.equal(await roleSelect().count(), 0);
      assert.equal(await statusSelect().count(), 0);
      assert.equal(mutationCount, before);
      return { actorId: actors.system_admin.userId, readOnly: true, patches: 0 };
    },
  );
  await check(
    'B-audit-actor-target-before-after-paging',
    'Four committed changes create four matching audit records; no duplicates from reconcile/retry; UI filter/paging/metadata agree with API',
    async () => {
      const all = await actorRead(auditPath + '&size=50');
      const added = all.items
        .filter((a) => !beforeIds.has(a.auditId))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      assert.equal(added.length, resume ? 3 : 4, 'one audit per actual state transition');
      for (const a of added) {
        assert.equal(a.actorUserId, actors.system_admin.userId);
        assert.equal(a.targetUserId, own.target.userId);
        assert(a.correlationId);
      }
      const expected = [
        {
          action: 'USER_ROLES_CHANGED',
          beforeData: { roles: ['USER'], status: 'ACTIVE' },
          afterData: { roles: ['CONTENT_ADMIN'], status: 'ACTIVE' },
        },
        {
          action: 'USER_STATUS_CHANGED',
          beforeData: { roles: ['CONTENT_ADMIN'], status: 'ACTIVE' },
          afterData: { roles: ['CONTENT_ADMIN'], status: 'SUSPENDED' },
        },
        {
          action: 'USER_STATUS_CHANGED',
          beforeData: { roles: ['CONTENT_ADMIN'], status: 'SUSPENDED' },
          afterData: { roles: ['CONTENT_ADMIN'], status: 'ACTIVE' },
        },
        {
          action: 'USER_ROLES_CHANGED',
          beforeData: { roles: ['CONTENT_ADMIN'], status: 'ACTIVE' },
          afterData: { roles: ['USER'], status: 'ACTIVE' },
        },
      ];
      assert.deepEqual(
        added.map(({ action, beforeData, afterData }) => ({ action, beforeData, afterData })),
        resume ? expected.slice(1) : expected,
      );
      const ids = [];
      for (let n = 1; n <= all.total; n++) {
        const p = await actorRead(auditPath + '&size=1&page=' + n);
        ids.push(p.items[0].auditId);
      }
      assert.equal(new Set(ids).size, all.total);
      assert.deepEqual([...ids].sort(), all.items.map((x) => x.auditId).sort());
      await page.goto(
        'http://localhost:3007/audit-logs?targetUserId=' +
          own.target.userId +
          '&actorUserId=' +
          actors.system_admin.userId +
          '&size=1',
      );
      await page
        .getByText('Người thực hiện: ' + actors.system_admin.userId, { exact: true })
        .waitFor();
      await page.getByRole('button', { name: 'Trang sau', exact: true }).waitFor();
      await page.getByText('Metadata', { exact: true }).click();
      assert((await page.locator('pre').innerText()).includes('"before"'));
      const auditViews = await responsive('audit-target');
      const response = page.waitForResponse(
        (r) =>
          r.url().includes('/admin/audit-logs?') &&
          new URL(r.url()).searchParams.get('page') === '2',
      );
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
      const page2 = await (await response).json();
      assert.equal(page2.items[0].auditId, ids[1]);
      assert.equal(new URL(page.url()).searchParams.get('targetUserId'), own.target.userId);
      fs.writeFileSync(
        path.join(dir, 'audit-readback.json'),
        JSON.stringify({ beforeIds: [...beforeIds], added, all, ids }, null, 2),
      );
      await page.goto('http://localhost:3007/audit-logs?targetUserId=' + crypto.randomUUID());
      await page.getByText('Chưa có dữ liệu phù hợp.', { exact: true }).waitFor();
      return {
        newAuditRows: added.length,
        totalTargetAudit: all.total,
        duplicateIds: 0,
        actorId: actors.system_admin.userId,
        targetId: own.target.userId,
        metadata: true,
        empty: true,
        viewports: auditViews,
      };
    },
  );
  assert(!report.guardViolation, 'Only newly created target may be mutated');
  const current = await target();
  report.finalTarget = { id: current.userId, roles: current.roles, status: current.status };
  assert.deepEqual(current.roles, ['USER']);
  assert.equal(current.status, 'ACTIVE');
}
async function main() {
  const ready = await fetch('http://localhost:3000/ready');
  assert.equal(ready.status, 200);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith('/api/frontend/admin/'))
      report.requests.push({
        surface: 'browser bridge',
        path: url.pathname,
        method: r.request().method(),
        status: r.status(),
      });
  });
  await login(page, 'http://localhost:3007', actors.system_admin);
  const initial = await target();
  assert.deepEqual(
    initial.roles,
    values.suite === 'resume' ? ['CONTENT_ADMIN'] : ['USER'],
    'Reconcile prior run before mutations',
  );
  assert.equal(initial.status, 'ACTIVE');
  report.initialTarget = { roles: initial.roles, status: initial.status };
  await openEditor();
  await guardTarget();
  if (values.suite === 'inspect') {
    await inspect();
    return;
  }
  if (values.suite === 'readback') {
    await keyboardReadback();
    return;
  }
  if (values.suite === 'all' || values.suite === 'resume') {
    await acceptance(values.suite === 'resume');
    return;
  }
  throw Error('Select --suite inspect/all or explicit resume from CONTENT_ADMIN ACTIVE');
}
main()
  .catch((e) => {
    report.fatal = e.message;
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const s of nativeSessions)
      await native('auth/logout', 'POST', { refreshToken: s.refreshToken }, s.accessToken).catch(
        () => {},
      );
    if (context)
      await context.request
        .post('http://localhost:3007/api/frontend/auth/logout', {
          headers: { Origin: 'http://localhost:3007' },
          data: {},
        })
        .catch(() => {});
    await targetContext?.close();
    await browser?.close();
    save();
    if (report.checks.some((c) => c.status === 'FAIL')) process.exitCode = 1;
    console.log('Evidence ' + path.relative(root, dir));
  });
