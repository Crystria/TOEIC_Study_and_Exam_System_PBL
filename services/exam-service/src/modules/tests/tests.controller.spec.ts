import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthorizationStateVerifier, RoleCode, RolesGuard } from '@toeic/common';
import request from 'supertest';
import { ExamAuthGuard } from '../../exam-auth.guard';
import { fullFixture } from '../../test-fixtures';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

describe('Test HTTP write authorization', () => {
  let app: INestApplication;
  const jwt = { verifyAsync: jest.fn() };
  const authorization = { verify: jest.fn() };
  const service = {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const claims = {
    sub: 'test-editor',
    sid: 'test-session',
    jti: 'test-token',
    type: 'access',
    userVersion: '0',
    sessionVersion: '0',
    iat: 1,
    exp: 9999999999,
  };
  const create = {
    title: 'Full test fixture',
    durationSeconds: 7200,
    questions: fullFixture().items,
  };
  const mutations = [
    { method: 'post' as const, path: '/api/v1/tests', body: create, handler: 'create' as const },
    {
      method: 'patch' as const,
      path: '/api/v1/tests/test-1',
      body: { title: 'Edited test' },
      handler: 'update' as const,
    },
    {
      method: 'delete' as const,
      path: '/api/v1/tests/test-1',
      body: {},
      handler: 'remove' as const,
    },
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestsController],
      providers: [
        { provide: TestsService, useValue: service },
        { provide: JwtService, useValue: jwt },
        { provide: AuthorizationStateVerifier, useValue: authorization },
        { provide: APP_GUARD, useClass: ExamAuthGuard },
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
    service.list.mockResolvedValue({ items: [], total: 0 });
    service.findById.mockResolvedValue({ testId: 'test-1' });
    service.create.mockResolvedValue({ testId: 'test-1' });
    service.update.mockResolvedValue({ testId: 'test-1' });
    service.remove.mockResolvedValue({ success: true });
  });

  describe.each(mutations)('$method $path', ({ method, path, body, handler }) => {
    it('rejects unauthenticated requests before invoking a mutation', async () => {
      const response = await request(app.getHttpServer())[method](path).send(body);
      expect(response.status).toBe(401);
      expect(service[handler]).not.toHaveBeenCalled();
    });

    it.each([[RoleCode.SYSTEM_ADMIN], [RoleCode.USER]])(
      'rejects roles %j before invoking any mutation',
      async (role) => {
        jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [role] });
        const pending = request(app.getHttpServer())[method](path);
        const response = await pending.auth('isolated-token', { type: 'bearer' }).send(body);
        expect(response.status).toBe(403);
        expect(service.create).not.toHaveBeenCalled();
        expect(service.update).not.toHaveBeenCalled();
        expect(service.remove).not.toHaveBeenCalled();
      },
    );

    it.each([
      { roles: [RoleCode.CONTENT_ADMIN] },
      { roles: [RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN] },
    ])('accepts a role set containing CONTENT_ADMIN: %j', async ({ roles }) => {
      jwt.verifyAsync.mockResolvedValue({ ...claims, roles });
      const pending = request(app.getHttpServer())[method](path);
      const response = await pending.auth('isolated-token', { type: 'bearer' }).send(body);
      expect(response.status).toBe(method === 'post' ? 201 : 200);
      expect(service[handler]).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps test list and detail available to authenticated system admins', async () => {
    jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.SYSTEM_ADMIN] });
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/tests')
          .auth('isolated-token', { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/tests/test-1')
          .auth('isolated-token', { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect(service.list).toHaveBeenCalledWith(expect.anything(), true);
    expect(service.findById).toHaveBeenCalledWith('test-1', true);
  });
});
