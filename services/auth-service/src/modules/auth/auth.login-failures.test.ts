import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { identityInclude } from '../../identity';
import {
  AUTH_NOW,
  AuthHarness,
  DUMMY_HASH,
  LOCK_MS,
  USER_ID,
  comparePassword,
  createAuthHarness,
  expectNoTokens,
  hashPassword,
  loginInput,
} from '../../../test/helpers/auth-harness';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

// Separate suite: the original UT-001 source and fixtures remain unchanged.
describe('Login rejection requirements', () => {
  let h: AuthHarness;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(AUTH_NOW);
    h = createAuthHarness();
    comparePassword.mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  async function rejectLogin(code = 'INVALID_CREDENTIALS') {
    const error: unknown = await h.service.login(loginInput).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    const response = (error as HttpException).getResponse();
    expect(response).toEqual({ code, message: 'Invalid credentials' });
    for (const sensitive of [
      h.user.email,
      h.user.passwordHash!,
      DUMMY_HASH,
      'passwordHash',
      'accessToken',
      'refreshToken',
      'userId',
    ])
      expect(JSON.stringify(response)).not.toContain(sensitive);
    expectNoTokens(h);
    return response;
  }

  describe('UT-002 | wrong password', () => {
    it.each([0, 1, 3, 4])(
      'increments %i previous failures once, locking at the fifth failure',
      async (prior) => {
        h.user.failedLoginCount = prior;

        await rejectLogin();

        expect(h.prisma.user.findUnique).toHaveBeenCalledTimes(1);
        expect(h.prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'learner@example.test' },
        });
        expect(comparePassword).toHaveBeenCalledTimes(1);
        expect(comparePassword).toHaveBeenCalledWith(loginInput.password, h.foundUser.passwordHash);
        expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(h.tx.user.findUnique).toHaveBeenCalledWith({
          where: { id: USER_ID },
          include: identityInclude,
        });
        expect(h.tx.user.update).toHaveBeenCalledTimes(1);
        expect(h.tx.user.update).toHaveBeenCalledWith({
          where: { id: USER_ID },
          data: {
            failedLoginCount: prior + 1,
            lockedUntil: prior === 4 ? new Date(AUTH_NOW.getTime() + LOCK_MS) : null,
          },
        });
        expect(h.tx.authSession.update).not.toHaveBeenCalled();
        expect(h.mail.enqueue).not.toHaveBeenCalled();
        expect(h.authorization.invalidate).not.toHaveBeenCalled();
      },
    );

    it('preserves an active lock one millisecond before expiry without another counter write', async () => {
      h.user.failedLoginCount = 5;
      h.user.lockedUntil = new Date(AUTH_NOW.getTime() + 1);
      await rejectLogin('TEMPORARILY_LOCKED');
      expect(h.tx.user.update).not.toHaveBeenCalled();
    });

    it.each([-1, 0])(
      'restarts the counter at one when the previous lock expires at now %i ms',
      async (offset) => {
        h.user.failedLoginCount = 5;
        h.user.lockedUntil = new Date(AUTH_NOW.getTime() + offset);
        await rejectLogin();
        expect(h.tx.user.update).toHaveBeenCalledTimes(1);
        expect(h.tx.user.update).toHaveBeenCalledWith({
          where: { id: USER_ID },
          data: { failedLoginCount: 1, lockedUntil: null },
        });
      },
    );

    it('locks after five consecutive failures, blocks retry, and restarts after exactly 15 minutes', async () => {
      // Stateful DB stub only: real login decisions and failure updates still run.
      h.user.failedLoginCount = 0;
      h.tx.user.update.mockImplementation(
        async ({ data }: { data: { failedLoginCount: number; lockedUntil: Date | null } }) => {
          Object.assign(h.user, data);
          return h.user;
        },
      );
      for (let failure = 1; failure <= 5; failure++) {
        await rejectLogin();
        expect(h.user.failedLoginCount).toBe(failure);
        expect(h.user.lockedUntil).toEqual(
          failure === 5 ? new Date(AUTH_NOW.getTime() + LOCK_MS) : null,
        );
      }
      await rejectLogin('TEMPORARILY_LOCKED');
      expect(h.tx.user.update).toHaveBeenCalledTimes(5);
      jest.advanceTimersByTime(LOCK_MS);
      await rejectLogin();
      expect(h.tx.user.update).toHaveBeenCalledTimes(6);
      expect(h.user.failedLoginCount).toBe(1);
      expect(h.user.lockedUntil).toBeNull();
      expect(randomUUID).not.toHaveBeenCalled();
    });
  });

  describe('UT-003 | unknown account', () => {
    it.each([false, true])(
      'rejects a null lookup even when the dummy comparison returns %s',
      async (comparison) => {
        h.prisma.user.findUnique.mockResolvedValue(null);
        comparePassword.mockResolvedValue(comparison);

        await rejectLogin();

        expect(h.prisma.user.findUnique).toHaveBeenCalledTimes(1);
        expect(h.prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'learner@example.test' },
        });
        expect(hashPassword).toHaveBeenCalledTimes(1); // Constructor timing-defense hash.
        expect(hashPassword).toHaveBeenCalledWith(expect.any(String), 12);
        expect(comparePassword).toHaveBeenCalledTimes(1);
        expect(comparePassword).toHaveBeenCalledWith(loginInput.password, DUMMY_HASH);
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
        expect(h.tx.$queryRaw).not.toHaveBeenCalled();
        expect(h.tx.user.findUnique).not.toHaveBeenCalled();
        expect(h.tx.user.update).not.toHaveBeenCalled();
      },
    );

    it('returns the same public status and body as a known account with a wrong password', async () => {
      const wrongPassword = await rejectLogin();
      const writesBefore = h.tx.user.update.mock.calls.length;
      const transactionsBefore = h.prisma.$transaction.mock.calls.length;
      h.prisma.user.findUnique.mockResolvedValue(null);

      const unknownAccount = await rejectLogin();

      expect(unknownAccount).toEqual(wrongPassword);
      expect(h.tx.user.update).toHaveBeenCalledTimes(writesBefore);
      expect(h.prisma.$transaction).toHaveBeenCalledTimes(transactionsBefore);
      expect(comparePassword).toHaveBeenLastCalledWith(loginInput.password, DUMMY_HASH);
      // Equal response shape is asserted; elapsed time/side-channel resistance needs other tests.
    });
  });
});
