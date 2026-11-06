import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { AuthorizationStateVerifier } from '@toeic/common';
import * as bcrypt from 'bcrypt';
import { AuthSession, RefreshToken } from '../../src/generated/prisma';
import { IdentityTx, IdentityUser } from '../../src/identity';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ActivationMailService } from '../../src/modules/auth/activation-mail.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AvatarService } from '../../src/modules/users/avatar.service';
import { UserPresenter } from '../../src/modules/users/user-presenter';

export const AUTH_NOW = new Date('2026-11-06T08:00:00.000Z');
export const WEEK_MS = 604800000;
export const LOCK_MS = 900000;
export const USER_ID = '20000000-0000-4000-8000-000000000002';
export const SESSION_ID = '30000000-0000-4000-8000-000000000002';
export const OLD_REFRESH = '40000000-0000-4000-8000-000000000001';
export const NEW_REFRESH = '40000000-0000-4000-8000-000000000002';
export const ACCESS_JTI = '40000000-0000-4000-8000-000000000003';
export const DUMMY_HASH = 'unit-only-dummy-bcrypt-hash';
export const loginInput = {
  email: '  Learner@Example.TEST  ',
  password: 'Wrong-Password-123!',
  deviceId: 'unit-web-device',
};
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const comparePassword = bcrypt.compare as jest.MockedFunction<
  (password: string, hash: string) => Promise<boolean>
>;
export const hashPassword = bcrypt.hash as jest.MockedFunction<
  (password: string, rounds: number) => Promise<string>
>;

function userRole(roleCode: string): IdentityUser['roles'][number] {
  return {
    userId: USER_ID,
    roleCode,
    legacyRoleId: null,
    role: { id: `role-${roleCode}`, roleCode, name: roleCode },
  };
}

/** All persistence/crypto/network boundaries are injected. Real helpers and presenter run.
 * The transaction mock executes the callback; it does not simulate PostgreSQL rollback.
 * Calling suites must jest.mock('bcrypt') and mock only randomUUID in node:crypto.
 */
export function createAuthHarness() {
  hashPassword.mockResolvedValue(DUMMY_HASH);
  comparePassword.mockResolvedValue(true);
  jest
    .mocked(randomUUID)
    .mockImplementation(() => {
      throw new Error('Unexpected extra token generation');
    })
    .mockReturnValueOnce(NEW_REFRESH)
    .mockReturnValueOnce(ACCESS_JTI);
  const user: IdentityUser = {
    id: USER_ID,
    email: 'learner@example.test',
    passwordHash: 'unit-only-stored-password-hash',
    fullName: 'Unit test learner',
    phoneNumber: null,
    legacyAvatarUrl: null,
    avatarKey: null,
    status: 'ACTIVE',
    failedLoginCount: 3,
    lockedUntil: null,
    authorizationVersion: 7n,
    roles: [userRole('USER'), userRole('CONTENT_ADMIN')],
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: AUTH_NOW,
  };
  const foundUser = { ...user };
  const session: AuthSession = {
    id: SESSION_ID,
    userId: USER_ID,
    deviceId: loginInput.deviceId,
    version: 3n,
    expiresAt: new Date(AUTH_NOW.getTime() + 60000),
    revokedAt: null,
    createdAt: new Date(AUTH_NOW.getTime() - 60000),
  };
  const currentToken: RefreshToken = {
    id: '50000000-0000-4000-8000-000000000001',
    userId: USER_ID,
    sessionId: SESSION_ID,
    tokenHash: sha256(OLD_REFRESH),
    expiresAt: new Date(AUTH_NOW.getTime() + 45000),
    consumedAt: null,
    revokedAt: null,
    createdAt: session.createdAt,
  };
  const foundToken = { ...currentToken };
  const rotatedSession = { ...session, expiresAt: new Date(AUTH_NOW.getTime() + WEEK_MS) };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: USER_ID }]),
    user: {
      findUnique: jest.fn().mockImplementation(async () => user),
      update: jest.fn().mockResolvedValue(user),
    },
    authSession: {
      findUnique: jest.fn().mockImplementation(async () => session),
      create: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockResolvedValue(rotatedSession),
    },
    refreshToken: {
      findUniqueOrThrow: jest.fn().mockImplementation(async () => currentToken),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'new-refresh-row' }),
    },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockImplementation(async () => foundUser) },
    refreshToken: { findUnique: jest.fn().mockImplementation(async () => foundToken) },
    $transaction: jest.fn((callback: (db: IdentityTx) => Promise<unknown>) =>
      callback(tx as unknown as IdentityTx),
    ),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('mock-access-token') };
  const avatars = { url: jest.fn().mockResolvedValue(null) };
  const mail = { enqueue: jest.fn() };
  const authorization = { invalidate: jest.fn() };
  const presenter = new UserPresenter(avatars as unknown as AvatarService);
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    mail as unknown as ActivationMailService,
    presenter,
    authorization as unknown as AuthorizationStateVerifier,
  );
  return {
    service,
    prisma,
    tx,
    jwt,
    avatars,
    mail,
    authorization,
    presenter,
    user,
    foundUser,
    session,
    currentToken,
    foundToken,
    rotatedSession,
  };
}

export type AuthHarness = ReturnType<typeof createAuthHarness>;

export function expectNoTokens(h: AuthHarness) {
  expect(h.tx.authSession.create).not.toHaveBeenCalled();
  expect(h.tx.refreshToken.create).not.toHaveBeenCalled();
  expect(h.jwt.signAsync).not.toHaveBeenCalled();
  expect(randomUUID).not.toHaveBeenCalled();
  expect(h.avatars.url).not.toHaveBeenCalled();
}
