import { createHash, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthorizationStateVerifier } from '@toeic/common';
import * as bcrypt from 'bcrypt';
import { AuthSession } from '../../generated/prisma';
import { IdentityTx, IdentityUser, identityInclude } from '../../identity';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarService } from '../users/avatar.service';
import { UserPresenter } from '../users/user-presenter';
import { ActivationMailService } from './activation-mail.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

const NOW = new Date('2026-11-06T07:00:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_ID = '10000000-0000-4000-8000-000000000001';
const ACCESS_ID = '10000000-0000-4000-8000-000000000002';
const USER_ID = '20000000-0000-4000-8000-000000000001';
const SESSION_ID = '30000000-0000-4000-8000-000000000001';
const DUMMY_HASH = 'dummy-hash-for-unknown-user';
const comparePassword = bcrypt.compare as jest.MockedFunction<
  (password: string, hash: string) => Promise<boolean>
>;
const hashPassword = bcrypt.hash as jest.MockedFunction<
  (password: string, rounds: number) => Promise<string>
>;
const dto = { email: '  Learner@Example.TEST  ', password: 'Valid-Test-123!', deviceId: 'web-qa' };

function role(roleCode: string): IdentityUser['roles'][number] {
  return {
    userId: USER_ID,
    roleCode,
    legacyRoleId: null,
    role: { id: `role-${roleCode}`, roleCode, name: roleCode },
  };
}

function activeUser(): IdentityUser {
  return {
    id: USER_ID,
    email: 'learner@example.test',
    passwordHash: 'stored-password-hash',
    fullName: 'Learner',
    phoneNumber: '0900000000',
    legacyAvatarUrl: null,
    avatarKey: 'avatars/learner.png',
    status: 'ACTIVE',
    failedLoginCount: 3,
    lockedUntil: null,
    authorizationVersion: 7n,
    roles: [role('USER'), role('CONTENT_ADMIN')],
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  };
}

/**
 * UT-001: docs/Test Report.xlsx, sheet "Unit test", row 12.
 * One requirement with supporting branch/boundary checks, not 24 completed requirements.
 * Run from repository root: npm run test:unit
 * Real code: controller.login -> service.login -> lockedUser -> issueTokens -> presenter.
 * Direct controller invocation does not exercise Nest pipes, HTTP, Gateway or cookies.
 */
describe('UT-001 | valid login creates exactly one session and token pair', () => {
  let found: IdentityUser;
  let locked: IdentityUser;
  let currentUser: IdentityUser;
  let session: AuthSession;
  let service: AuthService;
  let presenter: UserPresenter;
  let prisma: {
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    $queryRaw: jest.Mock;
    user: { findUnique: jest.Mock; update: jest.Mock };
    authSession: { create: jest.Mock };
    refreshToken: { create: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock };
  let avatars: { url: jest.Mock };
  let mail: { enqueue: jest.Mock };
  let authorization: { invalidate: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    hashPassword.mockResolvedValue(DUMMY_HASH);
    comparePassword.mockResolvedValue(true);
    jest
      .mocked(randomUUID)
      .mockImplementation(() => {
        throw new Error('Unexpected extra token generation');
      })
      .mockReturnValueOnce(REFRESH_ID)
      .mockReturnValueOnce(ACCESS_ID);

    found = activeUser();
    locked = { ...found };
    // Deliberately differs from the initial lookup: token/presenter must use the updated row.
    currentUser = {
      ...locked,
      fullName: 'Current learner name',
      failedLoginCount: 0,
      lockedUntil: null,
      updatedAt: NOW,
    };
    session = {
      id: SESSION_ID,
      userId: USER_ID,
      deviceId: dto.deviceId,
      version: 3n,
      expiresAt: new Date(NOW.getTime() + WEEK_MS),
      revokedAt: null,
      createdAt: NOW,
    };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: USER_ID }]),
      user: {
        findUnique: jest.fn().mockImplementation(async () => locked),
        update: jest.fn().mockImplementation(async () => currentUser),
      },
      authSession: { create: jest.fn().mockResolvedValue(session) },
      refreshToken: { create: jest.fn().mockResolvedValue({ id: 'refresh-row' }) },
    };
    prisma = {
      user: { findUnique: jest.fn().mockImplementation(async () => found) },
      // Execute the real transaction callback against a separate transaction mock.
      // This mock does not simulate PostgreSQL rollback or concurrent row locks.
      $transaction: jest.fn((callback: (db: IdentityTx) => Promise<unknown>) =>
        callback(tx as unknown as IdentityTx),
      ),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('mock-signed-access-token') };
    avatars = { url: jest.fn().mockResolvedValue('https://media.example.test/learner.png') };
    mail = { enqueue: jest.fn() };
    authorization = { invalidate: jest.fn() };
    presenter = new UserPresenter(avatars as unknown as AvatarService);
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mail as unknown as ActivationMailService,
      presenter,
      authorization as unknown as AuthorizationStateVerifier,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  function expectNoTokens() {
    expect(tx.authSession.create).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(randomUUID).not.toHaveBeenCalled();
    expect(avatars.url).not.toHaveBeenCalled();
  }

  async function expectFailure(status: number, code: string) {
    // Enforce the concrete Nest error and body, not just a matching message.
    const error: unknown = await service.login(dto).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).getResponse()).toEqual({
      code,
      message: code === 'USER_NOT_FOUND' ? code : 'Invalid credentials',
    });
    expectNoTokens();
  }

  it('UT-001/N01: returns the correct safe user, resets failures and writes each record once', async () => {
    const present = jest.spyOn(presenter, 'present'); // Call through to the real serializer.

    const result = await service.login(dto);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'learner@example.test' },
    });
    expect(comparePassword).toHaveBeenCalledTimes(1);
    expect(comparePassword).toHaveBeenCalledWith(dto.password, found.passwordHash);
    // Only the constructor's timing-defense hash runs; login never rehashes the password.
    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(hashPassword).toHaveBeenCalledWith(expect.any(String), 12);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0]).toEqual([
      ['SELECT id FROM users WHERE id=', ' FOR UPDATE'],
      USER_ID,
    ]);
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      include: identityInclude,
    });
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { failedLoginCount: 0, lockedUntil: null },
      include: identityInclude,
    });
    expect(tx.authSession.create).toHaveBeenCalledTimes(1);
    expect(tx.authSession.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        deviceId: dto.deviceId,
        expiresAt: new Date('2026-11-13T07:00:00.000Z'),
      },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        sessionId: SESSION_ID,
        tokenHash: createHash('sha256').update(REFRESH_ID).digest('hex'),
        expiresAt: session.expiresAt,
      },
    });
    expect(JSON.stringify(tx.refreshToken.create.mock.calls)).not.toContain(REFRESH_ID);
    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: USER_ID,
        sid: SESSION_ID,
        roles: ['USER', 'CONTENT_ADMIN'],
        type: 'access',
        userVersion: '7',
        sessionVersion: '3',
        jti: ACCESS_ID,
      },
      { expiresIn: 900 },
    );
    expect(randomUUID).toHaveBeenCalledTimes(2); // Refresh ID and access jti are distinct.
    expect(present).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledWith(currentUser);
    expect(avatars.url).toHaveBeenCalledTimes(1);
    expect(avatars.url).toHaveBeenCalledWith(currentUser.avatarKey);
    expect(result).toEqual({
      user: {
        userId: USER_ID,
        email: 'learner@example.test',
        fullName: 'Current learner name',
        phoneNumber: '0900000000',
        avatarKey: 'avatars/learner.png',
        avatarUrl: 'https://media.example.test/learner.png',
        status: 'ACTIVE',
        roles: ['CONTENT_ADMIN', 'USER'],
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: NOW.toISOString(),
      },
      accessToken: 'mock-signed-access-token',
      refreshToken: REFRESH_ID,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 604800,
    });
    expect(result!.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(found.passwordHash);
    expect(mail.enqueue).not.toHaveBeenCalled();
    expect(authorization.invalidate).not.toHaveBeenCalled();
    expect(tx.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      tx.authSession.create.mock.invocationCallOrder[0],
    );
    expect(tx.authSession.create.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    expect(tx.refreshToken.create.mock.invocationCallOrder[0]).toBeLessThan(
      jwt.signAsync.mock.invocationCallOrder[0],
    );
  });

  it('UT-001/N02: controller delegates the DTO exactly once to the real service', async () => {
    const login = jest.spyOn(service, 'login');
    const result = await new AuthController(service).login(dto);
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ user: { userId: USER_ID }, tokenType: 'Bearer' });
    expect(tx.authSession.create).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 0])('UT-001/B01: permits valid login at lock expiry %i ms', async (offset) => {
    locked.lockedUntil = new Date(NOW.getTime() + offset);
    locked.failedLoginCount = 5;
    const result = await service.login(dto);
    expect(result).toMatchObject({ user: { userId: USER_ID } });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginCount: 0, lockedUntil: null } }),
    );
    expect(tx.authSession.create).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
  });

  it('UT-001/B02: refuses login one millisecond before the lock expires', async () => {
    locked.lockedUntil = new Date(NOW.getTime() + 1);
    await expectFailure(401, 'TEMPORARILY_LOCKED');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  // Supporting negative paths for login branch coverage; these do not complete UT-002/003.
  it.each([0, 3, 4])(
    'UT-001/A01: wrong password with %i prior failures issues no tokens',
    async (prior) => {
      comparePassword.mockResolvedValue(false);
      locked.failedLoginCount = prior;
      await expectFailure(401, 'INVALID_CREDENTIALS');
      expect(tx.user.update).toHaveBeenCalledTimes(1);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          failedLoginCount: prior + 1,
          lockedUntil: prior === 4 ? new Date(NOW.getTime() + 900000) : null,
        },
      });
    },
  );

  it('UT-001/B03: expired lock restarts failed count at one on a wrong password', async () => {
    comparePassword.mockResolvedValue(false);
    locked.lockedUntil = new Date(NOW.getTime() - 1);
    locked.failedLoginCount = 5;
    await expectFailure(401, 'INVALID_CREDENTIALS');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { failedLoginCount: 1, lockedUntil: null },
    });
  });

  it('UT-001/A02: a changed password under the row lock cannot create a session', async () => {
    locked.passwordHash = 'concurrently-changed-password-hash';
    await expectFailure(401, 'INVALID_CREDENTIALS');
    expect(comparePassword).toHaveBeenCalledWith(dto.password, found.passwordHash);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { failedLoginCount: 4, lockedUntil: null },
    });
  });

  it.each(['INACTIVE', 'SUSPENDED'] as const)(
    'UT-001/A03: rejects a matching password when the locked user is %s',
    async (status) => {
      locked.status = status;
      await expectFailure(403, 'ACCOUNT_NOT_ACTIVE');
      expect(tx.user.update).not.toHaveBeenCalled();
    },
  );

  it('UT-001/A04: an unknown email uses the dummy hash and performs no transaction', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    comparePassword.mockResolvedValue(false);
    await expectFailure(401, 'INVALID_CREDENTIALS');
    expect(comparePassword).toHaveBeenCalledTimes(1);
    expect(comparePassword).toHaveBeenCalledWith(dto.password, DUMMY_HASH);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('UT-001/A05: a user without a password hash uses the dummy comparison', async () => {
    found.passwordHash = null;
    locked.passwordHash = null;
    comparePassword.mockResolvedValue(false);
    await expectFailure(401, 'INVALID_CREDENTIALS');
    expect(comparePassword).toHaveBeenCalledWith(dto.password, DUMMY_HASH);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('UT-001/A06: a user removed between lookup and row lock creates no tokens', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expectFailure(404, 'USER_NOT_FOUND');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each(['lookup', 'password', 'reset', 'session', 'refresh', 'jwt', 'presenter'] as const)(
    'UT-001/A07: propagates %s dependency failure without reporting login success',
    async (stage) => {
      const error = new Error(`${stage} unavailable`);
      const stages = {
        lookup: prisma.user.findUnique,
        password: comparePassword,
        reset: tx.user.update,
        session: tx.authSession.create,
        refresh: tx.refreshToken.create,
        jwt: jwt.signAsync,
        presenter: avatars.url,
      };
      stages[stage].mockRejectedValueOnce(error);
      await expect(service.login(dto)).rejects.toBe(error);
      const order = Object.keys(stages) as Array<keyof typeof stages>;
      for (const later of order.slice(order.indexOf(stage) + 1))
        expect(stages[later]).not.toHaveBeenCalled();
      // These assertions prove rejection and sequencing, not real database rollback.
      expect(stages[stage]).toHaveBeenCalledTimes(1);
    },
  );
});
