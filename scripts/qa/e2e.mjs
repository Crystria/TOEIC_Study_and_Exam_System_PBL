import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { baseUrl, bucket, clients, require, root, scrub, searchIndex } from './config.mjs';
import { accounts, password, runId, seed, tracking } from './fixture.mjs';
const { Client: EsClient } = require('@elastic/elasticsearch');
const { Client: MinioClient } = require('minio');
const Redis = require('ioredis');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(work, timeout = 60_000) {
  const end = Date.now() + timeout;
  let last;
  do {
    try {
      return await work();
    } catch (error) {
      last = error;
    }
    await sleep(300);
  } while (Date.now() < end);
  throw last;
}
function noAnswers(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      ![
        'correctOption',
        'correct_option',
        'isCorrect',
        'is_correct',
        'explanation',
        'transcript',
      ].includes(key),
      `Answer disclosure: ${key}`,
    );
    noAnswers(child);
  }
}
function percentiles(samples) {
  const values = [...samples].sort((a, b) => a - b);
  return {
    samples: values.length,
    p50Ms: +values[Math.ceil(values.length * 0.5) - 1].toFixed(2),
    p95Ms: +values[Math.ceil(values.length * 0.95) - 1].toFixed(2),
    maxMs: +values.at(-1).toFixed(2),
  };
}
export async function run({ base = baseUrl, keep = process.argv.includes('--seed') } = {}) {
  const id = runId(),
    label = keep ? 'QA Demo 200 Questions' : `qa-p4-${id}`;
  const track = tracking(),
    graded = new Map(),
    users = [];
  const report = {
    phase: 'P4',
    startedAt: new Date().toISOString(),
    baseUrl: base,
    node: process.version,
    mode: keep ? 'seed' : 'e2e-smoke',
    checks: [],
    metrics: {},
    passed: false,
  };
  const out = resolve(root, 'artifacts/qa');
  await mkdir(out, { recursive: true });
  let databases, es, minio, redis, tokens, fixture;
  async function raw(method, path, token, body, headers = {}) {
    const correlation = `p4-${id}-${Math.random().toString(16).slice(2)}`;
    const started = performance.now();
    const response = await fetch(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(20_000),
      headers: {
        'X-Correlation-ID': correlation,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Non-JSON response: ${method} ${path} (${response.status})`);
    }
    assert.equal(
      response.headers.get('x-correlation-id'),
      correlation,
      'Correlation ID was not preserved through gateway',
    );
    return {
      status: response.status,
      body: parsed,
      headers: response.headers,
      ms: performance.now() - started,
    };
  }
  async function api(method, path, token, body, status = 200, headers = {}) {
    const response = await raw(method, path, token, body, headers);
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${response.status}; ${path.includes('/auth/') ? 'auth response omitted' : JSON.stringify(response.body)?.slice(0, 500)}`,
    );
    return response.body;
  }
  async function check(name, work) {
    const started = performance.now();
    await work();
    report.checks.push({ name, passed: true, ms: +(performance.now() - started).toFixed(2) });
    console.log(`PASS ${name}`);
  }
  async function start(parts, key) {
    const a = await api(
      'POST',
      `/api/v1/tests/${fixture.testId}/${parts ? 'part-attempts' : 'attempts'}`,
      tokens[3],
      parts ? { parts, durationSeconds: 300 } : undefined,
      201,
      key ? { 'Idempotency-Key': key } : {},
    );
    noAnswers(a);
    return a;
  }
  async function submit(
    a,
    answers = a.questions.map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
  ) {
    const response = await raw('POST', `/api/v1/attempts/${a.attemptId}/submit`, tokens[3], {
      answers,
    });
    assert.equal(response.status, 201);
    graded.set(a.attemptId, response.body);
    return response;
  }
  try {
    const ready = await api('GET', '/ready');
    assert.equal(ready.qa, true, 'Refusing to seed a gateway that is not explicitly in QA_MODE');
    assert(
      /^questions-p4-/.test(searchIndex) && /-p4$/.test(bucket),
      'QA search index/bucket must use the QA namespace',
    );
    databases = clients();
    const [auth, questions, exam, analytics] = databases;
    es = new EsClient({ node: process.env.QA_ELASTICSEARCH_NODE ?? 'http://localhost:19200' });
    const endpoint = new URL(process.env.QA_MINIO_ENDPOINT ?? 'http://localhost:19000');
    minio = new MinioClient({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
      useSSL: endpoint.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    });
    redis = new Redis(process.env.QA_REDIS_URL ?? 'redis://localhost:7379', {
      maxRetriesPerRequest: 1,
    });
    users.push(...(await accounts(auth, keep ? 'demo' : id)));
    tokens = [];
    for (const user of users) {
      const login = await until(async () => {
        const response = await raw('POST', '/api/v1/auth/login', undefined, {
          email: user.email,
          password,
        });
        if (response.status === 429) {
          await sleep(6000);
          throw new Error('Waiting for auth rate limit refill');
        }
        assert.equal(response.status, 201);
        return response.body;
      }, 65_000);
      tokens.push(login.accessToken);
      user.refreshToken = login.refreshToken;
    }
    await check('gateway health/readiness and real auth JWT', async () => {
      assert.equal((await api('GET', '/health')).status, 'ok');
      assert.equal((await api('GET', '/status')).status, 'ok');
      await api('GET', '/api/v1/tests', undefined, undefined, 401);
      await api('GET', '/api/v1/tests', users[3].refreshToken, undefined, 401);
      await api('POST', '/api/v1/questions', tokens[3], {}, 403, {
        'X-User-Roles': 'SYSTEM_ADMIN',
        'X-User-ID': users[0].id,
      });
    });
    if (keep) {
      const existing = await api(
        'GET',
        `/api/v1/tests?keyword=${encodeURIComponent(label)}`,
        tokens[0],
      );
      if (existing.items.length) {
        fixture = await api('GET', `/api/v1/tests/${existing.items[0].testId}`, tokens[0]);
        const parts = await api('GET', `/api/v1/tests/${fixture.testId}/parts`, tokens[3]);
        assert(
          parts.parts.every((p) => p.available),
          'Existing QA seed has been edited; repair it before reusing',
        );
      }
    }
    if (!fixture)
      await check(
        'create 200 questions, 45 groups and 60 media uploads through gateway',
        async () => {
          fixture = await seed(api, tokens.slice(0, 3), label, track);
        },
      );
    report.fixture = {
      testId: fixture.testId,
      questions: 200,
      accounts: users.map(({ id, email }) => ({ id, email })),
    };
    await check('outbox-to-search indexing and USER answer redaction', async () => {
      if (!keep || track.questions.size)
        await until(async () => {
          await es.indices.refresh({ index: searchIndex });
          const count = await es.count({
            index: searchIndex,
            query: {
              bool: {
                filter: [{ term: { tags: label } }],
                must_not: [{ exists: { field: 'deletedAt' } }],
              },
            },
          });
          assert.equal(count.count, 200);
        });
      const listed = await api(
        'GET',
        `/api/v1/questions?tag=${encodeURIComponent(label)}&size=50`,
        tokens[3],
      );
      noAnswers(listed);
      assert.equal(listed.total, 200);
      const parts = await api('GET', `/api/v1/tests/${fixture.testId}/parts`, tokens[3]);
      assert.deepEqual(
        parts.parts.map((p) => p.totalQuestions),
        [6, 25, 39, 30, 30, 16, 54],
      );
      assert(parts.parts.every((p) => p.available));
    });
    if (keep) {
      report.passed = true;
      console.log(`Seed retained: ${fixture.testId}`);
      return report;
    }
    await check('public MinIO media URLs and group assets', async () => {
      const q = await api('GET', `/api/v1/questions/${fixture.items[0].questionId}`, tokens[3]);
      noAnswers(q);
      for (const [url, type] of [
        [q.audioUrl, 'audio/mpeg'],
        [q.imageUrl, 'image/png'],
      ]) {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        assert(response.headers.get('content-type')?.includes(type));
        assert((await response.arrayBuffer()).byteLength > 0);
      }
      const g = fixture.groups.find((g) => g.part === 7);
      await api('PATCH', `/api/v1/question-groups/${g.groupId}`, tokens[0], {
        assets: [
          { kind: 'TEXT', content: `${label} first asset`, orderNo: 2 },
          { kind: 'TEXT', content: 'QA second asset', orderNo: 1 },
        ],
      });
      const view = await api('GET', `/api/v1/question-groups/${g.groupId}`, tokens[3]);
      noAnswers(view);
      assert.deepEqual(
        view.assets.map((a) => a.orderNo),
        [1, 2],
      );
    });
    const full = await start(),
      single = await start([5], `p4-single-${id}`),
      multi = await start([3, 7]),
      all = await start([1, 2, 3, 4, 5, 6, 7]);
    await check('one/multiple/seven Parts, membership and durable start idempotency', async () => {
      assert.equal(single.questions.length, 30);
      assert.equal(multi.questions.length, 93);
      assert.equal(all.questions.length, 200);
      assert.equal(all.mode, 'PART');
      const repeat = await api(
        'POST',
        `/api/v1/tests/${fixture.testId}/part-attempts`,
        tokens[3],
        { parts: [5], durationSeconds: 300 },
        201,
        { 'Idempotency-Key': `p4-single-${id}` },
      );
      assert.equal(repeat.attemptId, single.attemptId);
      await api(
        'POST',
        `/api/v1/tests/${fixture.testId}/part-attempts`,
        tokens[3],
        { parts: [7], durationSeconds: 300 },
        409,
        { 'Idempotency-Key': `p4-single-${id}` },
      );
      await api('GET', `/api/v1/attempts/${full.attemptId}`, tokens[4], undefined, 403);
      const q2 = full.questions.find((q) => q.part === 2);
      assert.equal(q2.options.length, 3);
      await api(
        'PUT',
        `/api/v1/attempts/${full.attemptId}/answers/${q2.questionId}`,
        tokens[3],
        { selectedOption: 'D' },
        400,
      );
    });
    await check('Redis drafts, blank answers and Part-only accuracy', async () => {
      await api('PUT', `/api/v1/attempts/${single.attemptId}/draft`, tokens[3], {
        answers: single.questions
          .slice(0, 2)
          .map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
      });
      assert.equal(await exam.attemptAnswer.count({ where: { attemptId: single.attemptId } }), 0);
      noAnswers(await api('GET', `/api/v1/attempts/${single.attemptId}`, tokens[3]));
      const one = (
        await submit(single, [{ questionId: single.questions[0].questionId, selectedOption: null }])
      ).body;
      assert.equal(one.correctCount, 1);
      assert.equal(one.answers.length, 30);
      assert.equal(one.score, null);
      for (const a of [multi, all]) {
        const r = (await submit(a)).body;
        assert.equal(r.accuracy, 1);
        assert.equal(r.score, null);
        assert.equal(r.scoreListening, null);
      }
      const history = await api('GET', '/api/v1/attempts?mode=PART', tokens[3]);
      noAnswers(history);
      assert.equal(history.items.length, 3);
      assert(history.items.every((a) => a.mode === 'PART' && a.score === null));
      assert.equal((await api('GET', '/api/v1/attempts', tokens[4])).items.length, 0);
    });
    await check('immutable Full snapshot and simultaneous submit exactly once', async () => {
      const q = single.questions[0],
        original = await api('GET', `/api/v1/questions/${q.questionId}`, tokens[0]);
      await api('PATCH', `/api/v1/questions/${q.questionId}`, tokens[0], {
        correctOption: 'B',
        questionText: 'Edited after snapshot',
      });
      const results = await Promise.all([submit(full), submit(full), submit(full)]);
      for (const result of results) {
        assert.equal(result.body.totalScore, 990);
        assert.equal(result.body.scoreListening, 495);
        assert.equal(result.body.scoreReading, 495);
        assert(result.body.scoreDisclaimer);
        assert.equal(
          result.body.questions.find((item) => item.questionId === q.questionId).questionText,
          original.questionText,
        );
      }
      assert.equal(await exam.outboxEvent.count({ where: { aggregateId: full.attemptId } }), 1);
      assert.equal(await exam.attemptAnswer.count({ where: { attemptId: full.attemptId } }), 200);
      await api('PATCH', `/api/v1/questions/${q.questionId}`, tokens[0], {
        correctOption: 'A',
        questionText: original.questionText,
      });
    });
    await check('smoke p95 read <500ms and Full submit <2000ms (concurrency 1)', async () => {
      const reads = [],
        submits = [];
      const paths = [
        '/api/v1/tests',
        `/api/v1/questions?tag=${encodeURIComponent(label)}&size=20`,
        `/api/v1/attempts/${full.attemptId}`,
      ];
      for (let i = 0; i < 5; i++) await api('GET', paths[i % paths.length], tokens[3]);
      for (let i = 0; i < 100; i++) {
        const r = await raw('GET', paths[i % paths.length], tokens[3]);
        assert.equal(r.status, 200);
        reads.push(r.ms);
      }
      for (let i = 0; i < 10; i++) {
        const a = await start();
        const r = await submit(a);
        assert.equal(r.body.totalScore, 990);
        submits.push(r.ms);
      }
      report.metrics.read = percentiles(reads);
      report.metrics.submit = percentiles(submits);
      report.metrics.concurrency = 1;
      assert(report.metrics.read.p95Ms < 500, `Read p95 ${report.metrics.read.p95Ms}ms`);
      assert(report.metrics.submit.p95Ms < 2000, `Submit p95 ${report.metrics.submit.p95Ms}ms`);
      console.log(
        `Read p95 ${report.metrics.read.p95Ms}ms; submit p95 ${report.metrics.submit.p95Ms}ms`,
      );
    });
    await check('Full/Part events reach Analytics with weighted per-Part weak areas', async () => {
      await until(async () => {
        const scores = await api('GET', '/api/v1/analytics/scores', tokens[3]);
        assert.equal(scores.items.length, graded.size);
        assert(scores.items.filter((s) => s.mode === 'PART').every((s) => s.score === null));
        const expected = new Map();
        for (const result of graded.values())
          for (const stat of result.partStats) {
            const p = expected.get(stat.part) ?? { total: 0, correct: 0 };
            p.total += stat.totalQuestions;
            p.correct += stat.correctCount;
            expected.set(stat.part, p);
          }
        const weak = await api('GET', '/api/v1/analytics/weak-areas', tokens[3]);
        for (const [part, count] of expected) {
          const actual = weak.items.find((p) => p.part === part);
          assert(actual);
          assert.equal(actual.sampleCount, count.total);
          assert(Math.abs(actual.errorRate - (1 - count.correct / count.total)) < 1e-9);
        }
      });
    });
    await check(
      'archive cascade removes search and blocks new starts, while review survives',
      async () => {
        const group = fixture.groups.find((g) => g.part === 7);
        await api('DELETE', `/api/v1/question-groups/${group.groupId}`, tokens[0]);
        await api('GET', `/api/v1/question-groups/${group.groupId}`, tokens[3], undefined, 404);
        for (const q of group.questionIds)
          await api('GET', `/api/v1/questions/${q}`, tokens[3], undefined, 404);
        await api(
          'POST',
          `/api/v1/tests/${fixture.testId}/part-attempts`,
          tokens[3],
          { parts: [7], durationSeconds: 300 },
          409,
        );
        await until(async () => {
          await es.indices.refresh({ index: searchIndex });
          const r = await api('GET', `/api/v1/questions?groupId=${group.groupId}`, tokens[3]);
          assert.equal(r.total, 0);
        });
        await api('DELETE', `/api/v1/tests/${fixture.testId}`, tokens[0]);
        await api('POST', `/api/v1/tests/${fixture.testId}/attempts`, tokens[3], undefined, 404);
        assert.equal(
          (await api('GET', `/api/v1/attempts/${full.attemptId}`, tokens[3])).totalScore,
          990,
        );
      },
    );
    await check('presign quota returns 429 with retry/correlation headers', async () => {
      let blocked = false;
      for (let i = 0; i < 35; i++) {
        const response = await raw(
          'POST',
          `/api/v1/questions/${fixture.items[0].questionId}/media/presign`,
          tokens[0],
          { mediaType: 'AUDIO', contentType: 'audio/mpeg', fileName: 'quota.mp3' },
        );
        if (response.status === 429) {
          assert(Number(response.headers.get('retry-after')) >= 1);
          blocked = true;
          break;
        }
        assert.equal(response.status, 201);
      }
      assert(blocked, 'Expected the 30/hour presign limit');
    });
    report.passed = true;
    return report;
  } catch (error) {
    report.error = scrub(error.stack ?? error.message);
    throw error;
  } finally {
    if (!keep && databases && tokens) {
      const [auth, questions, exam, analytics] = databases;
      try {
        // Archive first; keep versioned ES tombstones so late deliveries cannot resurrect fixtures.
        for (const groupId of track.groups) {
          const r = await raw('DELETE', `/api/v1/question-groups/${groupId}`, tokens[1]);
          assert([200, 404].includes(r.status));
        }
        const standalone = await questions.question.findMany({
          where: { id: { in: [...track.questions] }, groupId: null, deletedAt: null },
          select: { id: true },
        });
        for (const q of standalone) await api('DELETE', `/api/v1/questions/${q.id}`, tokens[2]);
        if (track.questions.size)
          await until(async () => {
            await es.indices.refresh({ index: searchIndex });
            const count = await es.count({
              index: searchIndex,
              query: {
                bool: {
                  filter: [{ ids: { values: [...track.questions] } }],
                  must_not: [{ exists: { field: 'deletedAt' } }],
                },
              },
            });
            assert.equal(count.count, 0);
          });
        const allAttempts = await exam.attempt.findMany({
          where: { testId: { in: [...track.tests] }, userId: { in: users.map((u) => u.id) } },
          select: { id: true },
        });
        const attemptIds = allAttempts.map((a) => a.id);
        await until(async () => {
          const events = await exam.outboxEvent.findMany({
            where: { aggregateId: { in: attemptIds } },
          });
          assert(events.every((e) => e.publishedAt && !e.deadLetteredAt));
          assert.equal(
            await analytics.processedEvent.count({
              where: { eventId: { in: events.map((e) => e.id) } },
            }),
            events.length,
          );
        });
        await exam.outboxEvent.deleteMany({ where: { aggregateId: { in: attemptIds } } });
        await exam.test.deleteMany({ where: { id: { in: [...track.tests] } } });
        await questions.outboxEvent.deleteMany({
          where: { aggregateId: { in: [...track.questions, ...track.groups] } },
        });
        await questions.question.deleteMany({ where: { id: { in: [...track.questions] } } });
        await questions.questionGroup.deleteMany({ where: { id: { in: [...track.groups] } } });
        await questions.tag.deleteMany({ where: { name: label, questions: { none: {} } } });
        const owned = { userId: { in: users.map((u) => u.id) } };
        for (const model of [
          'scoreHistory',
          'learningActivity',
          'weakArea',
          'userLearningStat',
          'dailyStreak',
        ])
          await analytics[model].deleteMany({ where: owned });
        await auth.auditLog.deleteMany({ where: owned });
        await auth.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
        if (track.objects.size) await minio.removeObjects(bucket, [...track.objects]);
        const keys = [
          ...attemptIds.map((a) => `exam:draft:${a}`),
          ...users.flatMap((u) =>
            ['read', 'submit', 'presign', 'ai'].map((kind) => `ratelimit:user:${u.id}:${kind}`),
          ),
        ];
        if (keys.length) await redis.del(...keys);
        report.cleanup = {
          questions: track.questions.size,
          groups: track.groups.size,
          attempts: attemptIds.length,
          media: track.objects.size,
          retained: 'versioned ES tombstones and Analytics inbox IDs only',
        };
      } catch (error) {
        report.cleanupError = scrub(error.message);
        report.passed = false;
        process.exitCode = 1;
        console.error(`Cleanup failed: ${scrub(error.message)}`);
      }
    }
    await Promise.allSettled([
      ...(databases?.map((db) => db.$disconnect()) ?? []),
      es?.close(),
      redis?.quit(),
    ]);
    report.completedAt = new Date().toISOString();
    await writeFile(
      resolve(out, keep ? 'seed.json' : 'latest.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `QA ${report.passed ? 'PASS' : 'FAIL'}; report: artifacts/qa/${keep ? 'seed' : 'latest'}.json`,
    );
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await run().catch((error) => {
    console.error(scrub(error.message));
    process.exitCode = 1;
  });
}
