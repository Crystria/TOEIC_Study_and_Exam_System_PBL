/* Local integration launcher. Uses only explicitly named isolated databases; never migrates/seeds. */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const dotenv = require('dotenv');
const { mediaConfiguration } = require('./frontend-local-config.cjs');
const { values } = parseArgs({
  options: {
    databases: { type: 'string' },
    out: { type: 'string' },
    frontends: { type: 'boolean', default: false },
    writes: { type: 'boolean', default: false },
    'without-learning': { type: 'boolean', default: false },
    services: { type: 'string' },
    'media-bucket': { type: 'string' },
  },
});
if (!values.databases || !values.out)
  throw Error('Provide --databases <isolated manifest> --out <fresh tmp folder>');
const root = path.resolve(__dirname, '../..'),
  out = path.resolve(root, values.out);
if (!out.startsWith(path.join(root, 'tmp') + path.sep)) throw Error('Logs must be under tmp');
const databases = JSON.parse(fs.readFileSync(path.resolve(root, values.databases), 'utf8'));
const allServices = ['auth', 'question-bank', 'exam', 'learning', 'analytics', 'api-gateway'];
const selected = values.services ? values.services.split(',') : allServices;
if (!selected.length || selected.some((name) => !allServices.includes(name)))
  throw Error('Unknown service in --services');
const names = [...new Set(selected)].filter(
  (name) => !(name === 'learning' && values['without-learning']),
);
const namespace = path.relative(root, out).replace(/[^a-zA-Z0-9-]/g, '-');
if (values['media-bucket'] && !/^toeic-frontend-[a-z0-9-]+$/.test(values['media-bucket']))
  throw Error('Test media bucket must use toeic-frontend- namespace');
