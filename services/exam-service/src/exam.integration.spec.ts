import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createServer, AddressInfo } from 'node:net';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConsumedMessage, MessagingService, RedisService } from '@toeic/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureHttp } from './main';
import { PrismaService } from './prisma/prisma.service';
import { QUESTION_BANK_CLIENT, QuestionBankClient } from './grpc/question-bank.client';
import { AttemptsService } from './modules/attempts/attempts.service';
import { DraftStore } from './modules/attempts/draft.store';
import { ExpiryJob } from './modules/attempts/expiry.job';
import { ExamOutboxRelay } from './modules/outbox/outbox-relay';
import { fullFixture } from './test-fixtures';
import { PrismaService as QbPrisma } from '../../question-bank-service/src/prisma/prisma.service';
import { QuestionsService } from '../../question-bank-service/src/modules/questions/questions.service';
import { QuestionBankGrpcController } from '../../question-bank-service/src/grpc/question-bank.grpc.controller';
import { SearchService } from '../../question-bank-service/src/modules/search/search.service';
import { MediaService } from '../../question-bank-service/src/modules/media/media.service';
import { PrismaService as AnalyticsPrisma } from '../../analytics-service/src/prisma/prisma.service';
import { EventsConsumer } from '../../analytics-service/src/modules/analytics/events.consumer';

