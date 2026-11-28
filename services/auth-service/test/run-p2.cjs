// Owns ONLY p2_auth_{verify,rehearsal}_<pid> DBs and p2-mailpit-<pid> container.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const parsed = fs.existsSync(path.join(root, 'services/auth-service/.env'))
  ? require('dotenv').parse(fs.readFileSync(path.join(root, 'services/auth-service/.env')))
  : {};
const base = new URL(
  process.env.P2_POSTGRES_URL ||
    parsed.DATABASE_URL ||
    'postgresql://toeic:toeic@localhost:5432/postgres',
);
if (!['localhost', '127.0.0.1'].includes(base.hostname))
  throw new Error('P2 runner accepts local verification infrastructure only');
const container = process.env.P2_POSTGRES_CONTAINER || 'toeic-postgres',
  user = decodeURIComponent(base.username) || 'toeic';
const dbs = [],
  mailpit = 'p2-mailpit-' + process.pid;
let mailCreated = false,
  exit = 0;
function docker(args, input) {
  return execFileSync('docker', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}
function sql(db, value) {
  return docker(
    ['exec', '-i', container, 'psql', '-X', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-Atq'],
    value,
  ).trim();
}
function create(kind) {
  const db = 'p2_auth_' + kind + '_' + process.pid;
  assert.match(db, /^p2_auth_(verify|rehearsal)_\d+$/);
  docker(['exec', container, 'createdb', '-U', user, '-T', 'template0', db]);
  dbs.push(db);
  return db;
}
function url(db) {
  const copy = new URL(base);
  copy.pathname = '/' + db;
  return copy.toString();
}
function prisma(args, db) {
  const out = spawnSync(
    process.execPath,
    [path.join(root, 'node_modules/prisma/build/index.js'), ...args],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url(db) },
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (out.status !== 0)
    throw new Error('Prisma verification failed: ' + out.stdout + ' ' + out.stderr);
  return out.stdout;
}
(async () => {
  try {
    const rehearsal = create('rehearsal');
    const migrations = path.join(root, 'services/auth-service/prisma/migrations');
    for (const name of ['20261012083959_init', '20261031160000_p1_outbox_leases'])
      sql(rehearsal, fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
    const migration = fs.readFileSync(
      path.join(migrations, '20261101010000_p2_auth_sessions_activation/migration.sql'),
      'utf8',
    );
    const legacyHash = await require('bcrypt').hash('P2-Test-2026!', 12);
    sql(
      rehearsal,
      `INSERT INTO roles(id,code,name) VALUES ('old-role','USER','Legacy User');
   INSERT INTO users(id,email,password_hash,full_name,status,updated_at) VALUES ('00000010-0000-4000-8000-000000000001','Case@EXAMPLE.TEST','${legacyHash}','Legacy Active','ACTIVE',now()),('00000010-0000-4000-8000-000000000005','case@example.test','hash','Collision','PENDING',now());`,
    );
    assert.throws(() => sql(rehearsal, migration), /P2_EMAIL_COLLISION/);
    sql(
      rehearsal,
      `DELETE FROM users WHERE id='00000010-0000-4000-8000-000000000005';
   INSERT INTO users(id,email,password_hash,full_name,status,updated_at) VALUES ('00000010-0000-4000-8000-000000000002','locked@example.test','hash','Legacy Locked','LOCKED',now()),('00000010-0000-4000-8000-000000000003','disabled@example.test','hash','Disabled','DISABLED',now()),('00000010-0000-4000-8000-000000000004','pending@example.test','hash','Pending','PENDING',now());
   INSERT INTO user_roles(user_id,role_id) SELECT id,'old-role' FROM users;
   INSERT INTO refresh_tokens(id,user_id,token_hash,expires_at) VALUES ('legacy-token','00000010-0000-4000-8000-000000000001','legacy-hash',now()+interval '7 days');
   UPDATE users SET failed_login_attempts=4,avatar_url='https://legacy.invalid/avatar.png',phone_number='0901234567' WHERE id='00000010-0000-4000-8000-000000000001';`,
    );
    assert.throws(() => sql(rehearsal, migration), /P2_AMBIGUOUS_LOCKED_USER/);
    sql(
      rehearsal,
      "UPDATE users SET locked_until=now()+interval '15 minutes' WHERE id='00000010-0000-4000-8000-000000000002'",
    );
    sql(rehearsal, migration);
    assert.equal(
      sql(
        rehearsal,
        "SELECT email||':'||status::text FROM users WHERE id='00000010-0000-4000-8000-000000000001'",
      ),
      'case@example.test:ACTIVE',
    );
    assert.equal(
      sql(rehearsal, "SELECT status FROM users WHERE id='00000010-0000-4000-8000-000000000003'"),
      'SUSPENDED',
    );
    assert.equal(
      sql(rehearsal, "SELECT status FROM users WHERE id='00000010-0000-4000-8000-000000000004'"),
      'INACTIVE',
    );
    assert.equal(
      sql(
        rehearsal,
        "SELECT status::text||':'||(locked_until IS NOT NULL)::text FROM users WHERE id='00000010-0000-4000-8000-000000000002'",
      ),
      'ACTIVE:true',
    );
    assert.equal(
      sql(
        rehearsal,
        "SELECT role_code||':'||role_id FROM user_roles WHERE user_id='00000010-0000-4000-8000-000000000001'",
      ),
      'USER:old-role',
    );
    assert.equal(
      sql(
        rehearsal,
        "SELECT (revoked_at IS NOT NULL)::text FROM refresh_tokens WHERE id='legacy-token'",
      ),
      'true',
    );
    for (const next of fs
      .readdirSync(migrations)
      .filter(
        (n) =>
          n > '20261101010000_p2_auth_sessions_activation' &&
          fs.existsSync(path.join(migrations, n, 'migration.sql')),
      )
      .sort())
      sql(rehearsal, fs.readFileSync(path.join(migrations, next, 'migration.sql'), 'utf8'));
    const schema = path.join(root, 'services/auth-service/prisma/schema.prisma');
    prisma(
      [
        'migrate',
        'diff',
        '--from-url',
        url(rehearsal),
        '--to-schema-datamodel',
        schema,
        '--exit-code',
      ],
      rehearsal,
    );
    console.log(
      'PASS: P2 legacy mapping, collision/ambiguous-lock guards, refresh cutover and schema drift.',
    );
    const db = create('verify');
    prisma(['migrate', 'deploy', '--schema', schema], db);
    prisma(['migrate', 'deploy', '--schema', schema], db);
    prisma(
      ['migrate', 'diff', '--from-url', url(db), '--to-schema-datamodel', schema, '--exit-code'],
      db,
    );
    docker(['run', '-d', '--name', mailpit, '-p', '127.0.0.1::8025', 'axllent/mailpit:v1.33.0']);
    mailCreated = true;
    const port = docker(['port', mailpit, '8025/tcp']).trim().split(':').pop();
    const mailUrl = 'http://127.0.0.1:' + port;
    for (let n = 0; n < 100; n++) {
      try {
        const r = await fetch(mailUrl + '/api/v1/info');
        if (r.ok) break;
      } catch {}
      if (n === 99) throw new Error('Mailpit did not start');
      await new Promise((r) => setTimeout(r, 100));
    }
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const infra = fs.existsSync(path.join(root, '.env'))
      ? require('dotenv').parse(fs.readFileSync(path.join(root, '.env')))
      : {};
    const exchange = 'p2.verify.' + process.pid + '.events',
      prefix = 'p2.verify.' + process.pid;
    const env = {
      ...process.env,
      SYNC_ENABLED: 'false',
      DATABASE_URL: url(rehearsal),
      P2_AUTH_DATABASE_URL: url(rehearsal),
      JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
      JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
      JWT_ACCESS_PUBLIC_KEY_FILE: '',
      JWT_ACCESS_PRIVATE_KEY_FILE: '',
      AUTH_MAIL_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      AUTH_MAIL_ENCRYPTION_KEY_FILE: '',
      AUTH_SERVICE_SECRET: randomBytes(32).toString('hex'),
      AUTH_SERVICE_SECRET_FILE: '',
      MAILPIT_URL: mailUrl,
      RABBITMQ_URL:
        process.env.P2_RABBITMQ_URL || infra.RABBITMQ_URL || 'amqp://toeic:toeic@localhost:5772',
      RABBITMQ_EXCHANGE: exchange,
      AUTHORIZATION_QUEUE_PREFIX: prefix,
    };
    const result = spawnSync(
      process.execPath,
      [
        path.join(root, 'node_modules/jest/bin/jest.js'),
        '--runInBand',
        ...(process.env.P6_COVERAGE === 'true' ? ['--coverage','--coverageProvider=v8','--coverageReporters=json','--coverageReporters=text-summary','--coverageDirectory='+path.join(root,'artifacts/p6/coverage/p2'),'--collectCoverageFrom=**/modules/**/*.service.ts','--collectCoverageFrom=**/sync/*.ts','--collectCoverageFrom=**/modules/analytics/events.consumer.ts','--collectCoverageFrom=**/modules/analytics/analytics.queries.ts','--collectCoverageFrom=**/modules/analytics/calculations.ts'] : []),
        '--detectOpenHandles',
        '--cacheDirectory=../../node_modules/.cache/p2-auth',
        'auth.p2.integration.spec.ts',
      ],
      { cwd: path.join(root, 'services/auth-service'), env, stdio: 'inherit', windowsHide: true },
    );
    exit = result.status ?? 1;
    // Remove only this runner's broker topology, after Nest has drained and disconnected.
    const connection = await require('amqplib').connect(env.RABBITMQ_URL);
    try {
      const ch = await connection.createChannel();
      for (const service of ['auth-service', 'learning-service']) {
        const q = prefix + '.' + service + '.v2';
        for (const name of [
          q,
          q + '.dlq',
          q + '.retry.1000',
          q + '.retry.5000',
          q + '.retry.30000',
        ])
          await ch.deleteQueue(name);
      }
      await ch.deleteQueue(exchange + '.dlq');
      await ch.deleteExchange(exchange + '.dlx');
      await ch.deleteExchange(exchange);
      await ch.close();
    } finally {
      await connection.close();
    }
  } finally {
    if (mailCreated) {
      assert.match(mailpit, /^p2-mailpit-\d+$/);
      docker(['rm', '-f', mailpit]);
    }
    for (const db of dbs) {
      assert.match(db, /^p2_auth_(verify|rehearsal)_\d+$/);
      docker(['exec', container, 'dropdb', '-U', user, '--force', db]);
    }
  }
})()
  .catch((error) => {
    console.error(String(error.message).replace(/(postgresql:\/\/)[^\s@]+@/g, '$1***@'));
    exit = 1;
  })
  .finally(() => {
    process.exitCode = exit;
  });
