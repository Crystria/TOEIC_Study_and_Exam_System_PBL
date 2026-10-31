import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { AddressInfo } from 'node:net';
import {
  ClientGrpc,
  ClientProxyFactory,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RedisService } from '@toeic/common';
import { Client as EsClient } from '@elastic/elasticsearch';
import { Client as MinioClient } from 'minio';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureHttp } from './main';
import { PrismaService } from './prisma/prisma.service';
import { QuestionBankGrpcController } from './grpc/question-bank.grpc.controller';
import { OutboxRelay } from './modules/outbox/outbox-relay';
import { SearchService } from './modules/search/search.service';

const integration = process.env.P2_INTEGRATION_DATABASE_URL ? describe : describe.skip;
integration('Question Bank with PostgreSQL, RabbitMQ, MinIO and Elasticsearch', () => {
  let app: INestApplication, prisma: PrismaService, admin: string, user: string;
  let grpcClient: ClientGrpc & { close(): void };
  let grpcService: {
    getQuestions(data: {
      question_ids: string[];
    }): Observable<Awaited<ReturnType<QuestionBankGrpcController['getQuestions']>>>;
    getAnswerKey(data: {
      question_ids: string[];
    }): Observable<Awaited<ReturnType<QuestionBankGrpcController['getAnswerKey']>>>;
  };
  const questionIds = new Set<string>(),
    groupIds = new Set<string>(),
    objects = new Set<string>();
  const es = new EsClient({ node: 'http://localhost:19200', requestTimeout: 2000, maxRetries: 0 });
  const minio = new MinioClient({
    endPoint: 'localhost',
    port: 19000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
  });
  const marker = `p2-${randomUUID()}`;
  const options = ['A', 'B', 'C', 'D'].map((optionCode) => ({
    optionCode,
    optionText: `Option ${optionCode}`,
  }));
  const question = (part = 5) => ({
    part,
    type: 'SINGLE_CHOICE',
    questionText: `${marker} Choose a word`,
    difficulty: 'EASY',
    correctOption: 'A',
    options: part === 2 ? options.slice(0, 3) : options,
  });
  async function eventually(check: () => Promise<void>) {
    let last: unknown;
    for (let i = 0; i < 40; i++) {
      try {
        await check();
        return;
      } catch (error) {
        last = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw last;
  }
  const api = () => request(app.getHttpServer());
  async function createQuestion(part = 5) {
    const response = await api()
      .post('/api/v1/questions')
      .auth(admin, { type: 'bearer' })
      .send(question(part));
    expect(response.status).toBe(201);
    questionIds.add(response.body.questionId);
    return response.body as { questionId: string; isComplete: boolean };
  }
  async function createGroup(part = 7) {
    const response = await api()
      .post('/api/v1/question-groups')
      .auth(admin, { type: 'bearer' })
      .send({
        part,
        type: 'PASSAGE',
        transcript: 'Group transcript',
        passageText: `${marker} Passage [[1]] [[2]]`,
        questions: [
          { ...question(part), positionInGroup: 1 },
          { ...question(part), positionInGroup: 2 },
        ],
      });
    expect(response.status).toBe(201);
    groupIds.add(response.body.groupId);
    response.body.questionIds.forEach((id: string) => questionIds.add(id));
    return response.body as { groupId: string; questionIds: string[]; isComplete: boolean };
  }
  beforeAll(async () => {
    // This suite requires an explicit, separate verification database.
    const url = process.env.P2_INTEGRATION_DATABASE_URL!;
    if (!new URL(url).pathname.includes('p2_verify'))
      throw new Error('Integration tests require a dedicated p2_verify database');
    prisma = new PrismaService({ datasourceUrl: url });
    await prisma.$connect();
    if (!(await minio.bucketExists('toeic-media'))) await minio.makeBucket('toeic-media');
    const redis = new RedisService({
      get: () => 'redis://127.0.0.1:7379',
    } as unknown as ConfigService);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .compile();
    app = module.createNestApplication();
    app.get(ConfigService).set('QUESTION_SEARCH_QUEUE', 'question-bank-search-p2-tests');
    configureHttp(app);
    const portServer = createServer();
    await new Promise<void>((resolve) => portServer.listen(0, '127.0.0.1', resolve));
    const grpcUrl = `127.0.0.1:${(portServer.address() as AddressInfo).port}`;
    await new Promise<void>((resolve) => portServer.close(() => resolve()));
    const grpcOptions = {
      package: 'toeic.questionbank.v1',
      protoPath: join(__dirname, '../../../packages/contracts/proto/question_bank.proto'),
      url: grpcUrl,
      loader: { keepCase: true, defaults: true, arrays: true },
    };
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: grpcOptions,
    });
    await app.startAllMicroservices();
    grpcClient = ClientProxyFactory.create({ transport: Transport.GRPC, options: grpcOptions });
    grpcService = grpcClient.getService('QuestionBankService');
    await app.init();
    const jwt = app.get(JwtService),
      config = app.get(ConfigService);
    const sign = (roles: string[]) =>
      jwt.sign(
        { sub: randomUUID(), type: 'access', roles },
        {
          expiresIn: 300,
          issuer: config.get<string>('JWT_ISSUER') ?? 'toeic-auth',
          audience: config.get<string>('JWT_AUDIENCE') ?? 'toeic-api',
        },
      );
    admin = sign(['SYSTEM_ADMIN']);
    user = sign(['USER']);
  }, 30_000);
  afterAll(async () => {
    if (app) {
      grpcClient?.close();
      await app.get(OutboxRelay).onModuleDestroy();
      await prisma.question.deleteMany({ where: { id: { in: [...questionIds] } } });
      await prisma.questionGroup.deleteMany({ where: { id: { in: [...groupIds] } } });
      await prisma.tag.deleteMany({ where: { name: marker, questions: { none: {} } } });
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: [...questionIds, ...groupIds] } },
      });
      if (questionIds.size)
        await es.deleteByQuery({
          index: 'questions-v2',
          query: { ids: { values: [...questionIds] } },
          conflicts: 'proceed',
          refresh: true,
        });
      if (objects.size) await minio.removeObjects('toeic-media', [...objects]);
      await app.close();
    } else await prisma?.$disconnect();
    await es.close();
  }, 30_000);

  it('enforces JWT/roles, rejects invalid Part 2 options and hides answers from USER', async () => {
    expect((await api().get('/api/v1/questions')).status).toBe(401);
    expect(
      (await api().post('/api/v1/questions').auth(user, { type: 'bearer' }).send(question()))
        .status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/api/v1/questions')
          .auth(admin, { type: 'bearer' })
          .send({ ...question(2), options })
      ).status,
    ).toBe(400);
    const q = await createQuestion();
    const response = await api()
      .get(`/api/v1/questions/${q.questionId}`)
      .auth(user, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.correctOption).toBeUndefined();
    expect(response.body.options.every((o: object) => !('isCorrect' in o))).toBe(true);
    const adminResponse = await api()
      .get(`/api/v1/questions/${q.questionId}`)
      .auth(admin, { type: 'bearer' });
    expect(adminResponse.body.correctOption).toBe('A');
    const invalidJwt = app
      .get(JwtService)
      .sign(
        { sub: randomUUID(), type: 'refresh', roles: ['SYSTEM_ADMIN'] },
        { expiresIn: 300, issuer: 'toeic-auth', audience: 'toeic-api' },
      );
    expect((await api().get('/api/v1/questions').auth(invalidJwt, { type: 'bearer' })).status).toBe(
      401,
    );
  });
  it('updates tags and options in one transaction with an outbox event', async () => {
    const q = await createQuestion();
    const response = await api()
      .patch(`/api/v1/questions/${q.questionId}`)
      .auth(admin, { type: 'bearer' })
      .send({ tags: [marker], correctOption: 'B', options });
    expect(response.status).toBe(200);
    expect(response.body.tags).toEqual([marker]);
    expect(response.body.correctOption).toBe('B');
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: q.questionId, eventType: 'QuestionUpdatedEvent' },
      }),
    ).toBe(1);
    const invalid = await api()
      .patch(`/api/v1/questions/${q.questionId}`)
      .auth(admin, { type: 'bearer' })
      .send({ correctOption: 'Z', tags: ['should-not-save'] });
    expect(invalid.status).toBe(400);
    expect(
      (
        await prisma.question.findUniqueOrThrow({
          where: { id: q.questionId },
          include: { tags: { include: { tag: true } } },
        })
      ).tags.map((t) => t.tag.name),
    ).toEqual([marker]);
  });
  it('validates groups, reorders without unique collisions and rolls back invalid membership', async () => {
    const empty = await api()
      .post('/api/v1/question-groups')
      .auth(admin, { type: 'bearer' })
      .send({ part: 7, type: 'PASSAGE', passageText: 'Passage', questions: [] });
    expect(empty.status).toBe(400);
    const g = await createGroup();
    expect(g.isComplete).toBe(true);
    const reversed = [...g.questionIds].reverse();
    const reordered = await api()
      .patch(`/api/v1/question-groups/${g.groupId}`)
      .auth(admin, { type: 'bearer' })
      .send({ questionOrder: reversed });
    expect(reordered.status).toBe(200);
    expect(reordered.body.questionIds).toEqual(reversed);
    const bad = await api()
      .post('/api/v1/questions')
      .auth(admin, { type: 'bearer' })
      .send({ ...question(3), groupId: g.groupId, positionInGroup: 3 });
    expect(bad.status).toBe(400);
    const duplicate = await api()
      .post('/api/v1/questions')
      .auth(admin, { type: 'bearer' })
      .send({ ...question(7), groupId: g.groupId, positionInGroup: 1 });
    expect(duplicate.status).toBe(400);
    const g6 = await createGroup(6);
    const mismatch = await api()
      .patch(`/api/v1/question-groups/${g6.groupId}`)
      .auth(admin, { type: 'bearer' })
      .send({ passageText: 'Missing [[9]]' });
    expect(mismatch.status).toBe(400);
    const changed = await api()
      .patch(`/api/v1/question-groups/${g.groupId}`)
      .auth(admin, { type: 'bearer' })
      .send({
        assets: [
          { kind: 'TEXT', content: 'First passage', orderNo: 2 },
          { kind: 'TEXT', content: 'Second passage', orderNo: 1 },
        ],
      });
    expect(changed.body.assets.map((a: { orderNo: number }) => a.orderNo)).toEqual([1, 2]);
  });
  it('presigns media, rejects invalid content type and verifies uploaded objects before saving', async () => {
    const q = await createQuestion(2);
    const path = `/api/v1/questions/${q.questionId}`;
    const badType = await api()
      .post(`${path}/media/presign`)
      .auth(admin, { type: 'bearer' })
      .send({ fileName: 'audio.mp3', mediaType: 'AUDIO', contentType: 'image/png' });
    expect(badType.status).toBe(400);
    const presigned = await api()
      .post(`${path}/media/presign`)
      .auth(admin, { type: 'bearer' })
      .send({ fileName: 'audio.mp3', mediaType: 'AUDIO', contentType: 'audio/mpeg' });
    expect(presigned.status).toBe(201);
    expect(presigned.body.expiresIn).toBe(300);
    const key = presigned.body.storageKey as string;
    objects.add(key);
    expect(
      (
        await api()
          .patch(path)
          .auth(admin, { type: 'bearer' })
          .send({ audioKey: key, transcript: 'Transcript' })
      ).status,
    ).toBe(400);
    const upload = await fetch(presigned.body.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: Buffer.from('test audio'),
    });
    expect(upload.status).toBe(200);
    const saved = await api()
      .patch(path)
      .auth(admin, { type: 'bearer' })
      .send({ audioKey: key, transcript: 'Transcript' });
    expect(saved.status).toBe(200);
    expect(saved.body.isComplete).toBe(true);
    expect(saved.body.audioUrl).toContain(key);
    const nonce = randomUUID();
    const repeated = () =>
      api()
        .post(`${path}/media/presign`)
        .auth(admin, { type: 'bearer' })
        .set('Idempotency-Key', nonce)
        .send({ fileName: 'audio.mp3', mediaType: 'AUDIO', contentType: 'audio/mpeg' });
    const first = await repeated(),
      second = await repeated();
    expect(first.status).toBe(201);
    expect(second.body.storageKey).toBe(first.body.storageKey);
    const conflict = await api()
      .post(`${path}/media/presign`)
      .auth(admin, { type: 'bearer' })
      .set('Idempotency-Key', nonce)
      .send({ fileName: 'different.mp3', mediaType: 'AUDIO', contentType: 'audio/mpeg' });
    expect(conflict.status).toBe(409);
    const g = await createGroup(3);
    expect(g.isComplete).toBe(false);
    const groupMedia = await api()
      .post(`/api/v1/question-groups/${g.groupId}/media/presign`)
      .auth(admin, { type: 'bearer' })
      .send({ fileName: 'group.mp3', mediaType: 'AUDIO', contentType: 'audio/mpeg' });
    const groupKey = groupMedia.body.storageKey as string;
    objects.add(groupKey);
    await minio.putObject('toeic-media', groupKey, Buffer.from('group audio'), undefined, {
      'Content-Type': 'audio/mpeg',
    });
    const ready = await api()
      .patch(`/api/v1/question-groups/${g.groupId}`)
      .auth(admin, { type: 'bearer' })
      .send({ audioKey: groupKey });
    expect(ready.status).toBe(200);
    expect(ready.body.isComplete).toBe(true);
  });
  it('rejects objects belonging to another resource and uploads with a false MIME type', async () => {
    const q = await createQuestion(1),
      other = await createQuestion(1);
    const signed = await api()
      .post(`/api/v1/questions/${q.questionId}/media/presign`)
      .auth(admin, { type: 'bearer' })
      .send({ fileName: 'image.png', mediaType: 'IMAGE', contentType: 'image/png' });
    const key = signed.body.storageKey as string;
    objects.add(key);
    await minio.putObject('toeic-media', key, Buffer.from('invalid mime'), undefined, {
      'Content-Type': 'text/plain',
    });
    expect(
      (
        await api()
          .patch(`/api/v1/questions/${q.questionId}`)
          .auth(admin, { type: 'bearer' })
          .send({ imageKey: key })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .patch(`/api/v1/questions/${other.questionId}`)
          .auth(admin, { type: 'bearer' })
          .send({ imageKey: key })
      ).status,
    ).toBe(400);
  });
  it('serves active-only gRPC data with deduplicated groups/missing IDs and cascades archive', async () => {
    const g = await createGroup(),
      missing = randomUUID();
    const response = await firstValueFrom(
      grpcService.getQuestions({ question_ids: [...g.questionIds, missing] }),
    );
    expect(response.groups).toHaveLength(1);
    expect(response.groups[0].question_ids).toEqual(expect.arrayContaining(g.questionIds));
    expect(response.missing_ids).toEqual([missing]);
    expect(response.questions.every((q) => q.is_complete)).toBe(true);
    expect(JSON.stringify(response)).not.toContain('correct_option');
    expect(
      (
        await firstValueFrom(
          grpcService.getAnswerKey({ question_ids: [...g.questionIds, missing] }),
        )
      ).answers,
    ).toHaveLength(2);
    expect(
      (await api().delete(`/api/v1/question-groups/${g.groupId}`).auth(admin, { type: 'bearer' }))
        .status,
    ).toBe(200);
    expect(await prisma.question.count({ where: { groupId: g.groupId, deletedAt: null } })).toBe(0);
    expect(
      (
        await firstValueFrom(grpcService.getQuestions({ question_ids: g.questionIds }))
      ).missing_ids.sort(),
    ).toEqual([...g.questionIds].sort());
    expect(
      (await firstValueFrom(grpcService.getAnswerKey({ question_ids: g.questionIds }))).answers,
    ).toHaveLength(0);
  });
  it('publishes outbox events and indexes full group content, then removes archived children from search', async () => {
    const g = await createGroup();
    const word = `groupword${randomUUID().replace(/-/g, '')}`;
    await api()
      .patch(`/api/v1/question-groups/${g.groupId}`)
      .auth(admin, { type: 'bearer' })
      .send({ passageText: word });
    await eventually(async () => {
      await es.indices.refresh({ index: 'questions-v2' });
      const result = await api()
        .get('/api/v1/questions')
        .auth(user, { type: 'bearer' })
        .query({ keyword: word, groupId: g.groupId });
      expect(result.status).toBe(200);
      expect(result.body.total).toBe(2);
      expect(result.body.items).toHaveLength(2);
      expect(JSON.stringify(result.body)).not.toContain('correctOption');
    });
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: g.groupId, publishedAt: { not: null } },
      }),
    ).toBeGreaterThan(0);
    await api().delete(`/api/v1/question-groups/${g.groupId}`).auth(admin, { type: 'bearer' });
    await eventually(async () => {
      await es.indices.refresh({ index: 'questions-v2' });
      const found = await app
        .get(SearchService)
        .search({ keyword: word, groupId: g.groupId, page: 1, size: 20 });
      expect(found.total).toBe(0);
      expect(found.items).toHaveLength(0);
    });
  }, 25_000);
  it('falls back to PostgreSQL filtering and group text when Elasticsearch is unavailable', async () => {
    const g = await createGroup();
    const search = app.get(SearchService);
    const failing = jest
      .spyOn(search['client'], 'search')
      .mockRejectedValue(new Error('ES offline'));
    try {
      const response = await api()
        .get('/api/v1/questions')
        .auth(user, { type: 'bearer' })
        .query({ groupId: g.groupId, keyword: marker, size: 1 });
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.total).toBe(2);
      expect(response.body.totalPages).toBe(2);
    } finally {
      failing.mockRestore();
    }
  });
});
