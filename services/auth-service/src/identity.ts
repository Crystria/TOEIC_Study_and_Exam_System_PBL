import { createHash, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { Prisma } from './generated/prisma';
import { writeV2Outbox } from '@toeic/common';

export const identityInclude = { roles: { include: { role: true } } } as const;
export type IdentityUser = Prisma.UserGetPayload<{ include: typeof identityInclude }>;
export type IdentityTx = Prisma.TransactionClient;
export interface AuditContext {
  correlationId: string;
  ip?: string;
}
export function failure(status: number, code: string, message = code): never {
  throw new HttpException({ code, message }, status);
}
export function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export async function lockedUser(tx: IdentityTx, id: string): Promise<IdentityUser> {
  await tx.$queryRaw`SELECT id FROM users WHERE id=${id} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id }, include: identityInclude });
  if (!user) failure(404, 'USER_NOT_FOUND');
  return user;
}
export async function audit(
  tx: IdentityTx,
  actor: string,
  target: string | null,
  action: string,
  before: Prisma.InputJsonValue,
  after: Prisma.InputJsonValue,
  context: AuditContext,
) {
  await tx.adminAuditLog.create({
    data: {
      actorUserId: actor,
      targetUserId: target,
      action,
      beforeData: before,
      afterData: after,
      correlationId: context.correlationId,
      ip: context.ip,
    },
  });
}
export async function authorizationChanged(
  tx: IdentityTx,
  user: IdentityUser,
  reason: 'LOGOUT' | 'USER_STATUS_CHANGED' | 'USER_ROLES_CHANGED',
  session?: { id: string; version: bigint },
) {
  await writeV2Outbox(tx as never, user.id, {
    eventId: randomUUID(),
    eventType: 'AuthorizationChangedEvent.v2',
    occurredAt: new Date().toISOString(),
    producer: 'auth-service',
    version: 2,
    payload: {
      userId: user.id,
      userVersion: user.authorizationVersion.toString(),
      sessionId: session?.id ?? null,
      sessionVersion: session?.version.toString() ?? null,
      reason,
    },
  });
}
