// Creates and drops ONLY its own disposable database. Never targets application DBs.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PrismaOutboxStore } = require('../dist');
const db = 'p1_outbox_verify_' + process.pid;
const container = process.env.P1_POSTGRES_CONTAINER || 'toeic-postgres';
const user = process.env.P1_POSTGRES_USER || 'toeic';
function command(args) {
  return execFileSync('docker', ['exec', container, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function sql(text) {
  return command([
    'psql',
    '-X',
    '-U',
    user,
    '-d',
    db,
    '-Atq',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    text,
  ]).trim();
}
const literal = (v) =>
  typeof v === 'number'
    ? String(v)
    : "'" + (v instanceof Date ? v.toISOString() : String(v)).replaceAll("'", "''") + "'";
const bind = (text, values) => text.replace(/\$(\d+)/g, (_, i) => literal(values[Number(i) - 1]));
let created = false;
(async () => {
  try {
    command(['createdb', '-U', user, db]);
    created = true;
    sql(
      "CREATE TABLE outbox_events(id TEXT PRIMARY KEY,aggregate_id TEXT,event_type TEXT,payload JSONB,created_at TIMESTAMP DEFAULT timezone('UTC',now()),published_at TIMESTAMP)",
    );
    sql(
      fs.readFileSync(
        '../../services/auth-service/prisma/migrations/20261031160000_p1_outbox_leases/migration.sql',
        'utf8',
      ),
    );
    const client = {
      $queryRawUnsafe: async (text, ...values) =>
        JSON.parse(
          sql("SELECT coalesce(json_agg(t),'[]'::json) FROM (" + bind(text, values) + ') t'),
        ),
      $executeRawUnsafe: async (text, ...values) => {
        sql(bind(text, values));
        return 1;
      },
    };
    // UPDATE RETURNING cannot be a subquery: use data-modifying CTE for the test transport.
    client.$queryRawUnsafe = async (text, ...values) => {
      const raw = bind(text, values);
      const returned = sql(
        'WITH result AS (' + raw + ") SELECT coalesce(json_agg(result),'[]'::json) FROM result",
      );
      return JSON.parse(returned).map((e) => ({ ...e, created_at: new Date(e.created_at) }));
    };
    sql(
      "INSERT INTO outbox_events(id,aggregate_id,event_type,payload) VALUES ('e','a','Legacy','{}')",
    );
    const first = new PrismaOutboxStore(client, { Legacy: 'legacy' }),
      second = new PrismaOutboxStore(client, { Legacy: 'legacy' });
    const [a] = await first.claim(1, 30);
    assert.equal(a.id, 'e');
    assert.deepEqual(await second.claim(1, 30), []);
    sql("UPDATE outbox_events SET lease_until=now()-interval '1 second'");
    const [b] = await second.claim(1, 30);
    assert.notEqual(a.leaseOwner, b.leaseOwner);
    await first.published(a);
    assert.equal(sql('SELECT count(*) FROM outbox_events WHERE published_at IS NULL'), '1');
    await second.failed(b, new Date(Date.now() - 1000), 'test failure');
    const [c] = await first.claim(1, 30);
    assert.equal(c.id, 'e');
    assert.equal(c.retryCount, 1);
    await first.published(c);
    assert.equal(sql('SELECT count(*) FROM outbox_events WHERE published_at IS NOT NULL'), '1');
    console.log(
      'PASS: PostgreSQL atomic claims, expired lease recovery, stale owner protection, retry ID and publish marking.',
    );
  } finally {
    if (created) {
      assert.match(db, /^p1_outbox_verify_\d+$/);
      command(['dropdb', '-U', user, db]);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
