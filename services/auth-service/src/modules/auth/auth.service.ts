import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthorizationStateVerifier, JwtPayload, writeOutbox } from '@toeic/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IdentityTx,
  IdentityUser,
  authorizationChanged,
  failure,
  identityInclude,
  lockedUser,
  tokenHash,
} from '../../identity';
import { ActivationMailService } from './activation-mail.service';
import { UserPresenter } from '../users/user-presenter';
import { AuthSession } from '../../generated/prisma';
import { SyncUserDto } from './dto/sync.dto';

@Injectable()
export class AuthService {
  private readonly dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: ActivationMailService,
    private readonly presenter: UserPresenter,
    private readonly authorization: AuthorizationStateVerifier,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
  }) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            fullName: dto.fullName,
            status: 'INACTIVE',
            roles: { create: { roleCode: 'USER' } },
          },
          include: identityInclude,
        });
        await this.mail.enqueue(tx, created.id);
        return created;
      });
      return { user: await this.presenter.present(user), activationRequired: true };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') failure(409, 'EMAIL_ALREADY_REGISTERED');
      throw error;
    }
  }
  async verifyEmail(token: string) {
    const activation = await this.prisma.emailActivation.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!activation) failure(400, 'INVALID_ACTIVATION_TOKEN');
    await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, activation.userId);
      const current = await tx.emailActivation.findUniqueOrThrow({ where: { id: activation.id } });
      if (current.consumedAt || current.expiresAt <= new Date() || user.status !== 'INACTIVE')
        failure(400, 'INVALID_ACTIVATION_TOKEN');
      await tx.emailActivation.update({
        where: { id: current.id },
        data: { consumedAt: new Date() },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
      });
      await tx.emailDelivery.updateMany({
        where: { userId: user.id, deliveredAt: null },
        data: { deliveredAt: new Date(), encryptedToken: null },
      });
    });
    return { message: 'Email verified' };
  }
  async resend(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user)
      await this.prisma.$transaction(async (tx) => {
        const current = await lockedUser(tx, user.id);
        if (current.status !== 'INACTIVE') return;
        const latest = await tx.emailActivation.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
        const count = await tx.emailActivation.count({
          where: {
            userId: user.id,
            isResend: true,
            createdAt: { gte: new Date(Date.now() - 3600000) },
          },
        });
        if ((latest && latest.createdAt.getTime() > Date.now() - 60000) || count >= 5) return;
        await this.mail.enqueue(tx, user.id, true);
      });
    // Same status and body for unknown, active, throttled and eligible accounts.
    return { message: 'If eligible, a verification email will be sent' };
  }
  async login(dto: { email: string; password: string; deviceId: string }) {
    const found = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = await bcrypt.compare(dto.password, found?.passwordHash || (await this.dummyHash));
    if (!found) failure(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, found.id),
        now = new Date();
      if (user.lockedUntil && user.lockedUntil > now) return { error: 'TEMPORARILY_LOCKED' };
      if (!valid || user.passwordHash !== found.passwordHash) {
        const failed = (user.lockedUntil ? 0 : user.failedLoginCount) + 1;
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed,
            lockedUntil: failed >= 5 ? new Date(Date.now() + 900000) : null,
          },
        });
        return { error: 'INVALID_CREDENTIALS' };
      }
      if (user.status !== 'ACTIVE') return { error: 'ACCOUNT_NOT_ACTIVE' };
      const currentUser = await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
        include: identityInclude,
      });
      const session = await tx.authSession.create({
        data: {
          userId: user.id,
          deviceId: dto.deviceId,
          expiresAt: new Date(Date.now() + 604800000),
        },
      });
      return { tokens: await this.issueTokens(tx, currentUser, session) };
    });
    if (result.error)
      failure(
        result.error === 'ACCOUNT_NOT_ACTIVE' ? 403 : 401,
        result.error,
        'Invalid credentials',
      );
    return result.tokens;
  }
  private async issueTokens(tx: IdentityTx, user: IdentityUser, session: AuthSession) {
    const refreshToken = randomUUID();
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: tokenHash(refreshToken),
        expiresAt: session.expiresAt,
      },
    });
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        sid: session.id,
        roles: user.roles.map((r) => r.roleCode),
        type: 'access',
        userVersion: user.authorizationVersion.toString(),
        sessionVersion: session.version.toString(),
        jti: randomUUID(),
      },
      { expiresIn: 900 },
    );
    return {
      user: await this.presenter.present(user),
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken,
      refreshExpiresIn: 604800,
    };
  }
  async refresh(token: string) {
    const found = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!found?.sessionId) failure(401, 'INVALID_REFRESH_TOKEN');
    return this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, found.userId);
      const session = await tx.authSession.findUnique({ where: { id: found.sessionId! } });
      const current = await tx.refreshToken.findUniqueOrThrow({ where: { id: found.id } }),
        now = new Date();
      if (
        user.status !== 'ACTIVE' ||
        !session ||
        session.userId !== user.id ||
        session.revokedAt ||
        session.expiresAt <= now ||
        current.revokedAt ||
        current.consumedAt ||
        current.expiresAt <= now
      )
        failure(401, 'INVALID_REFRESH_TOKEN');
      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null, consumedAt: null },
        data: { revokedAt: now, consumedAt: now },
      });
      if (consumed.count !== 1) failure(401, 'INVALID_REFRESH_TOKEN');
      const rotated = await tx.authSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + 604800000) },
      });
      return this.issueTokens(tx, user, rotated);
    });
  }
  async logout(token: string, claims: JwtPayload) {
    const found = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!found || found.userId !== claims.sub || found.sessionId !== claims.sid)
      failure(401, 'INVALID_REFRESH_TOKEN');
    await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, claims.sub);
      const session = await tx.authSession.findUnique({ where: { id: found.sessionId! } });
      if (!session) return;
      if (session.userId !== user.id) failure(401, 'INVALID_REFRESH_TOKEN');
      if (session.revokedAt) return;
      const revoked = await tx.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), version: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await authorizationChanged(tx, user, 'LOGOUT', revoked);
    });
    this.authorization.invalidate(claims.sub);
    return { success: true };
  }
  async authorizationState(userId: string, sessionId: string) {
    // One indexed query gives a consistent identity/session/role snapshot without N+1 reads.
    const [session] = await this.prisma.$queryRaw<
      Array<{
        user_id: string;
        version: bigint;
        authorization_version: bigint;
        status: string;
        expires_at: Date;
        revoked_at: Date | null;
        roles: string[];
      }>
    >`SELECT s.user_id,s.version,s.expires_at,s.revoked_at,u.authorization_version,u.status::text,
      ARRAY(SELECT r.role_code FROM user_roles r WHERE r.user_id=u.id ORDER BY r.role_code) AS roles
      FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=${sessionId}`;
    if (!session || session.user_id !== userId) failure(404, 'SESSION_NOT_FOUND');
    return {
      userId,
      sessionId,
      userVersion: session.authorization_version.toString(),
      sessionVersion: session.version.toString(),
      status: session.status,
      roles: session.roles,
      sessionRevoked: !!session.revoked_at || session.expires_at <= new Date(),
      checkedAt: new Date().toISOString(),
      maxAgeSeconds: 30,
    };
  }
  // Legacy sync remains for P4; its event is not represented as a V2 acceptance.
  async sync(userId: string, dto: SyncUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const state = await tx.userSyncState.upsert({
        where: { userId_clientDeviceId: { userId, clientDeviceId: dto.clientDeviceId } },
        create: {
          userId,
          clientDeviceId: dto.clientDeviceId,
          lastSyncTime: new Date(dto.lastSyncTime),
          version: dto.version,
        },
        update: { lastSyncTime: new Date(dto.lastSyncTime), version: dto.version },
      });
      await writeOutbox(tx as never, {
        aggregateId: userId,
        eventType: 'UserSyncCompletedEvent',
        payload: {
          userId,
          clientDeviceId: dto.clientDeviceId,
          lastSyncTime: dto.lastSyncTime,
          version: dto.version,
        },
      });
      return state;
    });
  }
}
