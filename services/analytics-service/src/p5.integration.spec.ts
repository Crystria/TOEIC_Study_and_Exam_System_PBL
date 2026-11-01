import { AppModule as AnalyticsModule } from './app.module';
import { configureAnalytics } from './main';
import { PrismaService as AnalyticsPrisma } from './prisma/prisma.service';
import { EventsConsumer } from './modules/analytics/events.consumer';
import { ProjectionService } from './modules/analytics/projection.service';
import { AnalyticsClock } from './modules/analytics/calculations';
import { AppModule as ExamModule } from '../../exam-service/src/app.module';
import { PrismaService as ExamPrisma } from '../../exam-service/src/prisma/prisma.service';
import { configureHttp as configureExam } from '../../exam-service/src/main';
import { QUESTION_BANK_CLIENT } from '../../exam-service/src/grpc/question-bank.client';
import { fullFixture } from '../../exam-service/src/test-fixtures';
import { of } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { createServer, AddressInfo } from 'node:net';
import * as amqp from 'amqplib';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RedisService, MessagingService } from '@toeic/common';
import { Client } from 'minio';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../../learning-service/src/app.module';
import { configureLearning } from '../../learning-service/src/http';
import { PrismaService } from '../../learning-service/src/prisma/prisma.service';
import { AppModule as AuthModule } from '../../auth-service/src/app.module';
import { PrismaService as AuthPrisma } from '../../auth-service/src/prisma/prisma.service';
import { configureAuth } from '../../auth-service/src/http';
import { configureGateway } from '../../api-gateway/src/main';
import { validateRequest, validateEvent } from '@toeic/contracts/p0/runtime.cjs';
const integration = process.env.P5_LEARNING_DATABASE_URL ? describe : describe.skip;
integration('P5 Analytics via Gateway with real Auth/PostgreSQL/RabbitMQ/MinIO', () => {
  jest.setTimeout(60000);
  let auth: INestApplication,
    learning: INestApplication,
    gateway: INestApplication,
    db: PrismaService,
    authDb: AuthPrisma,
    minio: Client;
  let analytics: INestApplication, exam: INestApplication, adb: AnalyticsPrisma, edb: ExamPrisma;
  const fixture = fullFixture();
  let testId: string;
  const tokens: Record<string, string> = {},
    ids: Record<string, string> = {},
    objects = new Set<string>();
  let cards: Array<{ vocabularyId: string; definition: string }>;
  const api = () => request(gateway.getHttpServer());
  const post = (path: string, body: object | undefined, role = 'USER', key = randomUUID()) =>
    api()
      .post('/api/v1/learning/' + path)
      .auth(tokens[role], { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  async function createTopic(count = 6, definitions?: string[]) {
    const r = await post(
      'admin/vocabulary-topics',
      { topicName: 'P5 ' + randomUUID() },
      'CONTENT_ADMIN',
    );
    expect(r.status).toBe(201);
    const values = [];
    for (let i = 0; i < count; i++) {
      const v = await post(
        'admin/vocabularies',
        {
          topicId: r.body.topicId,
          word: 'Word ' + i,
          definition: definitions?.[i] ?? 'Meaning ' + i,
        },
        'CONTENT_ADMIN',
      );
      expect(v.status).toBe(201);
      validateRequest('Vocabulary', v.body);
      values.push(v.body);
    }
    return { topic: r.body.topicId, cards: values };
  }
  async function until(check: () => Promise<boolean>) {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('P5 timeout');
  }
  beforeAll(async () => {
    for (const key of [
      'P5_AUTH_DATABASE_URL',
      'P5_LEARNING_DATABASE_URL',
      'P5_ANALYTICS_DATABASE_URL',
      'P5_EXAM_DATABASE_URL',
    ])
      if (!/^\/p5_(auth|learning|analytics|exam)_\d+$/.test(new URL(process.env[key]!).pathname))
        throw new Error('Isolated P3 DB required');
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, '127.0.0.1', r));
    const learningPort = (socket.address() as AddressInfo).port;
    await new Promise<void>((r) => socket.close(() => r()));
    process.env.LEARNING_INTERNAL_URL = 'http://127.0.0.1:' + learningPort;
    const authSocket = createServer();
    await new Promise<void>((r) => authSocket.listen(0, '127.0.0.1', r));
    const authPort = (authSocket.address() as AddressInfo).port;
    await new Promise<void>((r) => authSocket.close(() => r()));
    process.env.AUTH_INTERNAL_URL = 'http://127.0.0.1:' + authPort;
    authDb = new AuthPrisma({ datasources: { db: { url: process.env.P5_AUTH_DATABASE_URL } } });
    db = new PrismaService({ datasources: { db: { url: process.env.P5_LEARNING_DATABASE_URL } } });
    const am = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(AuthPrisma)
      .useValue(authDb)
      .compile();
    auth = am.createNestApplication();
    configureAuth(auth);
    await auth.listen(authPort, '127.0.0.1');
    process.env.AUTH_INTERNAL_URL = await auth.getUrl();
    const lm = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    learning = lm.createNestApplication();
    configureLearning(learning);
    await learning.listen(learningPort, '127.0.0.1');
    adb = new AnalyticsPrisma({ datasourceUrl: process.env.P5_ANALYTICS_DATABASE_URL });
    edb = new ExamPrisma({ datasourceUrl: process.env.P5_EXAM_DATABASE_URL });
    const an = await Test.createTestingModule({ imports: [AnalyticsModule] })
      .overrideProvider(AnalyticsPrisma)
      .useValue(adb)
      .compile();
    analytics = an.createNestApplication();
    configureAnalytics(analytics);
    await analytics.listen(0, '127.0.0.1');
    const questionClient = {
      getService: () => ({
        getQuestions: ({ question_ids }: any) =>
          of({
            questions: fixture.bundle.questions.filter((q) => question_ids.includes(q.id)),
            groups: fixture.bundle.groups.filter((g) =>
              g.question_ids.some((id) => question_ids.includes(id)),
            ),
            missing_ids: [],
          }),
        getAnswerKey: ({ question_ids }: any) =>
          of({
            answers: fixture.key.answers.filter((a) => question_ids.includes(a.question_id)),
            missing_ids: [],
          }),
      }),
    };
    const ex = await Test.createTestingModule({ imports: [ExamModule] })
      .overrideProvider(ExamPrisma)
      .useValue(edb)
      .overrideProvider(QUESTION_BANK_CLIENT)
      .useValue(questionClient)
      .compile();
    exam = ex.createNestApplication();
    configureExam(exam);
    await exam.listen(0, '127.0.0.1');
    const gm = await Test.createTestingModule({}).compile();
    gateway = gm.createNestApplication({ bodyParser: false });
    configureGateway(
      gateway,
      new ConfigService({
        AUTH_SERVICE_URL: await auth.getUrl(),
        ANALYTICS_SERVICE_URL: await analytics.getUrl(),
        EXAM_SERVICE_URL: await exam.getUrl(),
        LEARNING_SERVICE_URL: await learning.getUrl(),
        JWT_ACCESS_PUBLIC_KEY: process.env.JWT_ACCESS_PUBLIC_KEY,
        JWT_ACCESS_PUBLIC_KEY_FILE: '',
        JWT_ISSUER: 'toeic-auth',
        JWT_AUDIENCE: 'toeic-api',
      }),
      { consumeToken: async () => true } as unknown as RedisService,
      new JwtService(),
    );
    await gateway.init();
    const password = 'P3-Test-2026!',
      passwordHash = await bcrypt.hash(password, 12);
    for (const roleCode of [
      'CONTENT_ADMIN',
      'USER',
      'SYSTEM_ADMIN',
      'OTHER',
      'OTHER_ADMIN',
      'PREDICT',
      'STREAK',
      'RANGE',
      'FUTURE',
      'REBUILD',
      'ROLLBACK',
    ]) {
      const role =
        roleCode === 'OTHER_ADMIN'
          ? 'CONTENT_ADMIN'
          : ['CONTENT_ADMIN', 'SYSTEM_ADMIN', 'USER'].includes(roleCode)
            ? roleCode
            : 'USER';
      await authDb.role.upsert({
        where: { roleCode: role },
        create: { roleCode: role, name: role },
        update: {},
      });
      const email = randomUUID() + '@example.test',
        user = await authDb.user.create({
          data: {
            email,
            passwordHash,
            fullName: 'P5 ' + role,
            status: 'ACTIVE',
            roles: { create: { roleCode: role } },
          },
        });
      ids[roleCode] = user.id;
      const signed = await api()
        .post('/api/v1/auth/login')
        .send({ email, password, deviceId: 'p3-device' });
      expect(signed.status).toBe(200);
      tokens[roleCode] = signed.body.accessToken;
      if (roleCode === 'USER') {
        const b = await api()
          .post('/api/v1/auth/login')
          .send({ email, password, deviceId: 'p4-device-b' });
        expect(b.status).toBe(200);
        tokens.DEVICE_B = b.body.accessToken;
      }
    }
    const endpoint = new URL(process.env.MINIO_ENDPOINT!);
    minio = new Client({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port),
      useSSL: endpoint.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
      region: 'us-east-1',
    });
    if (!(await minio.bucketExists('toeic-media'))) await minio.makeBucket('toeic-media');
    ({ cards } = await createTopic());
    const created = await api()
      .post('/api/v1/tests')
      .auth(tokens.CONTENT_ADMIN, { type: 'bearer' })
      .send({ title: 'P5 real Full test', durationSeconds: 7200, questions: fixture.items });
    expect(created.status).toBe(201);
    testId = created.body.testId;
  });
  afterAll(async () => {
    if (minio) for (const key of objects) await minio.removeObject('toeic-media', key);
    await exam?.close();
    await analytics?.close();
    await gateway?.close();
    await learning?.close();
    await auth?.close();
  });

  const aget = (p: string, role = 'USER') =>
    api()
      .get('/api/v1/analytics/' + p)
      .auth(tokens[role], { type: 'bearer' });
  const consume = () => analytics.get(EventsConsumer),
    clock = () => analytics.get(AnalyticsClock);
  function event(type: string, payload: object, at = new Date()) {
    return {
      eventId: randomUUID(),
      eventType: type,
      producer:
        type.startsWith('Vocabulary') || type.startsWith('Lesson')
          ? 'learning-service'
          : 'exam-service',
      version: 2 as const,
      occurredAt: at.toISOString(),
      payload,
    };
  }
  const totals = [6, 25, 39, 30, 30, 16, 54];
  function full(score: number, at: Date, userId = ids.PREDICT, attemptId: string = randomUUID()) {
    const stats = totals.map((total, i) => ({
      part: i + 1,
      total,
      correct: Math.floor(total * 0.7),
    }));
    return event('TestSubmittedEvent.v2', {
      attemptId,
      userId,
      testId,
      mode: 'FULL',
      scoreListening: score / 2,
      scoreReading: score / 2,
      totalScore: score,
      correctListeningCount: stats.slice(0, 4).reduce((s, r) => s + r.correct, 0),
      correctReadingCount: stats.slice(4).reduce((s, r) => s + r.correct, 0),
      correctCount: stats.reduce((s, r) => s + r.correct, 0),
      totalQuestions: 200,
      partStats: stats,
      completedAt: at.toISOString(),
      scoring: { method: 'LOOKUP', tableVersion: '2026.10-sample', official: false },
    });
  }
  function practice(
    parts: number[],
    at: Date,
    userId = ids.OTHER,
    correctFraction = 0.5,
    attemptId: string = randomUUID(),
  ) {
    const stats = parts.map((part) => ({
        part,
        total: totals[part - 1],
        correct: Math.floor(totals[part - 1] * correctFraction),
      })),
      correctCount = stats.reduce((s, r) => s + r.correct, 0),
      totalQuestions = stats.reduce((s, r) => s + r.total, 0);
    return event('PartPracticeSubmittedEvent.v2', {
      attemptId,
      userId,
      testId,
      mode: 'PART',
      parts,
      correctCount,
      totalQuestions,
      accuracy: Math.round((correctCount / totalQuestions) * 1e6) / 1e6,
      partStats: stats,
      completedAt: at.toISOString(),
    });
  }
  function reviewed(
    userId: string,
    at: Date,
    vocabularyId: string = randomUUID(),
    operationId: string = randomUUID(),
    quality = 5,
    revision = '1',
    firstAt: string | null = at.toISOString(),
  ) {
    return event('VocabularyLearnedEvent.v2', {
      userId,
      vocabularyId,
      operationId,
      sessionId: null,
      quality,
      revision,
      firstLearned: quality >= 3 && revision === '1',
      firstLearnedAt: firstAt,
      activityAt: at.toISOString(),
    });
  }
  async function deliver(e: any) {
    validateEvent(e);
    await analytics
      .get(MessagingService)
      .emit(
        validateEvent(e),
        e.payload.attemptId ?? e.payload.vocabularyId ?? e.payload.lessonId,
        e,
      );
    await until(
      async () => (await adb.processedEvent.count({ where: { eventId: e.eventId } })) === 1,
    );
  }
  let fullId: string, partId: string;
  it('serves canonical empty responses and enforces identity, owner scope, pagination and time range', async () => {
    expect((await api().get('/api/v1/analytics/progress')).status).toBe(401);
    for (const [path, def] of [
      ['progress', 'AnalyticsProgress'],
      ['scores', 'ScoresPage'],
      ['practices', 'PracticesPage'],
      ['streak', 'Streak'],
      ['weak-areas', 'WeakAreas'],
      ['prediction', 'Prediction'],
    ]) {
      const r = await aget(path);
      expect(r.status).toBe(200);
      validateRequest(def, r.body);
    }
    const p = (await aget('progress?timeRange=LAST_7_DAYS')).body;
    for (const route of ['scores', 'practices']) {
      const page = await aget(route + '?page=2147483647&size=50');
      expect(page.status).toBe(200);
      expect(page.body.items).toEqual([]);
    }
    expect(p.lifetime).toMatchObject({
      reviewCount: 0,
      vocabulariesLearned: 0,
      mockTestCount: 0,
      practiceCount: 0,
    });
    expect(p.dailyActivity).toHaveLength(7);
    expect(p.dailyActivity.every((d: any) => d.count === 0)).toBe(true);
    for (const path of [
      'scores?size=51',
      'progress?timeRange=LAST_90_DAYS',
      'progress?time_range=ALL_TIME',
      'progress?userId=' + ids.OTHER,
    ])
      expect((await aget(path)).status).toBe(400);
  });
  it('finalizes real Full/Part attempts, persists provenance and publishes only canonical V2 envelopes', async () => {
    const start = await api()
      .post('/api/v1/tests/' + testId + '/attempts')
      .auth(tokens.USER, { type: 'bearer' });
    expect(start.status).toBe(201);
    fullId = start.body.attemptId;
    const done = await api()
      .post('/api/v1/attempts/' + fullId + '/submit')
      .auth(tokens.USER, { type: 'bearer' })
      .send({
        answers: start.body.questions.map((q: any) => ({
          questionId: q.questionId,
          selectedOption: 'A',
        })),
      });
    expect(done.status).toBe(201);
    expect(done.body).toMatchObject({
      totalScore: 990,
      scoring: { method: 'LOOKUP', official: false, tableVersion: '2026.10-sample' },
    });
    const part = await api()
      .post('/api/v1/tests/' + testId + '/part-attempts')
      .auth(tokens.USER, { type: 'bearer' })
      .send({ parts: [5], durationSeconds: 300 });
    expect(part.status).toBe(201);
    partId = part.body.attemptId;
    expect(
      (
        await api()
          .post('/api/v1/attempts/' + partId + '/submit')
          .auth(tokens.USER, { type: 'bearer' })
          .send({
            answers: part.body.questions.map((q: any, i: number) => ({
              questionId: q.questionId,
              selectedOption: i < 15 ? 'A' : 'B',
            })),
          })
      ).status,
    ).toBe(201);
    await until(async () => (await adb.attemptFact.count({ where: { userId: ids.USER } })) === 2);
    const rows = await edb.outboxEvent.findMany({
      where: { aggregateId: { in: [fullId, partId] } },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(validateEvent(row.payload)).toMatch(/\.v2$/);
      expect((row.payload as any).eventId).toBe(row.id);
      expect(typeof (row.payload as any).payload.completedAt).toBe('string');
    }
    const scores = await aget('scores'),
      practices = await aget('practices');
    expect(scores.body.total).toBe(1);
    expect(scores.body.items[0].totalScore).toBe(990);
    expect(practices.body.total).toBe(1);
    expect(practices.body.items[0]).not.toHaveProperty('scoreListening');
    expect((await aget('progress')).body).toMatchObject({ mockTestCount: 1, practiceCount: 1 });
    const weak = (await aget('weak-areas')).body.items.find((p: any) => p.part === 5);
    expect(weak).toMatchObject({ correct: 45, total: 60, weaknessScore: 0.25, isWeak: false });
  });
  it('deduplicates same transport, new IDs for one attempt, concurrent delivery and rejects cross-mode/user collisions', async () => {
    const row = await edb.outboxEvent.findFirstOrThrow({ where: { aggregateId: fullId } }),
      original = row.payload as any;
    await Promise.all(Array.from({ length: 8 }, () => consume().consume(original)));
    const duplicate = { ...original, eventId: randomUUID(), occurredAt: new Date().toISOString() };
    await deliver(duplicate);
    expect(await adb.testScoreFact.count({ where: { attemptId: fullId } })).toBe(1);
    expect(await adb.learningActivityFact.count({ where: { entityId: fullId } })).toBe(1);
    const collision = practice([5], new Date(), ids.OTHER, 0.5, fullId);
    await deliver(collision);
    expect(
      await adb.analyticsQuarantine.count({
        where: { eventId: collision.eventId, reason: 'ATTEMPT_ID_COLLISION' },
      }),
    ).toBe(1);
    expect((await aget('scores', 'OTHER')).body.total).toBe(0);
    const changed = JSON.parse(JSON.stringify(original));
    changed.payload.totalScore = 980;
    changed.payload.scoreListening = 490;
    changed.payload.scoreReading = 490;
    await consume().consume(changed);
    expect(
      await adb.analyticsQuarantine.count({
        where: { eventId: changed.eventId, reason: 'EVENT_ID_COLLISION' },
      }),
    ).toBe(1);
    expect(
      (await adb.testScoreFact.findUniqueOrThrow({ where: { attemptId: fullId } })).totalScore,
    ).toBe(990);
  });
  it('counts real Learning review/first learned/lesson and REST-sync replay exactly once', async () => {
    const id = cards[0].vocabularyId;
    let first: string | null = null;
    for (const [i, q] of [2, 5, 0].entries()) {
      const r = await post('flashcards/' + id + '/review', {
        operationId: randomUUID(),
        baseEntityRevision: String(i),
        quality: q,
      });
      expect(r.status).toBe(200);
      if (i === 1) first = r.body.progress[0].state.firstLearnedAt;
      if (i === 2) expect(r.body.progress[0].state.firstLearnedAt).toBe(first);
    }
    const l = await post(
      'admin/lessons',
      {
        lessonTitle: 'P5 lesson',
        category: 'TENSE',
        contentMarkdown: '# Grammar',
        status: 'PUBLISHED',
      },
      'CONTENT_ADMIN',
    );
    expect(l.status).toBe(201);
    for (const baseEntityRevision of ['0', '1'])
      expect(
        (
          await post('lessons/' + l.body.lessonId + '/complete', {
            operationId: randomUUID(),
            baseEntityRevision,
          })
        ).status,
      ).toBe(200);
    const opId = randomUUID(),
      sync = await api()
        .post('/api/v1/sync/users')
        .auth(tokens.USER, { type: 'bearer' })
        .send({
          deviceId: 'p5-sync',
          operationId: opId,
          baseVersion: '0',
          clientOccurredAt: new Date().toISOString(),
          operation: {
            kind: 'REVIEW_FLASHCARD',
            vocabularyId: cards[1].vocabularyId,
            baseEntityRevision: '0',
            quality: 5,
          },
        });
    expect(sync.body.accepted).toBe(true);
    await until(
      async () => (await db.operationLedger.count({ where: { operationId: opId } })) === 1,
    );
    expect(
      (
        await post('flashcards/' + cards[1].vocabularyId + '/review', {
          operationId: opId,
          baseEntityRevision: '0',
          quality: 5,
        })
      ).status,
    ).toBe(200);
    await until(
      async () =>
        (await adb.learningActivityFact.count({ where: { userId: ids.USER, kind: 'REVIEW' } })) ===
        4,
    );
    expect((await aget('progress')).body.lifetime).toMatchObject({
      vocabulariesLearned: 2,
      reviewCount: 4,
      grammarLessonsCompleted: 1,
      mockTestCount: 1,
      practiceCount: 1,
    });
  });
  it('predicts from exactly the latest three Full facts and recomputes after the rolling window expires', async () => {
    const now = new Date();
    for (const [i, score] of [800, 700, 600, 990].entries())
      await deliver(full(score, new Date(now.getTime() - (i + 1) * 86400000)));
    await deliver(practice([1, 2, 3, 4, 5, 6, 7], now, ids.PREDICT, 1));
    const p = (await aget('prediction', 'PREDICT')).body;
    expect(p).toMatchObject({ predictedToeicScore: 730, eligibleFullCount: 4 });
    expect(p.usedAttemptIds).toHaveLength(3);
    expect((await aget('scores', 'PREDICT')).body.total).toBe(4);
    expect((await aget('practices', 'PREDICT')).body.total).toBe(1);
    const fake = jest
      .spyOn(clock(), 'now')
      .mockReturnValue(new Date(now.getTime() + 31 * 86400000));
    try {
      expect((await aget('prediction', 'PREDICT')).body).toMatchObject({
        predictedToeicScore: null,
        eligibleFullCount: 0,
      });
      expect(
        (await aget('weak-areas', 'PREDICT')).body.items.every(
          (p: any) => p.status === 'INSUFFICIENT_DATA',
        ),
      ).toBe(true);
      expect((await aget('streak', 'PREDICT')).body.learningStreakDays).toBe(0);
    } finally {
      fake.mockRestore();
    }
  });
  it('uses exact Part thresholds and insufficient-data nulls from Full and practice facts', async () => {
    for (let i = 0; i < 3; i++) await deliver(practice([1], new Date(), ids.CONTENT_ADMIN, 0));
    let rows = (await aget('weak-areas', 'CONTENT_ADMIN')).body.items;
    expect(rows[0]).toMatchObject({ total: 18, weaknessScore: null, isWeak: null });
    await deliver(practice([1], new Date(), ids.CONTENT_ADMIN, 1));
    rows = (await aget('weak-areas', 'CONTENT_ADMIN')).body.items;
    expect(rows[0]).toMatchObject({ total: 24, correct: 6, weaknessScore: 0.75, isWeak: true });
    await deliver(practice([5], new Date(), ids.CONTENT_ADMIN, 0.7));
    expect((await aget('weak-areas', 'CONTENT_ADMIN')).body.items[4]).toMatchObject({
      total: 30,
      correct: 21,
      weaknessScore: 0.3,
      isWeak: true,
    });
  });
  it('rebuilds late-day streak bridges and keeps one activity day for many reviews', async () => {
    const now = new Date();
    for (const day of [2, 0, 1])
      await deliver(reviewed(ids.STREAK, new Date(now.getTime() - day * 86400000)));
    await deliver(reviewed(ids.STREAK, now));
    expect((await aget('streak', 'STREAK')).body).toMatchObject({
      learningStreakDays: 3,
      longestStreak: 3,
    });
    expect((await aget('progress', 'STREAK')).body.lifetime).toMatchObject({
      studyDays: 3,
      reviewCount: 4,
    });
  });
  it('uses Vietnam calendar boundaries, fills empty days and excludes future facts until asOf reaches them', async () => {
    const anchor = new Date('2026-11-01T05:00:00Z'),
      fake = jest.spyOn(clock(), 'now').mockReturnValue(anchor);
    try {
      for (const at of ['2026-10-25T16:59:59.999Z', '2026-10-25T17:00:00.000Z'])
        await deliver({ ...reviewed(ids.RANGE, new Date(at)), occurredAt: anchor.toISOString() });
      const range = (await aget('progress?timeRange=LAST_7_DAYS', 'RANGE')).body;
      expect(range.from).toBe('2026-10-25T17:00:00.000Z');
      expect(range.lifetime.reviewCount).toBe(2);
      expect(range.inRange.reviewCount).toBe(1);
      expect(range.dailyActivity).toHaveLength(7);
      expect(range.dailyActivity[0]).toEqual({ date: '2026-10-26', count: 1 });
      const future = reviewed(ids.FUTURE, new Date(anchor.getTime() + 60000));
      future.occurredAt = new Date(anchor.getTime() + 60000).toISOString();
      await deliver(future);
      expect((await aget('progress', 'FUTURE')).body.lifetime.reviewCount).toBe(0);
      fake.mockReturnValue(new Date(anchor.getTime() + 120000));
      expect((await aget('progress', 'FUTURE')).body.lifetime.reviewCount).toBe(1);
    } finally {
      fake.mockRestore();
    }
  });
  it('paginates Full history/trends with user-scoped cursors and never mixes practice scores', async () => {
    const a = await aget('progress?timeRange=ALL_TIME&limit=2', 'PREDICT');
    expect(a.body.scoreTrend).toHaveLength(2);
    expect(a.body.scoreTrendNextCursor).toBeTruthy();
    const b = await aget(
      'progress?timeRange=ALL_TIME&limit=2&cursor=' + a.body.scoreTrendNextCursor,
      'PREDICT',
    );
    expect(b.body.scoreTrend).toHaveLength(2);
    expect(
      a.body.scoreTrend.some((r: any) =>
        b.body.scoreTrend.some((x: any) => x.attemptId === r.attemptId),
      ),
    ).toBe(false);
    expect(
      (await aget('progress?timeRange=ALL_TIME&cursor=' + a.body.scoreTrendNextCursor, 'OTHER'))
        .status,
    ).toBe(400);
    const scores = await aget('scores?page=2&size=2', 'PREDICT');
    expect(scores.body).toMatchObject({ total: 4, page: 2, size: 2, totalPages: 2 });
    validateRequest('ScoresPage', scores.body);
  });
  it('rolls back inbox, facts and projections together on DB failure, then retries through RabbitMQ', async () => {
    const e = reviewed(ids.ROLLBACK, new Date()),
      projection = analytics.get(ProjectionService),
      fail = jest
        .spyOn(projection, 'rebuildTx')
        .mockRejectedValue(new Error('p5 simulated projection DB outage'));
    try {
      await analytics
        .get(MessagingService)
        .emit('vocabulary.learned.v2', (e.payload as any).vocabularyId, e);
      await until(async () => fail.mock.calls.length > 0);
      expect(await adb.processedEvent.count({ where: { eventId: e.eventId } })).toBe(0);
      expect(await adb.learningActivityFact.count({ where: { eventId: e.eventId } })).toBe(0);
      expect(await adb.userStatistic.count({ where: { userId: ids.ROLLBACK } })).toBe(0);
    } finally {
      fail.mockRestore();
    }
    await until(
      async () => (await adb.processedEvent.count({ where: { eventId: e.eventId } })) === 1,
    );
    expect((await aget('progress', 'ROLLBACK')).body.lifetime.reviewCount).toBe(1);
  });
  it('rebuilds projections entirely from local facts and preserves legacy rows without inventing analytics', async () => {
    const anchor = new Date(Date.now() + 60000),
      fake = jest.spyOn(clock(), 'now').mockReturnValue(anchor);
    try {
      const id = randomUUID(),
        first = new Date(anchor.getTime() - 86400000).toISOString();
      await deliver({
        ...reviewed(ids.REBUILD, new Date(first), id),
        occurredAt: anchor.toISOString(),
      });
      await deliver({
        ...reviewed(ids.REBUILD, anchor, id, randomUUID(), 0, '2', first),
        occurredAt: anchor.toISOString(),
      });
      for (const [i, score] of [800, 700, 600].entries())
        await deliver(full(score, new Date(anchor.getTime() - (i + 1) * 86400000), ids.REBUILD));
      await adb.scoreHistory.create({
        data: {
          userId: ids.REBUILD,
          attemptId: randomUUID(),
          testType: 'MINI',
          score: 495,
          takenAt: anchor,
        },
      });
      const before = (await aget('progress?timeRange=ALL_TIME', 'REBUILD')).body;
      for (const model of [
        adb.userStatistic,
        adb.userWeakArea,
        adb.userActivityDay,
        adb.firstLearnedEntity,
        adb.completedLessonEntity,
      ])
        await (model as any).deleteMany({ where: { userId: ids.REBUILD } });
      await analytics.get(ProjectionService).rebuild(ids.REBUILD);
      const after = (await aget('progress?timeRange=ALL_TIME', 'REBUILD')).body;
      expect(after).toEqual(before);
      expect(after.lifetime).toMatchObject({
        reviewCount: 2,
        vocabulariesLearned: 1,
        mockTestCount: 3,
      });
      expect(await adb.scoreHistory.count({ where: { userId: ids.REBUILD } })).toBe(1);
    } finally {
      fake.mockRestore();
    }
  });
  it('quarantines conflicting business revisions and unknown legacy inbox IDs instead of overwriting facts', async () => {
    const e = reviewed(ids.OTHER, new Date());
    await deliver(e);
    const conflict = JSON.parse(JSON.stringify(e));
    conflict.eventId = randomUUID();
    conflict.payload.quality = 4;
    await deliver(conflict);
    expect(await adb.analyticsQuarantine.count({ where: { eventId: conflict.eventId } })).toBe(1);
    const legacy = reviewed(ids.OTHER, new Date());
    await adb.processedEvent.create({
      data: { eventId: legacy.eventId, eventType: 'VocabularyLearnedEvent' },
    });
    await consume().consume(legacy);
    expect(
      await adb.analyticsQuarantine.count({
        where: { eventId: legacy.eventId, reason: 'LEGACY_EVENT_ID_COLLISION' },
      }),
    ).toBe(1);
  });
  it('recovers producer publish failure with the same persisted Exam V2 event ID', async () => {
    const messaging = exam.get(MessagingService),
      original = messaging.emit.bind(messaging),
      fail = jest
        .spyOn(messaging, 'emit')
        .mockImplementation((route, id, e) =>
          route === 'part.practice.submitted.v2'
            ? Promise.reject(new Error('p5 simulated broker outage'))
            : original(route, id, e),
        );
    let id = '',
      eventId = '';
    try {
      const p = await api()
        .post('/api/v1/tests/' + testId + '/part-attempts')
        .auth(tokens.OTHER, { type: 'bearer' })
        .send({ parts: [1], durationSeconds: 300 });
      expect(p.status).toBe(201);
      id = p.body.attemptId;
      expect(
        (
          await api()
            .post('/api/v1/attempts/' + id + '/submit')
            .auth(tokens.OTHER, { type: 'bearer' })
            .send({})
        ).status,
      ).toBe(201);
      await until(
        async () =>
          (await edb.outboxEvent.count({
            where: { aggregateId: id, publishedAt: null, retryCount: { gte: 1 } },
          })) === 1,
      );
      eventId = (await edb.outboxEvent.findFirstOrThrow({ where: { aggregateId: id } })).id;
    } finally {
      fail.mockRestore();
    }
    await edb.outboxEvent.update({ where: { id: eventId }, data: { nextAttemptAt: new Date(0) } });
    await until(async () => (await adb.processedEvent.count({ where: { eventId } })) === 1);
    expect(await adb.practiceFact.count({ where: { attemptId: id } })).toBe(1);
  });
  it('DLQs schema-invalid/Mini/placeholder envelopes before business processing', async () => {
    const c = await amqp.connect(process.env.RABBITMQ_URL!);
    try {
      const ch = await c.createConfirmChannel(),
        q = process.env.ANALYTICS_QUEUE_PREFIX + '.analytics-service.v2',
        before = await adb.attemptFact.count(),
        mini = full(800, new Date());
      (mini.payload as any).mode = 'MINI';
      const bad = full(800, new Date());
      delete (bad.payload as any).scoring;
      for (const e of [mini, bad])
        ch.publish(
          process.env.RABBITMQ_EXCHANGE!,
          'test.submitted.v2',
          Buffer.from(JSON.stringify(e)),
          { persistent: true },
        );
      await ch.waitForConfirms();
      await until(async () => (await ch.checkQueue(q + '.dlq')).messageCount >= 2);
      expect(await adb.attemptFact.count()).toBe(before);
      await ch.close();
    } finally {
      await c.close();
    }
  });
});
