import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ContractPipe } from '../../http';
import { identityInclude } from '../../identity';
import { AuthController } from './auth.controller';
import {
  ACCESS_JTI,
  AUTH_NOW,
  AuthHarness,
  NEW_REFRESH,
  OLD_REFRESH,
  SESSION_ID,
  USER_ID,
  WEEK_MS,
  comparePassword,
  createAuthHarness,
  expectNoTokens,
  sha256,
} from '../../../test/helpers/auth-harness';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

describe('UT-005 | refresh the same active session', () => {
  let h: AuthHarness;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(AUTH_NOW);
    h = createAuthHarness();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  function expectNoRotation() {
    expect(h.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(h.tx.authSession.update).not.toHaveBeenCalled();
    expect(h.tx.user.update).not.toHaveBeenCalled();
    expectNoTokens(h);
  }
  async function expectInvalid() {
    const error: unknown = await h.service.refresh(OLD_REFRESH).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect((error as HttpException).getResponse()).toEqual({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'INVALID_REFRESH_TOKEN',
    });
  }

  it('consumes the old refresh once, renews the same session, and returns the correct safe token contract', async () => {
    const present = jest.spyOn(h.presenter, 'present');
    const before = {
      user: structuredClone(h.user),
      session: { ...h.session },
      token: { ...h.currentToken },
    };

    const result = await h.service.refresh(OLD_REFRESH);

    expect(h.prisma.refreshToken.findUnique).toHaveBeenCalledTimes(1);
    expect(h.prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256(OLD_REFRESH) },
    });
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.tx.$queryRaw.mock.calls[0]).toEqual([
      ['SELECT id FROM users WHERE id=', ' FOR UPDATE'],
      USER_ID,
    ]);
    expect(h.tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      include: identityInclude,
    });
    expect(h.tx.authSession.findUnique).toHaveBeenCalledTimes(1);
    expect(h.tx.authSession.findUnique).toHaveBeenCalledWith({ where: { id: SESSION_ID } });
    expect(h.tx.refreshToken.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: h.foundToken.id },
    });
    expect(h.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(h.tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: h.currentToken.id, revokedAt: null, consumedAt: null },
      data: { revokedAt: AUTH_NOW, consumedAt: AUTH_NOW },
    });
    expect(h.tx.authSession.update).toHaveBeenCalledTimes(1);
    expect(h.tx.authSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { expiresAt: new Date('2026-11-13T08:00:00.000Z') },
    });
    expect(h.tx.authSession.create).not.toHaveBeenCalled();
    expect(h.tx.user.update).not.toHaveBeenCalled();
    expect(h.tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(h.tx.refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        sessionId: SESSION_ID,
        tokenHash: sha256(NEW_REFRESH),
        expiresAt: h.rotatedSession.expiresAt,
      },
    });
    expect(h.jwt.signAsync).toHaveBeenCalledTimes(1);
    expect(h.jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: USER_ID,
        sid: SESSION_ID,
        roles: ['USER', 'CONTENT_ADMIN'],
        type: 'access',
        userVersion: '7',
        sessionVersion: '3',
        jti: ACCESS_JTI,
      },
      { expiresIn: 900 },
    );
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith(h.user);
    expect(h.avatars.url).toHaveBeenCalledWith(null);
    expect(result).toEqual({
      user: {
        userId: USER_ID,
        email: h.user.email,
        fullName: h.user.fullName,
        phoneNumber: null,
        avatarKey: null,
        avatarUrl: null,
        status: 'ACTIVE',
        roles: ['CONTENT_ADMIN', 'USER'],
        createdAt: h.user.createdAt.toISOString(),
        updatedAt: h.user.updatedAt.toISOString(),
      },
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: NEW_REFRESH,
      refreshExpiresIn: 604800,
    });
    expect(result.refreshToken).not.toBe(OLD_REFRESH);
    for (const value of ['passwordHash', h.user.passwordHash!, OLD_REFRESH])
      expect(JSON.stringify(result)).not.toContain(value);
    expect(JSON.stringify(h.tx.refreshToken.create.mock.calls)).not.toContain(NEW_REFRESH);
    expect(JSON.stringify(h.prisma.refreshToken.findUnique.mock.calls)).not.toContain(OLD_REFRESH);
    expect(h.user).toEqual(before.user);
    expect(h.session).toEqual(before.session);
    expect(h.currentToken).toEqual(before.token);
    expect(comparePassword).not.toHaveBeenCalled();
    expect(h.authorization.invalidate).not.toHaveBeenCalled();
    expect(h.mail.enqueue).not.toHaveBeenCalled();
    const order = [
      h.tx.refreshToken.updateMany,
      h.tx.authSession.update,
      h.tx.refreshToken.create,
      h.jwt.signAsync,
      present,
    ];
    for (let i = 1; i < order.length; i++)
      expect(order[i - 1].mock.invocationCallOrder[0]).toBeLessThan(
        order[i].mock.invocationCallOrder[0],
      );
  });

  it('runs the configured RefreshRequest body pipe and delegates once through the controller', async () => {
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, AuthController, 'refresh') as Record<
      string,
      { pipes: unknown[] }
    >;
    const pipe = metadata[`${RouteParamtypes.BODY}:0`].pipes[0];
    expect(pipe).toBeInstanceOf(ContractPipe);
    const dto = (pipe as ContractPipe).transform({ refreshToken: OLD_REFRESH }) as {
      refreshToken: string;
    };
    const refresh = jest.spyOn(h.service, 'refresh');
    const result = await new AuthController(h.service).refresh(dto);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith(OLD_REFRESH);
    expect(result.user.userId).toBe(USER_ID);
    expect(h.tx.authSession.update).toHaveBeenCalledTimes(1);
  });

  it('uses the current identity roles and preserves bigint version precision', async () => {
    h.user.authorizationVersion = 9007199254740993n;
    h.session.version = 9007199254740995n;
    h.rotatedSession.version = h.session.version;
    h.user.roles = h.user.roles.filter((role) => role.roleCode === 'USER');
    const result = await h.service.refresh(OLD_REFRESH);
    expect(h.jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['USER'],
        userVersion: '9007199254740993',
        sessionVersion: '9007199254740995',
        sub: USER_ID,
        sid: SESSION_ID,
      }),
      { expiresIn: 900 },
    );
    expect(result.user.roles).toEqual(['USER']);
    expect(h.tx.authSession.update.mock.calls[0][0].data).toEqual({
      expiresAt: new Date(AUTH_NOW.getTime() + WEEK_MS),
    });
  });

  it('accepts session and refresh expiry one millisecond after now', async () => {
    h.session.expiresAt = new Date(AUTH_NOW.getTime() + 1);
    h.currentToken.expiresAt = new Date(AUTH_NOW.getTime() + 1);
    await expect(h.service.refresh(OLD_REFRESH)).resolves.toMatchObject({
      user: { userId: USER_ID },
      refreshToken: NEW_REFRESH,
    });
    expect(h.tx.authSession.update).toHaveBeenCalledTimes(1);
  });

  // Guard branches support valid rotation coverage; they are not a separate UT-006 acceptance.
  it.each(['missing token', 'missing sessionId'] as const)(
    'refuses %s before starting a transaction',
    async (kind) => {
      if (kind === 'missing token') h.prisma.refreshToken.findUnique.mockResolvedValue(null);
      else h.foundToken.sessionId = null;
      await expectInvalid();
      expect(h.prisma.$transaction).not.toHaveBeenCalled();
      expectNoRotation();
    },
  );

  it.each([
    {
      name: 'inactive user',
      setup: (h: AuthHarness) => {
        h.user.status = 'INACTIVE';
      },
    },
    {
      name: 'suspended user',
      setup: (h: AuthHarness) => {
        h.user.status = 'SUSPENDED';
      },
    },
    {
      name: 'missing session',
      setup: (h: AuthHarness) => {
        h.tx.authSession.findUnique.mockResolvedValue(null);
      },
    },
    {
      name: 'foreign session owner',
      setup: (h: AuthHarness) => {
        h.session.userId = 'another-user';
      },
    },
    {
      name: 'revoked session',
      setup: (h: AuthHarness) => {
        h.session.revokedAt = AUTH_NOW;
      },
    },
    {
      name: 'session expires exactly now',
      setup: (h: AuthHarness) => {
        h.session.expiresAt = AUTH_NOW;
      },
    },
    {
      name: 'session expired one millisecond ago',
      setup: (h: AuthHarness) => {
        h.session.expiresAt = new Date(AUTH_NOW.getTime() - 1);
      },
    },
    {
      name: 'revoked refresh token',
      setup: (h: AuthHarness) => {
        h.currentToken.revokedAt = AUTH_NOW;
      },
    },
    {
      name: 'consumed refresh token',
      setup: (h: AuthHarness) => {
        h.currentToken.consumedAt = AUTH_NOW;
      },
    },
    {
      name: 'refresh expires exactly now',
      setup: (h: AuthHarness) => {
        h.currentToken.expiresAt = AUTH_NOW;
      },
    },
    {
      name: 'refresh expired one millisecond ago',
      setup: (h: AuthHarness) => {
        h.currentToken.expiresAt = new Date(AUTH_NOW.getTime() - 1);
      },
    },
  ])('does not rotate when the locked current state has $name', async ({ setup }) => {
    setup(h);
    await expectInvalid();
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
    expectNoRotation();
  });

  it('refuses a lost atomic consume instead of issuing another token pair', async () => {
    h.tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expectInvalid();
    expect(h.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(h.tx.authSession.update).not.toHaveBeenCalled();
    expectNoTokens(h);
  });

  it('does not rotate when the user disappears before the row lock is read', async () => {
    h.tx.user.findUnique.mockResolvedValue(null);
    await expect(h.service.refresh(OLD_REFRESH)).rejects.toMatchObject({
      status: 404,
      response: { code: 'USER_NOT_FOUND', message: 'USER_NOT_FOUND' },
    });
    expectNoRotation();
  });

  it.each(['consume', 'renew', 'refresh-write', 'jwt'] as const)(
    'propagates %s failure without reporting refresh success',
    async (stage) => {
      const error = new Error(`${stage} unavailable`);
      const actions = {
        consume: h.tx.refreshToken.updateMany,
        renew: h.tx.authSession.update,
        'refresh-write': h.tx.refreshToken.create,
        jwt: h.jwt.signAsync,
      };
      actions[stage].mockRejectedValueOnce(error);
      await expect(h.service.refresh(OLD_REFRESH)).rejects.toBe(error);
      const steps = Object.keys(actions) as Array<keyof typeof actions>;
      for (const later of steps.slice(steps.indexOf(stage) + 1))
        expect(actions[later]).not.toHaveBeenCalled();
      expect(h.avatars.url).not.toHaveBeenCalled();
      // A mock callback does not prove real database rollback under failure/concurrency.
    },
  );
});
