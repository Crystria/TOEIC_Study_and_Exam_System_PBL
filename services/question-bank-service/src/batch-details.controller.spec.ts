import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthorizationStateVerifier, RoleCode, RolesGuard } from '@toeic/common';
import request from 'supertest';
import { GroupsController } from './modules/groups/groups.controller';
import { GroupsService } from './modules/groups/groups.service';
import { QuestionsController } from './modules/questions/questions.controller';
import { QuestionsService } from './modules/questions/questions.service';
import { SearchService } from './modules/search/search.service';
import { QuestionBankAuthGuard } from './question-bank-auth.guard';

const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

describe('Question bank HTTP permissions and batch detail reads', () => {
  let app: INestApplication;
  const jwt = { verifyAsync: jest.fn() };
  const authorization = { verify: jest.fn() };
  const serviceMock = () => ({
    details: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    presign: jest.fn(),
  });
  const questions = serviceMock();
  const groups = serviceMock();
  const search = { reindex: jest.fn() };
  const claims = {
    sub: 'batch-editor',
    sid: 'batch-session',
    jti: 'batch-token',
    type: 'access',
    userVersion: '0',
    sessionVersion: '0',
    iat: 1,
    exp: 9999999999,
  };
  const endpoints = [
    { path: '/api/v1/questions', service: questions },
    { path: '/api/v1/question-groups', service: groups },
  ];
  const question = {
    part: 5,
    type: 'SINGLE_CHOICE',
    questionText: 'Choose an answer.',
    difficulty: 'EASY',
    correctOption: 'A',
    options: ['A', 'B', 'C', 'D'].map((optionCode) => ({ optionCode, optionText: optionCode })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [QuestionsController, GroupsController],
      providers: [
        { provide: QuestionsService, useValue: questions },
        { provide: GroupsService, useValue: groups },
        { provide: SearchService, useValue: search },
        { provide: JwtService, useValue: jwt },
        { provide: AuthorizationStateVerifier, useValue: authorization },
        { provide: APP_GUARD, useClass: QuestionBankAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.CONTENT_ADMIN] });
    authorization.verify.mockResolvedValue(undefined);
    questions.details.mockResolvedValue({ items: [{ questionId: uuid(1) }], missingIds: [] });
    groups.details.mockResolvedValue({ items: [{ groupId: uuid(1) }], missingIds: [] });
  });

  describe.each(endpoints)('GET $path/details', ({ path: collection, service }) => {
    const path = `${collection}/details`;
    it('rejects unauthenticated requests before reading answers or shared content', async () => {
      const response = await request(app.getHttpServer())
        .get(path)
        .query({ ids: uuid(1) });
      expect(response.status).toBe(401);
      expect(service.details).not.toHaveBeenCalled();
    });

    it('rejects USER without exposing any batch contents', async () => {
      jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.USER] });
      const response = await request(app.getHttpServer())
        .get(path)
        .query({ ids: uuid(1) })
        .auth('isolated-token', { type: 'bearer' });
      expect(response.status).toBe(403);
      expect(service.details).not.toHaveBeenCalled();
    });

    it.each([RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN])(
      'allows %s and resolves the static route before the single-record route',
      async (role) => {
        jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [role] });
        const response = await request(app.getHttpServer())
          .get(path)
          .query({ ids: `${uuid(2)},${uuid(1)}` })
          .auth('isolated-token', { type: 'bearer' });
        expect(response.status).toBe(200);
        expect(service.details).toHaveBeenCalledWith([uuid(2), uuid(1)]);
        expect(service.findById).not.toHaveBeenCalled();
        expect(response.body).toEqual(await service.details.mock.results[0].value);
      },
    );

    it.each([
      { label: 'missing IDs', query: {} },
      { label: 'empty IDs', query: { ids: '' } },
      { label: 'non-UUID IDs', query: { ids: `${uuid(1)},not-a-uuid` } },
      { label: 'empty comma member', query: { ids: `${uuid(1)},` } },
      { label: 'duplicate IDs', query: { ids: `${uuid(1)},${uuid(1)}` } },
      {
        label: 'case-variant duplicate IDs',
        query: { ids: '6BA7B810-9DAD-11D1-80B4-00C04FD430C8,6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
      },
      { label: 'repeated IDs query parameters', query: { ids: [uuid(1), uuid(2)] } },
      {
        label: '51 IDs',
        query: { ids: Array.from({ length: 51 }, (_, index) => uuid(index + 1)).join(',') },
      },
      { label: 'unknown query fields', query: { ids: uuid(1), revealAnswers: 'true' } },
    ])('rejects $label before invoking the service', async ({ query }) => {
      const response = await request(app.getHttpServer())
        .get(path)
        .query(query)
        .auth('isolated-token', { type: 'bearer' });
      expect(response.status).toBe(400);
      expect(service.details).not.toHaveBeenCalled();
    });

    it('accepts a full batch of 50 unique UUIDs in the requested order', async () => {
      const ids = Array.from({ length: 50 }, (_, index) => uuid(50 - index));
      const response = await request(app.getHttpServer())
        .get(path)
        .query({ ids: ids.join(',') })
        .auth('isolated-token', { type: 'bearer' });
      expect(response.status).toBe(200);
      expect(service.details).toHaveBeenCalledWith(ids);
      expect(service.findById).not.toHaveBeenCalled();
    });

    it('accepts existing UUID versions and normalizes case and surrounding whitespace', async () => {
      const legacyId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const response = await request(app.getHttpServer())
        .get(path)
        .query({ ids: ` ${legacyId.toUpperCase()} , ${uuid(1)} ` })
        .auth('isolated-token', { type: 'bearer' });
      expect(response.status).toBe(200);
      expect(service.details).toHaveBeenCalledWith([legacyId, uuid(1)]);
    });
  });

  describe.each(endpoints)('Writes under $path', ({ path, service }) => {
    const idPath = `${path}/${uuid(1)}`;
    const createBody =
      service === groups
        ? { part: 7, type: 'PASSAGE', questions: [{ ...question, part: 7 }] }
        : question;
    const mutations = [
      { method: 'post', url: path, body: createBody, handler: 'create' },
      { method: 'patch', url: idPath, body: {}, handler: 'update' },
      { method: 'delete', url: idPath, body: {}, handler: 'remove' },
      {
        method: 'post',
        url: `${idPath}/media/presign`,
        body: { mediaType: 'AUDIO', contentType: 'audio/mpeg', fileName: 'test.mp3' },
        handler: 'presign',
      },
    ] as const;

    it.each(mutations)('requires CONTENT_ADMIN for $method $url', async (mutation) => {
      const { method, url, body, handler } = mutation;
      const send = () => {
        const pending = request(app.getHttpServer())[method](url);
        return pending.auth('isolated-token', { type: 'bearer' }).send(body);
      };

      jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.SYSTEM_ADMIN] });
      expect((await send()).status).toBe(403);
      expect(service[handler]).not.toHaveBeenCalled();

      jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.CONTENT_ADMIN] });
      expect((await send()).status).toBe(method === 'post' ? 201 : 200);
      expect(service[handler]).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps search reindexing available to SYSTEM_ADMIN', async () => {
    const reindex = () =>
      request(app.getHttpServer())
        .post('/api/v1/questions/reindex')
        .auth('isolated-token', { type: 'bearer' });
    expect((await reindex()).status).toBe(403);
    expect(search.reindex).not.toHaveBeenCalled();
    jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.SYSTEM_ADMIN] });
    expect((await reindex()).status).toBe(201);
    expect(search.reindex).toHaveBeenCalledTimes(1);
  });
});
