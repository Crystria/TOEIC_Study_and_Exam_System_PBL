import { Injectable } from '@nestjs/common';
import { AuthorizationStateVerifier, RoleCode } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuditContext,
  audit,
  authorizationChanged,
  failure,
  identityInclude,
  lockedUser,
} from '../../identity';
import { Prisma, UserStatus } from '../../generated/prisma';
import { UserPresenter } from './user-presenter';
import { ListUsersQueryDto, AuditQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: UserPresenter,
    private readonly authorization: AuthorizationStateVerifier,
  ) {}
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: identityInclude,
    });
    if (!user) failure(404, 'USER_NOT_FOUND');
    return this.presenter.present(user);
  }
  async updateMe(userId: string, input: { fullName?: string; phoneNumber?: string | null }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName: input.fullName, phoneNumber: input.phoneNumber },
      include: identityInclude,
    });
    return this.presenter.present(user);
  }
  async listUsers(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      roles: query.role ? { some: { roleCode: query.role } } : undefined,
      OR: query.keyword
        ? [
            { email: { contains: query.keyword, mode: 'insensitive' } },
            { fullName: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: identityInclude,
        skip: (query.page - 1) * query.size,
        take: query.size,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: await Promise.all(users.map((user) => this.presenter.present(user))),
      total,
      page: query.page,
      size: query.size,
      totalPages: Math.ceil(total / query.size),
    };
  }
  async change(
    actor: string,
    target: string,
    patch: { roles?: RoleCode[]; status?: UserStatus },
    context: AuditContext,
  ) {
    const user = await this.prisma.$transaction(async (tx) => {
      // Serializes all role/status changes, including competing removals of the last admins.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(21202)::text`;
      const acting = await tx.user.findUnique({ where: { id: actor }, include: identityInclude });
      if (acting?.status !== 'ACTIVE' || !acting.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN'))
        failure(403, 'INSUFFICIENT_ROLE');
      const before = await lockedUser(tx, target);
      const oldRoles = before.roles.map((r) => r.roleCode).sort(),
        roles = patch.roles ? [...patch.roles].sort() : oldRoles;
      if (new Set(roles).size !== roles.length || !roles.length) failure(400, 'INVALID_ROLES');
      const status = patch.status ?? before.status;
      if (
        before.status === 'ACTIVE' &&
        oldRoles.includes('SYSTEM_ADMIN') &&
        (status !== 'ACTIVE' || !roles.includes(RoleCode.SYSTEM_ADMIN))
      ) {
        const admins = await tx.user.count({
          where: { status: 'ACTIVE', roles: { some: { roleCode: 'SYSTEM_ADMIN' } } },
        });
        if (admins <= 1) failure(409, 'LAST_ACTIVE_SYSTEM_ADMIN');
      }
      if (status === before.status && JSON.stringify(roles) === JSON.stringify(oldRoles))
        return before;
      if (patch.roles) {
        await tx.userRole.deleteMany({ where: { userId: target } });
        await tx.userRole.createMany({
          data: roles.map((roleCode) => ({ userId: target, roleCode })),
        });
      }
      const after = await tx.user.update({
        where: { id: target },
        data: { status, authorizationVersion: { increment: 1 } },
        include: identityInclude,
      });
      await tx.authSession.updateMany({
        where: { userId: target, revokedAt: null },
        data: { revokedAt: new Date(), version: { increment: 1 } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: target, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const reason = patch.roles ? 'USER_ROLES_CHANGED' : 'USER_STATUS_CHANGED';
      await audit(
        tx,
        actor,
        target,
        reason,
        { roles: oldRoles, status: before.status },
        { roles, status },
        context,
      );
      await authorizationChanged(tx, after, reason);
      return after;
    });
    this.authorization.invalidate(target);
    return this.presenter.present(user);
  }
  async listAuditLogs(query: AuditQueryDto) {
    if (query.from && query.to && new Date(query.from) > new Date(query.to))
      failure(400, 'INVALID_TIME_RANGE');
    const where: Prisma.AdminAuditLogWhereInput = {
      actorUserId: query.actorUserId,
      targetUserId: query.targetUserId,
      action: query.action,
      occurredAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        skip: (query.page - 1) * query.size,
        take: query.size,
        orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        auditId: r.id,
        actorUserId: r.actorUserId,
        targetUserId: r.targetUserId,
        action: r.action,
        beforeData: r.beforeData,
        afterData: r.afterData,
        occurredAt: r.occurredAt.toISOString(),
        correlationId: r.correlationId,
      })),
      total,
      page: query.page,
      size: query.size,
      totalPages: Math.ceil(total / query.size),
    };
  }
}
