import { spawn, execFileSync } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { root, require, names, services, databaseUrl, scrub } from './config.mjs';
const dir = join(root, 'private/p6'),
  out = join(root, 'artifacts/p6');
mkdirSync(dir, { recursive: true });
mkdirSync(out, { recursive: true });
const children = [],
  proxies = {};
let appendLogs = false;
const pair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const report = {
  startedAt: new Date().toISOString(),
  node: process.version,
  checks: [],
  passed: false,
};
async function port() {
  const s = createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function proxy(name, target) {
  let enabled = true;
  const sockets = new Set();
  const s = createServer((c) => {
    if (!enabled) return c.destroy();
    const u = connect(target, '127.0.0.1');
    c.setNoDelay(true);
    u.setNoDelay(true);
    for (const x of [c, u]) {
      sockets.add(x);
      x.on('error', () => {
        c.destroy();
        u.destroy();
      });
      x.on('close', () => sockets.delete(x));
    }
    c.pipe(u).pipe(c);
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const control = {
    port: s.address().port,
    down() {
      enabled = false;
      for (const x of sockets) x.destroy();
    },
    up() {
      enabled = true;
    },
    close() {
      control.down();
      s.close();
    },
  };
  proxies[name] = control;
  return control;
}
const docker = (args, input) =>
  execFileSync(
    'docker',
    args.map((a) => (a === 'toeic-postgres' ? process.env.P6_POSTGRES_CONTAINER || a : a)),
    { input, encoding: 'utf8', windowsHide: true },
  );
async function check(name, fn) {
  const start = Date.now();
  const detail = await fn();
  report.checks.push({ name, passed: true, ms: Date.now() - start, ...detail });
  writeFileSync(join(out, 'latest.json'), JSON.stringify(report, null, 2));
  console.log('PASS ' + name);
}
async function ready(url, child) {
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw Error('Service exited; see private/p6 log');
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      await r.arrayBuffer();
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error('Readiness timeout ' + url);
}
function launch(name, env) {
  const log = createWriteStream(join(dir, name + '.log'), { flags: appendLogs ? 'a' : 'w' });
  const p = spawn(process.execPath, ['dist/main.js'], {
    cwd: join(root, 'services', name),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  p.stdout.pipe(log);
  p.stderr.pipe(log);
  children.push(p);
  return p;
}
async function stopOwnedServices() {
  await Promise.all(
    children.splice(0).map(
      (p) =>
        new Promise((resolve, reject) => {
          if (p.exitCode !== null || p.signalCode) return resolve();
          const timer = setTimeout(() => reject(Error('QA child did not stop: ' + p.pid)), 5000);
          p.once('exit', () => {
            clearTimeout(timer);
            resolve();
          });
          p.kill();
        }),
    ),
  );
}
process.once('SIGINT', () => {
  for (const c of children) c.kill();
  for (const p of Object.values(proxies)) p.close();
  process.exit(130);
});
process.once('SIGTERM', () => {
  for (const c of children) c.kill();
  for (const p of Object.values(proxies)) p.close();
  process.exit(143);
});
try {
  const limits = (container) => {
    try {
      const [cpu, memory] = docker([
        'inspect',
        '--format',
        '{{.HostConfig.NanoCpus}}|{{.HostConfig.Memory}}',
        container,
      ])
        .trim()
        .split('|')
        .map(Number);
      return {
        container,
        cpuLimit: cpu ? cpu / 1e9 : null,
        memoryMiB: memory ? memory / 1048576 : null,
      };
    } catch {
      return { container, unavailable: true };
    }
  };
  report.infrastructure = {
    postgres: limits(process.env.P6_POSTGRES_CONTAINER || 'toeic-postgres'),
    rabbitmq: limits(
      process.env.P6_RABBITMQ_PORT === '6772' ? 'toeic-p6-rabbitmq' : 'toeic-rabbitmq',
    ),
    redis: limits('toeic-redis'),
    nodeEnv: 'development',
    databasePoolPerService: 8,
  };
  // Refuse to reset a QA database while another QA stack is consuming its queues.
  let connection, lastBrokerError;
  for (let attempt = 0; attempt < 30 && !connection; attempt++) {
    try {
      connection = await require('amqplib').connect(
        'amqp://toeic:toeic@127.0.0.1:' + (process.env.P6_RABBITMQ_PORT || '5772'),
      );
    } catch (error) {
      lastBrokerError = error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!connection) throw lastBrokerError;
  try {
    for (const name of [
      'qa.p6.domain.analytics-service.v2',
      'qa.p6.sync.learning-sync.v2',
      'qa.p6.sync.auth-learning-projection.v2',
      ...services.map((s) => 'qa.p6.authorization.' + s + '.v2'),
    ]) {
      const ch = await connection.createChannel();
      ch.on('error', () => {});
      try {
        const q = await ch.checkQueue(name);
        if (q.consumerCount) throw new Error('QA stack is already active: ' + name);
      } catch (e) {
        if (e.code !== 404) throw e;
      } finally {
        await ch.close().catch(() => {});
      }
    }
  } finally {
    await connection.close();
  }
  // Only fixed QA databases may be replaced; never reset the developer databases.
  if (process.env.P6_RESUME !== 'true')
    for (const db of names) {
      assert.match(db, /^(auth|question|exam|analytics|learning)_p6_verify$/);
      docker(['exec', 'toeic-postgres', 'dropdb', '--if-exists', '--force', '-U', 'toeic', db]);
    }
  const migration = spawn(process.execPath, ['scripts/qa/migrate.mjs'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  assert.equal(await new Promise((r) => migration.on('exit', r)), 0);
  const redis = await proxy('redis', 7379),
    rabbit = await proxy('rabbit', Number(process.env.P6_RABBITMQ_PORT || 5772)),
    storage = await proxy('storage', 19000),
    mail = await proxy('mail', 8025);
  const ports = Object.fromEntries(
    await Promise.all([...services, 'api-gateway', 'grpc'].map(async (n) => [n, await port()])),
  );
  const infra = existsSync(join(root, '.env'))
    ? require('dotenv').parse(readFileSync(join(root, '.env')))
    : {};
  const env = {
    NODE_ENV: 'development',
    QA_MODE: 'true',
    REDIS_URL: `redis://127.0.0.1:${redis.port}/6`,
    RABBITMQ_URL: `amqp://toeic:toeic@127.0.0.1:${rabbit.port}`,
    RABBITMQ_EXCHANGE: 'qa.p6.events',
    AUTHORIZATION_QUEUE_PREFIX: 'qa.p6.authorization',
    ANALYTICS_QUEUE_PREFIX: 'qa.p6.domain',
    LEARNING_V2_QUEUE_PREFIX: 'qa.p6.domain',
    SYNC_QUEUE_PREFIX: 'qa.p6.sync',
    SYNC_ENABLED: 'true',
    ANALYTICS_CONSUMER_ENABLED: 'true',
    JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
    JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
    JWT_ACCESS_PUBLIC_KEY_FILE: '',
    JWT_ACCESS_PRIVATE_KEY_FILE: '',
    JWT_ISSUER: 'toeic-auth',
    JWT_AUDIENCE: 'toeic-api',
    AUTH_SERVICE_SECRET: randomBytes(32).toString('hex'),
    AUTH_SERVICE_SECRET_FILE: '',
    AUTH_MAIL_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    AUTH_MAIL_ENCRYPTION_KEY_FILE: '',
    AUTH_INTERNAL_URL: `http://127.0.0.1:${ports['auth-service']}`,
    LEARNING_INTERNAL_URL: `http://127.0.0.1:${ports['learning-service']}`,
    MAILPIT_URL: `http://127.0.0.1:${mail.port}`,
    MINIO_ENDPOINT: `127.0.0.1:${storage.port}`,
    MINIO_PUBLIC_ENDPOINT: 'http://localhost:19000',
    MINIO_ACCESS_KEY: infra.MINIO_ACCESS_KEY || 'minioadmin',
    MINIO_SECRET_KEY: infra.MINIO_SECRET_KEY || 'minioadmin',
    AUTH_AVATAR_BUCKET: 'toeic-user-p6',
    MINIO_BUCKET: 'toeic-media-p6',
    MEDIA_PUBLIC_BASE_URL: 'http://localhost:19000/toeic-media-p6',
    ELASTICSEARCH_NODE: 'http://localhost:19200',
    QUESTION_SEARCH_INDEX: 'questions-p6-qa',
    QUESTION_SEARCH_QUEUE: 'qa-p6-search',
    QUESTION_OUTBOX_DLQ: 'qa.p6.question-bank-outbox-dlq',
    GRPC_PORT: String(ports.grpc),
    QUESTION_BANK_GRPC_URL: `localhost:${ports.grpc}`,
    ETS_ALLOW_DEV_FALLBACK: 'false',
  };
  for (const name of services)
    env[name.toUpperCase().replaceAll('-', '_') + '_URL'] = `http://127.0.0.1:${ports[name]}`;
  const redisClient = new (require('ioredis'))(env.REDIS_URL);
  assert.equal(new URL(env.REDIS_URL).pathname, '/6');
  await redisClient.flushdb();
  await redisClient.quit();
  const minio = new (require('minio').Client)({
    endPoint: 'localhost',
    port: 19000,
    useSSL: false,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });
  if (!(await minio.bucketExists('toeic-media-p6'))) await minio.makeBucket('toeic-media-p6');
  await minio.setBucketPolicy(
    'toeic-media-p6',
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: ['arn:aws:s3:::toeic-media-p6/*'],
        },
      ],
    }),
  );
  const base = `http://127.0.0.1:${ports['api-gateway']}`;
  async function startStack() {
    for (const [i, name] of services.entries()) {
      const u = new URL(databaseUrl(i));
      u.searchParams.set('connection_limit', '8');
      const p = launch(name, {
        ...env,
        PORT: String(ports[name]),
        DATABASE_URL: u.toString(),
        ...(name === 'auth-service' ? {} : { JWT_ACCESS_PRIVATE_KEY: '' }),
      });
      await ready(`http://127.0.0.1:${ports[name]}/api/v1/ready`, p);
    }
    const gw = launch('api-gateway', {
      ...env,
      JWT_ACCESS_PRIVATE_KEY: '',
      PORT: String(ports['api-gateway']),
    });
    await ready(base + '/ready', gw);
    writeFileSync(join(dir, 'runtime.json'), JSON.stringify({ ports, base, env }, null, 2));
  }
  await startStack();
  await check('all six real services ready through QA Gateway', async () => ({ ports }));
  const { run } = await import('./e2e.mjs');
  await check('canonical E2E with real Question Bank gRPC and Learning', async () => {
    const r =
      process.env.P6_RESUME === 'true'
        ? JSON.parse(readFileSync(join(root, 'artifacts/qa/latest.json')))
        : await run({ base, cleanup: false });
    assert(r.passed);
    return { checks: r.checks.length };
  });
  const { acceptance } = await import('./p6-acceptance.mjs');
  await acceptance({ base, env, proxies, check, docker, ports });
  // Outage proxies are test instrumentation, not part of the capacity profile.
  await stopOwnedServices();
  appendLogs = true;
  Object.assign(env, {
    REDIS_URL: 'redis://127.0.0.1:7379/6',
    RABBITMQ_URL: 'amqp://toeic:toeic@127.0.0.1:' + (process.env.P6_RABBITMQ_PORT || 5772),
    MINIO_ENDPOINT: '127.0.0.1:19000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
  });
  await check('all six services restart with direct dependencies before load', async () => {
    await startStack();
    report.infrastructure.loadConnections = 'direct; fault proxies used only for outage checks';
    return { ports };
  });
  const { brokerBenchmark } = await import('./p6-broker.mjs');
  await check('broker transport target 5000 events/sec', async () => {
    const r = await brokerBenchmark({
      ...env,
      RABBITMQ_URL: process.env.P6_BROKER_BENCH_URL || 'amqp://toeic:toeic@localhost:5772',
    });
    writeFileSync(join(out, 'broker.json'), JSON.stringify(r, null, 2));
    return { benchmark: r, targetMet: r.passed };
  });
  const { benchmark } = await import('./p6-load.mjs');
  if (process.env.P6_NFR_PREFLIGHT === 'true') {
    process.env.P6_LOAD_SECONDS = '60';
    process.env.P6_SKIP_RECOVERY = 'true';
    const preflight = await benchmark({ base, env, out });
    writeFileSync(join(out, 'preflight.json'), JSON.stringify(preflight, null, 2));
    assert(
      preflight.latency.p95Ms < 500 && preflight.errorRate < 0.01,
      'NFR preflight failed; inspect preflight.json before running 15 minutes',
    );
    delete process.env.P6_LOAD_SECONDS;
    delete process.env.P6_SKIP_RECOVERY;
    process.env.P6_REUSE_LOAD_FIXTURES = 'true';
  }
  report.load = await benchmark({ base, env, out });
  report.passed =
    report.checks.every((c) => c.passed && c.targetMet !== false) && report.load.passed;
  if (!report.passed) process.exitCode = 1;
} catch (e) {
  report.error = scrub(e.stack || e.message);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  for (const p of children) p.kill();
  for (const p of Object.values(proxies)) p.close();
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(out, 'latest.json'), JSON.stringify(report, null, 2));
  console.log('P6 report artifacts/p6/latest.json');
}
