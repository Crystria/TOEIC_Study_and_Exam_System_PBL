import { randomUUID, createPrivateKey } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Agent, request } from 'node:http';
import { clients, require, root } from './config.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function batches(model, rows) {
  for (let i = 0; i < rows.length; i += 500)
    await model.createMany({ data: rows.slice(i, i + 500) });
}
function stats(rows) {
  const a = [...rows].sort((a, b) => a - b);
  return {
    samples: a.length,
    p50Ms: a[Math.floor(a.length * 0.5)] || 0,
    p95Ms: a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] || 0,
    maxMs: a.at(-1) || 0,
  };
}
export async function benchmark({ base, env, out }) {
  const agent = new Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32, timeout: 4000 });
  const fetch = (url, options = {}) =>
    new Promise((resolve, reject) => {
      const req = request(
        url,
        { ...options, agent, signal: options.signal ?? AbortSignal.timeout(10000) },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.once('error', reject);
          res.once('end', () => {
            const body = Buffer.concat(chunks),
              status = res.statusCode || 0;
            resolve({ status, ok: status >= 200 && status < 300, arrayBuffer: async () => body });
          });
        },
      );
      req.once('error', reject);
      req.end();
    });
  const dbs = clients(),
    [auth, , exam, analytics, learning] = dbs;
  try {
    const reuse = process.env.P6_REUSE_LOAD_FIXTURES === 'true';
    let users = Array.from({ length: 1000 }, (_, i) => ({
      id: randomUUID(),
      email: `p6-vu-${i}@example.test`,
      fullName: 'P6 virtual user ' + i,
      status: 'ACTIVE',
    }));
    if (reuse) {
      users = await auth.user.findMany({
        where: { email: { startsWith: 'p6-vu-' } },
        orderBy: { email: 'asc' },
      });
      assert.equal(users.length, 1000);
    } else {
      await batches(auth.user, users);
      await batches(
        auth.userRole,
        users.map((u) => ({ userId: u.id, roleCode: 'USER' })),
      );
    }
    let sessions = users.map((u) => ({
      id: randomUUID(),
      userId: u.id,
      deviceId: 'p6-load-fixture',
      expiresAt: new Date(Date.now() + 3600000),
    }));
    if (reuse) {
      const rows = await auth.authSession.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
      });
      sessions = users.map((u) => rows.find((s) => s.userId === u.id));
      assert(sessions.every(Boolean));
    } else await batches(auth.authSession, sessions);
    const jwt = require('jsonwebtoken'),
      signingKey = createPrivateKey(env.JWT_ACCESS_PRIVATE_KEY),
      sign = (i) =>
        jwt.sign(
          {
            sub: users[i].id,
            sid: sessions[i].id,
            roles: ['USER'],
            type: 'access',
            userVersion: '0',
            sessionVersion: '0',
            jti: randomUUID(),
          },
          signingKey,
          { algorithm: 'RS256', issuer: 'toeic-auth', audience: 'toeic-api', expiresIn: 900 },
        );
    let tokens = users.map((_, i) => sign(i));
    const golden = require(join(root, 'packages/contracts/p0/fixtures/events.valid.json'))[0].data
      .payload;
    const attempts = [],
      scores = [],
      parts = [],
      activities = [],
      learned = [];
    const vocab = Array.from({ length: 20 }, () => randomUUID()),
      now = Date.now();
    for (const u of users) {
      for (let i = 0; i < 3; i++) {
        const id = randomUUID(),
          at = new Date(now - (i + 1) * 86400000),
          p = { ...golden, userId: u.id, attemptId: id, completedAt: at.toISOString() };
        attempts.push({
          attemptId: id,
          userId: u.id,
          testId: p.testId,
          mode: 'FULL',
          completedAt: at,
          payloadHash: 'p6-fixture',
          payload: p,
        });
        scores.push({
          attemptId: id,
          userId: u.id,
          completedAt: at,
          scoreListening: p.scoreListening,
          scoreReading: p.scoreReading,
          totalScore: p.totalScore,
          scoring: p.scoring,
        });
        parts.push(...p.partStats.map((s) => ({ attemptId: id, ...s })));
        activities.push({
          eventId: randomUUID(),
          businessKey: randomUUID(),
          userId: u.id,
          kind: 'FULL',
          entityId: id,
          activityAt: at,
          payloadHash: 'p6-fixture',
          payload: p,
        });
      }
      for (let i = 0; i < 100; i++) {
        const at = new Date(now - (i % 30) * 86400000),
          v = vocab[i % 20];
        activities.push({
          eventId: randomUUID(),
          businessKey: randomUUID(),
          userId: u.id,
          kind: 'REVIEW',
          entityId: v,
          operationId: randomUUID(),
          revision: BigInt(i + 1),
          activityAt: at,
          payloadHash: 'p6-fixture',
          payload: {
            userId: u.id,
            vocabularyId: v,
            activityAt: at.toISOString(),
            quality: 5,
            firstLearnedAt: new Date(now - 29 * 86400000).toISOString(),
          },
        });
      }
      for (const v of vocab)
        learned.push({ userId: u.id, vocabularyId: v, firstAt: new Date(now - 29 * 86400000) });
    }
    if (!reuse) {
      await batches(analytics.attemptFact, attempts);
      await batches(analytics.testScoreFact, scores);
      await batches(analytics.attemptPartFact, parts);
      await batches(analytics.learningActivityFact, activities);
      await batches(analytics.firstLearnedEntity, learned);
    }
    // Bulk fixtures need planner statistics before measuring the steady workload.
    // Both clients are restricted to the fixed local *_p6_verify databases.
    await Promise.all([auth, analytics].map((db) => db.$executeRawUnsafe('ANALYZE')));
    const routes = [
      '/api/v1/learning/vocabulary-topics',
      '/api/v1/learning/vocabularies',
      '/api/v1/learning/lessons',
      '/api/v1/tests',
      '/api/v1/analytics/scores',
      '/api/v1/analytics/prediction',
      '/api/v1/analytics/weak-areas',
      '/api/v1/analytics/progress',
    ];
    // Warm public queries and both protected services using every real identity.
    for (let n = 0; n < users.length; n += 25)
      await Promise.all(
        users.slice(n, n + 25).map(async (_, j) => {
          for (const path of [routes[0], routes[3], routes[4]]) {
            const r = await fetch(base + path, {
              headers: { Authorization: 'Bearer ' + tokens[n + j] },
            });
            assert.equal(r.status, 200);
            await r.arrayBuffer();
          }
        }),
      );
    const duration = Number(process.env.P6_LOAD_SECONDS || 900),
      think = 5000;
    assert(duration >= 1 && duration <= 3600);
    const samples = [],
      perRoute = Object.fromEntries(routes.map((p) => [p, []])),
      statuses = {},
      errors = [];
    const start = performance.now(),
      deadline = start + duration * 1000;
    let renewedTokens = 0,
      renewalMaxMs = 0,
      skippedSlots = 0;
    console.log(
      `P6 LOAD start: 1000 distinct users, ${duration}s, 5s think time, real JWT/Auth/Redis/Gateway`,
    );
    const progress = setInterval(() => {
      const elapsedSeconds = (performance.now() - start) / 1000;
      writeFileSync(
        join(out, 'load-progress.json'),
        JSON.stringify(
          {
            at: new Date().toISOString(),
            durationSeconds: duration,
            elapsedSeconds,
            virtualUsers: 1000,
            renewedTokens,
            renewalMaxMs,
            skippedSlots,
            latency: stats(samples),
            statuses,
            incomplete: true,
          },
          null,
          2,
        ),
      );
      console.log('P6 LOAD ' + Math.floor(elapsedSeconds) + 's ' + samples.length + ' requests');
    }, 30000);
    await Promise.all(
      users.map(async (_, i) => {
        let n = i,
          nextAt = start + i * 5,
          renewAt = start + 600000 + i * 5;
        while (nextAt < deadline) {
          await sleep(Math.max(0, nextAt - performance.now()));
          if (performance.now() >= deadline) break;
          if (performance.now() >= renewAt) {
            const renewalStart = performance.now();
            tokens[i] = sign(i);
            renewalMaxMs = Math.max(renewalMaxMs, performance.now() - renewalStart);
            renewedTokens++;
            renewAt += 600000;
          }
          const path = routes[n++ % routes.length],
            at = performance.now();
          try {
            const r = await fetch(base + path, {
              headers: {
                Authorization: 'Bearer ' + tokens[i],
                'X-Correlation-ID': 'p6-load-' + i + '-' + n,
              },
              signal: AbortSignal.timeout(10000),
            });
            const bytes = await r.arrayBuffer();
            statuses[r.status] = (statuses[r.status] || 0) + 1;
            if (!r.ok && errors.length < 10) {
              let details = {};
              try {
                const b = JSON.parse(Buffer.from(bytes).toString());
                details = { code: b.code, message: b.message };
              } catch {}
              errors.push({ path, status: r.status, ...details });
            }
          } catch (e) {
            statuses.network = (statuses.network || 0) + 1;
            if (errors.length < 10)
              errors.push({
                path,
                error: e.name,
                message: e.message,
                causeCode: e.cause?.code ?? e.code,
              });
          }
          const ms = performance.now() - at;
          samples.push(ms);
          perRoute[path].push(ms);
          nextAt += think;
          // Keep each user's original phase after delays; do not bunch late timers.
          if (nextAt < performance.now()) {
            const missed = Math.ceil((performance.now() - nextAt) / think);
            skippedSlots += missed;
            nextAt += missed * think;
          }
        }
      }),
    );
    clearInterval(progress);
    const elapsed = (performance.now() - start) / 1000,
      total = samples.length,
      failed = Object.entries(statuses)
        .filter(([s]) => s !== '200')
        .reduce((n, [, c]) => n + c, 0),
      latency = stats(samples),
      report = {
        hardware: {
          cpu: os.cpus()[0]?.model,
          logicalCpus: os.cpus().length,
          ramGiB: os.totalmem() / 1073741824,
          platform: os.platform(),
        },
        virtualUsers: 1000,
        steadyWindowSeconds: duration,
        elapsedSeconds: elapsed,
        thinkMs: think,
        pacing:
          'absolute 5s per-user cadence, staggered 5ms starts; skipped overdue slots, no catch-up bursts',
        tokenRenewal: {
          renewedTokens,
          maxSingleSignMs: renewalMaxMs,
          strategy: 'per-user staggered renewal, unchanged 900s TTL',
        },
        skippedSlots,
        clientTransport:
          'HTTP/1.1 keep-alive, max 128 sockets; latency includes client queue and full response body; no retries',
        warmup:
          'ANALYZE QA fixture databases; public Learning, protected Exam and Analytics for all users before timing; authorization cache still expires every <=30 seconds during load',
        dataset: {
          users: 1000,
          fullFacts: attempts.length,
          partFacts: parts.length,
          activityFacts: activities.length,
          firstLearned: learned.length,
        },
        fixtureAuthentication:
          'preseeded real Auth users/sessions, RSA access tokens; login throughput excluded',
        latency,
        statuses,
        errorRate: failed / total,
        rps: total / elapsed,
        perRoute: Object.fromEntries(routes.map((p) => [p, stats(perRoute[p])])),
        errors,
        passed: duration >= 900 && failed / total < 0.01 && latency.p95Ms < 500,
      };
    writeFileSync(join(out, 'load.json'), JSON.stringify(report, null, 2));
    const { recovery } = await import('./p6-recovery.mjs');
    report.recovery =
      process.env.P6_SKIP_RECOVERY === 'true'
        ? { passed: true, skipped: true }
        : await recovery({ base, env });
    report.passed = report.passed && report.recovery.passed;
    const { observe } = await import('./observe.mjs');
    report.observability = await observe(env);
    writeFileSync(join(out, 'load.json'), JSON.stringify(report, null, 2));
    console.log(
      'P6 LOAD done ' +
        JSON.stringify({
          passed: report.passed,
          p95Ms: latency.p95Ms,
          errorRate: report.errorRate,
          rps: report.rps,
        }),
    );
    return report;
  } finally {
    agent.destroy();
    await Promise.all(dbs.map((d) => d.$disconnect()));
  }
}
