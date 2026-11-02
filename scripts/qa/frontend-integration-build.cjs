/* One shared isolated repository copy for both apps and all builds in this round. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--'))
    throw new Error('Missing value for ' + name);
  return process.argv[index + 1];
}
const base = path.resolve(root, option('--evidence-dir', 'tmp/frontend-integration-session33'));
const build = path.resolve(root, option('--build-dir', path.join(base, 'build')));
if (!build.startsWith(path.resolve(root, 'tmp') + path.sep)) throw new Error('Invalid build root');
if (!base.startsWith(path.resolve(root, 'tmp') + path.sep))
  throw new Error('Invalid evidence root');
const ownerFile = path.join(build, '.frontend-preview-owner.json');
if (fs.existsSync(ownerFile)) {
  const owner = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
  try {
    process.kill(owner.pid, 0);
    throw new Error('Stop the owning preview before rebuilding: PID ' + owner.pid);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
    fs.unlinkSync(ownerFile);
  }
}
const initial = !fs.existsSync(path.join(build, 'node_modules/next/package.json'));
const mode = process.argv.includes('--api') ? 'api' : 'demo';
const excluded = new Set([
  'node_modules',
  '.next',
  '.test-build',
  '.git',
  '.agents',
  '.codex',
  '.aws',
]);
function copy(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    dereference: false,
    filter(file) {
      const rel = path.relative(source, file),
        name = path.basename(file);
      if (
        rel.split(path.sep).some((part) => excluded.has(part)) ||
        name.startsWith('.env') ||
        name.endsWith('.tsbuildinfo')
      )
        return false;
      if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Source link rejected: ' + rel);
      return true;
    },
  });
}
fs.mkdirSync(build, { recursive: true });
fs.mkdirSync(base, { recursive: true });
for (const app of ['web', 'admin-cms'])
  copy(path.join(root, 'apps', app), path.join(build, 'apps', app));
for (const file of ['package.json', 'package-lock.json'])
  fs.copyFileSync(path.join(root, file), path.join(build, file));
if (initial) {
  fs.cpSync(path.join(root, 'node_modules'), path.join(build, 'node_modules'), {
    recursive: true,
    dereference: false,
    filter(file) {
      const relative = path.relative(path.join(root, 'node_modules'), file);
      if (relative.split(path.sep)[0] === '@toeic') return false;
      if (fs.lstatSync(file).isSymbolicLink()) return false;
      return true;
    },
  });
  for (const app of ['web', 'admin-cms'])
    fs.cpSync(
      path.join(root, 'apps', app, 'node_modules'),
      path.join(build, 'apps', app, 'node_modules'),
      { recursive: true, dereference: true },
    );
  copy(path.join(root, 'packages/config-ts'), path.join(build, 'node_modules/@toeic/config-ts'));
}
let files = 0;
function physical(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Non-physical copy: ' + file);
    if (item.isDirectory()) physical(file);
    else files++;
  }
}
physical(path.join(build, 'node_modules'));
const env = {};
for (const [key, value] of Object.entries(process.env))
  if (
    /^(PATH|SYSTEMROOT|WINDIR|SYSTEMDRIVE|COMSPEC|PATHEXT|OS|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(
      key,
    )
  )
    env[key] = value;
const distDir = '.next-session33';
Object.assign(env, {
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_DATA_MODE: mode,
  FRONTEND_BUILD_DIR: distDir,
});
if (process.argv.includes('--ui-contract-writes')) env.FRONTEND_TEST_WRITES = 'enabled';
if (process.argv.includes('--copy-only')) {
  console.log(JSON.stringify({ build, files, mode, copied: true }));
  process.exit(0);
}
const results = [];
const manifest = path.join(build, '.frontend-build.json');
if (fs.existsSync(manifest)) fs.unlinkSync(manifest);
for (const app of ['web', 'admin-cms']) {
  const logFile = path.join(base, `${app}-${mode}-build.log`),
    log = fs.openSync(logFile, 'w');
  const result = spawnSync(
    process.execPath,
    [path.join(build, 'node_modules/next/dist/bin/next'), 'build'],
    { cwd: path.join(build, 'apps', app), env, stdio: ['ignore', log, log] },
  );
  fs.closeSync(log);
  if (result.status === 0) {
    const source = path.join(build, 'apps', app);
    const runtimeApp = path.join(source, distDir, 'standalone', 'apps', app);
    fs.cpSync(path.join(source, distDir, 'static'), path.join(runtimeApp, distDir, 'static'), {
      recursive: true,
    });
    if (fs.existsSync(path.join(source, 'public')))
      fs.cpSync(path.join(source, 'public'), path.join(runtimeApp, 'public'), { recursive: true });
  }
  results.push({ app, mode, status: result.status, error: result.error?.message, log: logFile });
  console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(
  path.join(base, `build-${mode}-result.json`),
  JSON.stringify({ files, build, results }, null, 2),
);
if (results.some((r) => r.status !== 0)) process.exit(1);
fs.writeFileSync(
  manifest,
  JSON.stringify(
    {
      mode,
      writes: process.argv.includes('--ui-contract-writes'),
      metadataVerified: false,
      distDir,
      builtAt: new Date().toISOString(),
      build,
    },
    null,
    2,
  ),
);
