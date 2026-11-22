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
          selectedOption: q.options.find((option: any) => {
            const correctText = q.direction === 'MEANING_CONFIRMATION' ? 'Có' : definition;
            return (option.text === correctText) === correct;
          }).code,
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
    const adminTopicList = 'admin/vocabulary-topics?size=1&keyword=' + payload.topicName;
    expect((await get(adminTopicList, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [{ topicId: a.body.topicId }],
      total: 1,
      totalPages: 1,
    });
    expect((await del('vocabulary-topics/' + a.body.topicId)).status).toBe(200);
    expect((await get(adminTopicList, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
    });
    expect((await get('vocabulary-topics/' + a.body.topicId)).status).toBe(404);
    expect(
      (await get('admin/vocabulary-topics/' + a.body.topicId, 'CONTENT_ADMIN')).body,
    ).toMatchObject({ topicId: a.body.topicId, deletedAt: expect.any(String) });
    expect(await db.contentAudit.count({ where: { actorId: ids.CONTENT_ADMIN } })).toBeGreaterThan(
      7,
    );
  });
  it('creates auditable vocabulary batches and rolls back conflicts', async () => {
    const topicId = (await createTopic(0)).topic;
    const path = 'admin/vocabularies/bulk';
    const key = randomUUID();
    const items = ['Six', 'Five', 'Four', 'Three', 'Two', 'One'].map((word) => ({
      word,
      phonetic: null,
      definition: 'ộ'.repeat(10_000),
      example: null,
    }));
    const body = { topicId, items };

    expect((await post(path, body, 'SYSTEM_ADMIN')).status).toBe(403);
    const created = await post(path, body, 'CONTENT_ADMIN', key);
    expect(created.status).toBe(201);
    validateRequest('VocabularyBulkCreated', created.body);
    expect(created.body.items).toMatchObject(items.map((item) => ({ ...item, topicId })));
    expect((await post(path, body, 'CONTENT_ADMIN', key)).body).toEqual(created.body);

    const conflict = await post(path, { topicId, items: items.slice(1) }, 'CONTENT_ADMIN', key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    const duplicate = await post(
      path,
      {
        topicId,
        items: [
          { word: 'New word', definition: 'New meaning' },
          { word: ' ONE ', definition: 'Duplicate' },
        ],
      },
      'CONTENT_ADMIN',
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_CONTENT');
    expect((await get('vocabularies?topicId=' + topicId)).body.total).toBe(items.length);
    expect(
      await db.contentAudit.count({
        where: {
          actorId: ids.CONTENT_ADMIN,
          action: 'VOCABULARIES_CREATED',
          entityId: {
            in: created.body.items.map((item: { vocabularyId: string }) => item.vocabularyId),
          },
        },
      }),
    ).toBe(items.length);
  });
  it('archives only the active vocabulary of a topic and lets admins archive the empty topic', async () => {
    const { topic: target, cards: words } = await createTopic(4);
    const targetPath = 'vocabulary-topics/' + target;
    const path = targetPath + '/vocabularies';
    const [archived, ...activeIds] = words.map((word) => word.vocabularyId as string);
    const imageKey = `learning/${target}/image.png`;
    await db.vocabulary.update({ where: { id: activeIds[0] }, data: { imageKey } });
    expect((await del('vocabularies/' + archived)).status).toBe(200);

    expect((await del(targetPath)).body.code).toBe('TOPIC_NOT_EMPTY');
    for (const role of ['USER', 'SYSTEM_ADMIN']) {
      expect(
        (
          await api()
            .delete('/api/v1/learning/admin/' + path)
            .auth(tokens[role], { type: 'bearer' })
        ).status,
      ).toBe(403);
    }
    const cleared = await del(path);
    expect(cleared.status).toBe(200);
    validateRequest('VocabularyBulkDeleted', cleared.body);
    expect(cleared.body).toEqual({ success: true, deletedCount: activeIds.length });
    expect((await del(path)).body).toEqual({ success: true, deletedCount: 0 });

    for (const [prefix, role] of [
      ['', 'USER'],
      ['admin/', 'CONTENT_ADMIN'],
    ]) {
      expect(
        (await get(`${prefix}vocabularies?topicId=${target}&size=1`, role)).body,
      ).toMatchObject({
        items: [],
        total: 0,
      });
    }
    expect((await get(targetPath)).body).toMatchObject({ topicId: target, vocabularyCount: 0 });
    expect((await get('vocabularies?topicId=' + topic)).body.total).toBe(cards.length);
    expect(
      await db.contentAudit.count({
        where: { action: 'VOCABULARIES_DELETED', entityId: { in: [archived, ...activeIds] } },
      }),
    ).toBe(words.length);
    expect(await db.learningStorageGarbage.findUnique({ where: { objectKey: imageKey } })).not.toBe(
      null,
    );
    expect((await del(targetPath)).status).toBe(200);
    expect((await get(targetPath)).status).toBe(404);
  });
  it('imports workbook lists atomically and updates vocabulary without duplicating it', async () => {
    const path = 'admin/vocabularies/import';
    const source = `excel-${randomUUID()}`;
    const word = {
      word: 'accountant',
      partOfSpeech: 'n',
      phonetic: '/əˈkaʊn.tənt/',
      definition: 'kế toán',
      englishDefinition: 'a person responsible for the money in a business',
      example: 'My [accountant] takes care of my taxes.\n(=Dịch: Kế toán của tôi lo liệu thuế.)',
    };
    const body = {
      source,
      lists: [
        { name: 'List 1', words: [word] },
        { name: 'List 2', words: [{ ...word, word: 'ACCOUNTANT' }] },
      ],
    };
    const duplicate = {
      ...body,
      lists: [...body.lists, { name: 'List 3', words: [word, { ...word, word: ' ACCOUNTANT ' }] }],
    };
    const manual = await post('admin/vocabulary-topics', { topicName: 'List 1' }, 'CONTENT_ADMIN');
    expect((await post(path, body, 'USER')).status).toBe(403);
    expect((await post(path, duplicate, 'CONTENT_ADMIN')).body.code).toBe('DUPLICATE_IMPORT_WORD');
    expect(await db.vocabularyTopic.count({ where: { importSource: source } })).toBe(0);

    const key = randomUUID();
    const result = await post(path, body, 'CONTENT_ADMIN', key);
    expect(result.status).toBe(201);
    validateRequest('VocabularyImportResult', result.body);
    expect(result.body).toEqual({
      listCount: 2,
      wordCount: 2,
      createdCount: 2,
      updatedCount: 0,
      unchangedCount: 0,
    });
    expect((await post(path, body, 'CONTENT_ADMIN', key)).body).toEqual(result.body);
    expect((await post(path, body, 'CONTENT_ADMIN')).body).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      unchangedCount: 2,
    });

    const topics = await db.vocabularyTopic.findMany({ where: { importSource: source } });
    expect(topics.map((entry) => entry.name).sort()).toEqual(['List 1', 'List 2']);
    expect(await db.vocabulary.count({ where: { topicId: manual.body.topicId } })).toBe(0);
    const topicId = topics.find((entry) => entry.name === 'List 1')!.id;
    const cards = await get(`vocabularies?topicId=${topicId}&keyword=responsible`);
    expect(cards.body.items).toMatchObject([word]);
    const vocabularyId = cards.body.items[0].vocabularyId;

    const change = { ...word, englishDefinition: 'someone who prepares accounts' };
    const revised = { ...body, lists: [{ name: 'List 1', words: [change] }, body.lists[1]] };
    expect((await post(path, revised, 'CONTENT_ADMIN', key)).body.code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
    expect((await post(path, revised, 'CONTENT_ADMIN')).body).toMatchObject({
      createdCount: 0,
      updatedCount: 1,
      unchangedCount: 1,
    });
    expect((await get(`vocabularies/${vocabularyId}`)).body).toMatchObject(change);
    expect(
      (await patch(`vocabularies/${vocabularyId}`, { englishDefinition: null })).body,
    ).toMatchObject({ englishDefinition: null, definition: word.definition });

    const adminTopicWords = `admin/vocabularies?topicId=${topicId}&size=1`;
    expect((await get(adminTopicWords, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [{ vocabularyId }],
      total: 1,
      totalPages: 1,
    });
    expect((await del(`vocabularies/${vocabularyId}`)).status).toBe(200);
    for (const list of [adminTopicWords, `${adminTopicWords}&keyword=accountant`]) {
      expect((await get(list, 'CONTENT_ADMIN')).body).toMatchObject({
        items: [],
        total: 0,
        totalPages: 0,
      });
    }
    const activeTopicId = topics.find((entry) => entry.name === 'List 2')!.id;
    expect(
      (await get('admin/vocabularies?keyword=accountant&size=1', 'CONTENT_ADMIN')).body,
    ).toMatchObject({ items: [{ topicId: activeTopicId }], total: 1, totalPages: 1 });
    expect((await get(`admin/vocabularies/${vocabularyId}`, 'CONTENT_ADMIN')).body).toMatchObject({
      vocabularyId,
      deletedAt: expect.any(String),
    });

    expect((await post(path, revised, 'CONTENT_ADMIN')).body).toMatchObject({
      createdCount: 0,
      updatedCount: 1,
      unchangedCount: 1,
    });
    expect((await get(`vocabularies/${vocabularyId}`)).body).toMatchObject(change);
  });
  it('keeps personal CRUD private to each learner and cascades only their private topic words', async () => {
    const prefix = 'Personal ' + randomUUID();
    const key = randomUUID();
    const created = await post('personal/vocabulary-topics', { topicName: prefix }, 'USER', key);
    expect(created.status).toBe(201);
    const topicId = created.body.topicId;
    expect(created.body).toMatchObject({ topicName: prefix, vocabularyCount: 0 });
    expect(created.body).not.toHaveProperty('userId');
    expect(
      (await post('personal/vocabulary-topics', { topicName: prefix }, 'USER', key)).body,
    ).toEqual(created.body);
    expect(
      (await post('personal/vocabulary-topics', { topicName: prefix + ' changed' }, 'USER', key))
        .status,
    ).toBe(409);
    const otherTopic = await post('personal/vocabulary-topics', { topicName: prefix }, 'OTHER');
    expect(otherTopic.status).toBe(201);
    expect(otherTopic.body.topicId).not.toBe(topicId);
    const ownWord = await post('personal/vocabularies', {
      topicId,
      word: 'Private word',
      definition: 'Private meaning',
      phonetic: '/word/',
    });
    const otherWord = await post(
      'personal/vocabularies',
      { topicId: otherTopic.body.topicId, word: 'Other private word', definition: 'Other meaning' },
      'OTHER',
    );
    expect(ownWord.status).toBe(201);
    expect(otherWord.status).toBe(201);
    expect(ownWord.body).toMatchObject({ topicId, audioUrl: null, imageUrl: null });
    const ownLesson = await post('personal/lessons', {
      lessonTitle: prefix,
      category: 'Personal',
      contentMarkdown: '# Private notes',
    });
    expect(ownLesson.status).toBe(201);
    expect(ownLesson.body.status).toBe('PRIVATE');
    const vocabularyId = ownWord.body.vocabularyId,
      lessonId = ownLesson.body.lessonId;
    for (const [path, body] of [
      [`vocabulary-topics/${topicId}`, { topicName: 'Stolen' }],
      [`vocabularies/${vocabularyId}`, { word: 'Stolen' }],
      [`lessons/${lessonId}`, { lessonTitle: 'Stolen' }],
    ] as const) {
      expect((await get('personal/' + path, 'OTHER')).status).toBe(404);
      expect(
        (
          await api()
            .patch('/api/v1/learning/personal/' + path)
            .auth(tokens.OTHER, { type: 'bearer' })
            .send(body)
        ).status,
      ).toBe(404);
      expect(
        (
          await api()
            .delete('/api/v1/learning/personal/' + path)
            .auth(tokens.OTHER, { type: 'bearer' })
        ).status,
      ).toBe(404);
    }
    expect(
      (
        await post(
          'personal/vocabularies',
          { topicId, word: 'Wrong owner', definition: 'No' },
          'OTHER',
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api()
          .patch('/api/v1/learning/personal/vocabularies/' + vocabularyId)
          .auth(tokens.USER, { type: 'bearer' })
          .send({ topicId: otherTopic.body.topicId })
      ).status,
    ).toBe(404);
    // The database also prevents a forged ownership link if a future code path bypasses the service.
    await expect(
      db.personalVocabulary.create({
        data: { userId: ids.OTHER, topicId, word: 'Forged', definition: 'No' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(
      (await get('personal/vocabulary-topics?keyword=' + encodeURIComponent(prefix))).body,
    ).toMatchObject({ total: 1, items: [{ topicId, vocabularyCount: 1 }] });
    expect(
      (await get('personal/vocabularies?topicId=' + topicId + '&keyword=meaning')).body,
    ).toMatchObject({ total: 1, items: [{ vocabularyId }] });
    expect(
      (await get('personal/lessons?category=Personal&keyword=' + encodeURIComponent(prefix))).body,
    ).toMatchObject({ total: 1, items: [{ lessonId, status: 'PRIVATE' }] });
    expect(
      (
        await get(
          'personal/vocabulary-topics?keyword=' + encodeURIComponent(prefix) + '&size=1&page=2',
        )
      ).body,
    ).toMatchObject({ total: 1, page: 2, size: 1, items: [] });
    const changedWord = await api()
      .patch('/api/v1/learning/personal/vocabularies/' + vocabularyId)
      .auth(tokens.USER, { type: 'bearer' })
      .send({ word: 'Renamed', phonetic: null, example: null });
    expect(changedWord.status).toBe(200);
    expect(changedWord.body).toMatchObject({
      word: 'Renamed',
      phonetic: null,
      example: null,
      definition: 'Private meaning',
    });
    expect(
      (
        await api()
          .patch('/api/v1/learning/personal/lessons/' + lessonId)
          .auth(tokens.USER, { type: 'bearer' })
          .send({ contentMarkdown: '# Edited privately' })
      ).body,
    ).toMatchObject({ contentMarkdown: '# Edited privately', status: 'PRIVATE' });
    expect(
      (
        await api()
          .patch('/api/v1/learning/personal/vocabulary-topics/' + topicId)
          .auth(tokens.USER, { type: 'bearer' })
          .send({ topicName: 'Renamed private topic' })
      ).status,
    ).toBe(200);
    const deleted = await api()
      .delete('/api/v1/learning/personal/vocabulary-topics/' + topicId)
      .auth(tokens.USER, { type: 'bearer' });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({ id: topicId, deleted: true, success: true });
    expect((await get('personal/vocabularies/' + vocabularyId)).status).toBe(404);
    expect(
      (await get('personal/vocabularies/' + otherWord.body.vocabularyId, 'OTHER')).status,
    ).toBe(200);
    expect(
      (
        await api()
          .delete('/api/v1/learning/personal/vocabularies/' + otherWord.body.vocabularyId)
          .auth(tokens.OTHER, { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .delete('/api/v1/learning/personal/lessons/' + lessonId)
          .auth(tokens.USER, { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect((await get('personal/lessons/' + lessonId)).status).toBe(404);
    // Shared catalog lookups cannot expose private notes and retain existing content.
    expect((await get('lessons/' + lessonId)).status).toBe(404);
    expect((await get('vocabulary-topics/' + topic)).status).toBe(200);
  });
  it('rejects personal ownership injection, invalid patches and invalid queries through HTTP', async () => {
    const created = await post('personal/vocabulary-topics', {
      topicName: 'Validation ' + randomUUID(),
    });
    expect(created.status).toBe(201);
    const topicId = created.body.topicId;
    expect(
      (await post('personal/vocabulary-topics', { topicName: 'Forged', userId: ids.OTHER })).status,
    ).toBe(400);
    expect(
      (
        await post('personal/lessons', {
          lessonTitle: 'No',
          category: 'Notes',
          contentMarkdown: ' ',
          status: 'PUBLISHED',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post('personal/vocabularies', {
          topicId,
          word: 'X',
          definition: 'Y',
          ownerId: ids.OTHER,
        })
      ).status,
    ).toBe(400);
    for (const body of [
      {},
      { topicName: null },
      { topicName: ' ' },
      { topicName: 'x'.repeat(256) },
      { userId: ids.OTHER },
    ]) {
      expect(
        (
          await api()
            .patch('/api/v1/learning/personal/vocabulary-topics/' + topicId)
            .auth(tokens.USER, { type: 'bearer' })
            .send(body)
        ).status,
      ).toBe(400);
    }
    expect((await get('personal/vocabulary-topics?userId=' + ids.OTHER)).status).toBe(400);
    expect((await get('personal/vocabulary-topics?size=51')).status).toBe(400);
    expect((await get('personal/vocabulary-topics/not-a-uuid')).status).toBe(400);
    expect((await api().get('/api/v1/learning/personal/vocabulary-topics')).status).toBe(401);
    expect((await get('personal/vocabulary-topics/' + topicId)).body.topicName).toMatch(
      /^Validation /,
    );
    await api()
      .delete('/api/v1/learning/personal/vocabulary-topics/' + topicId)
      .auth(tokens.USER, { type: 'bearer' });
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
    const adminLessons = `admin/lessons?size=1&category=TENSE&keyword=${encodeURIComponent(before.lesson.lessonTitle)}`;
    expect((await get(`${adminLessons}&status=DRAFT`, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [{ lessonId, status: 'DRAFT' }],
      total: 1,
      totalPages: 1,
    });
    expect((await get('lessons/' + lessonId)).status).toBe(404);
    expect((await patch('lessons/' + lessonId, { status: 'PUBLISHED' })).status).toBe(200);
    expect((await get('lessons/' + lessonId)).body.lessonTitle).toBe(before.lesson.lessonTitle);
    expect((await get(adminLessons, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [{ lessonId, status: 'PUBLISHED' }],
      total: 1,
      totalPages: 1,
    });
    expect((await del('lessons/' + lessonId)).status).toBe(200);
    expect((await get(adminLessons, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
    });
    expect((await get(`${adminLessons}&status=ARCHIVED`, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [{ lessonId, status: 'ARCHIVED', deletedAt: expect.any(String) }],
      total: 1,
    });
    expect((await get('admin/lessons/' + lessonId, 'CONTENT_ADMIN')).body).toMatchObject({
      lessonId,
      deletedAt: expect.any(String),
    });
    expect((await get('lessons/' + lessonId)).status).toBe(404);
    await db.grammarLesson.update({ where: { id: lessonId }, data: { deletedAt: null } });
    expect((await get(adminLessons, 'CONTENT_ADMIN')).body).toMatchObject({
      items: [],
      total: 0,
    });
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
    // The session snapshot test soft-deletes a shared card selected by session order.
    // Own this vocabulary so media checks cannot depend on that earlier selection.
    const media = await createTopic(1),
      id = media.cards[0].vocabularyId,
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
    expect((await del('vocabularies/' + id)).status).toBe(200);
    expect(
      (
        await post(
          path + 'presign',
          { kind: 'IMAGE', contentType: 'image/png', sizeBytes: 3 },
          'CONTENT_ADMIN',
        )
      ).status,
    ).toBe(404);
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
  it('schedules flashcards individually as a topic drops from four due cards to none', async () => {
    const t = await createTopic(4);
    const emptyTopic = await createTopic(0);
    for (const card of t.cards) {
      const first = await post('flashcards/' + card.vocabularyId + '/review', {
        operationId: randomUUID(),
        baseEntityRevision: '0',
        quality: 5,
      });
      expect(first.status).toBe(200);
    }
    await db.userVocabularyProgress.updateMany({
      where: { userId: ids.USER, vocabularyId: { in: t.cards.map((card) => card.vocabularyId) } },
      data: { nextReviewDate: new Date(0) },
    });

    const path = 'review-today?topicId=' + t.topic;
    const limited = await get(path + '&size=2');
    expect(limited.status).toBe(200);
    expect(limited.body).toMatchObject({ total: 4, size: 2, totalPages: 2 });
    expect(limited.body.items).toHaveLength(2);
    expect((await get('review-today?topicId=' + emptyTopic.topic)).body).toMatchObject({
      total: 0,
      items: [],
    });

    for (let remaining = 4; remaining > 0; remaining--) {
      const due = await get(path);
      expect(due.status).toBe(200);
      expect(due.body.items).toHaveLength(remaining);
      const [card] = due.body.items;
      const reviewPath = 'flashcards/' + card.entityId + '/review';
      const body = {
        operationId: randomUUID(),
        baseEntityRevision: card.revision,
        quality: 5,
      };
      const review = await post(reviewPath, body);
      expect(review.status).toBe(200);
      expect(review.body.progress).toMatchObject([
        {
          entityId: card.entityId,
          revision: '2',
          state: { repetitionNumber: 2, intervalDays: 6, nextReviewDate: expect.any(String) },
        },
      ]);
      if (remaining === 1) expect((await post(reviewPath, body)).body).toEqual(review.body);
    }
    expect((await get(path)).body).toMatchObject({ total: 0, items: [] });
  });
  it('starts shared flashcard and quiz sessions with each due count from four down to one', async () => {
    const { topic: topicId, cards: words } = await createTopic(4);
    for (const { vocabularyId } of words) {
      const response = await post(`flashcards/${vocabularyId}/review`, {
        operationId: randomUUID(),
        baseEntityRevision: '0',
        quality: 5,
      });
      expect(response.status).toBe(200);
    }
    await db.userVocabularyProgress.updateMany({
      where: { userId: ids.USER, vocabularyId: { in: words.map((word) => word.vocabularyId) } },
      data: { nextReviewDate: new Date(0) },
    });

    const start = { topicId, scope: 'SHARED', mode: 'REVIEW', limit: 8 };
    for (let remaining = 4; remaining > 0; remaining--) {
      const response = await post('flashcard-sessions', start);
      expect(response.status).toBe(201);
      const round = response.body;
      validateRequest('FlashcardSession', round);
      expect(round.scope).toBe('SHARED');
      expect(round.vocabularies).toHaveLength(remaining);
      expect(round.quiz).toHaveLength(remaining);
      const body = submission(round, 5, true);
      const path = `flashcard-sessions/${round.sessionId}`;
      expect((await post(`${path}/reviews`, { reviews: body.reviews.slice(0, 1) })).status).toBe(200);
      expect((await get(`review-today?topicId=${topicId}`)).body.total).toBe(remaining - 1);
      if (remaining === 1) {
        const result = await post(`${path}/submit`, body);
        expect(result.status).toBe(200);
        validateRequest('FlashcardSessionResult', result.body);
        expect(result.body).toMatchObject({ quizScore: 1, quizTotal: 1 });
      } else {
        expect((await post(`${path}/cancel`, undefined)).status).toBe(200);
      }
    }
    const empty = await post('flashcard-sessions', start);
    expect(empty.status).toBe(409);
    expect(empty.body.code).toBe('NO_ELIGIBLE_FLASHCARDS');
    const progress = await db.userVocabularyProgress.findMany({
      where: { userId: ids.USER, vocabularyId: { in: words.map((word) => word.vocabularyId) } },
    });
    expect(progress).toHaveLength(4);
    for (const entry of progress)
      expect(entry).toMatchObject({ revision: 2n, repetitionNumber: 2, intervalDays: 6 });
  });
  it('draws different Vietnamese distractors from the active catalog across quiz questions', async () => {
    const prefix = randomUUID();
    const definitions = Array.from({ length: 21 }, (_, index) => `Nghĩa ${index} ${prefix}`);
    const { topic: topicId, cards: words } = await createTopic(definitions.length, definitions);
    const response = await post('flashcard-sessions', {
      topicId,
      scope: 'SHARED',
      mode: 'NEW',
      limit: 5,
    });
    expect(response.status).toBe(201);
    validateRequest('FlashcardSession', response.body);

    const meaningById = new Map(words.map((word) => [word.vocabularyId, word.definition]));
    for (const round of [response.body, await session(topicId)]) {
      const used = new Set<string>();
      expect(round.quiz).toHaveLength(5);
      for (const question of round.quiz) {
        const answers = question.options.map((option: { text: string }) => option.text);
        const correct = meaningById.get(question.vocabularyId);
        expect(answers).toHaveLength(4);
        expect(new Set(answers).size).toBe(4);
        expect(answers).toContain(correct);
        for (const answer of answers) {
          expect(definitions).toContain(answer);
          if (answer !== correct) {
            expect(used.has(answer)).toBe(false);
            used.add(answer);
          }
        }
      }
      expect(used.size).toBe(15);
    }
    expect((await get(`flashcard-sessions/${response.body.sessionId}`)).body).toEqual(
      response.body,
    );
  });
  it('limits personal flashcard rounds and saves each private SM-2 rating before grading the quiz', async () => {
    const topicResponse = await post('personal/vocabulary-topics', {
      topicName: 'Private flashcards ' + randomUUID(),
    });
    expect(topicResponse.status).toBe(201);
    const { topicId } = topicResponse.body;
    for (const word of ['private first', 'private second', 'private third']) {
      const created = await post('personal/vocabularies', {
        topicId,
        word,
        definition: 'Shared meaning',
      });
      expect(created.status).toBe(201);
    }
    const start = { topicId, scope: 'PERSONAL', mode: 'NEW', limit: 2 };
    expect((await post('flashcard-sessions', start, 'OTHER')).status).toBe(404);
    const startKey = randomUUID();
    const response = await post('flashcard-sessions', start, 'USER', startKey);
    expect(response.status).toBe(201);
    const round = response.body;
    validateRequest('FlashcardSession', round);
    expect((await post('flashcard-sessions', start, 'USER', startKey)).body).toEqual(round);
    expect(round.scope).toBe('PERSONAL');
    expect(round.vocabularies).toHaveLength(2);
    expect(round.quiz).toHaveLength(2);
    const sharedDefinitions = new Set(
      (
        await db.vocabulary.findMany({
          where: { deletedAt: null, topic: { deletedAt: null } },
          select: { definition: true },
        })
      ).map(({ definition }) => definition),
    );
    for (const question of round.quiz) {
      expect(question.direction).toBe('WORD_TO_MEANING');
      expect(question.options).toHaveLength(4);
      expect(question).not.toHaveProperty('correctOption');
      expect(question.options.map((option: { text: string }) => option.text)).toContain(
        'Shared meaning',
      );
      for (const option of question.options) {
        if (option.text !== 'Shared meaning') expect(sharedDefinitions.has(option.text)).toBe(true);
      }
    }
    const path = `flashcard-sessions/${round.sessionId}`;
    const body = submission(round, 5, false);
    const [first, second] = body.reviews;
    const review = { reviews: [first] };
    expect((await get(path, 'OTHER')).status).toBe(404);
    expect((await post(`${path}/reviews`, review, 'OTHER')).status).toBe(404);
    expect((await post(`${path}/reviews`, review)).status).toBe(200);
    expect((await post(`${path}/reviews`, review)).status).toBe(200);
    expect((await get(path)).body.reviews).toMatchObject([first]);
    const progress = () =>
      db.userPersonalVocabularyProgress.findMany({
        where: { userId: ids.USER, vocabulary: { topicId } },
      });
    expect(await progress()).toMatchObject([
      { vocabularyId: first.vocabularyId, quality: 5, revision: 1n, nextReviewDate: expect.any(Date) },
    ]);
    expect((await post(`${path}/reviews`, { reviews: [{ ...first, quality: 1 }] })).status).toBe(409);
    expect((await post(`${path}/submit`, body)).status).toBe(409);
    expect((await post(`${path}/reviews`, { reviews: [second] })).status).toBe(200);
    expect(await progress()).toHaveLength(2);

    const result = await post(`${path}/submit`, body);
    expect(result.status).toBe(200);
    validateRequest('FlashcardSessionResult', result.body);
    expect(result.body).toMatchObject({ quizScore: 0, quizTotal: 2 });
    expect((await post(`${path}/submit`, body)).body).toEqual(result.body);
    for (const entry of await progress())
      expect(entry).toMatchObject({ quality: 5, revision: 1n, repetitionNumber: 1, intervalDays: 1 });

    const reviewStart = { ...start, mode: 'REVIEW', limit: 1 };
    expect((await post('flashcard-sessions', reviewStart)).body.code).toBe('NO_ELIGIBLE_FLASHCARDS');
    await db.userPersonalVocabularyProgress.updateMany({
      where: { userId: ids.USER, vocabularyId: first.vocabularyId },
      data: { nextReviewDate: new Date(0) },
    });
    const due = await post('flashcard-sessions', reviewStart);
    expect(due.status).toBe(201);
    expect(due.body.vocabularies).toMatchObject([{ vocabularyId: first.vocabularyId }]);
    expect(due.body.quiz).toHaveLength(1);
    const saved = await post(`flashcard-sessions/${due.body.sessionId}/reviews`, { reviews: [first] });
    expect(saved.status).toBe(200);
    expect(await progress()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vocabularyId: first.vocabularyId,
          revision: 2n,
          repetitionNumber: 2,
          intervalDays: 6,
        }),
      ]),
    );
    expect((await post('flashcard-sessions', reviewStart)).body.code).toBe('NO_ELIGIBLE_FLASHCARDS');

    const removedWord = await api()
      .delete(`/api/v1/learning/personal/vocabularies/${first.vocabularyId}`)
      .auth(tokens.USER, { type: 'bearer' });
    expect(removedWord.status).toBe(200);
    expect((await get(path)).status).toBe(404);
    expect((await post(`${path}/submit`, body)).status).toBe(404);
    expect((await post('flashcard-sessions', start, 'USER', startKey)).status).toBe(404);
    expect(await progress()).toMatchObject([{ vocabularyId: second.vocabularyId }]);

    const lastRound = await post('flashcard-sessions', start);
    expect(lastRound.status).toBe(201);
    expect(lastRound.body.vocabularies).toHaveLength(1);
    const removedTopic = await api()
      .delete(`/api/v1/learning/personal/vocabulary-topics/${topicId}`)
      .auth(tokens.USER, { type: 'bearer' });
    expect(removedTopic.status).toBe(200);
    expect((await get(`flashcard-sessions/${lastRound.body.sessionId}`)).status).toBe(404);
    expect(await progress()).toEqual([]);
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
    expect(summary.body).toMatchObject({ grammarLessonsCompleted: 1, sessionsCompleted: 2 });
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
