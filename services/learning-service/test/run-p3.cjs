// Only these local p3_*_<pid> databases and this run's broker topology are disposable.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../../..'),
  read = (p) =>
    fs.existsSync(path.join(root, p))
      ? require('dotenv').parse(fs.readFileSync(path.join(root, p)))
      : {};
const local = read('services/learning-service/.env'),
  infra = read('.env'),
  base = new URL(
    process.env.P3_POSTGRES_URL ||
      local.DATABASE_URL ||
      'postgresql://toeic:toeic@localhost:5432/postgres',
  );
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('P3 requires local verification infrastructure');
const container = process.env.P3_POSTGRES_CONTAINER || 'toeic-postgres',
  user = decodeURIComponent(base.username) || 'toeic',
  dbs = [],
  prefix = 'p3.verify.' + process.pid,
  exchange = prefix + '.events';
const rabbit =
  process.env.P3_RABBITMQ_URL || infra.RABBITMQ_URL || 'amqp://toeic:toeic@localhost:5772';
let exit = 0;
function docker(args, input) {
  return execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
function sql(db, text) {
  return docker(
    ['exec', '-i', container, 'psql', '-X', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq'],
    text,
  ).trim();
}
function create(kind) {
  const db = 'p3_' + kind + '_' + process.pid;
  assert.match(db, /^p3_(auth|learning|rehearsal)_\d+$/);
  docker(['exec', container, 'createdb', '-U', user, '-T', 'template0', db]);
  dbs.push(db);
  return db;
}
function url(db) {
  const copy = new URL(base);
  copy.pathname = '/' + db;
  return copy.toString();
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
  if (p.status !== 0) throw new Error('Prisma verification failed: ' + p.stdout + p.stderr);
  return p.stdout;
}
(async () => {
  try {
    const rehearsal = create('rehearsal'),
      dir = path.join(root, 'services/learning-service/prisma/migrations');
    for (const name of ['20261012084046_init', '20261031160000_p1_outbox_leases'])
      sql(rehearsal, fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'));
    const migration = fs.readFileSync(
      path.join(dir, '20261101030000_p3_learning/migration.sql'),
      'utf8',
    );
    sql(
      rehearsal,
      `INSERT INTO vocabulary_topics(id,name,updated_at) VALUES('topic','Legacy',now()); INSERT INTO vocabularies(id,topic_id,word,pronunciation,meaning,audio_url,updated_at) VALUES('v1','topic',' café ','/old/','Nghĩa','https://legacy.invalid/audio.mp3',now()),('v2','topic','Café',null,'Other',null,now());`,
    );
    assert.throws(() => sql(rehearsal, migration), /P3_DUPLICATE_VOCABULARY/);
    sql(
      rehearsal,
      "DELETE FROM vocabularies WHERE id='v2'; INSERT INTO user_progress(id,user_id,vocabulary_id) VALUES('progress','user','v1')",
    );
    assert.throws(() => sql(rehearsal, migration), /P3_LEGACY_PROGRESS_REQUIRES_REVIEW/);
    sql(
      rehearsal,
      "DELETE FROM user_progress; INSERT INTO grammar_lessons(id,title,slug,content,level,updated_at) VALUES('lesson','Old','old','Old content','BEGINNER',now())",
    );
    assert.throws(() => sql(rehearsal, migration), /P3_LEGACY_LESSON_CATEGORY_REQUIRED/);
    sql(rehearsal, 'DELETE FROM grammar_lessons');
    sql(rehearsal, migration);
    for (const next of fs
      .readdirSync(dir)
      .filter(
        (n) =>
          n > '20261101030000_p3_learning' && fs.existsSync(path.join(dir, n, 'migration.sql')),
      )
      .sort())
      sql(rehearsal, fs.readFileSync(path.join(dir, next, 'migration.sql'), 'utf8'));
    assert.equal(
      sql(
        rehearsal,
        "SELECT normalized_word||':'||phonetic||':'||definition||':'||audio_url FROM vocabularies WHERE id='v1'",
      ),
      'café:/old/:Nghĩa:https://legacy.invalid/audio.mp3',
    );
    prisma(rehearsal, [
      'migrate',
      'diff',
      '--from-url',
      url(rehearsal),
      '--to-schema-datamodel',
      'services/learning-service/prisma/schema.prisma',
      '--exit-code',
    ]);
    console.log(
      'PASS: migration preserves legacy vocabulary; rejects unresolved progress/category and Unicode duplicates; schema has no drift.',
    );
    const auth = create('auth'),
      learning = create('learning');
    for (const [s, db] of [
      ['auth', auth],
      ['learning', learning],
    ]) {
      const args = ['migrate', 'deploy', '--schema', `services/${s}-service/prisma/schema.prisma`];
      prisma(db, args);
      prisma(db, args);
    }
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/jest/bin/jest.js'),
        '--runInBand',
        ...(process.env.P6_COVERAGE === 'true' ? ['--coverage','--coverageProvider=v8','--coverageReporters=json','--coverageReporters=text-summary','--coverageDirectory='+path.join(root,'artifacts/p6/coverage/p3'),'--collectCoverageFrom=**/modules/**/*.service.ts','--collectCoverageFrom=**/sync/*.ts','--collectCoverageFrom=**/modules/analytics/events.consumer.ts','--collectCoverageFrom=**/modules/analytics/analytics.queries.ts','--collectCoverageFrom=**/modules/analytics/calculations.ts'] : []),
        '--passWithNoTests=false',
        '--detectOpenHandles',
        '--cacheDirectory=../../node_modules/.cache/p3-learning',
        'learning.p3.integration.spec.ts',
      ],
      {
        cwd: path.join(root, 'services/learning-service'),
        windowsHide: true,
        stdio: 'inherit',
        env: {
          ...process.env,
          SYNC_ENABLED: 'false',
          DATABASE_URL: url(learning),
          P3_AUTH_DATABASE_URL: url(auth),
          P3_LEARNING_DATABASE_URL: url(learning),
          REDIS_URL: process.env.REDIS_URL || 'redis://localhost:7379',
          RABBITMQ_URL: rabbit,
          RABBITMQ_EXCHANGE: exchange,
          AUTHORIZATION_QUEUE_PREFIX: prefix,
          LEARNING_V2_QUEUE_PREFIX: prefix,
          JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
          JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
          JWT_ACCESS_PUBLIC_KEY_FILE: '',
          JWT_ACCESS_PRIVATE_KEY_FILE: '',
          AUTH_SERVICE_SECRET: randomBytes(32).toString('hex'),
          AUTH_SERVICE_SECRET_FILE: '',
          AUTH_MAIL_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
          AUTH_MAIL_ENCRYPTION_KEY_FILE: '',
          MAILPIT_URL: 'http://localhost:8025',
          MINIO_ENDPOINT: process.env.P3_MINIO_ENDPOINT || 'http://localhost:19000',
          MINIO_PUBLIC_ENDPOINT: process.env.P3_MINIO_ENDPOINT || 'http://localhost:19000',
          MEDIA_PUBLIC_BASE_URL:
            (process.env.P3_MINIO_ENDPOINT || 'http://localhost:19000') + '/toeic-media',
          MINIO_ACCESS_KEY: infra.MINIO_ACCESS_KEY || 'minioadmin',
          MINIO_SECRET_KEY: infra.MINIO_SECRET_KEY || 'minioadmin',
        },
      },
    );
    exit = result.status ?? 1;
  } finally {
    try {
      const conn = await require('amqplib').connect(rabbit);
      try {
        const ch = await conn.createChannel();
        for (const name of [
          'auth-service',
          'learning-service',
          'analytics-service',
          'auth-learning-projection',
        ]) {
          const q = prefix + '.' + name + '.v2';
          for (const n of [q, q + '.dlq', q + '.retry.1000', q + '.retry.5000', q + '.retry.30000'])
            await ch.deleteQueue(n);
        }
        await ch.deleteQueue(exchange + '.dlq');
        await ch.deleteExchange(exchange + '.dlx');
        await ch.deleteExchange(exchange);
        await ch.close();
      } finally {
        await conn.close();
      }
    } catch (e) {
      console.error('P3 topology cleanup:', e.message);
      exit = 1;
    }
    for (const db of dbs) {
      assert.match(db, /^p3_(auth|learning|rehearsal)_\d+$/);
      docker(['exec', container, 'dropdb', '-U', user, '--force', db]);
    }
  }
})()
  .catch((e) => {
    console.error(String(e.message).replace(/(postgresql:\/\/)[^\s@]+@/g, '$1***@'));
    exit = 1;
  })
  .finally(() => {
    process.exitCode = exit;
  });
