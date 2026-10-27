// Browser QA uses a new non-persistent context; never opens the user's profile.
// Set PLAYWRIGHT_MODULE to an existing Playwright install if it is not in PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const base = 'http://localhost:3006';
const report = {
  checks: [],
  responsive: [],
  media: [],
  errors: [],
  apiRequests: [],
  physicalListeningVerified: false,
};
const shots = path.join(root, 'docs/screenshots/audio-playback-20261027');
fs.mkdirSync(shots, { recursive: true });
const audio = (p) => p.locator('audio');
const replay = (p) => p.getByRole('button', { name: 'Nghe lại từ đầu', exact: true });
const storage = (p) => p.evaluate(() => ({ ...localStorage }));
async function ready(p) {
  await p.waitForFunction(() => {
    const a = document.querySelector('audio');
    return a && Number.isFinite(a.duration) && a.duration > 0 && a.readyState >= 2;
  });
}
async function plays(p) {
  await replay(p).click();
  await p.waitForFunction(() => {
    const a = document.querySelector('audio');
    return a && !a.paused && a.currentTime > 0.15;
  });
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log('PASS', name);
}
async function screenshots(p, name) {
  for (const width of [1440, 768, 390]) {
    await p.setViewportSize({ width, height: 900 });
    await p.locator('.player-audio,.player-media-missing').first().scrollIntoViewIfNeeded();
    const png = await p.screenshot({
      path: path.join(shots, `${name}-${width}.png`),
      fullPage: false,
    });
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), 900);
    const size = await p.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(size.scroll <= size.client);
    report.responsive.push({
      name,
      width,
      height: 900,
      pngWidth: png.readUInt32BE(16),
      pngHeight: png.readUInt32BE(20),
      ...size,
    });
  }
}
async function navigate(p, n) {
  await p.setViewportSize({ width: 1440, height: 900 });
  // Let the breakpoint's matchMedia effect settle before toggling native details.
  // Otherwise a late desktop-open update can race with a click and close the map.
  await p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  // Locate the map by its native summary, independent of its responsive default.
  const details = p
    .locator('details')
    .filter({ has: p.locator('summary').filter({ hasText: 'Bảng câu hỏi' }) });
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  await p.getByRole('button', { name: new RegExp(`^Câu ${n},`) }).click();
}
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      window.__mediaEvents = [];
      for (const name of [
        'playing',
        'pause',
        'seeking',
        'seeked',
        'ratechange',
        'ended',
        'loadedmetadata',
        'error',
      ]) {
        document.addEventListener(
          name,
          (e) => {
            if (e.target instanceof HTMLMediaElement)
              window.__mediaEvents.push({
                name,
                source: e.target.currentSrc,
                time: e.target.currentTime,
              });
          },
          true,
        );
      }
    });
    const p = await context.newPage();
    p.on('pageerror', (e) => report.errors.push(e.message));
    p.on('request', (r) => {
      if (r.url().includes('/api/')) report.apiRequests.push(r.url());
    });
    p.on('dialog', (d) => d.dismiss());
    await p.goto(base + '/study/vocabulary/business-office');
    await p.getByRole('button', { name: 'Học bộ từ', exact: true }).click();
    await ready(p);
    await check(
      'Vocabulary metadata, no autoplay, pause/resume, seek/seeked, rate, replay and ended',
      async () => {
        assert.equal(
          await audio(p).evaluate((a) => a.paused && a.currentTime === 0 && !a.autoplay),
          true,
        );
        const before = await storage(p);
        await plays(p);
        await audio(p).evaluate((a) => a.pause());
        const at = await audio(p).evaluate((a) => a.currentTime);
        await p.waitForTimeout(250);
        assert.equal(await audio(p).evaluate((a) => a.currentTime), at);
        await audio(p).evaluate((a) => a.play());
        await p.waitForFunction((t) => document.querySelector('audio').currentTime > t + 0.15, at);
        await audio(p).evaluate((a) => {
          a.pause();
          a.currentTime = a.duration / 2;
        });
        await p.waitForFunction(() => window.__mediaEvents.some((e) => e.name === 'seeked'));
        for (const rate of ['0.8', '1.2']) {
          await p.getByRole('combobox', { name: /Tốc độ/ }).selectOption(rate);
          assert.equal(await audio(p).evaluate((a) => a.playbackRate), Number(rate));
          await audio(p).evaluate((a) => a.play());
          const start = await audio(p).evaluate((a) => a.currentTime);
          await p.waitForTimeout(350);
          assert.ok((await audio(p).evaluate((a) => a.currentTime)) > start + 0.1);
          await audio(p).evaluate((a) => a.pause());
        }
        await plays(p);
        assert.ok((await audio(p).evaluate((a) => a.currentTime)) < 1.5);
        await audio(p).evaluate((a) => {
          a.currentTime = a.duration - 0.15;
        });
        await p.waitForFunction(() => document.querySelector('audio').ended);
        await p.getByRole('status').filter({ hasText: 'Đã phát hết' }).waitFor();
        await plays(p);
        await audio(p).evaluate((a) => a.pause());
        assert.deepEqual(await storage(p), before);
        report.vocabularyEvents = await p.evaluate(() => window.__mediaEvents);
        await screenshots(p, 'vocabulary-ready');
      },
    );
    await check(
      'Native keyboard Space play/pause and ArrowRight seek; labels and focus',
      async () => {
        await audio(p).evaluate((a) => {
          a.pause();
          a.currentTime = 0;
        });
        await audio(p).focus();
        await p.keyboard.press('Space');
        await p.waitForFunction(() => !document.querySelector('audio').paused);
        await p.keyboard.press('Space');
        await p.waitForFunction(() => document.querySelector('audio').paused);
        const position = await audio(p).evaluate((a) => a.currentTime);
        await p.keyboard.press('ArrowRight');
        await p.waitForFunction(
          (before) => document.querySelector('audio').currentTime > before + 0.001,
          position,
        );
        assert.ok(await audio(p).getAttribute('aria-label'));
        assert.ok(await audio(p).getAttribute('aria-describedby'));
      },
    );
    await check('All 28 published MP3s decode and actually play in Chromium', async () => {
      const records = require('./recordings-20261027/manifest.json').files;
      for (const record of records) {
        const result = await p.evaluate(
          async ({ url }) => {
            const a = document.createElement('audio');
            document.body.append(a);
            a.src = url;
            let playing = false;
            a.addEventListener('playing', () => {
              playing = true;
            });
            try {
              await a.play();
              await new Promise((r) => setTimeout(r, 200));
              return {
                duration: a.duration,
                currentTime: a.currentTime,
                playing,
                paused: a.paused,
                error: a.error?.code ?? null,
              };
            } finally {
              a.pause();
              a.remove();
            }
          },
          { url: record.publicUrl },
        );
        assert.ok(
          result.playing &&
            result.currentTime > 0 &&
            Number.isFinite(result.duration) &&
            result.error === null,
        );
        assert.ok(Math.abs(result.duration - record.durationSeconds) < 0.1);
        report.media.push({ id: record.id, ...result });
      }
    });
    await check(
      'Vocabulary stops previous clip on word change and unmount; no autoplay next word',
      async () => {
        await plays(p);
        await p.evaluate(() => {
          window.__oldAudio = document.querySelector('audio');
        });
        await p.getByRole('button', { name: 'Lật thẻ xem nghĩa', exact: true }).click();
        await p.getByRole('button', { name: /Đã thuộc/ }).click();
        await ready(p);
        assert.ok(await p.evaluate(() => window.__oldAudio.paused));
        assert.ok(await audio(p).evaluate((a) => a.paused && a.currentTime === 0));
        await plays(p);
        await p.evaluate(() => {
          window.__oldAudio = document.querySelector('audio');
        });
        await p.getByRole('link', { name: 'Tạm dừng và về thư viện', exact: true }).click();
        await p.waitForURL((url) => url.pathname === '/study/vocabulary');
        await p.waitForFunction(() => window.__oldAudio.paused && !window.__oldAudio.isConnected);
      },
    );
    await check(
      'Real loading and first-request failure; keyboard retry then successful playback',
      async () => {
        let attempts = 0;
        let release;
        const gate = new Promise((r) => {
          release = r;
        });
        await p.route('**/demo/audio/vocabulary-colleague.mp3', async (route) => {
          attempts++;
          if (attempts === 1) {
            await gate;
            await route.fulfill({ status: 503, body: 'QA temporary media failure' });
          } else await route.continue();
        });
        await p.goto(base + '/study/vocabulary/business-office');
        await p.getByText('Đang tải âm thanh…', { exact: false }).waitFor();
        release();
        await p.getByRole('alert').filter({ hasText: 'Không tải hoặc phát được audio' }).waitFor();
        await screenshots(p, 'vocabulary-error');
        const button = p.getByRole('button', { name: 'Thử tải lại audio', exact: true });
        await button.focus();
        await p.keyboard.press('Enter');
        await ready(p);
        assert.ok(await button.evaluate((b) => b === document.activeElement));
        assert.ok(await audio(p).evaluate((a) => a.paused));
        await plays(p);
        await audio(p).evaluate((a) => a.pause());
        assert.ok(attempts >= 2);
        await p.unroute('**/demo/audio/vocabulary-colleague.mp3');
      },
    );
    await p.goto(base + '/exam/full-test-01/prepare?mode=PRACTICE&scope=parts&parts=1,2,3,4');
    const boxes = p.locator('.exam-readiness input[type=checkbox]');
    await boxes.first().waitFor();
    for (const box of await boxes.all()) await box.check();
    await p.getByRole('button', { name: /Kiểm tra chuẩn bị/ }).click();
    await p.getByRole('button', { name: 'Bắt đầu phiên demo', exact: true }).click();
    await ready(p);
    const takeUrl = p.url();
    await check(
      'Exam Part 1-4 playback; same-group/other-group pause and no autoplay',
      async () => {
        await p.getByRole('radio').nth(1).check();
        await p.waitForTimeout(500);
        await screenshots(p, 'exam-ready');
        await plays(p);
        await p.evaluate(() => {
          window.__oldAudio = document.querySelector('audio');
        });
        await navigate(p, 2);
        await ready(p);
        assert.ok(await p.evaluate(() => window.__oldAudio.paused));
        assert.ok(await audio(p).evaluate((a) => a.paused));
        for (const n of [7, 32, 33, 35, 71]) {
          await plays(p);
          await p.evaluate(() => {
            window.__oldAudio = document.querySelector('audio');
          });
          await navigate(p, n);
          await ready(p);
          assert.ok(await p.evaluate(() => window.__oldAudio.paused));
          assert.ok(await audio(p).evaluate((a) => a.paused));
          if (n === 7) assert.equal(await p.getByRole('radio').count(), 4);
        }
        await plays(p);
        await audio(p).evaluate((a) => a.pause());
      },
    );
    await check(
      'Audio/retry/seek/reload preserve exam answers, mode, Parts, duration and fixed deadline',
      async () => {
        const before = JSON.parse((await storage(p))['toeic.exam-demo.v1']);
        await plays(p);
        await audio(p).evaluate((a) => {
          a.currentTime = 5;
        });
        await p.getByRole('button', { name: 'Thử tải lại audio', exact: true }).click();
        await ready(p);
        await plays(p);
        const afterAudio = JSON.parse((await storage(p))['toeic.exam-demo.v1']);
        assert.deepEqual(afterAudio, before);
        await p.reload();
        await ready(p);
        const after = JSON.parse((await storage(p))['toeic.exam-demo.v1']);
        for (const key of ['answers', 'selection', 'durationSeconds', 'deadlineAt', 'startedAt'])
          assert.deepEqual(after[key], before[key]);
        assert.ok(after.deadlineAt < Date.now() + after.durationSeconds * 1000);
        assert.ok(await audio(p).evaluate((a) => a.paused && a.currentTime === 0));
        report.deadlineCheck = {
          deadlineBefore: before.deadlineAt,
          deadlineAfter: after.deadlineAt,
          answers: after.answers,
        };
      },
    );
    await check(
      'Exam first-request load error, keyboard retry and successful playback preserve draft',
      async () => {
        const before = await storage(p);
        let requests = 0;
        await p.route('**/demo/audio/listening-part-4.mp3', (route) => {
          requests++;
          return requests === 1
            ? route.fulfill({ status: 503, body: 'QA temporary media failure' })
            : route.continue();
        });
        await p.reload();
        await p.getByRole('alert').filter({ hasText: 'Không tải hoặc phát được audio' }).waitFor();
        await screenshots(p, 'exam-error');
        const retry = p.getByRole('button', { name: 'Thử tải lại audio', exact: true });
        await retry.focus();
        await p.keyboard.press('Enter');
        await ready(p);
        assert.ok(await retry.evaluate((el) => el === document.activeElement));
        assert.ok(await audio(p).evaluate((a) => a.paused));
        await plays(p);
        await audio(p).evaluate((a) => a.pause());
        assert.deepEqual(await storage(p), before);
        await p.unroute('**/demo/audio/listening-part-4.mp3');
      },
    );
    await check(
      'Exam route unmount stops playing; resume retains answers/deadline without autoplay',
      async () => {
        await plays(p);
        await p.evaluate(() => {
          window.__oldAudio = document.querySelector('audio');
        });
        const before = await storage(p);
        await p.getByRole('button', { name: 'Rời bài', exact: true }).click();
        await p.waitForURL((url) => !url.pathname.endsWith('/take'));
        assert.ok(
          await p.evaluate(() => window.__oldAudio.paused && !window.__oldAudio.isConnected),
        );
        await p.goto(takeUrl);
        await ready(p);
        assert.deepEqual(await storage(p), before);
        assert.ok(await audio(p).evaluate((a) => a.paused && a.currentTime === 0));
      },
    );
    await check('Existing missing-media scenario renders without empty audio source', async () => {
      await p.goto(takeUrl + '&preview=media-missing');
      await p.getByText('Chưa có audio minh họa', { exact: true }).waitFor();
      assert.equal(await audio(p).count(), 0);
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.apiRequests, []);
    report.browserPlaybackVerified = true;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(root, 'tmp/audio-playback-report-20261027.json'),
      JSON.stringify(report, null, 2),
    );
  }
  console.log(
    'PASS',
    report.checks.length,
    'checks;',
    report.media.length,
    'actual MP3 playbacks;',
    report.responsive.length,
    'viewport captures',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
