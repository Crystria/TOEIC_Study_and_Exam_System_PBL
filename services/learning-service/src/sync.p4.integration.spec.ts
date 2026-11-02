import { randomUUID } from 'node:crypto';
import { createServer, AddressInfo } from 'node:net';
import { SyncService } from '../../auth-service/src/sync/sync.service';
import { LearningClient } from '../../auth-service/src/sync/learning-client';
import { LearningSyncService } from './sync/learning-sync.service';
import { ProgressService } from './modules/learning/progress.service';
import {
  serviceAuthSecret,
  learningServiceToken,
  stableHash,
  SyncRequest,
  SyncResult,
} from '@toeic/common';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RedisService, MessagingService } from '@toeic/common';
import { Client } from 'minio';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureLearning } from './http';
import { PrismaService } from './prisma/prisma.service';
import { AppModule as AuthModule } from '../../auth-service/src/app.module';
import { PrismaService as AuthPrisma } from '../../auth-service/src/prisma/prisma.service';
import { configureAuth } from '../../auth-service/src/http';
import { configureGateway } from '../../api-gateway/src/main';
import { validateRequest, validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import * as amqp from 'amqplib';
const integration = process.env.P4_LEARNING_DATABASE_URL ? describe : describe.skip;
integration('P4 sync via Gateway with real Auth/PostgreSQL/RabbitMQ/MinIO', () => {
  jest.setTimeout(60000);
  let auth: INestApplication,
    learning: INestApplication,
    gateway: INestApplication,
    db: PrismaService,
    authDb: AuthPrisma,
    minio: Client;
  const tokens: Record<string, string> = {},
    ids: Record<string, string> = {},
    objects = new Set<string>();
  let topic: string, cards: Array<{ vocabularyId: string; definition: string }>, lesson: string;
  const api = () => request(gateway.getHttpServer());
  const get = (path: string, role = 'USER') =>
    api()
      .get('/api/v1/learning/' + path)
      .auth(tokens[role], { type: 'bearer' });
  const post = (path: string, body: object | undefined, role = 'USER', key = randomUUID()) =>
    api()
      .post('/api/v1/learning/' + path)
      .auth(tokens[role], { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  const patch = (path: string, body: object | undefined) =>
    api()
      .patch('/api/v1/learning/admin/' + path)
      .auth(tokens.CONTENT_ADMIN, { type: 'bearer' })
      .send(body);
  const del = (path: string) =>
    api()
      .delete('/api/v1/learning/admin/' + path)
      .auth(tokens.CONTENT_ADMIN, { type: 'bearer' });
  async function createTopic(count = 6, definitions?: string[]) {
    const r = await post(
      'admin/vocabulary-topics',
      { topicName: 'P3 ' + randomUUID() },
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
  async function session(t = topic, role = 'USER') {
    const r = await post('vocabulary-sessions', { topicId: t, mode: 'NEW' }, role);
    expect(r.status).toBe(201);
    validateRequest('Session', r.body);
    return r.body;
  }
  function submission(s: any, quality = 5, correct = false) {
    return {
      operationId: randomUUID(),
      reviews: s.vocabularies.map((v: any) => ({ vocabularyId: v.vocabularyId, quality })),
      answers: s.quiz.map((q: any) => {
        const definition = s.vocabularies.find(
          (v: any) => v.vocabularyId === q.vocabularyId,
        ).definition;
        return {
          questionId: q.questionId,
          selectedOption: q.options.find((o: any) => (o.text === definition) === correct).code,
        };
      }),
    };
  }
  async function until(check: () => Promise<boolean>) {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('P3 timeout');
  }
  beforeAll(async () => {
    for (const key of ['P4_AUTH_DATABASE_URL', 'P4_LEARNING_DATABASE_URL'])
      if (!/^\/p4_(auth|learning)_\d+$/.test(new URL(process.env[key]!).pathname))
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
    authDb = new AuthPrisma({ datasources: { db: { url: process.env.P4_AUTH_DATABASE_URL } } });
    db = new PrismaService({ datasources: { db: { url: process.env.P4_LEARNING_DATABASE_URL } } });
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
    const gm = await Test.createTestingModule({}).compile();
    gateway = gm.createNestApplication({ bodyParser: false });
    configureGateway(
      gateway,
      new ConfigService({
        AUTH_SERVICE_URL: await auth.getUrl(),
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
    for (const roleCode of ['CONTENT_ADMIN', 'USER', 'SYSTEM_ADMIN', 'OTHER', 'OTHER_ADMIN']) {
      const role =
        roleCode === 'OTHER' ? 'USER' : roleCode === 'OTHER_ADMIN' ? 'CONTENT_ADMIN' : roleCode;
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
            fullName: 'P3 ' + role,
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
    ({ topic, cards } = await createTopic());
  });
  afterAll(async () => {
    if (minio) for (const key of objects) await minio.removeObject('toeic-media', key);
    await gateway?.close();
    await learning?.close();
    await auth?.close();
  });

  const authSync = () => auth.get(SyncService),
    learnSync = () => learning.get(LearningSyncService);
  async function newBody(
    operation: SyncRequest['operation'],
    operationId = randomUUID(),
    role = 'USER',
  ): Promise<SyncRequest> {
    const head = await authDb.syncHead.findUnique({ where: { userId: ids[role] || ids.USER } });
    return {
      deviceId: 'device-a',
      operationId,
      baseVersion: (head?.syncVersion ?? 0n).toString(),
      clientOccurredAt: new Date().toISOString(),
      operation,
    };
  }
  const syncPost = (body: SyncRequest, role = 'USER') =>
    api().post('/api/v1/sync/users').auth(tokens[role], { type: 'bearer' }).send(body);
  const syncGet = (id: string, role = 'USER') =>
    api()
      .get('/api/v1/sync/operations/' + id)
      .auth(tokens[role], { type: 'bearer' });
  async function terminal(id: string, role = 'USER') {
    await until(async () => {
      const r = await syncGet(id, role);
      if (r.status !== 200) throw new Error('Operation lookup failed: ' + JSON.stringify(r.body));
      return r.body.status !== 'PENDING';
    });
    const r = await syncGet(id, role);
    validateRequest('SyncResponse', r.body);
    return r.body;
  }
  const review = (id: string, quality = 5, baseEntityRevision = '0') => ({
    kind: 'REVIEW_FLASHCARD' as const,
    vocabularyId: id,
    quality,
    baseEntityRevision,
  });
  it('requires identity, closed commands, bounded revisions/times and scoped internal service credentials', async () => {
    expect((await api().post('/api/v1/sync/users').send({})).status).toBe(401);
    const b = await newBody(review(cards[0].vocabularyId));
    for (const bad of [
      { ...b, arbitraryState: {} },
      { ...b, baseVersion: '9223372036854775808' },
      { ...b, operation: { ...b.operation, easinessFactor: 4 } },
      { ...b, clientOccurredAt: new Date(Date.now() - 31 * 86400000).toISOString() },
      { ...b, clientOccurredAt: new Date(Date.now() + 600000).toISOString() },
    ])
      expect(
        (await api().post('/api/v1/sync/users').auth(tokens.USER, { type: 'bearer' }).send(bad))
          .status,
      ).toBe(400);
    expect((await syncPost({ ...b, baseVersion: '1' })).body.code).toBe('FUTURE_VERSION');
    const oversized = JSON.stringify({ ...b, padding: 'x'.repeat(256 * 1024) });
    for (const server of [gateway.getHttpServer(), auth.getHttpServer()])
      expect(
        (
          await request(server)
            .post('/api/v1/sync/users')
            .auth(tokens.USER, { type: 'bearer' })
            .set('Content-Type', 'application/json')
            .send(oversized)
        ).status,
      ).toBe(413);
    const endpoint = '/internal/v1/learning/users/' + ids.USER + '/progress';
    expect(
      (await request(learning.getHttpServer()).get(endpoint).auth(tokens.USER, { type: 'bearer' }))
        .status,
    ).toBe(401);
    const secret = serviceAuthSecret(auth.get(ConfigService)),
      token = await learningServiceToken(secret, 'learning:progress:read');
    expect(
      (await request(learning.getHttpServer()).get(endpoint).auth(token, { type: 'bearer' }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(learning.getHttpServer())
          .get('/internal/v1/learning/users/' + ids.USER + '/operations/' + randomUUID())
          .auth(token, { type: 'bearer' })
      ).status,
    ).toBe(401);
  });
  it('accepts PENDING, applies once at Learning and converges versions/projection through real broker', async () => {
    const body = await newBody(review(cards[0].vocabularyId));
    const accepted = await syncPost(body);
    expect(accepted.status).toBe(200);
    validateRequest('SyncResponse', accepted.body);
    expect(accepted.body).toMatchObject({ accepted: true, status: 'PENDING', syncVersion: '1' });
    const done = await terminal(body.operationId);
    expect(done).toMatchObject({ status: 'APPLIED', resolvedVersion: '1', appliedVersion: '1' });
    expect(done.progress.find((p: any) => p.entityId === cards[0].vocabularyId)).toMatchObject({
      revision: '1',
      state: { quality: 5 },
    });
    const replay = await syncPost(
      {
        ...body,
        deviceId: 'device-b',
        baseVersion: '0',
        clientOccurredAt: '2000-01-01T00:00:00.000Z',
      },
      'DEVICE_B',
    );
    expect(replay.body).toMatchObject({ status: 'APPLIED', syncVersion: '1' });
    expect((await syncPost({ ...body, operation: review(cards[0].vocabularyId, 0) })).status).toBe(
      409,
    );
    expect(
      await db.operationLedger.count({
        where: { userId: ids.USER, operationId: body.operationId },
      }),
    ).toBe(1);
    expect((await syncGet(body.operationId, 'OTHER')).status).toBe(404);
    const source = await authDb.syncOperation.findUniqueOrThrow({
      where: { userId_operationId: { userId: ids.USER, operationId: body.operationId } },
    });
    await learnSync().consume(source.command);
    expect(
      await db.syncResolution.count({ where: { userId: ids.USER, operationId: body.operationId } }),
    ).toBe(1);
  });
  it('serializes two device admissions, rejects stale/future heads and returns BUSY for a different pending action', async () => {
    const gate: { release?: () => void } = {},
      waiting = new Promise<void>((r) => (gate.release = r)),
      original = learnSync().consume.bind(learnSync()),
      hold = jest.spyOn(learnSync(), 'consume').mockImplementation(async (e) => {
        await waiting;
        return original(e);
      });
    const a = await newBody(review(cards[1].vocabularyId)),
      b = {
        ...a,
        operationId: randomUUID(),
        deviceId: 'device-b',
        operation: review(cards[2].vocabularyId),
      };
    try {
      const results = await Promise.all([syncPost(a), syncPost(b, 'DEVICE_B')]);
      expect(results.filter((r) => r.body.accepted)).toHaveLength(1);
      expect(results.find((r) => !r.body.accepted)!.body.status).toBe('CONFLICT');
      const winner = results.find((r) => r.body.accepted)!.body;
      const busy = await syncPost({
        ...b,
        operationId: randomUUID(),
        baseVersion: winner.syncVersion,
      });
      expect(busy.body).toMatchObject({ accepted: false, status: 'BUSY' });
      expect(
        (
          await authDb.syncHead.findUniqueOrThrow({ where: { userId: ids.USER } })
        ).syncVersion.toString(),
      ).toBe(winner.syncVersion);
    } finally {
      hold.mockRestore();
      gate.release!();
    }
    await until(
      async () =>
        !(await authDb.syncHead.findUniqueOrThrow({ where: { userId: ids.USER } }))
          .pendingOperationId,
    );
  });
  it('shares operation identity across REST and sync in both directions without repeating SM-2 or activity', async () => {
    const t = await createTopic(2),
      operationId = randomUUID(),
      r = review(t.cards[0].vocabularyId),
      online = await post('flashcards/' + r.vocabularyId + '/review', {
        operationId,
        quality: r.quality,
        baseEntityRevision: r.baseEntityRevision,
      });
    expect(online.status).toBe(200);
    const b = await newBody(r, operationId);
    expect((await syncPost(b)).body.accepted).toBe(true);
    expect((await terminal(operationId)).status).toBe('APPLIED');
    const row = await db.userVocabularyProgress.findUniqueOrThrow({
      where: { userId_vocabularyId: { userId: ids.USER, vocabularyId: r.vocabularyId } },
    });
    expect(row.revision).toBe(1n);
    const b2 = await newBody(review(t.cards[1].vocabularyId));
    await syncPost(b2);
    await terminal(b2.operationId);
    const rest = await post('flashcards/' + t.cards[1].vocabularyId + '/review', {
      operationId: b2.operationId,
      quality: 5,
      baseEntityRevision: '0',
    });
    expect(rest.status).toBe(200);
    expect(rest.body.progress[0].revision).toBe('1');
    for (const id of [operationId, b2.operationId])
      expect(
        await db.outboxEvent.count({
          where: {
            eventType: 'VocabularyLearnedEvent.v2',
            payload: { path: ['payload', 'operationId'], equals: id },
          },
        }),
      ).toBe(1);
  });
  it('rejects sync when online wins a revision race; rejected operations advance resolved only', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      body = await newBody(review(id)),
      original = learnSync().consume.bind(learnSync());
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      hold = jest.spyOn(learnSync(), 'consume').mockImplementation(async (e) => {
        await gate;
        return original(e);
      });
    let accepted: any;
    try {
      accepted = (await syncPost(body)).body;
      expect(accepted.accepted).toBe(true);
      expect(
        (
          await post('flashcards/' + id + '/review', {
            operationId: randomUUID(),
            baseEntityRevision: '0',
            quality: 3,
          })
        ).status,
      ).toBe(200);
    } finally {
      hold.mockRestore();
      release();
    }
    const done = await terminal(body.operationId);
    expect(done).toMatchObject({
      status: 'REJECTED',
      reason: 'ENTITY_REVISION_CONFLICT',
      resolvedVersion: accepted.syncVersion,
    });
    expect(BigInt(done.appliedVersion)).toBeLessThan(BigInt(done.resolvedVersion));
    expect(done.operationProgress[0].revision).toBe('1');
    const onlineReplay = await post('flashcards/' + id + '/review', {
      operationId: body.operationId,
      baseEntityRevision: '0',
      quality: 5,
    });
    expect(onlineReplay.status).toBe(409);
  });
  it('uses bounded offline activity for scheduling while keeping progress updatedAt at commit time', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      b = await newBody(review(id));
    b.clientOccurredAt = new Date(Date.now() - 10 * 86400000).toISOString();
    await syncPost(b);
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
    const row = await db.userVocabularyProgress.findUniqueOrThrow({
      where: { userId_vocabularyId: { userId: ids.USER, vocabularyId: id } },
    });
    expect(row.firstLearnedAt!.toISOString()).toBe(b.clientOccurredAt);
    expect(row.updatedAt.getTime()).toBeGreaterThan(Date.now() - 60000);
    const future = await newBody(review(cards[5].vocabularyId));
    future.clientOccurredAt = new Date(Date.now() + 60000).toISOString();
    await syncPost(future);
    await terminal(future.operationId);
    const op = await authDb.syncOperation.findUniqueOrThrow({
      where: { userId_operationId: { userId: ids.USER, operationId: future.operationId } },
    });
    expect(op.activityAt.toISOString()).toBe(op.acceptedAt.toISOString());
  });
  it('makes an offline five-card submit atomic and grades its server snapshot; replay order is irrelevant', async () => {
    const t = await createTopic(5),
      s = await session(t.topic),
      submitted = submission(s, 5, true),
      operation = {
        kind: 'SUBMIT_VOCABULARY_SESSION' as const,
        sessionId: s.sessionId,
        reviews: submitted.reviews,
        answers: submitted.answers,
      },
      body = await newBody(operation, submitted.operationId);
    await syncPost(body);
    expect((await terminal(body.operationId)).status).toBe('APPLIED');
    const stored = await db.vocabularySession.findUniqueOrThrow({ where: { id: s.sessionId } });
    expect((stored.result as any).quizScore).toBe(5);
    const retry = await syncPost({
      ...body,
      operation: {
        ...operation,
        reviews: [...operation.reviews].reverse(),
        answers: [...operation.answers].reverse(),
      },
    });
    expect(retry.body.status).toBe('APPLIED');
    expect(
      await db.outboxEvent.count({
        where: {
          eventType: 'VocabularyLearnedEvent.v2',
          payload: { path: ['payload', 'sessionId'], equals: s.sessionId },
        },
      }),
    ).toBe(5);
    const t2 = await createTopic(5),
      s2 = await session(t2.topic),
      submit2 = submission(s2);
    await post('flashcards/' + s2.vocabularies[4].vocabularyId + '/review', {
      operationId: randomUUID(),
      baseEntityRevision: '0',
      quality: 4,
    });
    const rejected = await newBody(
      {
        kind: 'SUBMIT_VOCABULARY_SESSION',
        sessionId: s2.sessionId,
        reviews: submit2.reviews,
        answers: submit2.answers,
      },
      submit2.operationId,
    );
    await syncPost(rejected);
    expect((await terminal(rejected.operationId)).reason).toBe('ENTITY_REVISION_CONFLICT');
    expect(
      await db.userVocabularyProgress.count({
        where: {
          userId: ids.USER,
          vocabularyId: { in: s2.vocabularies.map((v: any) => v.vocabularyId) },
        },
      }),
    ).toBe(1);
    expect(
      (await db.vocabularySession.findUniqueOrThrow({ where: { id: s2.sessionId } })).status,
    ).toBe('IN_PROGRESS');
  });
  it('records deleted, expired and foreign resources as terminal REJECTED without retrying domain errors', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId;
    await del('vocabularies/' + id);
    const b = await newBody(review(id));
    await syncPost(b);
    expect((await terminal(b.operationId)).reason).toBe('VOCABULARY_NOT_FOUND');
    const t2 = await createTopic(5),
      s = await session(t2.topic);
    await db.vocabularySession.update({
      where: { id: s.sessionId },
      data: { expiresAt: new Date(0) },
    });
    const sub = submission(s),
      expired = await newBody(
        {
          kind: 'SUBMIT_VOCABULARY_SESSION',
          sessionId: s.sessionId,
          reviews: sub.reviews,
          answers: sub.answers,
        },
        sub.operationId,
      );
    await syncPost(expired);
    expect((await terminal(expired.operationId)).reason).toBe('SESSION_EXPIRED');
    const foreign = await newBody(
      {
        kind: 'SUBMIT_VOCABULARY_SESSION',
        sessionId: s.sessionId,
        reviews: sub.reviews,
        answers: sub.answers,
      },
      randomUUID(),
      'OTHER',
    );
    await syncPost(foreign, 'OTHER');
    expect((await terminal(foreign.operationId, 'OTHER')).reason).toBe('SESSION_NOT_FOUND');
  });
  it('retains PENDING and original command ID through a failed Auth broker publish', async () => {
    const t = await createTopic(1),
      b = await newBody(review(t.cards[0].vocabularyId)),
      messaging = auth.get(MessagingService),
      original = messaging.emit.bind(messaging),
      mock = jest
        .spyOn(messaging, 'emit')
        .mockImplementation((route, id, event) =>
          route === 'user.sync.accepted.v2'
            ? Promise.reject(new Error('p4 simulated broker outage'))
            : original(route, id, event),
        );
    let commandId = '';
    try {
      const r = await syncPost(b);
      expect(r.body.status).toBe('PENDING');
      const op = await authDb.syncOperation.findUniqueOrThrow({
        where: { userId_operationId: { userId: ids.USER, operationId: b.operationId } },
      });
      commandId = op.commandEventId;
      await until(
        async () =>
          (await authDb.outboxEvent.count({
            where: { id: commandId, publishedAt: null, retryCount: { gte: 1 } },
          })) === 1,
      );
      expect(await db.operationLedger.count({ where: { operationId: b.operationId } })).toBe(0);
      expect((await syncPost(b)).body.syncVersion).toBe(r.body.syncVersion);
    } finally {
      mock.mockRestore();
    }
    await authDb.outboxEvent.updateMany({
      where: { id: commandId },
      data: { nextAttemptAt: new Date(0) },
    });
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
    expect(await authDb.outboxEvent.count({ where: { id: commandId } })).toBe(1);
  });
  it('rolls back Learning inbox/progress/outbox on infrastructure failure and then retries successfully', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      b = await newBody(review(id));
    await db.$executeRawUnsafe(
      `CREATE FUNCTION p4_fail() RETURNS trigger AS $$ BEGIN IF NEW.aggregate_id='${id}' THEN RAISE EXCEPTION 'p4 simulated outbox outage'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER p4_fail BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION p4_fail()',
    );
    let op: any;
    try {
      await syncPost(b);
      op = await authDb.syncOperation.findUniqueOrThrow({
        where: { userId_operationId: { userId: ids.USER, operationId: b.operationId } },
      });
      await new Promise((r) => setTimeout(r, 700));
      expect(await db.userVocabularyProgress.count({ where: { vocabularyId: id } })).toBe(0);
      expect(await db.operationLedger.count({ where: { operationId: b.operationId } })).toBe(0);
      expect(await db.processedEvent.count({ where: { eventId: op.commandEventId } })).toBe(0);
      expect((await syncGet(b.operationId)).body.status).toBe('PENDING');
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER p4_fail ON outbox_events');
      await db.$executeRawUnsafe('DROP FUNCTION p4_fail()');
    }
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
  });
  it('reconciles a lost callback by scoped ledger lookup without repeating the operation', async () => {
    const t = await createTopic(1),
      b = await newBody(review(t.cards[0].vocabularyId)),
      source = authSync(),
      original = source.consume.bind(source),
      mock = jest.spyOn(source, 'consume').mockImplementation(async (e) => {
        const v = e as any;
        if (
          v.eventType === 'LearningSyncResolvedEvent.v2' &&
          v.payload.operationId === b.operationId
        )
          return;
        return original(e);
      });
    try {
      await syncPost(b);
      await until(
        async () =>
          (await db.operationLedger.count({ where: { operationId: b.operationId } })) === 1,
      );
      await until(
        async () =>
          (await db.outboxEvent.count({
            where: {
              eventType: 'LearningSyncResolvedEvent.v2',
              publishedAt: { not: null },
              payload: { path: ['payload', 'operationId'], equals: b.operationId },
            },
          })) === 1,
      );
    } finally {
      mock.mockRestore();
    }
    expect((await syncGet(b.operationId)).body.status).toBe('PENDING');
    await source.reconcile(ids.USER, b.operationId);
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
    expect(
      (
        await db.userVocabularyProgress.findUniqueOrThrow({
          where: {
            userId_vocabularyId: { userId: ids.USER, vocabularyId: t.cards[0].vocabularyId },
          },
        })
      ).revision,
    ).toBe(1n);
  });
  it('replays the original command to recover a lost hash-conflict rejection', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      opId = randomUUID();
    await post('flashcards/' + id + '/review', {
      operationId: opId,
      baseEntityRevision: '0',
      quality: 5,
    });
    const b = await newBody(review(id, 0), opId),
      source = authSync(),
      original = source.consume.bind(source),
      mock = jest.spyOn(source, 'consume').mockImplementation(async (e) => {
        const v = e as any;
        if (v.eventType === 'LearningSyncResolvedEvent.v2' && v.payload.operationId === opId)
          return;
        return original(e);
      });
    try {
      await syncPost(b);
      await until(
        async () =>
          (await db.outboxEvent.count({
            where: {
              eventType: 'LearningSyncResolvedEvent.v2',
              publishedAt: { not: null },
              payload: { path: ['payload', 'operationId'], equals: opId },
            },
          })) === 1,
      );
    } finally {
      mock.mockRestore();
    }
    await source.reconcile(ids.USER, opId);
    const done = await terminal(opId);
    expect(done).toMatchObject({ status: 'REJECTED', reason: 'IDEMPOTENCY_CONFLICT' });
    expect(
      (
        await db.userVocabularyProgress.findUniqueOrThrow({
          where: { userId_vocabularyId: { userId: ids.USER, vocabularyId: id } },
        })
      ).quality,
    ).toBe(5);
  });
  it('ignores older revisions, quarantines equal-revision changes and refuses conflicting terminal results', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      b = await newBody(review(id));
    await syncPost(b);
    await terminal(b.operationId);
    const old = await db.outboxEvent.findFirstOrThrow({
      where: {
        eventType: 'LearningProgressChangedEvent.v2',
        payload: { path: ['payload', 'operationId'], equals: b.operationId },
      },
    });
    await post('flashcards/' + id + '/review', {
      operationId: randomUUID(),
      baseEntityRevision: '1',
      quality: 3,
    });
    await until(
      async () =>
        (await authDb.syncProjection.count({
          where: { userId: ids.USER, entityId: id, revision: 2n },
        })) === 1,
    );
    await authSync().consume({ ...(old.payload as object), eventId: randomUUID() });
    expect(
      (
        await authDb.syncProjection.findUniqueOrThrow({
          where: {
            userId_entityType_entityId: {
              userId: ids.USER,
              entityType: 'VOCABULARY',
              entityId: id,
            },
          },
        })
      ).revision,
    ).toBe(2n);
    const newer = await db.outboxEvent.findFirstOrThrow({
      where: {
        eventType: 'LearningProgressChangedEvent.v2',
        payload: { path: ['payload', 'progress', '0', 'revision'], equals: '2' },
      },
    });
    const corrupt = JSON.parse(JSON.stringify(newer.payload));
    corrupt.eventId = randomUUID();
    corrupt.payload.progress[0].state.quality = 0;
    await authSync().consume(corrupt);
    expect(
      await authDb.syncQuarantine.count({
        where: { eventId: corrupt.eventId, reason: 'PROJECTION_REVISION_COLLISION' },
      }),
    ).toBe(1);
    const resolved = await db.syncResolution.findFirstOrThrow({
        where: { operationId: b.operationId },
      }),
      bad = JSON.parse(JSON.stringify(resolved.envelope));
    bad.eventId = randomUUID();
    bad.payload.status = 'REJECTED';
    bad.payload.reason = 'DIFFERENT_RESULT';
    await authSync().consume(bad);
    expect((await syncGet(b.operationId)).body.status).toBe('APPLIED');
    expect(await authDb.syncQuarantine.count({ where: { eventId: bad.eventId } })).toBe(1);
  });
  it('bootstraps paginated canonical state without cross-DB reads and detects a changed watermark', async () => {
    const userId = ids.OTHER,
      t = await createTopic(1),
      base = t.cards[0],
      rows = Array.from({ length: 55 }, (_, i) => ({
        id: randomUUID(),
        topicId: t.topic,
        word: 'Bootstrap ' + i,
        wordKey: 'bootstrap ' + i,
        definition: 'Bootstrap meaning ' + i,
        definitionKey: 'bootstrap meaning ' + i,
      }));
    await db.vocabulary.createMany({ data: rows });
    await db.userVocabularyProgress.createMany({
      data: rows.map((v) => ({
        userId,
        vocabularyId: v.id,
        quality: 4,
        intervalDays: 1,
        easinessFactor: 2.5,
        repetitionNumber: 1,
        nextReviewDate: new Date('2026-01-01'),
        firstLearnedAt: new Date('2026-01-01'),
        revision: 1n,
        updatedAt: new Date(),
      })),
    });
    await db.learningProgressHead.upsert({
      where: { userId },
      create: { userId, version: 55n },
      update: { version: 55n },
    });
    await authDb.syncHead.upsert({
      where: { userId },
      create: { userId },
      update: { bootstrapDone: false, bootstrapCursor: null, bootstrapWatermark: null },
    });
    await authSync().repair(userId);
    const first = await authDb.syncHead.findUniqueOrThrow({ where: { userId } });
    expect(first.bootstrapDone).toBe(false);
    expect(first.bootstrapCursor).not.toBeNull();
    await db.learningProgressHead.update({ where: { userId }, data: { version: 56n } });
    await authSync().repair(userId);
    expect(
      (await authDb.syncHead.findUniqueOrThrow({ where: { userId } })).bootstrapCursor,
    ).toBeNull();
    await authSync().repair(userId);
    await authSync().repair(userId);
    expect((await authDb.syncHead.findUniqueOrThrow({ where: { userId } })).bootstrapDone).toBe(
      true,
    );
    const firstPage = await api()
      .get('/api/v1/sync/users/me?limit=20')
      .auth(tokens.OTHER, { type: 'bearer' });
    validateRequest('SyncState', firstPage.body);
    expect(firstPage.body.progress).toHaveLength(20);
    const second = await api()
      .get('/api/v1/sync/users/me?limit=20&cursor=' + firstPage.body.nextCursor)
      .auth(tokens.OTHER, { type: 'bearer' });
    expect(second.body.progress).toHaveLength(20);
    expect(
      firstPage.body.progress.some((a: any) =>
        second.body.progress.some((b: any) => a.entityId === b.entityId),
      ),
    ).toBe(false);
    expect(
      (
        await api()
          .get('/api/v1/sync/users/me?cursor=' + firstPage.body.nextCursor)
          .auth(tokens.USER, { type: 'bearer' })
      ).status,
    ).toBe(400);
  });
  it('completes a lesson through sync once, preserving the original completion on later operations', async () => {
    const lesson = await post(
      'admin/lessons',
      {
        lessonTitle: 'P4 Grammar',
        category: 'TENSE',
        contentMarkdown: '# Past tense',
        status: 'PUBLISHED',
      },
      'CONTENT_ADMIN',
    );
    expect(lesson.status).toBe(201);
    const id = lesson.body.lessonId,
      b = await newBody({ kind: 'COMPLETE_LESSON', lessonId: id, baseEntityRevision: '0' });
    b.clientOccurredAt = new Date(Date.now() - 86400000).toISOString();
    await syncPost(b);
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
    const first = await db.userLessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: ids.USER, lessonId: id } },
    });
    expect(first.completedAt.toISOString()).toBe(b.clientOccurredAt);
    const again = await newBody({ kind: 'COMPLETE_LESSON', lessonId: id, baseEntityRevision: '1' });
    await syncPost(again);
    expect((await terminal(again.operationId)).status).toBe('APPLIED');
    const last = await db.userLessonProgress.findUniqueOrThrow({
      where: { userId_lessonId: { userId: ids.USER, lessonId: id } },
    });
    expect(last.completedAt).toEqual(first.completedAt);
    expect(last.revision).toBe(1n);
    expect(
      await db.outboxEvent.count({
        where: { eventType: 'LessonCompletedEvent.v2', aggregateId: id },
      }),
    ).toBe(1);
  });
  it('rolls back Auth resolution, watermark and inbox together when its inbox insert fails', async () => {
    const t = await createTopic(1),
      b = await newBody(review(t.cards[0].vocabularyId));
    await authDb.$executeRawUnsafe(
      "CREATE FUNCTION p4_auth_fail() RETURNS trigger AS $$ BEGIN IF NEW.event_type='LearningSyncResolvedEvent.v2' THEN RAISE EXCEPTION 'p4 simulated Auth inbox outage'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql",
    );
    await authDb.$executeRawUnsafe(
      'CREATE TRIGGER p4_auth_fail BEFORE INSERT ON sync_inbox FOR EACH ROW EXECUTE FUNCTION p4_auth_fail()',
    );
    let eventId = '';
    const original = authSync().consume.bind(authSync()),
      observed = jest.spyOn(authSync(), 'consume').mockImplementation(original);
    try {
      await syncPost(b);
      await until(
        async () =>
          (await db.syncResolution.count({ where: { operationId: b.operationId } })) === 1,
      );
      const res = await db.syncResolution.findFirstOrThrow({
        where: { operationId: b.operationId },
      });
      eventId = (res.envelope as any).eventId;
      await until(async () => observed.mock.calls.some(([e]) => (e as any).eventId === eventId));
      await new Promise((r) => setTimeout(r, 100));
      const op = await authDb.syncOperation.findUniqueOrThrow({
        where: { userId_operationId: { userId: ids.USER, operationId: b.operationId } },
      });
      expect(op.status).toBe('PENDING');
      expect(
        (await authDb.syncHead.findUniqueOrThrow({ where: { userId: ids.USER } })).resolvedVersion,
      ).toBe(op.syncVersion - 1n);
      expect(await authDb.syncInbox.count({ where: { eventId } })).toBe(0);
    } finally {
      observed.mockRestore();
      await authDb.$executeRawUnsafe('DROP TRIGGER p4_auth_fail ON sync_inbox');
      await authDb.$executeRawUnsafe('DROP FUNCTION p4_auth_fail()');
    }
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
  });
  it('marks delayed pending and repairs it through the maintenance worker', async () => {
    const t = await createTopic(1),
      b = await newBody(review(t.cards[0].vocabularyId)),
      source = authSync(),
      original = source.consume.bind(source),
      tick = source.tick.bind(source),
      pause = jest.spyOn(source, 'tick').mockResolvedValue(undefined),
      drop = jest.spyOn(source, 'consume').mockImplementation(async (e) => {
        if (
          (e as any).eventType === 'LearningSyncResolvedEvent.v2' &&
          (e as any).payload.operationId === b.operationId
        )
          return;
        return original(e);
      });
    try {
      await syncPost(b);
      await until(
        async () =>
          (await db.outboxEvent.count({
            where: {
              eventType: 'LearningSyncResolvedEvent.v2',
              publishedAt: { not: null },
              payload: { path: ['payload', 'operationId'], equals: b.operationId },
            },
          })) === 1,
      );
      await authDb.syncOperation.update({
        where: { userId_operationId: { userId: ids.USER, operationId: b.operationId } },
        data: { acceptedAt: new Date(Date.now() - 31000) },
      });
      const state = await api().get('/api/v1/sync/users/me').auth(tokens.USER, { type: 'bearer' });
      expect(state.body.delayed).toBe(true);
      drop.mockRestore();
      await tick();
      expect((await terminal(b.operationId)).status).toBe('APPLIED');
    } finally {
      drop.mockRestore();
      pause.mockRestore();
    }
  });
  it('resubscribes the P4 consumer after its actual RabbitMQ connection drops', async () => {
    const t = await createTopic(1),
      b = await newBody(review(t.cards[0].vocabularyId));
    await (
      learning.get(MessagingService) as unknown as { connection: { close(): Promise<void> } }
    ).connection.close();
    expect((await syncPost(b)).body.status).toBe('PENDING');
    expect((await terminal(b.operationId)).status).toBe('APPLIED');
    expect(
      await db.operationLedger.count({ where: { userId: ids.USER, operationId: b.operationId } }),
    ).toBe(1);
  });
  it('dead-letters malformed sync transport without creating a business rejection or inbox', async () => {
    const before = await db.processedEvent.count(),
      connection = await amqp.connect(process.env.RABBITMQ_URL!);
    try {
      const ch = await connection.createConfirmChannel(),
        queue = process.env.SYNC_QUEUE_PREFIX + '.learning-sync.v2';
      ch.publish(
        process.env.RABBITMQ_EXCHANGE!,
        'user.sync.accepted.v2',
        Buffer.from('{"broken":true}'),
        { persistent: true },
      );
      await ch.waitForConfirms();
      await until(async () => (await ch.checkQueue(queue + '.dlq')).messageCount >= 1);
      expect(await db.processedEvent.count()).toBe(before);
      await ch.close();
    } finally {
      await connection.close();
    }
  });
});
