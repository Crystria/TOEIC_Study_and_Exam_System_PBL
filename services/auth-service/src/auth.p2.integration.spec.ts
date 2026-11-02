import { randomUUID } from 'node:crypto';
import { createServer, AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  AppConfigModule,
  AuthorizationModule,
  JwtAuthGuard,
  MessagingModule,
  RedisService,
  RoleCode,
  Roles,
  RolesGuard,
  accessJwtOptions,
  serviceToken,
} from '@toeic/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Client } from 'minio';
import { AppModule } from './app.module';
import { configureAuth } from './http';
import { PrismaService } from './prisma/prisma.service';
import { configureGateway } from '../../api-gateway/src/main';
import { tokenHash } from './identity';

@Controller()
class ProtectedProbe {
  @Get('probe') probe() {
    return { ok: true };
  }
  @Get('content') @Roles(RoleCode.CONTENT_ADMIN) content() {
    return { ok: true };
  }
}
const integration = process.env.P2_AUTH_DATABASE_URL ? describe : describe.skip;
integration('P2 Auth through Gateway with real PostgreSQL, Mailpit, RabbitMQ and MinIO', () => {
  jest.setTimeout(90000);
  let auth: INestApplication,
    gateway: INestApplication,
    probe: INestApplication,
    db: PrismaService,
    minio: Client;
  let adminId: string,
    adminToken: string,
    userId: string,
    userEmail: string,
    userToken: string,
    userRefresh: string;
  const password = 'P2-Test-2026!',
    objects = new Set<string>();
  const api = () => request(gateway.getHttpServer());
  const register = (email: string) =>
    api()
      .post('/api/v1/auth/register')
      .send({ email, password, confirmPassword: password, fullName: 'P2 Learner' });
  const login = (email: string) =>
    api().post('/api/v1/auth/login').send({ email, password, deviceId: 'p2-device' });
  async function until<T>(read: () => Promise<T | undefined>, timeout = 15000): Promise<T> {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const value = await read();
      if (value !== undefined) return value;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('P2 verification timeout');
  }
  async function mailToken(email: string) {
    return until(async () => {
      const list = (await (await fetch(process.env.MAILPIT_URL + '/api/v1/messages')).json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      for (const row of list.messages.filter((m) => m.To.some((t) => t.Address === email))) {
        const mail = (await (
          await fetch(process.env.MAILPIT_URL + '/api/v1/message/' + row.ID)
        ).json()) as { Text: string };
        const match = mail.Text.match(/token=([A-Za-z0-9_-]+)/);
        if (match) {
          const current = await db.emailActivation.findUnique({
            where: { tokenHash: tokenHash(match[1]) },
          });
          if (current && !current.consumedAt) return match[1];
        }
      }
      return undefined;
    });
  }
  async function activeAccount() {
    const email = randomUUID() + '@example.test';
    const created = await register(email);
    expect(created.status).toBe(201);
    const token = await mailToken(email);
    expect((await api().post('/api/v1/auth/verify-email').send({ token })).status).toBe(200);
    return { email, id: created.body.user.userId };
  }
  beforeAll(async () => {
    if (
      !/^\/p2_auth_(verify|rehearsal)_\d+$/.test(
        new URL(process.env.P2_AUTH_DATABASE_URL!).pathname,
      )
    )
      throw new Error('Separate P2 verification DB required');
    const reserve = createServer();
    await new Promise<void>((r) => reserve.listen(0, '127.0.0.1', r));
    const port = (reserve.address() as AddressInfo).port;
    await new Promise<void>((r) => reserve.close(() => r()));
    process.env.AUTH_INTERNAL_URL = 'http://127.0.0.1:' + port;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    auth = module.createNestApplication();
    configureAuth(auth);
    await auth.listen(port, '127.0.0.1');
    db = auth.get(PrismaService);
    const config = new ConfigService({
      AUTH_SERVICE_URL: process.env.AUTH_INTERNAL_URL,
      JWT_ACCESS_PUBLIC_KEY: process.env.JWT_ACCESS_PUBLIC_KEY,
      JWT_ACCESS_PUBLIC_KEY_FILE: '',
      JWT_ISSUER: 'toeic-auth',
      JWT_AUDIENCE: 'toeic-api',
    });
    const gm = await Test.createTestingModule({}).compile();
    gateway = gm.createNestApplication({ bodyParser: false });
    configureGateway(
      gateway,
      config,
      { consumeToken: async () => true } as unknown as RedisService,
      new JwtService(),
    );
    await gateway.init();
    const pm = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        MessagingModule,
        AuthorizationModule.forService('learning-service'),
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (c: ConfigService) => accessJwtOptions(c),
        }),
      ],
      controllers: [ProtectedProbe],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    probe = pm.createNestApplication();
    await probe.init();
    const endpoint = new URL(
      (process.env.MINIO_ENDPOINT || 'http://localhost:19000').replace(
        /^(?!https?:\/\/)/,
        'http://',
      ),
    );
    minio = new Client({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || 80),
      useSSL: endpoint.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      region: 'us-east-1',
    });
    const email = randomUUID() + '@example.test';
    execFileSync(
      process.execPath,
      [resolve(__dirname, '../../../scripts/bootstrap-system-admin.mjs')],
      {
        env: { ...process.env, ADMIN_BOOTSTRAP_EMAIL: email, ADMIN_BOOTSTRAP_PASSWORD: password },
        stdio: 'pipe',
        windowsHide: true,
      },
    );
    adminId = (await db.user.findUniqueOrThrow({ where: { email } })).id;
    const signed = await login(email);
    expect(signed.status).toBe(200);
    adminToken = signed.body.accessToken;
  });
  afterAll(async () => {
    if (minio) for (const key of objects) await minio.removeObject('toeic-user', key);
    await probe?.close();
    await gateway?.close();
    await auth?.close();
  });
  it('preserves legacy credentials/IDs/roles and signs usable sessions after migration', async () => {
    const id = '00000010-0000-4000-8000-000000000001';
    const before = await db.user.findUniqueOrThrow({ where: { id } });
    expect(before.failedLoginCount).toBe(4);
    expect(before.legacyAvatarUrl).toBe('https://legacy.invalid/avatar.png');
    const result = await login('CASE@EXAMPLE.TEST');
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({
      userId: id,
      email: 'case@example.test',
      roles: ['USER'],
      phoneNumber: '0901234567',
      avatarKey: null,
      avatarUrl: null,
    });
    expect(
      (await api().get('/api/v1/users/me').auth(result.body.accessToken, { type: 'bearer' }))
        .status,
    ).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id } });
    expect(after.failedLoginCount).toBe(0);
    expect(result.body.user.updatedAt).toBe(after.updatedAt.toISOString());
  });
  it('validates closed requests, password confirmation/bytes and concurrent normalized-email registration', async () => {
    const base = {
      email: 'invalid@example.test',
      password,
      confirmPassword: password,
      fullName: 'P2 User',
    };
    for (const body of [
      { ...base, roles: ['SYSTEM_ADMIN'] },
      { ...base, confirmPassword: 'Mismatch1!' },
      { ...base, password: 'Aa1' + 'é'.repeat(36), confirmPassword: 'Aa1' + 'é'.repeat(36) },
    ])
      expect((await api().post('/api/v1/auth/register').send(body)).status).toBe(400);
    const email = randomUUID() + '@example.test';
    const results = await Promise.all([register(email.toUpperCase()), register(email)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.user.count({ where: { email } })).toBe(1);
  });
  it('persists encrypted activation work during mail failure, then delivers and activates once without issuing a session', async () => {
    userEmail = randomUUID() + '@example.test';
    const original = globalThis.fetch;
    const mock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.method === 'POST' && String(input).includes('/api/v1/send'))
        throw new Error('simulated provider outage');
      return original(input, init);
    });
    try {
      const created = await register(userEmail);
      expect(created.status).toBe(201);
      expect(created.body.activationRequired).toBe(true);
      expect(created.body.accessToken).toBeUndefined();
      expect(created.body.user.roles).toEqual(['USER']);
      userId = created.body.user.userId;
      expect((await login(userEmail)).status).toBe(403);
      expect(await db.authSession.count({ where: { userId } })).toBe(0);
      const pending = await until(async () => {
        const row = await db.emailDelivery.findFirst({ where: { userId, retryCount: { gte: 1 } } });
        return row ?? undefined;
      });
      expect(pending.encryptedToken).toBeTruthy();
    } finally {
      mock.mockRestore();
    }
    const token = await mailToken(userEmail);
    const stored = await db.emailActivation.findUniqueOrThrow({
      where: { tokenHash: tokenHash(token) },
    });
    expect(stored.tokenHash).not.toBe(token);
    const responses = await Promise.all([
      api().post('/api/v1/auth/verify-email').send({ token }),
      api().post('/api/v1/auth/verify-email').send({ token }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    const signed = await login(userEmail);
    expect(signed.status).toBe(200);
    userToken = signed.body.accessToken;
    userRefresh = signed.body.refreshToken;
    expect(signed.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 604800,
    });
    expect(signed.body.user.status).toBe('ACTIVE');
  });
  it('rejects expired activation and caps five resends/hour with indistinguishable responses', async () => {
    const email = randomUUID() + '@example.test';
    const created = await register(email);
    const id = created.body.user.userId;
    const token = await mailToken(email);
    await db.emailActivation.updateMany({
      where: { userId: id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await api().post('/api/v1/auth/verify-email').send({ token })).status).toBe(400);
    const unknown = await api()
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'unknown@example.test' });
    expect(unknown.status).toBe(202);
    for (let n = 0; n < 7; n++) {
      await db.emailActivation.updateMany({
        where: { userId: id },
        data: { createdAt: new Date(Date.now() - 61000) },
      });
      const response = await api().post('/api/v1/auth/resend-verification').send({ email });
      expect(response.status).toBe(202);
      expect(response.body).toEqual(unknown.body);
    }
    expect(await db.emailActivation.count({ where: { userId: id, isResend: true } })).toBe(5);
    const count = await db.emailActivation.count({ where: { userId: id } });
    await api().post('/api/v1/auth/resend-verification').send({ email });
    expect(await db.emailActivation.count({ where: { userId: id } })).toBe(count);
  });
  it('counts five concurrent password failures, rejects the sixth with 401 and resets after lock expiry', async () => {
    const account = await activeAccount();
    const wrong = () =>
      api()
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: 'Wrong1!', deviceId: 'wrong' });
    const attempts = await Promise.all(Array.from({ length: 5 }, wrong));
    expect(attempts.every((r) => r.status === 401)).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(row.failedLoginCount).toBe(5);
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect((await wrong()).body.code).toBe('TEMPORARILY_LOCKED');
    await db.user.update({
      where: { id: account.id },
      data: { lockedUntil: new Date(Date.now() - 1) },
    });
    expect((await login(account.email)).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).failedLoginCount).toBe(
      0,
    );
  });
  it('atomically rotates opaque refresh; rejects replay, foreign logout, refresh-as-access and makes logout idempotent', async () => {
    const results = await Promise.all([
      api().post('/api/v1/auth/refresh').send({ refreshToken: userRefresh }),
      api().post('/api/v1/auth/refresh').send({ refreshToken: userRefresh }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const rotated = results.find((r) => r.status === 200)!.body;
    expect(rotated.refreshToken).not.toBe(userRefresh);
    // Defense against an inconsistent refresh/session FK pair: never revoke another user's session.
    const adminSession = await db.authSession.findFirstOrThrow({
      where: { userId: adminId, revokedAt: null },
    });
    const inconsistent = randomUUID();
    await db.refreshToken.create({
      data: {
        userId,
        sessionId: adminSession.id,
        tokenHash: tokenHash(inconsistent),
        expiresAt: new Date(Date.now() + 604800000),
      },
    });
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: inconsistent })).status,
    ).toBe(401);
    const inconsistentAccess = auth
      .get(JwtService)
      .sign({
        sub: userId,
        sid: adminSession.id,
        jti: randomUUID(),
        userVersion: '0',
        sessionVersion: adminSession.version.toString(),
        roles: ['USER'],
        type: 'access',
      });
    expect(
      (
        await api()
          .post('/api/v1/auth/logout')
          .auth(inconsistentAccess, { type: 'bearer' })
          .send({ refreshToken: inconsistent })
      ).status,
    ).toBe(401);
    expect(
      (await db.authSession.findUniqueOrThrow({ where: { id: adminSession.id } })).revokedAt,
    ).toBeNull();
    expect(
      (await api().get('/api/v1/users/me').auth(rotated.refreshToken, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (
        await api()
          .post('/api/v1/auth/logout')
          .auth(adminToken, { type: 'bearer' })
          .send({ refreshToken: rotated.refreshToken })
      ).status,
    ).toBe(401);
    for (let n = 0; n < 2; n++)
      expect(
        (
          await api()
            .post('/api/v1/auth/logout')
            .auth(rotated.accessToken, { type: 'bearer' })
            .send({ refreshToken: rotated.refreshToken })
        ).status,
      ).toBe(200);
    expect(
      (await api().get('/api/v1/users/me').auth(rotated.accessToken, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: rotated.refreshToken }))
        .status,
    ).toBe(401);
    const fresh = await login(userEmail);
    userToken = fresh.body.accessToken;
    userRefresh = fresh.body.refreshToken;
  });
  it('restricts profile fields and content role; validates authoritative state with a separate scoped service JWT', async () => {
    expect(
      (
        await api()
          .patch('/api/v1/users/me')
          .auth(userToken, { type: 'bearer' })
          .send({ status: 'ACTIVE' })
      ).status,
    ).toBe(400);
    expect(
      (await api().patch('/api/v1/users/me').auth(userToken, { type: 'bearer' }).send({})).status,
    ).toBe(400);
    const patched = await api()
      .patch('/api/v1/users/me')
      .auth(userToken, { type: 'bearer' })
      .send({ fullName: 'Updated Name', phoneNumber: null });
    expect(patched.status).toBe(200);
    expect(patched.body.phoneNumber).toBeNull();
    expect(patched.body.passwordHash).toBeUndefined();
    expect(
      (await request(probe.getHttpServer()).get('/content').auth(adminToken, { type: 'bearer' }))
        .status,
    ).toBe(403);
    const path =
      '/internal/v1/auth/authorization-state?userId=' +
      userId +
      '&sessionId=' +
      (new JwtService().decode(userToken) as { sid: string }).sid;
    expect(
      (await request(auth.getHttpServer()).get(path).auth(userToken, { type: 'bearer' })).status,
    ).toBe(401);
    const internal = await request(auth.getHttpServer())
      .get(path)
      .auth(serviceToken(process.env.AUTH_SERVICE_SECRET!, 'learning-service'), { type: 'bearer' });
    expect(internal.status).toBe(200);
    expect(internal.body.maxAgeSeconds).toBe(30);
    const missingSession = auth.get(JwtService).sign({
      sub: userId,
      sid: randomUUID(),
      jti: randomUUID(),
      userVersion: '0',
      sessionVersion: '0',
      roles: ['USER'],
      type: 'access',
    });
    const denied = await api().get('/api/v1/users/me').auth(missingSession, { type: 'bearer' });
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('SESSION_REVOKED');
    expect(
      (
        await api()
          .get('/api/v1/internal/v1/auth/authorization-state')
          .auth(adminToken, { type: 'bearer' })
      ).status,
    ).toBe(404);
  });
  it('guards the last active admin and revokes stale roles via transactional outbox and broker invalidation', async () => {
    expect(
      (
        await api()
          .patch(`/api/v1/admin/users/${adminId}/status`)
          .auth(adminToken, { type: 'bearer' })
          .send({ status: 'SUSPENDED' })
      ).status,
    ).toBe(409);
    expect(
      (
        await api()
          .patch(`/api/v1/admin/users/${userId}/roles`)
          .auth(adminToken, { type: 'bearer' })
          .send({ roles: ['USER', 'USER'] })
      ).status,
    ).toBe(400);
    expect(
      (await request(probe.getHttpServer()).get('/probe').auth(userToken, { type: 'bearer' }))
        .status,
    ).toBe(200);
    const changed = await api()
      .patch(`/api/v1/admin/users/${userId}/roles`)
      .auth(adminToken, { type: 'bearer' })
      .send({ roles: ['CONTENT_ADMIN'] });
    expect(changed.status).toBe(200);
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: userRefresh })).status,
    ).toBe(401);
    await until(async () => {
      const r = await request(probe.getHttpServer())
        .get('/probe')
        .auth(userToken, { type: 'bearer' });
      return r.status === 401 ? true : undefined;
    });
    const audit = await api()
      .get(`/api/v1/admin/audit-logs?targetUserId=${userId}`)
      .auth(adminToken, { type: 'bearer' });
    expect(audit.status).toBe(200);
    expect(audit.body.items[0]).toMatchObject({
      actorUserId: adminId,
      action: 'USER_ROLES_CHANGED',
      beforeData: { roles: ['USER'] },
      afterData: { roles: ['CONTENT_ADMIN'] },
    });
    expect(
      await db.outboxEvent.count({
        where: { aggregateId: userId, eventType: 'AuthorizationChangedEvent.v2' },
      }),
    ).toBeGreaterThan(0);
    const signed = await login(userEmail);
    userToken = signed.body.accessToken;
    userRefresh = signed.body.refreshToken;
    expect(
      (await request(probe.getHttpServer()).get('/content').auth(userToken, { type: 'bearer' }))
        .status,
    ).toBe(200);
  });
  it('serializes competing removal of active system admins', async () => {
    const id = randomUUID();
    await db.user.create({
      data: {
        id,
        email: id + '@example.test',
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'Other Admin',
        status: 'ACTIVE',
        roles: { create: { roleCode: 'SYSTEM_ADMIN' } },
      },
    });
    const otherToken = (await login(id + '@example.test')).body.accessToken;
    const results = await Promise.all([
      api()
        .patch(`/api/v1/admin/users/${id}/roles`)
        .auth(otherToken, { type: 'bearer' })
        .send({ roles: ['USER'] }),
      api()
        .patch(`/api/v1/admin/users/${adminId}/roles`)
        .auth(adminToken, { type: 'bearer' })
        .send({ roles: ['USER'] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db.user.count({
        where: { status: 'ACTIVE', roles: { some: { roleCode: 'SYSTEM_ADMIN' } } },
      }),
    ).toBe(1);
    // Further tests need an admin; use the surviving active account through normal login.
    const survivor = await db.user.findFirstOrThrow({
      where: { status: 'ACTIVE', roles: { some: { roleCode: 'SYSTEM_ADMIN' } } },
    });
    adminId = survivor.id;
    adminToken = (await login(survivor.email)).body.accessToken;
  });
  it('rolls back status, audit, session and version together when outbox insert fails', async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: userId } }),
      audits = await db.adminAuditLog.count({ where: { targetUserId: userId } });
    await db.$executeRawUnsafe(
      "CREATE FUNCTION p2_test_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type = 'AuthorizationChangedEvent.v2' THEN RAISE EXCEPTION 'p2_test_outbox_failure'; END IF; RETURN NEW; END $$",
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER p2_test_outbox_failure BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION p2_test_reject_outbox()',
    );
    try {
      const failed = await api()
        .patch(`/api/v1/admin/users/${userId}/status`)
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'SUSPENDED' });
      expect(failed.status).toBe(503);
      expect(JSON.stringify(failed.body)).not.toContain('constraint');
      const after = await db.user.findUniqueOrThrow({ where: { id: userId } });
      expect(after.status).toBe(before.status);
      expect(after.authorizationVersion).toBe(before.authorizationVersion);
      expect(await db.adminAuditLog.count({ where: { targetUserId: userId } })).toBe(audits);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER p2_test_outbox_failure ON outbox_events');
      await db.$executeRawUnsafe('DROP FUNCTION p2_test_reject_outbox()');
    }
    expect((await api().get('/api/v1/users/me').auth(userToken, { type: 'bearer' })).status).toBe(
      200,
    );
  });
  it('enforces suspension immediately for login/refresh, then reactivation requires new credentials', async () => {
    const oldRefresh = userRefresh;
    expect(
      (
        await api()
          .patch(`/api/v1/admin/users/${userId}/status`)
          .auth(adminToken, { type: 'bearer' })
          .send({ status: 'SUSPENDED' })
      ).status,
    ).toBe(200);
    expect((await login(userEmail)).status).toBe(403);
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })).status,
    ).toBe(401);
    await until(async () => {
      const r = await request(probe.getHttpServer())
        .get('/probe')
        .auth(userToken, { type: 'bearer' });
      return r.status === 401 ? true : undefined;
    });
    expect(
      (
        await api()
          .patch(`/api/v1/admin/users/${userId}/status`)
          .auth(adminToken, { type: 'bearer' })
          .send({ status: 'ACTIVE' })
      ).status,
    ).toBe(200);
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })).status,
    ).toBe(401);
    const signed = await login(userEmail);
    userToken = signed.body.accessToken;
    userRefresh = signed.body.refreshToken;
    const another = (await login(userEmail)).body;
    await db.refreshToken.update({
      where: { tokenHash: tokenHash(another.refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await api().post('/api/v1/auth/refresh').send({ refreshToken: another.refreshToken }))
        .status,
    ).toBe(401);
  });
  it('confirms private avatars by owner and HEAD metadata, with idempotent confirm', async () => {
    const presign = async () => {
      const r = await api()
        .patch('/api/v1/users/me/avatar/presign')
        .auth(userToken, { type: 'bearer' })
        .send({ kind: 'AVATAR', contentType: 'image/png', sizeBytes: 4 });
      expect(r.status).toBe(200);
      objects.add(r.body.objectKey);
      return r.body;
    };
    expect(
      (
        await api()
          .patch('/api/v1/users/me/avatar/presign')
          .auth(userToken, { type: 'bearer' })
          .send({ kind: 'AVATAR', contentType: 'image/png', sizeBytes: 2097153 })
      ).status,
    ).toBe(400);
    const ticket = await presign();
    expect(
      (
        await fetch(ticket.putUrl, {
          method: 'PUT',
          headers: ticket.requiredHeaders,
          body: Buffer.from([1, 2, 3, 4]),
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await api()
          .post('/api/v1/users/me/avatar/confirm')
          .auth(adminToken, { type: 'bearer' })
          .send({ uploadId: ticket.uploadId })
      ).status,
    ).toBe(404);
    for (let n = 0; n < 2; n++)
      expect(
        (
          await api()
            .post('/api/v1/users/me/avatar/confirm')
            .auth(userToken, { type: 'bearer' })
            .send({ uploadId: ticket.uploadId })
        ).status,
      ).toBe(200);
    const me = await api().get('/api/v1/users/me').auth(userToken, { type: 'bearer' });
    expect(me.body.avatarKey).toBe(ticket.objectKey);
    expect(me.body.avatarUrl).toContain('X-Amz-Signature');
    expect((await fetch(me.body.avatarUrl)).ok).toBe(true);
    const bare = new URL(me.body.avatarUrl);
    bare.search = '';
    expect((await fetch(bare)).ok).toBe(false);
    const bad = await presign();
    await fetch(bad.putUrl, {
      method: 'PUT',
      headers: bad.requiredHeaders,
      body: Buffer.from([1]),
    });
    expect(
      (
        await api()
          .post('/api/v1/users/me/avatar/confirm')
          .auth(userToken, { type: 'bearer' })
          .send({ uploadId: bad.uploadId })
      ).status,
    ).toBe(400);
    const expired = await presign();
    await db.avatarUpload.update({
      where: { id: expired.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await api()
          .post('/api/v1/users/me/avatar/confirm')
          .auth(userToken, { type: 'bearer' })
          .send({ uploadId: expired.uploadId })
      ).status,
    ).toBe(400);
  });
  it('fails closed with 503 after a cached state expires during Auth transport outage', async () => {
    const req = () =>
      request(probe.getHttpServer()).get('/probe').auth(userToken, { type: 'bearer' });
    expect((await req()).status).toBe(200);
    const now = Date.now.bind(Date),
      original = globalThis.fetch;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now() + 31000);
    const transport = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).includes('/internal/v1/auth/authorization-state'))
        throw new Error('simulated Auth outage');
      return original(input, init);
    });
    try {
      expect((await req()).status).toBe(503);
    } finally {
      clock.mockRestore();
      transport.mockRestore();
    }
    expect((await req()).status).toBe(200);
  });
});
