const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const build = path.join(root, 'tmp/cms-ui-session31/build');
const app = path.join(build, 'apps/admin-cms');
const initial = !fs.existsSync(build);
fs.mkdirSync(app, { recursive: true });
const copy = (source, destination, filter) =>
  fs.cpSync(source, destination, { recursive: true, dereference: true, filter });
copy(path.join(root, 'apps/admin-cms'), app, (source) => {
  const relative = path.relative(path.join(root, 'apps/admin-cms'), source);
  return !relative
    .split(path.sep)
    .some(
      (part) =>
        ['node_modules', '.next', '.git'].includes(part) ||
        part.startsWith('.env') ||
        part.endsWith('.tsbuildinfo'),
    );
});
console.log('Copied CMS source/config without env, caches or dependencies.');
if (initial) {
  const deps = path.join(root, 'node_modules');
  copy(deps, path.join(build, 'node_modules'), (source) => {
    const relative = path.relative(deps, source);
    return relative.split(path.sep)[0] !== '@toeic';
  });
  console.log('Copied root dependencies physically.');
  copy(path.join(root, 'apps/admin-cms/node_modules'), path.join(app, 'node_modules'));
  copy(
    path.join(root, 'packages/config-ts'),
    path.join(build, 'node_modules/@toeic/config-ts'),
    (source) => !['node_modules', 'dist'].includes(path.basename(source)),
  );
  for (const name of ['package.json', 'package-lock.json'])
    if (fs.existsSync(path.join(root, name)))
      fs.copyFileSync(path.join(root, name), path.join(build, name));
}
let physicalFiles = 0;
function checkPhysical(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Non-physical dependency: ' + file);
    if (e.isDirectory()) checkPhysical(file);
    else physicalFiles++;
  }
}
checkPhysical(path.join(build, 'node_modules'));
checkPhysical(path.join(app, 'node_modules'));
console.log('Verified physical dependency files: ' + physicalFiles);
const env = {};
for (const [key, value] of Object.entries(process.env))
  if (
    /^(PATH|SYSTEMROOT|WINDIR|SYSTEMDRIVE|COMSPEC|PATHEXT|OS|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(
      key,
    )
  )
    env[key] = value;
env.NEXT_TELEMETRY_DISABLED = '1';
const log = fs.openSync(path.join(build, 'build.log'), 'w');
const typecheck = spawnSync(
  process.execPath,
  [
    path.join(build, 'node_modules/typescript/bin/tsc'),
    '-p',
    'tsconfig.json',
    '--noEmit',
    '--incremental',
    'false',
  ],
  { cwd: app, env, encoding: 'utf8' },
);
fs.writeFileSync(path.join(build, 'typecheck.log'), typecheck.stdout + typecheck.stderr);
if (typecheck.status !== 0) {
  console.log(typecheck.stdout + typecheck.stderr);
  process.exit(typecheck.status || 1);
}
console.log('Isolated TypeScript passed.');
const result = spawnSync(
  process.execPath,
  [path.join(build, 'node_modules/next/dist/bin/next'), 'build'],
  { cwd: app, env, stdio: ['ignore', log, log] },
);
fs.closeSync(log);
fs.writeFileSync(
  path.join(build, 'build-result.json'),
  JSON.stringify({ status: result.status, error: result.error?.message, physicalFiles }, null, 2),
);
console.log(fs.readFileSync(path.join(build, 'build.log'), 'utf8'));
if (result.status !== 0) process.exit(result.status || 1);
