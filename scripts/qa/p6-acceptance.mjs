import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clients, root, require, names, services, databaseUrl } from './config.mjs';
import { accounts, password, png } from './fixture.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function wait(fn, ms = 60000) {
  const end = Date.now() + ms;
  let error;
  while (Date.now() < end) {
    try {
      return await fn();
    } catch (e) {
      error = e;
      await sleep(250);
    }
  }
  throw error;
}
export async function acceptance({ base, env, proxies, check, docker, ports }) {
  const dbs = clients(),
    [auth, questions, exam, analytics, learning] = dbs;
  async function request(method, path, token, body) {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'p6-' + randomUUID(),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    return { status: r.status, body: await r.json() };
  }
  try {
    const users = await accounts(auth, 'p6-failure-' + randomUUID()),
      login = await request('POST', '/api/v1/auth/login', null, {
        email: users[0].email,
        password,
        deviceId: 'p6-failure',
      });
    assert.equal(login.status, 200);
    const token = login.body.accessToken;
    const topic = await learning.vocabularyTopic.findFirstOrThrow(),
      card = await learning.vocabulary.findFirstOrThrow({ where: { topicId: topic.id } });
    await check(
      'RabbitMQ outage: Learning commit survives and same V2 ID is replayed exactly once',
      async () => {
        proxies.rabbit.down();
        await sleep(500);
        const op = randomUUID(),
          r = await request('POST', '/api/v1/learning/flashcards/' + card.id + '/review', token, {
            quality: 5,
            baseEntityRevision: '0',
            operationId: op,
          });
        assert.equal(r.status, 200);
        const row = await learning.outboxEvent.findFirstOrThrow({
          where: {
            eventType: 'VocabularyLearnedEvent.v2',
            payload: { path: ['payload', 'operationId'], equals: op },
          },
        });
        assert.equal(row.publishedAt, null);
        const id = row.id;
        proxies.rabbit.up();
        await wait(async () => {
          assert((await learning.outboxEvent.findUniqueOrThrow({ where: { id } })).publishedAt);
          assert.equal(await analytics.processedEvent.count({ where: { eventId: id } }), 1);
        });
        const mq = await require('amqplib').connect(env.RABBITMQ_URL);
        try {
          const ch = await mq.createConfirmChannel();
          ch.publish(
            env.RABBITMQ_EXCHANGE,
            'vocabulary.learned.v2',
            Buffer.from(JSON.stringify(row.payload)),
            { persistent: true },
          );
          await ch.waitForConfirms();
          await ch.close();
        } finally {
          await mq.close();
        }
        await sleep(500);
        assert.equal(
          await analytics.learningActivityFact.count({
            where: { userId: users[0].id, kind: 'REVIEW' },
          }),
          1,
        );
        return { eventIdStable: true };
      },
    );
    await check(
      'Redis outage: readiness fails, degraded read remains authenticated and recovers',
      async () => {
        proxies.redis.down();
        try {
          const r = await request('GET', '/api/v1/analytics/progress', token);
          assert([200, 503, 504].includes(r.status));
          const ready = await fetch(base + '/ready');
          assert.equal(ready.status, 503);
        } finally {
          proxies.redis.up();
        }
        await wait(async () =>
          assert.equal((await request('GET', '/api/v1/analytics/progress', token)).status, 200),
        );
      },
    );
    await check(
      'Storage outage: presign fails without marking media attached, then recovers',
      async () => {
        const presign = await request('PATCH', '/api/v1/users/me/avatar/presign', token, {
          kind: 'AVATAR',
          contentType: 'image/png',
          sizeBytes: png.length,
        });
        assert.equal(presign.status, 200);
        assert(
          (
            await fetch(presign.body.putUrl, {
              method: 'PUT',
              headers: presign.body.requiredHeaders,
              body: png,
            })
          ).ok,
        );
        const before = (await auth.user.findUniqueOrThrow({ where: { id: users[0].id } }))
          .avatarKey;
        proxies.storage.down();
        try {
          const r = await request('POST', '/api/v1/users/me/avatar/confirm', token, {
            uploadId: presign.body.uploadId,
          });
          assert([503, 504, 500].includes(r.status));
          assert.equal(
            (await auth.user.findUniqueOrThrow({ where: { id: users[0].id } })).avatarKey,
            before,
          );
        } finally {
          proxies.storage.up();
        }
        await wait(async () =>
          assert.equal(
            (
              await request('POST', '/api/v1/users/me/avatar/confirm', token, {
                uploadId: presign.body.uploadId,
              })
            ).status,
            200,
          ),
        );
        assert.equal(
          (await fetch('http://localhost:19000/toeic-user-p6/' + presign.body.objectKey)).status,
          403,
        );
      },
    );
    await check(
      'Mail sandbox outage: activation delivery is durable, recovers and activates once',
      async () => {
        const email = 'p6-activation-' + randomUUID() + '@example.test';
        proxies.mail.down();
        try {
          const r = await request('POST', '/api/v1/auth/register', null, {
            email,
            password,
            confirmPassword: password,
            fullName: 'P6 activation',
          });
          assert.equal(r.status, 201);
          const user = await auth.user.findUniqueOrThrow({ where: { email } });
          assert.equal(user.status, 'INACTIVE');
          assert.equal(
            await auth.emailDelivery.count({ where: { userId: user.id, deliveredAt: null } }),
            1,
          );
          await wait(async () =>
            assert.equal(
              await auth.emailDelivery.count({
                where: { userId: user.id, deliveredAt: null, retryCount: { gte: 1 } },
              }),
              1,
            ),
          );
        } finally {
          proxies.mail.up();
        }
        const user = await auth.user.findUniqueOrThrow({ where: { email } });
        await wait(async () =>
          assert.equal(
            await auth.emailDelivery.count({ where: { userId: user.id, deliveredAt: null } }),
            0,
          ),
        );
        const messages = await (
          await fetch(
            'http://localhost:8025/api/v1/search?query=' + encodeURIComponent('to:' + email),
          )
        ).json();
        assert(messages.messages.length);
        const message = await (
          await fetch('http://localhost:8025/api/v1/message/' + messages.messages[0].ID)
        ).json();
        const content = message.Text || message.HTML;
        const match = content.match(/[?&]token=([A-Za-z0-9_-]+)/);
        assert(match);
        assert.equal(
          (await request('POST', '/api/v1/auth/verify-email', null, { token: match[1] })).status,
          200,
        );
        assert.equal(
          (await request('POST', '/api/v1/auth/verify-email', null, { token: match[1] })).status,
          400,
        );
      },
    );
    await check(
      'Backup/restore all five populated QA databases with row checksums and schema verification',
      async () => {
        for (const db of [auth, learning, exam, questions])
          await wait(async () =>
            assert.equal(await db.outboxEvent.count({ where: { publishedAt: null } }), 0),
          );
        const checks = [];
        for (const [i, name] of names.entries()) {
          assert.match(name, /^(auth|question|exam|analytics|learning)_p6_verify$/);
          const restored = name.replace('_verify', '_restore');
          // docker wrapper returns binary only when requested by a separate invocation below.
          const { execFileSync } = await import('node:child_process');
          const bytes = execFileSync(
            'docker',
            [
              'exec',
              process.env.P6_POSTGRES_CONTAINER || 'toeic-postgres',
              'pg_dump',
              '-U',
              'toeic',
              '-Fc',
              name,
            ],
            { windowsHide: true },
          );
          writeFileSync(join(root, 'private/p6', name + '.dump'), bytes);
          docker([
            'exec',
            'toeic-postgres',
            'dropdb',
            '--if-exists',
            '--force',
            '-U',
            'toeic',
            restored,
          ]);
          docker(['exec', 'toeic-postgres', 'createdb', '-U', 'toeic', restored]);
          execFileSync(
            'docker',
            [
              'exec',
              '-i',
              process.env.P6_POSTGRES_CONTAINER || 'toeic-postgres',
              'pg_restore',
              '-U',
              'toeic',
              '--exit-on-error',
              '--no-owner',
              '-d',
              restored,
            ],
            { input: bytes, windowsHide: true },
          );
          const sql = (db, q) =>
            docker([
              'exec',
              'toeic-postgres',
              'psql',
              '-X',
              '-U',
              'toeic',
              '-d',
              db,
              '-Atqc',
              q,
            ]).trim();
          const tables = sql(
            name,
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
          ).split('\n');
          for (const table of tables) {
            assert.match(table, /^[a-z_]+$/);
            const q = `SELECT count(*)||':'||md5(coalesce(string_agg(j,'|' ORDER BY j),'')) FROM (SELECT row_to_json(t)::text j FROM "${table}" t) x`;
            assert.equal(sql(restored, q), sql(name, q), name + '.' + table);
          }
          const u = new URL(databaseUrl(i));
          u.pathname = '/' + restored;
          execFileSync(
            process.execPath,
            [
              join(root, 'node_modules/prisma/build/index.js'),
              'migrate',
              'diff',
              '--from-url',
              u.toString(),
              '--to-schema-datamodel',
              join(root, 'services', services[i], 'prisma/schema.prisma'),
              '--exit-code',
            ],
            { env: { ...process.env, DATABASE_URL: u.toString() }, windowsHide: true },
          );
          checks.push({ database: name, tables: tables.length, matched: true });
          docker(['exec', 'toeic-postgres', 'dropdb', '--force', '-U', 'toeic', restored]);
        }
        return { databases: checks };
      },
    );
  } finally {
    for (const p of Object.values(proxies)) p.up();
    await Promise.all(dbs.map((d) => d.$disconnect()));
  }
}