for (const name of ['auth', 'question-bank', 'exam', 'learning', 'analytics']) {
  const row = databases.find((d) => d.name === name);
  if (
    !row ||
    row.status !== 0 ||
    !new RegExp('^' + name.replace('-', '_') + '_frontend_[a-z0-9_]+$').test(row.database)
  )
    throw Error('Only fully migrated frontend test databases are allowed');
}
const children = [];
const records = [];
let stopping = false;
function envFile(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}
function scrub(value) {
  return value
    .replace(/((?:postgres(?:ql)?|amqps?|rediss?):\/\/)[^\s/@]+@/g, '$1***@')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]');
}
function launch(name, cwd, args, env) {
  const log = fs.createWriteStream(path.join(out, name + '.log'), { flags: 'wx' });
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => log.write(scrub(String(chunk))));
  child.on('exit', (code) => {
    log.end();
    console.log(name + ' exited: ' + code);
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
  child.on('error', (error) => {
    console.log(name + ' spawn failed: ' + error.code);
    process.exitCode = 1;
    stop();
  });
  children.push(child);
  records.push({ name, pid: child.pid, startedAt: new Date().toISOString() });
  console.log(name + ' PID ' + child.pid);
}
async function free(port) {
  // On Windows an IPv4-only bind can succeed beside a dual-stack listener.
  for (const host of ['127.0.0.1', '::1']) {
    const occupied = await new Promise((resolve) => {
      const socket = net.connect({ host, port });
      const done = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
      socket.setTimeout(500, () => done(false));
    });
    if (occupied) throw Error('Port is occupied: ' + port);
  }
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(Error('Port is occupied: ' + port)));
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
}
function stop() {
  stopping = true;
  for (const c of children)
    if (c.exitCode === null && c.pid) {
      if (process.platform === 'win32')
        spawnSync('taskkill.exe', ['/PID', String(c.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      else c.kill();
    }
}
process.on('SIGINT', () => {
  stop();
  setTimeout(() => process.exit(0), 500);
});
process.on('SIGTERM', () => {
  stop();
  setTimeout(() => process.exit(0), 500);
});
process.on('exit', stop);
(async () => {
  for (const name of names) {
    const cwd = path.join(root, 'services', name === 'api-gateway' ? name : name + '-service');
    const dependency =
      name === 'learning' ? 'markdown-it' : name === 'api-gateway' ? 'helmet' : null;
    if (dependency) {
      try {
        require.resolve(dependency, { paths: [cwd] });
      } catch {
        throw Error('Install declared dependency before starting: ' + dependency);
      }
    }
    if (!fs.existsSync(path.join(cwd, 'dist/main.js')))
      throw Error('Build service before starting: ' + name);
  }
  const ports = {
    auth: [3001],
    'question-bank': [3002, 50052],
    exam: [3003],
    learning: [3004],
    analytics: [3005],
    'api-gateway': [3000],
  };
  for (const port of [
    ...names.flatMap((name) => ports[name]),
    ...(values.frontends ? [3006, 3007] : []),
  ])
    await free(port);
  fs.mkdirSync(out, { recursive: true });
  for (const name of names) {
    const cwd = path.join(root, 'services', name === 'api-gateway' ? name : name + '-service');
    const env = {
      ...process.env,
      ...envFile(path.join(cwd, '.env.example')),
      ...envFile(path.join(cwd, '.env')),
    };
    // Resolve existing file sources; never replace valid keys, inline secrets or issuer/audience.
    for (const key of [
      'JWT_ACCESS_PUBLIC_KEY',
      'JWT_ACCESS_PRIVATE_KEY',
      'AUTH_SERVICE_SECRET',
      'AUTH_MAIL_ENCRYPTION_KEY',
    ]) {
      if (env[key]) delete env[key + '_FILE'];
      else if (env[key + '_FILE']) env[key + '_FILE'] = path.resolve(cwd, env[key + '_FILE']);
    }
    env.AUTHORIZATION_QUEUE_PREFIX = namespace;
    env.ANALYTICS_QUEUE_PREFIX = namespace + '-domain';
    env.SYNC_QUEUE_PREFIX = namespace + '-sync';
    env.LEARNING_V2_QUEUE_PREFIX = namespace + '-learning';
    env.RABBITMQ_EXCHANGE = namespace + '.events';
    env.QUESTION_SEARCH_QUEUE = namespace + '-search';
    Object.assign(env, mediaConfiguration(name, values['media-bucket'], env));
    const db = databases.find((d) => d.name === name);
    if (db) {
      const url = new URL(env.DATABASE_URL);
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        throw Error('Local PostgreSQL required');
      url.pathname = '/' + db.database;
      env.DATABASE_URL = url.href;
    }
    if (name === 'question-bank') {
      env.QUESTION_SEARCH_INDEX = 'questions-' + namespace.toLowerCase();
    }
    launch(name, cwd, ['dist/main.js'], env);
  }
  if (values.frontends)
    for (const app of ['web', 'admin-cms'])
      launch(
        app,
        path.join(root, 'apps', app),
        [
          path.join(root, 'node_modules/next/dist/bin/next'),
          'dev',
          '-p',
          app === 'web' ? '3006' : '3007',
          '--hostname',
          'localhost',
        ],
        {
          ...process.env,
          NEXT_PUBLIC_DATA_MODE: 'api',
          FRONTEND_API_ENV: 'local',
          FRONTEND_GATEWAY_URL: 'http://127.0.0.1:3000/api/v1',
          FRONTEND_TEST_WRITES: values.writes ? 'enabled' : 'disabled',
          FRONTEND_BUILD_DIR: '.next-' + namespace,
          NEXT_TELEMETRY_DISABLED: '1',
        },
      );
  fs.writeFileSync(
    path.join(out, 'processes.json'),
    JSON.stringify(
      {
        launcherPid: process.pid,
        services: names,
        partial: names.length !== allServices.length,
        processes: records,
      },
      null,
      2,
    ),
  );
  console.log(
    (names.length === allServices.length ? 'Full' : 'Partial') +
      ' local processes spawned; check HTTP readiness separately. Ctrl+C stops only these owned processes.',
  );
})().catch((error) => {
  console.log(scrub(error.message));
  stop();
  process.exitCode = 1;
});
