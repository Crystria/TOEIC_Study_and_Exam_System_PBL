import { Global, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AuthorizationStateVerifier, JwtAuthGuard, RoleCode, RolesGuard } from '@toeic/common';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { PrismaService } from '../../prisma/prisma.service';
import { TestsModule } from './tests.module';
import { QuestionBankClient } from '../../grpc/question-bank.client';

// No AppModule/infrastructure providers: only controllers, actual guards/services,
// a Prisma stub and a JwtService stub. HTTP binds a temporary loopback port.
const prisma = {
  test: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
};
@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: prisma },
    { provide: QuestionBankClient, useValue: {} },
  ],
  exports: [PrismaService, QuestionBankClient],
})
class StubPrismaModule {}

const fixture = {
  id: 'demo-test-002',
  title: 'Synthetic metadata fixture',
  type: 'MINI',
  durationSeconds: 61,
  status: 'UNRECOGNIZED_STATUS',
  _count: { questions: 0, attempts: 42 },
  questions: [],
};
const expected = {
  id: fixture.id,
  title: fixture.title,
  type: null,
  durationSeconds: 61,
  questionCount: 0,
  status: null,
};
const base = '/api/v1/tests/cms-metadata';
const paths = [base, `${base}/${fixture.id}`];

describe('CMS metadata HTTP boundary (isolated Nest app)', () => {
  let app: INestApplication;
  const jwt = { verifyAsync: jest.fn() };
  const authorization = { verify: jest.fn() };
  const claims = {
    sub: 'synthetic-subject',
    sid: 'synthetic-session',
    jti: 'synthetic-jti',
    type: 'access',
    userVersion: '0',
    sessionVersion: '0',
    iat: 1,
    exp: 9999999999,
  };
  let port: number;

  function get(path: string, authorization?: string): Promise<{ status: number; body: unknown }> {
    return new Promise((resolveResponse, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: 'GET',
          agent: false,
          headers: authorization ? { Authorization: authorization } : {},
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            body += chunk;
          });
          res.on('end', () => resolveResponse({ status: res.statusCode!, body: JSON.parse(body) }));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [StubPrismaModule, TestsModule],
      providers: [
        { provide: JwtService, useValue: jwt },
        { provide: AuthorizationStateVerifier, useValue: authorization },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jwt.verifyAsync.mockResolvedValue({
      ...claims,
      roles: [RoleCode.CONTENT_ADMIN],
    });
    authorization.verify.mockResolvedValue(undefined);
    prisma.test.findMany.mockResolvedValue([fixture]);
    prisma.test.count.mockResolvedValue(1);
    prisma.test.findFirst.mockResolvedValue(fixture);
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries));
  });

  describe.each(paths)('GET %s', (path) => {
    it('requires a JWT without reaching Prisma', async () => {
      expect((await get(path)).status).toBe(401);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(prisma.test.findMany).not.toHaveBeenCalled();
      expect(prisma.test.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a JWT when verification fails', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('synthetic rejection'));
      expect((await get(path, 'Bearer isolated-placeholder')).status).toBe(401);
      expect(prisma.test.findFirst).not.toHaveBeenCalled();
      expect(prisma.test.findMany).not.toHaveBeenCalled();
    });

    it.each([
      { roles: [RoleCode.USER], status: 403 },
      { roles: [RoleCode.SYSTEM_ADMIN], status: 403 },
      { roles: [], status: 401 },
      { roles: undefined, status: 401 },
      { roles: 'CONTENT_ADMIN', status: 401 },
    ])('rejects roles=%j without reaching Prisma', async ({ roles, status }) => {
      jwt.verifyAsync.mockResolvedValue({ ...claims, roles });
      expect((await get(path, 'Bearer isolated-placeholder')).status).toBe(status);
      expect(prisma.test.findMany).not.toHaveBeenCalled();
      expect(prisma.test.findFirst).not.toHaveBeenCalled();
    });

    it.each([
      { roles: [RoleCode.CONTENT_ADMIN] },
      { roles: [RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN] },
    ])('accepts a roles array containing CONTENT_ADMIN: %j', async ({ roles }) => {
      jwt.verifyAsync.mockResolvedValue({ ...claims, roles });
      const response = await get(path, 'Bearer isolated-placeholder');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        path === base ? { items: [expected], total: 1, page: 1, size: 20 } : expected,
      );
    });
  });

  it('routes the static metadata list before the legacy :id and transforms pagination', async () => {
    const response = await get(
      `${base}?page=3&size=7&keyword=B%C3%B4`,
      'Bearer isolated-placeholder',
    );
    expect(response).toEqual({
      status: 200,
      body: { items: [expected], total: 1, page: 3, size: 7 },
    });
    expect(prisma.test.findFirst).not.toHaveBeenCalled();
    expect(prisma.test.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 14,
        take: 7,
        where: { deletedAt: null, title: { contains: 'Bô', mode: 'insensitive' } },
      }),
    );
  });

  it.each([
    'page=0',
    'size=51',
    'type=FULL_TEST',
    'type=FULL',
    'status=DRAFT',
    'status=OTHER',
    'includeDeleted=true',
    'demoRole=CONTENT_ADMIN',
  ])('rejects invalid/unknown list query %s', async (query) => {
    expect((await get(`${base}?${query}`, 'Bearer isolated-placeholder')).status).toBe(400);
    expect(prisma.test.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty past-end page without clamping', async () => {
    prisma.test.findMany.mockResolvedValue([]);
    expect(await get(`${base}?page=99`, 'Bearer isolated-placeholder')).toEqual({
      status: 200,
      body: { items: [], total: 1, page: 99, size: 20 },
    });
  });

  it('returns 404 for a missing Test through the metadata detail route', async () => {
    prisma.test.findFirst.mockResolvedValue(null);
    expect((await get(`${base}/absent`, 'Bearer isolated-placeholder')).status).toBe(404);
    expect(prisma.test.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'absent', deletedAt: null } }),
    );
  });

  it.each(['/api/v1/tests', '/api/v1/tests/' + fixture.id])(
    'keeps existing Test reads authenticated: %s',
    async (path) => {
      expect((await get(path)).status).toBe(401);
      jwt.verifyAsync.mockResolvedValue({ ...claims, roles: [RoleCode.USER] });
      const response = await get(path, 'Bearer isolated-placeholder');
      expect(response.status).toBe(200);
      expect(jwt.verifyAsync).toHaveBeenCalled();
    },
  );

  it('documents the actual DTO/route/query/security shape consistently with checked-in OpenAPI', () => {
    const generated = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const schema = generated.components!.schemas!.CmsTestMetadataDto as {
      properties: Record<string, unknown>;
      required: string[];
    };
    const keys = ['id', 'title', 'type', 'durationSeconds', 'questionCount', 'status'].sort();
    expect(Object.keys(schema.properties).sort()).toEqual(keys);
    expect([...schema.required].sort()).toEqual(keys);
    const contract = parse(
      readFileSync(
        resolve(__dirname, '../../../../../packages/contracts/openapi/openapi.yaml'),
        'utf8',
      ),
    );
    expect(Object.keys(contract.paths)).toEqual(
      expect.arrayContaining([base, `${base}/{id}`, '/health', '/api/v1/tests']),
    );
    for (const path of [base, `${base}/{id}`]) {
      expect(generated.paths[path].get!.security).toEqual([{ bearer: [] }]);
      expect(contract.paths[path].get.security).toEqual([{ bearerAuth: [] }]);
      expect(contract.paths[path].get['x-required-roles']).toEqual(['CONTENT_ADMIN']);
    }
    expect(contract.paths[base].get.parameters.map((p: { name: string }) => p.name).sort()).toEqual(
      ['keyword', 'page', 'size'].sort(),
    );
    expect(contract.components.schemas.CmsTestMetadata.required.sort()).toEqual(keys);
    expect(Object.keys(contract.components.schemas.CmsTestMetadata.properties).sort()).toEqual(
      keys,
    );
    expect(contract.components.schemas.CmsTestMetadata.additionalProperties).toBe(false);
    expect(contract.components.schemas.CmsTestMetadata.properties.status).not.toHaveProperty(
      'enum',
    );
  });
});
