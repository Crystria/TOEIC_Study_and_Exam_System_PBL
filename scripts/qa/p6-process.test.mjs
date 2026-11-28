import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { guardShutdown, stopChild } from './p6-process.mjs';

async function child(t, source) {
  const process = spawn(globalThis.process.execPath, ['-e', source], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  t.after(() => {
    if (process.exitCode === null && !process.signalCode) process.kill('SIGKILL');
  });
  await once(process.stdout, 'data');
  return process;
}

test('stopChild waits until an owned service actually exits', async (t) => {
  const service = await child(t, "console.log('ready'); setInterval(() => {}, 1000)");
  await stopChild(service);
  assert.ok(service.exitCode !== null || service.signalCode);
});

test(
  'stopChild escalates when a Unix service ignores SIGTERM',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const service = await child(
      t,
      "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
    );
    await stopChild(service, { graceMs: 50, killMs: 2000 });
    assert.equal(service.signalCode, 'SIGKILL');
  },
);

test(
  'already signaled but still-running services are still awaited',
  {
    skip: process.platform === 'win32',
  },
  async (t) => {
    const service = await child(
      t,
      "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
    );
    service.kill('SIGTERM');
    assert.equal(service.killed, true);
    await stopChild(service, { graceMs: 50, killMs: 2000 });
    assert.equal(service.signalCode, 'SIGKILL');
  },
);

test('an already exited service needs no additional signal', async () => {
  await stopChild(undefined);
  await stopChild({ exitCode: 0, signalCode: null });
});

test('crash mode sends SIGKILL and waits for the replica to exit', async (t) => {
  const service = await child(
    t,
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000)",
  );
  await stopChild(service, { signal: 'SIGKILL' });
  assert.ok(service.exitCode !== null || service.signalCode);
  if (process.platform !== 'win32') assert.equal(service.signalCode, 'SIGKILL');
});

test('shutdown guard does not keep a clean CLI alive', () => {
  const timer = guardShutdown();
  assert.equal(timer.hasRef(), false);
  clearTimeout(timer);
});

test('shutdown guard terminates a CLI with leaked handles and reports resource types', () => {
  const module = new URL('./p6-process.mjs', import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { guardShutdown } from ${JSON.stringify(module)};
     setInterval(() => {}, 1000);
     guardShutdown({ graceMs: 50, onTimeout: () => console.error('report updated') });`,
    ],
    { encoding: 'utf8', timeout: 5000, windowsHide: true },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Active resource types:/);
  assert.match(result.stderr, /report updated/);
});
