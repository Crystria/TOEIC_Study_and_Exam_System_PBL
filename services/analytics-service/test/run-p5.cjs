const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process'),
  { generateKeyPairSync, randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../../..'),
  read = (p) =>
    fs.existsSync(path.join(root, p))
      ? require('dotenv').parse(fs.readFileSync(path.join(root, p)))
      : {};
const local = read('services/analytics-service/.env'),
  infra = read('.env'),
  base = new URL(
    process.env.P5_POSTGRES_URL ||
      local.DATABASE_URL ||
      'postgresql://toeic:toeic@localhost:5432/postgres',
  );
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw Error('P5 verification infrastructure must be local');
const container = process.env.P5_POSTGRES_CONTAINER || 'toeic-postgres',
  user = decodeURIComponent(base.username) || 'toeic',
  dbs = [],
  prefix = 'p5.verify.' + process.pid,
  exchange = prefix + '.events',
  rabbit = process.env.P5_RABBITMQ_URL || infra.RABBITMQ_URL || 'amqp://toeic:toeic@localhost:5772';
let exit = 0;
function docker(args, input) {
  return execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
function sql(db, q) {
  return docker(
    ['exec', '-i', container, 'psql', '-X', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq'],
    q,
  ).trim();
}
function create(kind) {
  const db = 'p5_' + kind + '_' + process.pid;
  assert.match(db, /^p5_(auth|learning|analytics|exam|rehearsal)_\d+$/);
  docker(['exec', container, 'createdb', '-U', user, '-T', 'template0', db]);
  dbs.push(db);
  return db;
}
function url(db) {
  const u = new URL(base);
  u.pathname = '/' + db;
  return u.toString();
}
function prisma(db, args) {
  const p = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules/prisma/build/index.js'), ...args],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url(db) },
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (p.status !== 0) throw Error('Prisma check failed ' + p.stdout + p.stderr);
  return p.stdout;
}
(async () => {
  try {
    const r = create('rehearsal'),
      dir = path.join(root, 'services/analytics-service/prisma/migrations');
    for (const n of fs
      .readdirSync(dir)
      .filter(
        (n) =>
          n < '20261101050000_p5_analytics' && fs.existsSync(path.join(dir, n, 'migration.sql')),
      )
      .sort())
      sql(r, fs.readFileSync(path.join(dir, n, 'migration.sql'), 'utf8'));
    sql(
      r,
      "INSERT INTO score_history(id,user_id,attempt_id,test_type,mode,score,taken_at) VALUES('old-mini','legacy','old-attempt','MINI',null,250,now()),('old-full','legacy','old-full-attempt','FULL','FULL',750,now()); INSERT INTO processed_events(event_id,event_type) VALUES('old-event','TestSubmittedEvent')",
    );
    sql(r, fs.readFileSync(path.join(dir, '20261101050000_p5_analytics/migration.sql'), 'utf8'));
    assert.equal(sql(r, 'SELECT count(*) FROM score_history'), '2');
    assert.equal(sql(r, 'SELECT count(*) FROM test_score_facts'), '0');
    assert.equal(
      sql(r, "SELECT payload_hash IS NULL FROM processed_events WHERE event_id='old-event'"),
      't',
    );
    prisma(r, [
      'migrate',
      'diff',
      '--from-url',
      url(r),
      '--to-schema-datamodel',
      'services/analytics-service/prisma/schema.prisma',
      '--exit-code',
    ]);
    console.log(
      'PASS: P5 preserves legacy scores/inbox without fabricating Full facts; schema has no drift.',
    );
    const databases = {};
    for (const name of ['auth', 'learning', 'analytics', 'exam']) {
      databases[name] = create(name);
      for (let n = 0; n < 2; n++)
        prisma(databases[name], [
          'migrate',
          'deploy',
          '--schema',
          `services/${name}-service/prisma/schema.prisma`,
        ]);
    }
    const pair = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      }),
      env = {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(databases).map(([k, v]) => [
            'P5_' + k.toUpperCase() + '_DATABASE_URL',
            url(v),
          ]),
        ),
        DATABASE_URL: url(databases.analytics),
        REDIS_URL: 'redis://localhost:7379',
        RABBITMQ_URL: rabbit,
        RABBITMQ_EXCHANGE: exchange,
        AUTHORIZATION_QUEUE_PREFIX: prefix + '.authorization',
        ANALYTICS_CONSUMER_ENABLED: 'true',
        SYNC_QUEUE_PREFIX: prefix,
        LEARNING_V2_QUEUE_PREFIX: prefix,
        ANALYTICS_QUEUE_PREFIX: prefix,
        SYNC_ENABLED: 'true',
        JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
        JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
        JWT_ACCESS_PUBLIC_KEY_FILE: '',
        JWT_ACCESS_PRIVATE_KEY_FILE: '',
        AUTH_SERVICE_SECRET: randomBytes(32).toString('hex'),
        AUTH_SERVICE_SECRET_FILE: '',
        AUTH_MAIL_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        AUTH_MAIL_ENCRYPTION_KEY_FILE: '',
        MINIO_ENDPOINT: 'http://localhost:19000',
        MINIO_PUBLIC_ENDPOINT: 'http://localhost:19000',
        MINIO_ACCESS_KEY: infra.MINIO_ACCESS_KEY || 'minioadmin',
        MINIO_SECRET_KEY: infra.MINIO_SECRET_KEY || 'minioadmin',
      };
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/jest/bin/jest.js'),
        '--runInBand',
        ...(process.env.P6_COVERAGE === 'true' ? ['--coverage','--coverageProvider=v8','--coverageReporters=json','--coverageReporters=text-summary','--coverageDirectory='+path.join(root,'artifacts/p6/coverage/p5'),'--collectCoverageFrom=**/modules/**/*.service.ts','--collectCoverageFrom=**/sync/*.ts','--collectCoverageFrom=**/modules/analytics/events.consumer.ts','--collectCoverageFrom=**/modules/analytics/analytics.queries.ts','--collectCoverageFrom=**/modules/analytics/calculations.ts'] : []),
        '--passWithNoTests=false',
        '--detectOpenHandles',
        'p5.integration.spec.ts',
      ],
      {
        cwd: path.join(root, 'services/analytics-service'),
        env,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    exit = result.status ?? 1;
  } finally {
    try {
      const c = await require('amqplib').connect(rabbit);
      try {
        const ch = await c.createChannel();
        for (const s of [
          'auth-service',
          'learning-service',
          'analytics-service',
          'exam-service',
          'auth-learning-projection',
          'learning-sync',
        ])
          for (const q of [
            prefix + '.' + s + '.v2',
            prefix + '.' + s + '.v2.dlq',
            ...[1000, 5000, 30000].map((d) => prefix + '.' + s + '.v2.retry.' + d),
          ])
            await ch.deleteQueue(q);
        for (const s of ['auth-service', 'learning-service', 'analytics-service', 'exam-service']) {
          const q = prefix + '.authorization.' + s + '.v2';
          for (const n of [q, q + '.dlq', ...[1000, 5000, 30000].map((d) => q + '.retry.' + d)])
            await ch.deleteQueue(n);
        }
        await ch.deleteQueue(prefix + '.exam-outbox-dlq');
        await ch.deleteQueue(exchange + '.dlq');
        await ch.deleteExchange(exchange + '.dlx');
        await ch.deleteExchange(exchange);
        await ch.close();
      } finally {
        await c.close();
      }
    } catch (e) {
      console.error('P5 topology cleanup: ' + e.message);
      exit = 1;
    }
    for (const db of dbs) {
      assert.match(db, /^p5_(auth|learning|analytics|exam|rehearsal)_\d+$/);
      docker(['exec', container, 'dropdb', '-U', user, '--force', db]);
    }
  }
})()
  .catch((e) => {
    console.error(String(e.message).replace(/(postgresql:\/\/)[^\s@]+@/g, '$1***@'));
    exit = 1;
  })
  .finally(() => (process.exitCode = exit));
