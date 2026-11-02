import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { clients, require, root, databaseUrl, scrub } from './config.mjs';
import { stopChild } from './p6-process.mjs';
import { wait } from './p6-acceptance.mjs';
export async function recovery({ base, env }) {
  const dbs = clients(),
    [auth, , , analytics, learning] = dbs,
    checks = [];
  let child,
    revision = 0,
    stage = 'initialize';
  const enter = (name) => {
    stage = name;
    console.log('P6 RECOVERY ' + stage);
  };
  // Consume every response and bound transport waits, including failed assertions.
  const request = async (target, options = {}) => {
    const response = await fetch(target, {
      ...options,
      signal: options.signal || AbortSignal.timeout(10000),
    });
    const body = await response.text();
    return { status: response.status, json: async () => JSON.parse(body) };
  };
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  const url = 'http://127.0.0.1:' + port;
  async function launch(authUrl) {
    assert(!child, 'Previous recovery replica must exit before launching another');
    const log = createWriteStream(join(root, 'private/p6/analytics-replica.log'), { flags: 'a' });
    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: join(root, 'services/analytics-service'),
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: databaseUrl(3),
        PORT: String(port),
        JWT_ACCESS_PRIVATE_KEY: '',
        AUTH_INTERNAL_URL: authUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    await wait(async () => {
      assert.equal(child.exitCode, null, 'Recovery replica exited before readiness');
      assert.equal((await request(url + '/api/v1/ready')).status, 200);
    });
  }
  async function stop(options) {
    await stopChild(child, options);
    child = undefined;
  }
  try {
    const user = await auth.user.findFirstOrThrow({ where: { email: { startsWith: 'p6-vu-' } } }),
      session = await auth.authSession.findFirstOrThrow({ where: { userId: user.id } }),
      token = require('jsonwebtoken').sign(
        {
          sub: user.id,
          sid: session.id,
          roles: ['USER'],
          type: 'access',
          userVersion: '0',
          sessionVersion: '0',
          jti: randomUUID(),
        },
        env.JWT_ACCESS_PRIVATE_KEY,
        { algorithm: 'RS256', issuer: 'toeic-auth', audience: 'toeic-api', expiresIn: 900 },
      );
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    enter('fresh authorizer with Auth unavailable');
    await launch('http://127.0.0.1:1');
    assert.equal((await request(url + '/api/v1/analytics/progress', { headers })).status, 503);
    checks.push({
      name: 'fresh authorizer fails closed when Auth transport is unavailable',
      passed: true,
    });
    await stop();
    enter('two Analytics replicas and replay');
    await launch(env.AUTH_INTERNAL_URL);
    assert.equal((await request(url + '/api/v1/analytics/progress', { headers })).status, 200);
    const mq = await require('amqplib').connect(env.RABBITMQ_URL);
    try {
      const ch = await mq.createConfirmChannel();
      assert.equal((await ch.checkQueue('qa.p6.domain.analytics-service.v2')).consumerCount, 2);
      const card = await learning.vocabulary.findFirstOrThrow({ where: { deletedAt: null } }),
        before = await analytics.learningActivityFact.count({ where: { userId: user.id } });
      const old = await learning.userVocabularyProgress.findUnique({
        where: { userId_vocabularyId: { userId: user.id, vocabularyId: card.id } },
      });
      revision = Number(old?.revision || 0n);
      for (let i = 0; i < 10; i++) {
        const r = await request(base + '/api/v1/learning/flashcards/' + card.id + '/review', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            operationId: randomUUID(),
            quality: 5,
            baseEntityRevision: String(revision + i),
          }),
        });
        assert.equal(r.status, 200);
      }
      await wait(async () =>
        assert.equal(
          await analytics.learningActivityFact.count({ where: { userId: user.id } }),
          before + 10,
        ),
      );
      const row = await learning.outboxEvent.findFirstOrThrow({
        where: {
          eventType: 'VocabularyLearnedEvent.v2',
          payload: { path: ['payload', 'userId'], equals: user.id },
        },
        orderBy: { createdAt: 'desc' },
      });
      for (let i = 0; i < 200; i++)
        ch.publish(
          env.RABBITMQ_EXCHANGE,
          'vocabulary.learned.v2',
          Buffer.from(JSON.stringify(row.payload)),
          { persistent: true },
        );
      await ch.waitForConfirms();
      // This scenario tests crash/redelivery, rather than graceful Nest/Prisma teardown.
      await stop({ signal: 'SIGKILL' });
      await wait(async () =>
        assert.equal((await ch.checkQueue('qa.p6.domain.analytics-service.v2')).messageCount, 0),
      );
      assert.equal(
        await analytics.learningActivityFact.count({ where: { userId: user.id } }),
        before + 10,
      );
      checks.push({
        name: 'two Analytics replicas, abrupt replica exit and 200 replay deliveries retain exact counts',
        passed: true,
      });
      await ch.close();
    } finally {
      await mq.close();
    }
    enter('sync operation to other-device visibility');
    const state = await (await request(base + '/api/v1/sync/users/me', { headers })).json();
    await wait(async () => {
      const p = await auth.syncProjection.findUnique({
        where: {
          userId_entityType_entityId: {
            userId: user.id,
            entityType: 'VOCABULARY',
            entityId: (await learning.vocabulary.findFirstOrThrow({ where: { deletedAt: null } }))
              .id,
          },
        },
      });
      assert(p && p.revision === BigInt(revision + 10));
    });
    const card2 = await learning.vocabulary.findFirstOrThrow({ where: { deletedAt: null } }),
      id = randomUUID(),
      start = Date.now();
    const response = await request(base + '/api/v1/sync/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deviceId: 'p6-device-b',
        operationId: id,
        baseVersion: state.syncVersion,
        clientOccurredAt: new Date().toISOString(),
        operation: {
          kind: 'REVIEW_FLASHCARD',
          vocabularyId: card2.id,
          quality: 3,
          baseEntityRevision: String(revision + 10),
        },
      }),
    });
    assert.equal(response.status, 200);
    await wait(async () => {
      const r = await (await request(base + '/api/v1/sync/operations/' + id, { headers })).json();
      assert.equal(r.status, 'APPLIED');
      const s = await (await request(base + '/api/v1/sync/users/me', { headers })).json();
      assert(
        s.progress.some((p) => p.entityId === card2.id && p.revision === String(revision + 11)),
      );
    });
    const ms = Date.now() - start;
    checks.push({
      name: 'sync operation to other-device canonical visibility',
      ms,
      targetMs: 3000,
      passed: ms < 3000,
    });
    enter('fresh six-service E2E after load');
    const { run } = await import('./e2e.mjs');
    const full = await run({ base, cleanup: false });
    assert(full.passed);
    checks.push({
      name: 'fresh six-service E2E after load and recovery',
      passed: true,
      checks: full.checks.length,
    });
    const { observe } = await import('./observe.mjs');
    const observability = await observe(env);
    return {
      checks,
      observability,
      hardware: {
        cpu: os.cpus()[0]?.model,
        logicalCpus: os.cpus().length,
        ramGiB: os.totalmem() / 1073741824,
      },
      passed: checks.every((c) => c.passed),
    };
  } catch (e) {
    const error = scrub(e.stack || e.message);
    console.error('P6 RECOVERY failed at ' + stage + ': ' + error);
    return { checks, passed: false, stage, error };
  } finally {
    await stop();
    await Promise.all(dbs.map((d) => d.$disconnect()));
  }
}
