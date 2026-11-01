import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { Prisma } from './generated/prisma';
import { writeV2Outbox } from '@toeic/common';
export type Tx = Prisma.TransactionClient;
export function fail(status: number, code: string, extra: Record<string, unknown> = {}): never {
  throw new HttpException({ code, message: code, ...extra }, status);
}
export const normalized = (s: string) => s.normalize('NFC').trim().toLowerCase();
export { canonicalJson as canonical, stableHash as hash } from '@toeic/common';
import { stableHash as hash } from '@toeic/common';
export function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
export async function userLock(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`learning-user:${userId}`},0))::text`;
}
export async function contentLock(tx: Tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(30301)::text`;
}
export function nextRevision(value: bigint): bigint {
  if (value >= 9223372036854775807n) fail(503, 'REVISION_EXHAUSTED');
  return value + 1n;
}
export async function event(
  tx: Tx,
  aggregateId: string,
  eventType: string,
  payload: unknown,
  at: Date,
) {
  await writeV2Outbox(tx as never, aggregateId, {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    producer: 'learning-service',
    version: 2,
    payload,
  });
}
export async function activeVocabulary(tx: Tx, id: string) {
  const locked = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT v.id FROM vocabularies v JOIN vocabulary_topics t ON t.id=v.topic_id WHERE v.id=${id} AND v.deleted_at IS NULL AND t.deleted_at IS NULL FOR SHARE OF v,t`;
  if (!locked.length) fail(404, 'VOCABULARY_NOT_FOUND');
  return tx.vocabulary.findUniqueOrThrow({ where: { id } });
}
export async function idempotent<T>(
  tx: Tx,
  actorId: string,
  scope: string,
  key: string,
  body: unknown,
  run: () => Promise<T>,
): Promise<T> {
  if (!key || key.length > 128 || /[^\x21-\x7e]/.test(key)) fail(400, 'IDEMPOTENCY_KEY_REQUIRED');
  const requestHash = hash(body),
    where = { actorId_scope_key: { actorId, scope, key } };
  const existing = await tx.contentIdempotency.findUnique({ where });
  if (existing) {
    if (existing.requestHash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT');
    return existing.result as T;
  }
  const result = await run();
  await tx.contentIdempotency.create({
    data: { actorId, scope, key, requestHash, result: inputJson(result) },
  });
  return result;
}
export async function contentAudit(
  tx: Tx,
  actorId: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  correlationId: string,
) {
  await tx.contentAudit.create({
    data: {
      actorId,
      entityId,
      action,
      before: before === null ? Prisma.JsonNull : inputJson(before),
      after: after === null ? Prisma.JsonNull : inputJson(after),
      correlationId,
    },
  });
}
