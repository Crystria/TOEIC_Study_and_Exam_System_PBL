import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { JwtPayload } from '@toeic/common';
import { AuthController } from './auth.controller';
import scenarioData from '../../../../../tests/fixtures/group2-cases.json';
import {
  AUTH_NOW,
  AuthHarness,
  OLD_REFRESH,
  SESSION_ID,
  USER_ID,
  createAuthHarness,
  expectNoTokens,
  sha256,
} from '../../../test/helpers/auth-harness';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomUUID: jest.fn(),
}));

interface Profile {
  name: string;
  category: string;
  lookup?: string;
  binding?: string;
  userStatus?: string;
  user?: string;
  session?: string;
  token?: string;
  sessionOffset?: number;
  tokenOffset?: number;
  consumeRows?: number;
  dependency?: string;
  http?: number;
}
// One shared literal dataset drives Jest and the Excel condition/O vectors.
const cases: Record<string, Profile[]> = scenarioData;

describe('Session rejection and logout requirements', () => {
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

  async function httpError(work: Promise<unknown>, status: number) {
    const error: unknown = await work.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(status);
    expect((error as HttpException).getResponse()).toEqual({
      code: status === 404 ? 'USER_NOT_FOUND' : 'INVALID_REFRESH_TOKEN',
      message: status === 404 ? 'USER_NOT_FOUND' : 'INVALID_REFRESH_TOKEN',
    });
    expect(JSON.stringify((error as HttpException).getResponse())).not.toContain(OLD_REFRESH);
  }

  describe('UT-006 | invalid or expired refresh', () => {
    it.each(cases['UT-006'])('$name', async (c) => {
      if (c.lookup === 'missing') h.prisma.refreshToken.findUnique.mockResolvedValue(null);
      if (c.binding === 'missing') h.foundToken.sessionId = null;
      if (c.userStatus) h.user.status = c.userStatus as typeof h.user.status;
      if (c.user === 'missing') h.tx.user.findUnique.mockResolvedValue(null);
      if (c.session === 'missing') h.tx.authSession.findUnique.mockResolvedValue(null);
      if (c.session === 'foreign') h.session.userId = 'another-user';
      if (c.session === 'revoked') h.session.revokedAt = AUTH_NOW;
      if (c.sessionOffset !== undefined)
        h.session.expiresAt = new Date(+AUTH_NOW + c.sessionOffset);
      if (c.token === 'revoked') h.currentToken.revokedAt = AUTH_NOW;
      if (c.token === 'consumed') h.currentToken.consumedAt = AUTH_NOW;
      if (c.tokenOffset !== undefined)
        h.currentToken.expiresAt = new Date(+AUTH_NOW + c.tokenOffset);
      if (c.consumeRows !== undefined)
        h.tx.refreshToken.updateMany.mockResolvedValue({ count: c.consumeRows });
      const fault = new Error('injected refresh dependency failure');
      if (c.dependency === 'lookup') h.prisma.refreshToken.findUnique.mockRejectedValue(fault);
      if (c.dependency === 'token-read')
        h.tx.refreshToken.findUniqueOrThrow.mockRejectedValue(fault);
      const before = structuredClone({ user: h.user, session: h.session, token: h.currentToken });

      const work = h.service.refresh(OLD_REFRESH);
      if (c.dependency) await expect(work).rejects.toBe(fault);
      else await httpError(work, c.http ?? 401);

      expect(h.prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256(OLD_REFRESH) },
      });
      expectNoTokens(h);
      expect(h.tx.authSession.update).not.toHaveBeenCalled();
      expect(h.tx.user.update).not.toHaveBeenCalled();
      expect(h.authorization.invalidate).not.toHaveBeenCalled();
      if (c.consumeRows === undefined) expect(h.tx.refreshToken.updateMany).not.toHaveBeenCalled();
      else
        expect(h.tx.refreshToken.updateMany).toHaveBeenCalledWith({
          where: { id: h.currentToken.id, revokedAt: null, consumedAt: null },
          data: { revokedAt: AUTH_NOW, consumedAt: AUTH_NOW },
        });
      expect({ user: h.user, session: h.session, token: h.currentToken }).toEqual(before);
      if (c.lookup === 'missing' || c.binding === 'missing' || c.dependency === 'lookup')
        expect(h.prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('UT-007 | logout revokes the target session only', () => {
    it.each(cases['UT-007'])('$name', async (c) => {
      const claims = {
        sub: USER_ID,
        sid: SESSION_ID,
        roles: ['USER'],
        type: 'access',
      } as JwtPayload;
      const foreign = { ...h.session, id: 'other-session', userId: 'other-user' };
      const sibling = { ...h.session, id: 'same-user-other-session' };
      const sessions = [h.session, foreign, sibling];
      const tokens = [
        h.currentToken,
        { ...h.currentToken, id: 'foreign-refresh', sessionId: foreign.id, userId: foreign.userId },
        { ...h.currentToken, id: 'sibling-refresh', sessionId: sibling.id },
        { ...h.currentToken, id: 'already-revoked-refresh', revokedAt: new Date(+AUTH_NOW - 1000) },
      ];
      const unaffected = structuredClone([foreign, sibling, ...tokens.slice(1)]);
      const outbox = jest.fn().mockResolvedValue({ id: 'outbox-row' });
      Object.assign(h.tx, { outboxEvent: { create: outbox } });
      // Real authorizationChanged/writeV2Outbox/schema validation execute; only the DB boundary is mocked.
      jest.mocked(randomUUID).mockReset().mockReturnValue('90000000-0000-4000-8000-000000000001');
      h.tx.authSession.update.mockImplementation(async ({ where, data }) => {
        const target = sessions.find((session) => session.id === where.id)!;
        target.revokedAt = data.revokedAt as Date;
        target.version += 1n;
        return target;
      });
      h.tx.refreshToken.updateMany.mockImplementation(async ({ where, data }) => {
        let count = 0;
        for (const token of tokens)
          if (token.sessionId === where.sessionId && token.revokedAt === null) {
            token.revokedAt = data.revokedAt as Date;
            count++;
          }
        return { count };
      });
      if (c.lookup === 'missing') h.prisma.refreshToken.findUnique.mockResolvedValue(null);
      if (c.lookup === 'foreign-user') h.foundToken.userId = foreign.userId;
      if (c.lookup === 'foreign-session') h.foundToken.sessionId = sibling.id;
      if (c.lookup === 'unbound') h.foundToken.sessionId = null;
      if (c.session === 'foreign') h.session.userId = foreign.userId;
      if (c.session === 'missing') h.tx.authSession.findUnique.mockResolvedValue(null);
      if (c.session === 'revoked') h.session.revokedAt = new Date(+AUTH_NOW - 1000);
      if (c.user === 'missing') h.tx.user.findUnique.mockResolvedValue(null);
      const fault = new Error('injected logout dependency failure');
      const stages = {
        lookup: h.prisma.refreshToken.findUnique,
        'session-write': h.tx.authSession.update,
        'token-write': h.tx.refreshToken.updateMany,
        outbox,
      };
      if (c.dependency) stages[c.dependency as keyof typeof stages].mockRejectedValueOnce(fault);
      const before = structuredClone(h.session);

      const work = new AuthController(h.service).logout(claims, { refreshToken: OLD_REFRESH });
      if (c.dependency) await expect(work).rejects.toBe(fault);
      else if (c.http) await httpError(work, c.http);
      else await expect(work).resolves.toEqual({ success: true });

      expect(h.prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256(OLD_REFRESH) },
      });
      expect([foreign, sibling, ...tokens.slice(1)]).toEqual(unaffected);
      expect(h.tx.authSession.create).not.toHaveBeenCalled();
      expect(h.tx.refreshToken.create).not.toHaveBeenCalled();
      expect(h.jwt.signAsync).not.toHaveBeenCalled();
      expect(h.tx.user.update).not.toHaveBeenCalled();
      if (c.http || c.dependency) expect(h.authorization.invalidate).not.toHaveBeenCalled();
      else {
        expect(h.authorization.invalidate).toHaveBeenCalledTimes(1);
        expect(h.authorization.invalidate).toHaveBeenCalledWith(USER_ID);
      }
      if (!c.http && !c.dependency && !c.session) {
        expect(h.session).toEqual({ ...before, revokedAt: AUTH_NOW, version: before.version + 1n });
        expect(h.currentToken.revokedAt).toEqual(AUTH_NOW);
        expect(h.tx.authSession.update).toHaveBeenCalledWith({
          where: { id: SESSION_ID },
          data: { revokedAt: AUTH_NOW, version: { increment: 1 } },
        });
        expect(h.tx.refreshToken.updateMany).toHaveBeenCalledWith({
          where: { sessionId: SESSION_ID, revokedAt: null },
          data: { revokedAt: AUTH_NOW },
        });
        expect(outbox).toHaveBeenCalledTimes(1);
        expect(outbox.mock.calls[0][0].data.payload).toMatchObject({
          eventType: 'AuthorizationChangedEvent.v2',
          version: 2,
          producer: 'auth-service',
          payload: {
            userId: USER_ID,
            userVersion: '7',
            sessionId: SESSION_ID,
            sessionVersion: '4',
            reason: 'LOGOUT',
          },
        });
        expect(h.tx.authSession.update.mock.invocationCallOrder[0]).toBeLessThan(
          h.tx.refreshToken.updateMany.mock.invocationCallOrder[0],
        );
        expect(h.tx.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
          outbox.mock.invocationCallOrder[0],
        );
        expect(outbox.mock.invocationCallOrder[0]).toBeLessThan(
          h.authorization.invalidate.mock.invocationCallOrder[0],
        );
      } else if (!c.dependency) {
        expect(h.tx.authSession.update).not.toHaveBeenCalled();
        expect(h.tx.refreshToken.updateMany).not.toHaveBeenCalled();
        expect(outbox).not.toHaveBeenCalled();
        expect(h.session).toEqual(before);
      }
      // Callback mocks cannot prove PostgreSQL rollback on a failed later write.
    });
  });
});
