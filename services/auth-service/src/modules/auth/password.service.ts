import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AuthorizationStateVerifier, JwtPayload } from '@toeic/common';
import * as bcrypt from 'bcrypt';
import {
  AuditContext,
  IdentityTx,
  IdentityUser,
  authorizationChanged,
  failure,
  identityInclude,
  lockedUser,
  tokenHash,
} from '../../identity';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivationMailService } from './activation-mail.service';

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ActivationMailService,
    private readonly authorization: AuthorizationStateVerifier,
  ) {}

  async forgot(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await this.prisma.$transaction(async (tx) => {
        const current = await lockedUser(tx, user.id);
        if (current.status !== 'ACTIVE' || !current.passwordHash) return;
        const now = new Date();
        const recent = await tx.passwordReset.findMany({
          where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 3_600_000) } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { createdAt: true },
        });
        if (
          recent.length >= 5 ||
          (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60_000)
        )
          return;
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(now.getTime() + 30 * 60_000);
        await this.invalidateResets(tx, user.id, now);
        await tx.passwordReset.create({
          data: {
            userId: user.id,
            authorizationVersion: current.authorizationVersion,
            tokenHash: tokenHash(token),
            expiresAt,
            createdAt: now,
          },
        });
        await this.mail.enqueuePasswordReset(tx, user.id, token, expiresAt);
      });
    }
    return { message: 'If eligible, a password reset email will be sent' };
  }

  async reset(token: string, newPassword: string, context: AuditContext) {
    const where = { tokenHash: tokenHash(token) };
    const ticket = await this.prisma.passwordReset.findUnique({ where });
    if (!ticket || ticket.consumedAt || ticket.expiresAt <= new Date())
      failure(400, 'INVALID_PASSWORD_RESET_TOKEN');
    await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, ticket.userId);
      const current = await tx.passwordReset.findUnique({ where });
      if (
        !current ||
        current.consumedAt ||
        current.expiresAt <= new Date() ||
        current.authorizationVersion !== user.authorizationVersion ||
        user.status !== 'ACTIVE' ||
        !user.passwordHash
      )
        failure(400, 'INVALID_PASSWORD_RESET_TOKEN');
      await this.updatePassword(tx, user, newPassword, 'PASSWORD_RESET', context);
    });
    this.authorization.invalidate(ticket.userId);
    return { success: true };
  }

  async change(
    claims: JwtPayload,
    currentPassword: string,
    newPassword: string,
    context: AuditContext,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, claims.sub);
      const session = await tx.authSession.findUnique({ where: { id: claims.sid } });
      if (
        !session ||
        session.userId !== user.id ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        user.status !== 'ACTIVE' ||
        user.authorizationVersion.toString() !== claims.userVersion ||
        session.version.toString() !== claims.sessionVersion
      )
        failure(401, 'SESSION_REVOKED');
      if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash)))
        failure(400, 'INCORRECT_CURRENT_PASSWORD');
      await this.updatePassword(tx, user, newPassword, 'PASSWORD_CHANGED', context);
    });
    this.authorization.invalidate(claims.sub);
    return { success: true };
  }

  private async invalidateResets(tx: IdentityTx, userId: string, now: Date) {
    await tx.passwordReset.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.emailDelivery.updateMany({
      where: { userId, purpose: 'PASSWORD_RESET', deliveredAt: null },
      data: { deliveredAt: now, encryptedToken: null, leaseOwner: null, leaseUntil: null },
    });
  }

  private async updatePassword(
    tx: IdentityTx,
    user: IdentityUser,
    password: string,
    action: 'PASSWORD_CHANGED' | 'PASSWORD_RESET',
    context: AuditContext,
  ) {
    if (user.passwordHash && (await bcrypt.compare(password, user.passwordHash)))
      failure(400, 'PASSWORD_UNCHANGED');
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        authorizationVersion: { increment: 1 },
      },
      include: identityInclude,
    });
    await this.invalidateResets(tx, user.id, now);
    await tx.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, version: { increment: 1 } },
    });
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        targetType: 'USER',
        targetId: user.id,
        metadata: { correlationId: context.correlationId },
      },
    });
    await authorizationChanged(tx, updated, 'PASSWORD_CHANGED');
  }
}
