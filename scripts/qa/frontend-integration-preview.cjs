/* Own both child processes; never discover or terminate an unrelated server. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { parseArgs } = require('node:util');
const { values } = parseArgs({
  options: {
    'build-dir': { type: 'string', default: 'tmp/frontend-integration-session33/build' },
    'web-port': { type: 'string', default: '3106' },
    'cms-port': { type: 'string', default: '3107' },
    gateway: { type: 'string' },
    environment: { type: 'string', default: 'local' },
  },
});
const root = process.cwd(),
  build = path.resolve(values['build-dir']);
if (!build.startsWith(path.resolve(root, 'tmp') + path.sep)) throw new Error('Invalid build root');
const manifest = JSON.parse(fs.readFileSync(path.join(build, '.frontend-build.json'), 'utf8'));
if (manifest.writes && values.gateway)
  throw new Error(
    'UI contract write builds cannot connect to a Gateway; rebuild without --ui-contract-writes',
  );
const ownerFile = path.join(build, '.frontend-preview-owner.json');
const children = [];
let owns = false,
  stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  if (owns) fs.unlinkSync(ownerFile);
  process.exitCode = code;
  process.stdin.pause();
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
(async () => {
  const ports = [values['web-port'], values['cms-port']].map(Number);
  if (ports[0] === ports[1] || ports.some((p) => !Number.isInteger(p) || p < 1024 || p > 65535))
    throw new Error('Provide two distinct ports between 1024 and 65535');
  for (const port of ports) await freePort(port);
  fs.writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, ports, mode: manifest.mode }), {
    flag: 'wx',
  });
  owns = true;
  for (const [index, app] of ['web', 'admin-cms'].entries()) {
    const child = spawn(
      process.execPath,
      [path.join(build, 'apps', app, manifest.distDir, 'standalone/apps', app, 'server.js')],
      {
        cwd: build,
        windowsHide: true,
        stdio: ['ignore', 'inherit', 'inherit'],
        env: {
          ...process.env,
          PORT: String(ports[index]),
          HOSTNAME: '127.0.0.1',
          NEXT_PUBLIC_DATA_MODE: manifest.mode,
          FRONTEND_TEST_WRITES: manifest.writes ? 'enabled' : 'disabled',
          FRONTEND_METADATA_VERIFIED: 'false',
          FRONTEND_API_ENV: values.environment,
          FRONTEND_GATEWAY_URL: values.gateway || '',
        },
      },
    );
    children.push(child);
    child.once('error', () => stop(1));
    child.once('exit', () => {
      if (!stopping) stop(1);
    });
  }
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (line) => {
    if (line.trim() === 'stop') stop();
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
  console.log(
    JSON.stringify({
      mode: manifest.mode,
      writes: manifest.writes,
      web: `http://127.0.0.1:${ports[0]}`,
      cms: `http://127.0.0.1:${ports[1]}/login`,
      note: 'Wait for HTTP/assets/browser QA before handing off. Enter stop to end this preview.',
    }),
  );
})().catch((error) => {
  console.error(error.message);
  stop(1);
});
