import { randomUUID } from 'node:crypto';
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
const integration = process.env.P3_LEARNING_DATABASE_URL ? describe : describe.skip;
integration('P3 Learning via Gateway with real Auth/PostgreSQL/RabbitMQ/MinIO', () => {
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
    for (const key of ['P3_AUTH_DATABASE_URL', 'P3_LEARNING_DATABASE_URL'])
      if (!/^\/p3_(auth|learning)_\d+$/.test(new URL(process.env[key]!).pathname))
        throw new Error('Isolated P3 DB required');
    authDb = new AuthPrisma({ datasources: { db: { url: process.env.P3_AUTH_DATABASE_URL } } });
    db = new PrismaService({ datasources: { db: { url: process.env.P3_LEARNING_DATABASE_URL } } });
    const am = await Test.createTestingModule({ imports: [AuthModule] })
      .overrideProvider(AuthPrisma)
      .useValue(authDb)
      .compile();
    auth = am.createNestApplication();
    configureAuth(auth);
    await auth.listen(0, '127.0.0.1');
    process.env.AUTH_INTERNAL_URL = await auth.getUrl();
    const lm = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    learning = lm.createNestApplication();
    configureLearning(learning);
    await learning.listen(0, '127.0.0.1');
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
    // Fresh CI storage needs the same public-read policy as scripts/init-media.mjs.
    await minio.setBucketPolicy(
      'toeic-media',
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: ['arn:aws:s3:::toeic-media/*'],
          },
        ],
      }),
    );
    ({ topic, cards } = await createTopic());
  });
  afterAll(async () => {
    if (minio) for (const key of objects) await minio.removeObject('toeic-media', key);
    await gateway?.close();
    await learning?.close();
    await auth?.close();
  });
  it('enforces direct and Gateway authorization, roles and closed body/query schemas', async () => {
    expect((await api().get('/api/v1/learning/vocabularies')).status).toBe(401);
    for (const role of ['USER', 'SYSTEM_ADMIN']) {
      expect((await post('admin/vocabulary-topics', { topicName: 'Forbidden' }, role)).status).toBe(
        403,
      );
      expect(
        (
          await request(learning.getHttpServer())
            .post('/api/v1/learning/admin/vocabulary-topics')
            .auth(tokens[role], { type: 'bearer' })
            .set('Idempotency-Key', randomUUID())
            .send({ topicName: 'Forbidden' })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await post(
          'admin/vocabularies',
          { topicId: topic, word: 'X', definition: 'Y', audioKey: 'learning/forged' },
          'CONTENT_ADMIN',
        )
      ).status,
    ).toBe(400);
    expect((await get('vocabularies?unknown=x')).status).toBe(400);
    expect((await get('vocabularies?size=51')).status).toBe(400);
    expect((await get('vocabularies/not-a-uuid')).status).toBe(400);
    expect(
      (
        await post(
          'admin/vocabularies',
          { topicId: topic, word: '  ', definition: 'Y' },
          'CONTENT_ADMIN',
        )
      ).status,
    ).toBe(400);
    expect(
      (await get('vocabularies?topicId=' + topic + '&keyword=Word&size=2')).body,
    ).toMatchObject({ total: 6, size: 2, page: 1, totalPages: 3 });
    expect((await get('vocabularies?topicId=' + topic + '&page=99')).body.items).toEqual([]);
  });
  it('makes CRUD idempotent, normalizes duplicate words, audits changes and restricts topic deletion', async () => {
    const key = randomUUID(),
      payload = { topicName: 'Idempotent' };
    const a = await post('admin/vocabulary-topics', payload, 'CONTENT_ADMIN', key),
      b = await post('admin/vocabulary-topics', payload, 'CONTENT_ADMIN', key);
    expect(a.status).toBe(201);
    expect(b.body).toEqual(a.body);
    expect(
      (await post('admin/vocabulary-topics', { topicName: 'Changed' }, 'CONTENT_ADMIN', key))
        .status,
    ).toBe(409);
    expect(
      (
        await post(
          'admin/vocabularies',
          { topicId: topic, word: ' word 0 ', definition: 'different' },
          'CONTENT_ADMIN',
        )
      ).status,
    ).toBe(409);
    expect((await del('vocabulary-topics/' + topic)).status).toBe(409);
    expect((await del('vocabulary-topics/' + a.body.topicId)).status).toBe(200);
    expect((await get('vocabulary-topics/' + a.body.topicId)).status).toBe(404);
    expect(await db.contentAudit.count({ where: { actorId: ids.CONTENT_ADMIN } })).toBeGreaterThan(
      7,
    );
  });
  it('rejects whitespace-only PATCH fields without changing content, publication status or audit', async () => {
    const created = await post(
      'admin/lessons',
      {
        lessonTitle: 'Whitespace regression',
        category: 'TENSE',
        contentMarkdown: '# Valid content',
        status: 'DRAFT',
      },
      'CONTENT_ADMIN',
    );
    expect(created.status).toBe(201);
    const lessonId = created.body.lessonId as string;
    const snapshot = async () => ({
      topic: await db.vocabularyTopic.findUniqueOrThrow({ where: { id: topic } }),
      vocabulary: await db.vocabulary.findUniqueOrThrow({ where: { id: cards[0].vocabularyId } }),
      lesson: await db.grammarLesson.findUniqueOrThrow({ where: { id: lessonId } }),
      auditCount: await db.contentAudit.count(),
    });
    const before = await snapshot();
    for (const whitespace of ['   ', ' \t\n ', '\u00a0\u3000']) {
      for (const [path, body] of [
        ['vocabulary-topics/' + topic, { topicName: whitespace }],
        ['vocabularies/' + cards[0].vocabularyId, { word: whitespace }],
        ['vocabularies/' + cards[0].vocabularyId, { definition: whitespace }],
        ['lessons/' + lessonId, { lessonTitle: whitespace, status: 'PUBLISHED' }],
        ['lessons/' + lessonId, { category: whitespace, status: 'PUBLISHED' }],
        ['lessons/' + lessonId, { contentMarkdown: whitespace, status: 'PUBLISHED' }],
      ] as const) {
        const response = await patch(path, body);
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('EMPTY_CONTENT');
      }
    }
    expect(await snapshot()).toEqual(before);
    expect((await get('lessons/' + lessonId)).status).toBe(404);
    expect((await patch('lessons/' + lessonId, { status: 'PUBLISHED' })).status).toBe(200);
    expect((await get('lessons/' + lessonId)).body.lessonTitle).toBe(before.lesson.lessonTitle);
    expect((await del('lessons/' + lessonId)).status).toBe(200);
  });
  it('hides draft/archived lessons, renders safe Markdown and completes lessons only once', async () => {
    const created = await post(
      'admin/lessons',
      {
        lessonTitle: 'Grammar',
        category: 'TENSE',
        contentMarkdown:
          '# Hello\n<script>alert(1)</script>\n[bad](javascript:alert(1))\n![x](https://tracking.invalid/x)',
        status: 'DRAFT',
      },
      'CONTENT_ADMIN',
    );
    expect(created.status).toBe(201);
    lesson = created.body.lessonId;
    expect(created.body.contentHtml).not.toMatch(/<script|href="javascript:|<img/);
    validateRequest('Lesson', created.body);
    expect((await get('lessons/' + lesson)).status).toBe(404);
    expect(
      (
        await post('lessons/' + lesson + '/complete', {
          operationId: randomUUID(),
          baseEntityRevision: '0',
        })
      ).status,
    ).toBe(404);
    expect((await patch('lessons/' + lesson, { status: 'PUBLISHED' })).status).toBe(200);
    const body = { operationId: randomUUID(), baseEntityRevision: '0' },
      first = await post('lessons/' + lesson + '/complete', body);
    expect(first.status).toBe(200);
    validateRequest('ProgressResult', first.body);
    expect((await post('lessons/' + lesson + '/complete', body)).body).toEqual(first.body);
    expect(
      (await post('lessons/' + lesson + '/complete', { ...body, operationId: randomUUID() }))
        .status,
    ).toBe(409);
    const again = await post('lessons/' + lesson + '/complete', {
      operationId: randomUUID(),
      baseEntityRevision: '1',
    });
    expect(again.body.progress).toEqual(first.body.progress);
    expect(await db.outboxEvent.count({ where: { eventType: 'LessonCompletedEvent.v2' } })).toBe(1);
  });
  it('validates quality and revisions; preserves firstLearned and exactly one CAS winner', async () => {
    const id = cards[5].vocabularyId,
      path = 'flashcards/' + id + '/review';
    for (const q of [-1, 6, 2.5])
      expect(
        (await post(path, { operationId: randomUUID(), baseEntityRevision: '0', quality: q }))
          .status,
      ).toBe(400);
    expect(
      (
        await post(path, {
          operationId: randomUUID(),
          baseEntityRevision: '9223372036854775808',
          quality: 5,
        })
      ).status,
    ).toBe(400);
    const body = { operationId: randomUUID(), baseEntityRevision: '0', quality: 2 },
      first = await post(path, body);
    expect(first.status).toBe(200);
    expect(first.body.progress[0]).toMatchObject({
      revision: '1',
      state: { quality: 2, repetitionNumber: 0, firstLearnedAt: null },
    });
    expect((await post(path, body)).body).toEqual(first.body);
    expect((await post(path, { ...body, quality: 5 })).status).toBe(409);
    const wins = await Promise.all(
      [4, 5].map((quality) =>
        post(path, { operationId: randomUUID(), baseEntityRevision: '1', quality }),
      ),
    );
    expect(wins.map((r) => r.status).sort()).toEqual([200, 409]);
    const success = wins.find((r) => r.status === 200)!;
    expect(success.body.progress[0].revision).toBe('2');
    const learned = success.body.progress[0].state.firstLearnedAt;
    const low = await post(path, {
      operationId: randomUUID(),
      baseEntityRevision: '2',
      quality: 0,
    });
    expect(low.body.progress[0].state.firstLearnedAt).toBe(learned);
    expect((await get('review-today')).body.items).toEqual([]);
  });
  it('requires 5 cards and 4 normalized distinct definitions without creating a partial session', async () => {
    for (const t of [
      await createTopic(4),
      await createTopic(5, ['Same', ' same ', 'SAME', 'Other', 'Third']),
    ]) {
      const count = await db.vocabularySession.count();
      expect((await post('vocabulary-sessions', { topicId: t.topic, mode: 'NEW' })).status).toBe(
        409,
      );
      expect(await db.vocabularySession.count()).toBe(count);
    }
  });
  it('keeps drafts private and commits 5 reviews atomically; quiz results never gate quality', async () => {
    const s = await session();
    expect(JSON.stringify(s)).not.toMatch(/correctOption|quizCorrect|expectedRevision/);
    for (const q of s.quiz) {
      expect(new Set(q.options.map((o: any) => o.code)).size).toBe(4);
      expect(
        new Set(q.options.map((o: any) => o.text.normalize('NFC').trim().toLowerCase())).size,
      ).toBe(4);
    }
    expect((await get('vocabulary-sessions/' + s.sessionId, 'OTHER')).status).toBe(404);
    const body = submission(s, 5, false),
      draft = { reviews: body.reviews.slice(0, 1) };
    expect((await post('vocabulary-sessions/' + s.sessionId + '/reviews', draft)).status).toBe(200);
    expect(
      await db.userVocabularyProgress.count({
        where: {
          userId: ids.USER,
          vocabularyId: { in: s.vocabularies.map((v: any) => v.vocabularyId) },
        },
      }),
    ).toBe(0);
    const changed = s.vocabularies[0];
    await patch('vocabularies/' + changed.vocabularyId, { definition: 'Changed after session' });
    await del('vocabularies/' + changed.vocabularyId);
    const results = await Promise.all([
      post('vocabulary-sessions/' + s.sessionId + '/submit', body),
      post('vocabulary-sessions/' + s.sessionId + '/submit', body),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].body).toEqual(results[1].body);
    const result = results[0].body;
    validateRequest('SessionResult', result);
    expect(result.quizScore).toBe(0);
    expect(result.progress.every((p: any) => p.state.firstLearnedAt && p.revision === '1')).toBe(
      true,
    );
    await db.vocabularySession.update({
      where: { id: s.sessionId },
      data: { expiresAt: new Date(0) },
    });
    expect((await post('vocabulary-sessions/' + s.sessionId + '/submit', body)).body).toEqual(
      result,
    );
    expect(
      (
        await post('vocabulary-sessions/' + s.sessionId + '/submit', {
          ...body,
          answers: body.answers.map((a: any, i: number) =>
            i === 0 ? { ...a, selectedOption: a.selectedOption === 'A' ? 'B' : 'A' } : a,
          ),
        })
      ).status,
    ).toBe(409);
    expect(
      await db.outboxEvent.count({
        where: {
          eventType: 'VocabularyLearnedEvent.v2',
          payload: { path: ['payload', 'sessionId'], equals: s.sessionId },
        },
      }),
    ).toBe(5);
    expect((await get('vocabularies/' + changed.vocabularyId)).status).toBe(404);
  });
  it('accepts all wrong qualities independently from a perfect quiz; rejects stale revision as one transaction', async () => {
    const t = await createTopic(5),
      s = await session(t.topic, 'OTHER'),
      body = submission(s, 0, true);
    const result = await post('vocabulary-sessions/' + s.sessionId + '/submit', body, 'OTHER');
    expect(result.status).toBe(200);
    expect(result.body.quizScore).toBe(5);
    expect(
      result.body.progress.every(
        (p: any) => p.state.firstLearnedAt === null && p.state.quality === 0,
      ),
    ).toBe(true);
    const t2 = await createTopic(5),
      s2 = await session(t2.topic),
      b2 = submission(s2);
    expect(
      (
        await post('flashcards/' + s2.vocabularies[4].vocabularyId + '/review', {
          operationId: randomUUID(),
          baseEntityRevision: '0',
          quality: 5,
        })
      ).status,
    ).toBe(200);
    const outbox = await db.outboxEvent.count();
    const rejected = await post('vocabulary-sessions/' + s2.sessionId + '/submit', b2);
    expect(rejected.status).toBe(409);
    expect(rejected.body.currentProgress).toHaveLength(1);
    expect(await db.outboxEvent.count()).toBe(outbox);
    expect(
      await db.userVocabularyProgress.count({
        where: {
          userId: ids.USER,
          vocabularyId: { in: s2.vocabularies.map((v: any) => v.vocabularyId) },
        },
      }),
    ).toBe(1);
    expect(
      await db.operationLedger.findUnique({
        where: { userId_operationId: { userId: ids.USER, operationId: b2.operationId } },
      }),
    ).toBeNull();
  });
  it('blocks canceled/expired/foreign sessions and preserves owner isolation', async () => {
    const t = await createTopic(5),
      s = await session(t.topic);
    expect((await post('vocabulary-sessions/' + s.sessionId + '/cancel', undefined)).status).toBe(
      200,
    );
    expect((await post('vocabulary-sessions/' + s.sessionId + '/cancel', undefined)).status).toBe(
      200,
    );
    expect(
      (await post('vocabulary-sessions/' + s.sessionId + '/submit', submission(s))).body.code,
    ).toBe('SESSION_CANCELED');
    const expired = await session(t.topic);
    await db.vocabularySession.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(0) },
    });
    expect((await get('vocabulary-sessions/' + expired.sessionId)).body.status).toBe('EXPIRED');
    expect(
      (await post('vocabulary-sessions/' + expired.sessionId + '/submit', submission(expired))).body
        .code,
    ).toBe('SESSION_EXPIRED');
  });
  it('rolls back progress and ledger when the outbox insert fails', async () => {
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      body = { operationId: randomUUID(), baseEntityRevision: '0', quality: 5 };
    await db.$executeRawUnsafe(
      `CREATE FUNCTION p3_fail_event() RETURNS trigger AS $$ BEGIN IF NEW.aggregate_id='${id}' THEN RAISE EXCEPTION 'p3 simulated outbox outage'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER p3_fail_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION p3_fail_event()',
    );
    try {
      expect((await post('flashcards/' + id + '/review', body)).status).toBe(503);
      expect(await db.userVocabularyProgress.count({ where: { vocabularyId: id } })).toBe(0);
      expect(await db.operationLedger.count({ where: { operationId: body.operationId } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER p3_fail_event ON outbox_events');
      await db.$executeRawUnsafe('DROP FUNCTION p3_fail_event()');
    }
    expect((await post('flashcards/' + id + '/review', body)).status).toBe(200);
  });
  it('presigns real browser PUT; verifies ownership, MIME/size/expiry and disallows arbitrary keys', async () => {
    const id = cards[1].vocabularyId,
      path = 'vocabularies/' + id + '/media/';
    for (const body of [
      { kind: 'IMAGE', contentType: 'image/png', sizeBytes: 2097153 },
      { kind: 'AUDIO', contentType: 'image/png', sizeBytes: 10 },
    ])
      expect((await post(path + 'presign', body, 'CONTENT_ADMIN')).status).toBe(400);
    const signed = await post(
      path + 'presign',
      { kind: 'IMAGE', contentType: 'image/png', sizeBytes: 3 },
      'CONTENT_ADMIN',
    );
    expect(signed.status).toBe(200);
    validateRequest('UploadTicket', signed.body);
    objects.add(signed.body.objectKey);
    expect(signed.body.objectKey).toMatch(new RegExp('^learning/' + id + '/'));
    expect(
      (
        await fetch(signed.body.putUrl, {
          method: 'PUT',
          headers: signed.body.requiredHeaders,
          body: Buffer.from('png'),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          path + 'confirm',
          { uploadId: signed.body.uploadId, objectKey: 'question-bank/forged' },
          'CONTENT_ADMIN',
        )
      ).status,
    ).toBe(400);
    expect((await post(path + 'confirm', { uploadId: signed.body.uploadId }, 'USER')).status).toBe(
      403,
    );
    expect(
      (await post(path + 'confirm', { uploadId: signed.body.uploadId }, 'OTHER_ADMIN')).status,
    ).toBe(404);
    const key = randomUUID(),
      confirmed = await post(
        path + 'confirm',
        { uploadId: signed.body.uploadId },
        'CONTENT_ADMIN',
        key,
      );
    expect(confirmed.status).toBe(200);
    expect((await fetch(confirmed.body.url)).status).toBe(200);
    expect(
      (await post(path + 'confirm', { uploadId: signed.body.uploadId }, 'CONTENT_ADMIN', key)).body,
    ).toEqual(confirmed.body);
    expect((await get('vocabularies/' + id)).body.imageKey).toBe(signed.body.objectKey);
    const wrong = await post(
      path + 'presign',
      { kind: 'IMAGE', contentType: 'image/png', sizeBytes: 3 },
      'CONTENT_ADMIN',
    );
    objects.add(wrong.body.objectKey);
    await fetch(wrong.body.putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: Buffer.from('long'),
    });
    expect(
      (await post(path + 'confirm', { uploadId: wrong.body.uploadId }, 'CONTENT_ADMIN')).status,
    ).toBe(400);
    await db.learningUpload.update({
      where: { id: wrong.body.uploadId },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (await post(path + 'confirm', { uploadId: wrong.body.uploadId }, 'CONTENT_ADMIN')).body.code,
    ).toBe('UPLOAD_EXPIRED');
  });
  it('paginates due dates and creates REVIEW from server progress only', async () => {
    const t = await createTopic(5);
    for (const card of t.cards)
      expect(
        (
          await post('flashcards/' + card.vocabularyId + '/review', {
            operationId: randomUUID(),
            baseEntityRevision: '0',
            quality: 4,
          })
        ).status,
      ).toBe(200);
    await db.userVocabularyProgress.updateMany({
      where: { userId: ids.USER, vocabularyId: { in: t.cards.map((c) => c.vocabularyId) } },
      data: { nextReviewDate: new Date('2026-01-01T00:00:00Z') },
    });
    const page = await get('review-today?topicId=' + t.topic + '&size=2');
    expect(page.body).toMatchObject({ total: 5, totalPages: 3, size: 2 });
    validateRequest('ReviewPage', page.body);
    const review = await post('vocabulary-sessions', { topicId: t.topic, mode: 'REVIEW' });
    expect(review.status).toBe(201);
    validateRequest('Session', review.body);
    expect((await post('vocabulary-sessions', { topicId: t.topic, mode: 'NEW' })).status).toBe(409);
  });
  it('retains committed progress and original event IDs through broker publish failure', async () => {
    await until(async () => (await db.outboxEvent.count({ where: { publishedAt: null } })) === 0);
    const t = await createTopic(1),
      id = t.cards[0].vocabularyId,
      body = { operationId: randomUUID(), baseEntityRevision: '0', quality: 5 },
      mock = jest
        .spyOn(learning.get(MessagingService), 'emit')
        .mockRejectedValue(new Error('p3 simulated broker outage'));
    let eventIds: string[] = [];
    try {
      expect((await post('flashcards/' + id + '/review', body)).status).toBe(200);
      await until(
        async () =>
          (await db.outboxEvent.count({ where: { publishedAt: null, retryCount: { gte: 1 } } })) >
          0,
      );
      const rows = await db.outboxEvent.findMany({
        where: { payload: { path: ['payload', 'operationId'], equals: body.operationId } },
      });
      expect(rows).toHaveLength(2);
      eventIds = rows.map((r) => r.id);
      expect(rows.every((r) => r.publishedAt === null)).toBe(true);
      expect((await post('flashcards/' + id + '/review', body)).status).toBe(200);
      expect(await db.outboxEvent.count({ where: { id: { in: eventIds } } })).toBe(2);
    } finally {
      mock.mockRestore();
    }
    await db.outboxEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { nextAttemptAt: new Date(0) },
    });
    await until(
      async () =>
        (await db.outboxEvent.count({ where: { id: { in: eventIds }, publishedAt: null } })) === 0,
    );
    expect(
      (
        await db.userVocabularyProgress.findUniqueOrThrow({
          where: { userId_vocabularyId: { userId: ids.USER, vocabularyId: id } },
        })
      ).revision,
    ).toBe(1n);
  });
  it('reports canonical progress and publishes validated V2 envelopes with stable event IDs into durable queues', async () => {
    const summary = await get('progress');
    expect(summary.status).toBe(200);
    validateRequest('LearningProgress', summary.body);
    expect(summary.body).toMatchObject({ grammarLessonsCompleted: 1, sessionsCompleted: 1 });
    await until(async () => (await db.outboxEvent.count({ where: { publishedAt: null } })) === 0);
    const rows = await db.outboxEvent.findMany();
    for (const row of rows) {
      expect(validateEvent(row.payload)).toMatch(/\.v2$/);
      expect((row.payload as any).eventId).toBe(row.id);
    }
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    try {
      const ch = await conn.createChannel();
      let received = 0;
      for (const name of ['analytics-service', 'auth-learning-projection']) {
        const queue = process.env.LEARNING_V2_QUEUE_PREFIX + '.' + name + '.v2';
        const info = await ch.checkQueue(queue);
        expect(info.messageCount).toBeGreaterThan(0);
        while (true) {
          const msg = await ch.get(queue, { noAck: true });
          if (!msg) break;
          const e = JSON.parse(msg.content.toString());
          expect(rows.some((r) => r.id === e.eventId)).toBe(true);
          validateEvent(e);
          received++;
        }
      }
      expect(received).toBe(rows.length);
      await ch.close();
    } finally {
      await conn.close();
    }
  });
});