const integration = process.env.P3_EXAM_DATABASE_URL ? describe : describe.skip;
integration('Exam Full/Part workflow with real PostgreSQL/Redis/gRPC/RabbitMQ/Analytics', () => {
  let app: INestApplication,
    qbApp: INestApplication,
    db: PrismaService,
    qb: QbPrisma,
    analytics: AnalyticsPrisma,
    redis: RedisService;
  let testId: string, admin: string, owner: string;
  const users = new Set<string>(),
    tests = new Set<string>(),
    data = fullFixture();
  const createdDraftIds = new Set<string>();
  const syntheticEventIds = new Set<string>();
  const fixtureIds = data.items.map((q) => q.questionId);
  const api = () => request(app.getHttpServer());
  function token(roles = ['USER']) {
    const id = randomUUID();
    users.add(id);
    const config = app.get(ConfigService);
    return {
      id,
      jwt: app
        .get(JwtService)
        .sign(
          { sub: id, type: 'access', roles },
          {
            expiresIn: 1800,
            issuer: config.get<string>('JWT_ISSUER') ?? 'toeic-auth',
            audience: config.get<string>('JWT_AUDIENCE') ?? 'toeic-api',
          },
        ),
    };
  }
  async function eventually(check: () => Promise<void>) {
    let last: unknown;
    for (let i = 0; i < 60; i++) {
      try {
        await check();
        return;
      } catch (error) {
        last = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw last;
  }
  async function part(parts = [5], jwt = owner, key?: string) {
    let call = api().post(`/api/v1/tests/${testId}/part-attempts`).auth(jwt, { type: 'bearer' });
    if (key) call = call.set('Idempotency-Key', key);
    const response = await call.send({ parts, durationSeconds: 300 });
    expect(response.status).toBe(201);
    createdDraftIds.add(response.body.attemptId);
    return response.body as {
      attemptId: string;
      questions: { questionId: string; part: number; questionText: string }[];
      mode: string;
      score: number | null;
      totalQuestions: number;
    };
  }
  async function submit(
    id: string,
    jwt = owner,
    answers: { questionId: string; selectedOption: string | null }[] = [],
  ) {
    return api()
      .post(`/api/v1/attempts/${id}/submit`)
      .auth(jwt, { type: 'bearer' })
      .send({ answers });
  }
  beforeAll(async () => {
    for (const name of [
      'P3_EXAM_DATABASE_URL',
      'P3_QUESTION_DATABASE_URL',
      'P3_ANALYTICS_DATABASE_URL',
    ]) {
      if (!process.env[name] || !new URL(process.env[name]!).pathname.includes('p3_verify'))
        throw new Error('P3 integration requires dedicated p3_verify databases');
    }
    db = new PrismaService({ datasourceUrl: process.env.P3_EXAM_DATABASE_URL });
    qb = new QbPrisma({ datasourceUrl: process.env.P3_QUESTION_DATABASE_URL });
    analytics = new AnalyticsPrisma({ datasourceUrl: process.env.P3_ANALYTICS_DATABASE_URL });
    await Promise.all([db.$connect(), qb.$connect(), analytics.$connect()]);
    await qb.questionGroup.createMany({
      data: data.bundle.groups.map((g) => ({
        id: g.group_id,
        part: g.part,
        type: g.type,
        instruction: g.instruction,
        audioKey: g.audio_key || null,
        transcript: g.transcript || null,
        passageText: g.passage_text || null,
        orderNo: g.order_no,
      })),
    });
    await qb.question.createMany({
      data: data.bundle.questions.map((q) => ({
        id: q.id,
        part: q.part,
        type: q.type,
        questionText: q.question_text,
        correctOption: 'A',
        difficulty: q.difficulty,
        explanation: q.explanation,
        groupId: q.group_id || null,
        positionInGroup: q.position_in_group || null,
        audioKey: q.audio_key || null,
        imageKey: q.image_key || null,
        transcript: q.transcript || null,
      })),
    });
    await qb.questionOption.createMany({
      data: data.bundle.questions.flatMap((q) =>
        q.options.map((o) => ({
          questionId: q.id,
          optionCode: o.option_key,
          optionText: o.content,
        })),
      ),
    });
    const source = new QuestionsService(qb, {} as SearchService, {} as MediaService);
    const qbModule = await Test.createTestingModule({
      controllers: [QuestionBankGrpcController],
      providers: [{ provide: QuestionsService, useValue: source }],
    }).compile();
    qbApp = qbModule.createNestApplication();
    const portServer = createServer();
    await new Promise<void>((resolve) => portServer.listen(0, '127.0.0.1', resolve));
    const url = `127.0.0.1:${(portServer.address() as AddressInfo).port}`;
    await new Promise<void>((resolve) => portServer.close(() => resolve()));
    const options = {
      package: 'toeic.questionbank.v1',
      protoPath: join(__dirname, '../../../packages/contracts/proto/question_bank.proto'),
      url,
      loader: { keepCase: true, defaults: true, arrays: true },
    };
    qbApp.connectMicroservice({ transport: Transport.GRPC, options });
    await qbApp.startAllMicroservices();
    await qbApp.init();
    const client = ClientProxyFactory.create({ transport: Transport.GRPC, options });
    redis = new RedisService({ get: () => 'redis://127.0.0.1:7379' } as unknown as ConfigService);
    const module = await Test.createTestingModule({
      imports: [AppModule],
      providers: [{ provide: AnalyticsPrisma, useValue: analytics }, EventsConsumer],
    })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(RedisService)
      .useValue(redis)
      .overrideProvider(QUESTION_BANK_CLIENT)
      .useValue(client)
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    app.get(ConfigService).set('ANALYTICS_CONSUMER_QUEUE', 'analytics-p3-tests');
    await app.init();
    await eventually(async () => expect(await redis.getClient().ping()).toBe('PONG'));
    admin = token(['SYSTEM_ADMIN']).jwt;
    owner = token().jwt;
    const response = await api()
      .post('/api/v1/tests')
      .auth(admin, { type: 'bearer' })
      .send({ title: 'P3 integration Full', durationSeconds: 7200, questions: data.items });
    expect(response.status).toBe(201);
    testId = response.body.testId;
    tests.add(testId);
  }, 60_000);
  afterAll(async () => {
    if (app) {
      await app.get(ExpiryJob).onModuleDestroy();
      await app.get(ExamOutboxRelay).onModuleDestroy();
      const ids = (
        await db.attempt.findMany({ where: { userId: { in: [...users] } }, select: { id: true } })
      ).map((a) => a.id);
      const events = await db.outboxEvent.findMany({
        where: { aggregateId: { in: ids } },
        select: { id: true },
      });
      await db.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await db.attempt.deleteMany({ where: { userId: { in: [...users] } } });
      await db.test.deleteMany({ where: { id: { in: [...tests] } } });
      await analytics.processedEvent.deleteMany({
        where: { eventId: { in: [...events.map((e) => e.id), ...syntheticEventIds] } },
      });
      await analytics.scoreHistory.deleteMany({ where: { userId: { in: [...users] } } });
      await analytics.learningActivity.deleteMany({ where: { userId: { in: [...users] } } });
      await analytics.weakArea.deleteMany({ where: { userId: { in: [...users] } } });
      await analytics.userLearningStat.deleteMany({ where: { userId: { in: [...users] } } });
      await analytics.dailyStreak.deleteMany({ where: { userId: { in: [...users] } } });
      if (ids.length) await redis.getClient().del(...ids.map((id) => `exam:draft:${id}`));
      await app.close();
    } else {
      await db?.$disconnect();
      await analytics?.$disconnect();
      redis?.getClient().disconnect();
    }
    if (qb) {
      await qb.question.deleteMany({ where: { id: { in: fixtureIds } } });
      await qb.questionGroup.deleteMany({
        where: { id: { in: data.bundle.groups.map((g) => g.group_id) } },
      });
    }
    await qbApp?.close();
    await qb?.$disconnect();
  }, 60_000);

  it('enforces JWT and admin roles; rejects malformed Full test structures', async () => {
    expect((await api().get('/api/v1/tests')).status).toBe(401);
    const body = { title: 'Bad', durationSeconds: 7200, questions: data.items.slice(1) };
    expect(
      (await api().post('/api/v1/tests').auth(owner, { type: 'bearer' }).send(body)).status,
    ).toBe(403);
    expect(
      (await api().post('/api/v1/tests').auth(admin, { type: 'bearer' }).send(body)).status,
    ).toBe(400);
    expect(
      (
        await api()
          .post('/api/v1/tests')
          .auth(admin, { type: 'bearer' })
          .send({ ...body, questions: data.items, durationSeconds: 300 })
      ).status,
    ).toBe(400);
  });
  it('starts Full atomically and reuses it under concurrent starts without leaking answers', async () => {
    const calls = await Promise.all(
      Array.from({ length: 3 }, () =>
        api().post(`/api/v1/tests/${testId}/attempts`).auth(owner, { type: 'bearer' }),
      ),
    );
    calls.forEach((r) => expect(r.status).toBe(201));
    const a = calls[0].body;
    createdDraftIds.add(a.attemptId);
    expect(new Set(calls.map((r) => r.body.attemptId)).size).toBe(1);
    expect(a.questions).toHaveLength(200);
    expect(a.groups).toHaveLength(data.bundle.groups.length);
    expect(a.remainingSeconds).toBeGreaterThan(7190);
    expect(a.parts).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(JSON.stringify(a)).not.toContain('correctOption');
    expect(JSON.stringify(a)).not.toContain('Private explanation');
    expect(JSON.stringify(a)).not.toContain('transcript');
    expect(await db.attemptQuestionSnapshot.count({ where: { attemptId: a.attemptId } })).toBe(200);
    expect(await db.attemptAnswer.count({ where: { attemptId: a.attemptId } })).toBe(0);
  });
  it('supports concurrent Part idempotency, detects changed requests and never converts seven Parts to Full', async () => {
    const key = randomUUID();
    const attempts = await Promise.all(Array.from({ length: 3 }, () => part([5, 7], owner, key)));
    expect(new Set(attempts.map((a) => a.attemptId)).size).toBe(1);
    expect(attempts[0].questions).toHaveLength(84);
    expect(attempts[0].questions.every((q) => q.part === 5 || q.part === 7)).toBe(true);
    const conflict = await api()
      .post(`/api/v1/tests/${testId}/part-attempts`)
      .auth(owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ parts: [5], durationSeconds: 300 });
    expect(conflict.status).toBe(409);
    const all = await part([1, 2, 3, 4, 5, 6, 7]);
    expect(all.mode).toBe('PART');
    expect(all.totalQuestions).toBe(200);
    const graded = await submit(
      all.attemptId,
      owner,
      all.questions.map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
    );
    expect(graded.body.accuracy).toBe(1);
    expect(graded.body.score).toBeNull();
    expect(graded.body.scoreListening).toBeNull();
  });
  it('reports part availability and blocks incomplete/archived groups without creating an attempt', async () => {
    const missing = data.bundle.groups.find((g) => g.part === 3)!.question_ids[0];
    await qb.question.update({ where: { id: missing }, data: { deletedAt: new Date() } });
    try {
      const available = await api()
        .get(`/api/v1/tests/${testId}/parts`)
        .auth(owner, { type: 'bearer' });
      expect(available.body.parts.find((p: { part: number }) => p.part === 3).available).toBe(
        false,
      );
      const before = await db.attempt.count();
      const response = await api()
        .post(`/api/v1/tests/${testId}/part-attempts`)
        .auth(owner, { type: 'bearer' })
        .send({ parts: [3], durationSeconds: 300 });
      expect(response.status).toBe(409);
      expect(response.body.details.length).toBeGreaterThan(0);
      expect(await db.attempt.count()).toBe(before);
    } finally {
      await qb.question.update({ where: { id: missing }, data: { deletedAt: null } });
    }
    expect(
      (
        await api()
          .post(`/api/v1/tests/${testId}/part-attempts`)
          .auth(owner, { type: 'bearer' })
          .send({ parts: [5, 5], durationSeconds: 300 })
      ).status,
    ).toBe(400);
  });
  it('stores draft only in Redis, validates snapshot membership/Part 2 options, and enforces ownership', async () => {
    const a = await part([2]);
    const path = `/api/v1/attempts/${a.attemptId}`;
    expect(
      (
        await api()
          .put(`${path}/answers/${a.questions[0].questionId}`)
          .auth(owner, { type: 'bearer' })
          .send({ selectedOption: 'D' })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .put(`${path}/answers/${randomUUID()}`)
          .auth(owner, { type: 'bearer' })
          .send({ selectedOption: 'A' })
      ).status,
    ).toBe(400);
    expect((await api().get(path).auth(token().jwt, { type: 'bearer' })).status).toBe(403);
    const saved = await api()
      .put(`${path}/draft`)
      .auth(owner, { type: 'bearer' })
      .send({ answers: [{ questionId: a.questions[0].questionId, selectedOption: 'A' }] });
    expect(saved.status).toBe(200);
    expect(await db.attemptAnswer.count({ where: { attemptId: a.attemptId } })).toBe(0);
    expect(await redis.getClient().ttl(`exam:draft:${a.attemptId}`)).toBeGreaterThan(3600);
    const resumed = await api().get(path).auth(owner, { type: 'bearer' });
    expect(resumed.body.answers[0].selectedOption).toBe('A');
    expect(JSON.stringify(resumed.body)).not.toContain('isCorrect');
  });
  it('merges submitted choices over draft, grades all blanks, and submits exactly once under concurrency', async () => {
    const a = await part([5]);
    await api()
      .put(`/api/v1/attempts/${a.attemptId}/draft`)
      .auth(owner, { type: 'bearer' })
      .send({
        answers: a.questions
          .slice(0, 2)
          .map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
      });
    const calls = await Promise.all(
      Array.from({ length: 4 }, () =>
        submit(a.attemptId, owner, [
          { questionId: a.questions[0].questionId, selectedOption: null },
        ]),
      ),
    );
    calls.forEach((r) => {
      expect(r.status).toBe(201);
      expect(r.body.correctCount).toBe(1);
      expect(r.body.totalQuestions).toBe(30);
      expect(r.body.answers).toHaveLength(30);
    });
    expect(await db.attemptAnswer.count({ where: { attemptId: a.attemptId } })).toBe(30);
    expect(await db.outboxEvent.count({ where: { aggregateId: a.attemptId } })).toBe(1);
    expect(
      (
        await submit(
          a.attemptId,
          owner,
          a.questions.map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
        )
      ).body.correctCount,
    ).toBe(1);
  });
  it('keeps immutable question/answer snapshots after question edits and test title changes', async () => {
    const a = await part([5]),
      first = a.questions[0];
    await qb.question.update({
      where: { id: first.questionId },
      data: { questionText: 'Edited after start', correctOption: 'B' },
    });
    try {
      const replacement = data.items.map((q) => ({ ...q }));
      const fifth = replacement.filter((q) => q.part === 5);
      [fifth[0].orderNo, fifth[1].orderNo] = [fifth[1].orderNo, fifth[0].orderNo];
      const update = await api()
        .patch(`/api/v1/tests/${testId}`)
        .auth(admin, { type: 'bearer' })
        .send({ title: 'Edited test title', questions: replacement });
      expect(update.status).toBe(200);
      const result = await submit(a.attemptId, owner, [
        { questionId: first.questionId, selectedOption: 'A' },
      ]);
      expect(result.body.correctCount).toBe(1);
      expect(result.body.questions[0].questionText).toBe(first.questionText);
      expect(result.body.questions[0].correctOption).toBe('A');
      expect(result.body.questions[0].explanation).toBe('Private explanation');
    } finally {
      await qb.question.update({
        where: { id: first.questionId },
        data: { questionText: first.questionText, correctOption: 'A' },
      });
      await api()
        .patch(`/api/v1/tests/${testId}`)
        .auth(admin, { type: 'bearer' })
        .send({ title: 'P3 integration Full', questions: data.items });
    }
  });
  it('rejects a torn question/answer revision and rolls back start without snapshots', async () => {
    const bank = app.get(QuestionBankClient),
      original = bank.getAnswerBundle.bind(bank);
    const mismatch = jest.spyOn(bank, 'getAnswerBundle').mockImplementation(async (ids) => {
      const response = await original(ids);
      response.answers[0].revision = 'stale-revision';
      return response;
    });
    const person = token();
    try {
      const response = await api()
        .post(`/api/v1/tests/${testId}/part-attempts`)
        .auth(person.jwt, { type: 'bearer' })
        .send({ parts: [5], durationSeconds: 300 });
      expect(response.status).toBe(409);
      expect(response.body.details.join()).toContain('content changed');
      expect(await db.attempt.count({ where: { userId: person.id } })).toBe(0);
    } finally {
      mismatch.mockRestore();
    }
  });
  it('expires an old Full attempt before starting a new one and preserves Part 6 blank positions', async () => {
    const person = token();
    const first = await api()
      .post(`/api/v1/tests/${testId}/attempts`)
      .auth(person.jwt, { type: 'bearer' });
    await db.attempt.update({
      where: { id: first.body.attemptId },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    const second = await api()
      .post(`/api/v1/tests/${testId}/attempts`)
      .auth(person.jwt, { type: 'bearer' });
    expect(second.status).toBe(201);
    expect(second.body.attemptId).not.toBe(first.body.attemptId);
    const old = await db.attempt.findUniqueOrThrow({ where: { id: first.body.attemptId } });
    expect(old.status).toBe('EXPIRED');
    expect(old.score).toBe(10);
    const p6 = await api()
      .post(`/api/v1/tests/${testId}/part-attempts`)
      .auth(person.jwt, { type: 'bearer' })
      .send({ parts: [6], durationSeconds: 300 });
    expect(
      p6.body.questions.slice(0, 4).map((q: { positionInGroup: number }) => q.positionInGroup),
    ).toEqual([1, 2, 3, 4]);
  });
  it('expires from Redis drafts, ignores late submitted answers, and races safely with the expiry worker', async () => {
    const a = await part([1]);
    await api()
      .put(`/api/v1/attempts/${a.attemptId}/draft`)
      .auth(owner, { type: 'bearer' })
      .send({ answers: [{ questionId: a.questions[0].questionId, selectedOption: 'A' }] });
    await db.attempt.update({
      where: { id: a.attemptId },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    const [result] = await Promise.all([
      submit(
        a.attemptId,
        owner,
        a.questions.map((q) => ({ questionId: q.questionId, selectedOption: 'A' })),
      ),
      app.get(AttemptsService).expireDue(0),
    ]);
    expect(result.body.status).toBe('EXPIRED');
    expect(result.body.correctCount).toBe(1);
    expect(
      await db.outboxEvent.count({
        where: { aggregateId: a.attemptId, eventType: 'PartPracticeSubmittedEvent' },
      }),
    ).toBe(1);
    const late = await api()
      .put(`/api/v1/attempts/${a.attemptId}/answers/${a.questions[1].questionId}`)
      .auth(owner, { type: 'bearer' })
      .send({ selectedOption: 'A' });
    expect(late.status).toBe(409);
    const blank = await part([5]);
    await db.attempt.update({
      where: { id: blank.attemptId },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    await app.get(AttemptsService).expireDue(0);
    expect(
      (await db.attempt.findUniqueOrThrow({ where: { id: blank.attemptId } })).correctCount,
    ).toBe(0);
  });
  it('does not finalize or lose draft data when Redis read fails', async () => {
    const a = await part([5]);
    const failure = jest
      .spyOn(app.get(DraftStore), 'read')
      .mockRejectedValue(new ServiceUnavailableException('Redis unavailable'));
    try {
      expect((await submit(a.attemptId)).status).toBe(503);
    } finally {
      failure.mockRestore();
    }
    expect((await db.attempt.findUniqueOrThrow({ where: { id: a.attemptId } })).status).toBe(
      'IN_PROGRESS',
    );
    expect(await db.attemptAnswer.count({ where: { attemptId: a.attemptId } })).toBe(0);
    expect(await db.outboxEvent.count({ where: { aggregateId: a.attemptId } })).toBe(0);
  });
  it('converts Full scores correctly and delivers Full/Part events into Analytics without double counting', async () => {
    const person = token();
    const full = await api()
      .post(`/api/v1/tests/${testId}/attempts`)
      .auth(person.jwt, { type: 'bearer' });
    expect(full.status).toBe(201);
    const answers = full.body.questions.map((q: { questionId: string }) => ({
      questionId: q.questionId,
      selectedOption: 'A',
    }));
    const result = await submit(full.body.attemptId, person.jwt, answers);
    expect(result.body.scoreListening).toBe(495);
    expect(result.body.scoreReading).toBe(495);
    expect(result.body.totalScore).toBe(990);
    expect(result.body.scoreDisclaimer).toContain('tham khảo');
    const partial = await part([5], person.jwt);
    await submit(partial.attemptId, person.jwt);
    await eventually(async () => {
      const history = await analytics.scoreHistory.findMany({ where: { userId: person.id } });
      expect(history).toHaveLength(2);
      expect(history.find((h) => h.mode === 'FULL')?.score).toBe(990);
      expect(history.find((h) => h.mode === 'PART')?.score).toBeNull();
      const weak = await analytics.weakArea.findUniqueOrThrow({
        where: { userId_skillArea_part: { userId: person.id, skillArea: 'READING', part: 5 } },
      });
      expect(weak.sampleCount).toBe(60);
      expect(weak.errorRate).toBe(0.5);
    });
    const event = await db.outboxEvent.findFirstOrThrow({
      where: { aggregateId: full.body.attemptId },
    });
    const duplicate = {
      eventId: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.getTime(),
      payload: event.payload,
    };
    await app.get(MessagingService).emit('test.submitted', full.body.attemptId, duplicate);
    await eventually(async () =>
      expect(await analytics.learningActivity.count({ where: { userId: person.id } })).toBe(2),
    );
  }, 25_000);
  it('serializes two concurrent deliveries of the same Analytics event', async () => {
    const person = token(),
      eventId = randomUUID();
    syntheticEventIds.add(eventId);
    const envelope = {
      eventId,
      eventType: 'PartPracticeSubmittedEvent',
      occurredAt: Date.now(),
      payload: {
        userId: person.id,
        attemptId: randomUUID(),
        testId,
        mode: 'PART',
        parts: [5],
        totalQuestions: 30,
        correctCount: 15,
        accuracy: 0.5,
        completedAt: Date.now(),
        partStats: [
          { part: 5, skill: 'READING', totalQuestions: 30, correctCount: 15, accuracy: 0.5 },
        ],
        durationSeconds: 300,
      },
    };
    const message = {
      routingKey: 'part-practice.submitted',
      content: Buffer.from(JSON.stringify(envelope)),
      properties: {} as ConsumedMessage['properties'],
    };
    await Promise.all([
      app.get(EventsConsumer)['route'](message),
      app.get(EventsConsumer)['route'](message),
    ]);
    expect(await analytics.learningActivity.count({ where: { userId: person.id } })).toBe(1);
    const weak = await analytics.weakArea.findUniqueOrThrow({
      where: { userId_skillArea_part: { userId: person.id, skillArea: 'READING', part: 5 } },
    });
    expect(weak.sampleCount).toBe(30);
    expect(weak.errorRate).toBe(0.5);
  });
  it('preserves legacy attempts as read-only, isolates history, and keeps snapshots readable after test archive', async () => {
    const person = token();
    const legacy = await db.attempt.create({
      data: {
        testId,
        userId: person.id,
        durationSeconds: 7200,
        deadlineAt: new Date(Date.now() - 1000),
        snapshotVersion: 0,
      },
    });
    expect(
      (await api().get(`/api/v1/attempts/${legacy.id}`).auth(person.jwt, { type: 'bearer' })).body
        .readOnly,
    ).toBe(true);
    expect((await submit(legacy.id, person.jwt)).status).toBe(409);
    const a = await part([5], person.jwt);
    const history = await api()
      .get('/api/v1/attempts')
      .auth(person.jwt, { type: 'bearer' })
      .query({ mode: 'PART', page: 1, size: 1 });
    expect(history.body.total).toBe(1);
    expect(history.body.items[0].attemptId).toBe(a.attemptId);
    const create = await api()
      .post('/api/v1/tests')
      .auth(admin, { type: 'bearer' })
      .send({ title: 'Archive fixture', durationSeconds: 7200, questions: data.items });
    const id = create.body.testId;
    tests.add(id);
    const started = await api()
      .post(`/api/v1/tests/${id}/part-attempts`)
      .auth(person.jwt, { type: 'bearer' })
      .send({ parts: [5], durationSeconds: 300 });
    expect((await api().delete(`/api/v1/tests/${id}`).auth(admin, { type: 'bearer' })).status).toBe(
      200,
    );
    expect(
      (await api().post(`/api/v1/tests/${id}/attempts`).auth(person.jwt, { type: 'bearer' }))
        .status,
    ).toBe(404);
    expect(
      (
        await api()
          .get(`/api/v1/attempts/${started.body.attemptId}`)
          .auth(person.jwt, { type: 'bearer' })
      ).body.questions,
    ).toHaveLength(30);
  });
});
