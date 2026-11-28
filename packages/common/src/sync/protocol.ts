import { createHash } from 'node:crypto';
export interface ProgressSnapshot {
  entityType: 'VOCABULARY' | 'LESSON';
  entityId: string;
  revision: string;
  state: unknown;
}
export type LearningOperation =
  | { kind: 'REVIEW_FLASHCARD'; vocabularyId: string; baseEntityRevision: string; quality: number }
  | { kind: 'COMPLETE_LESSON'; lessonId: string; baseEntityRevision: string }
  | {
      kind: 'SUBMIT_VOCABULARY_SESSION';
      sessionId: string;
      reviews: Array<{ vocabularyId: string; quality: number }>;
      answers: Array<{ questionId: string; selectedOption: string }>;
    };
export interface SyncRequest {
  deviceId: string;
  operationId: string;
  baseVersion: string;
  clientOccurredAt: string;
  operation: LearningOperation;
}
export interface SyncCommand {
  userId: string;
  deviceId: string;
  operationId: string;
  baseVersion: string;
  syncVersion: string;
  activityAt: string;
  operation: LearningOperation;
}
export interface SyncResult {
  userId: string;
  operationId: string;
  syncVersion: string;
  status: 'APPLIED' | 'REJECTED';
  reason: string | null;
  actionHash: string;
  progress: ProgressSnapshot[];
}
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return (
    '{' +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}
export function stableHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
export function normalizeLearningOperation(operation: LearningOperation): LearningOperation {
  return operation.kind === 'SUBMIT_VOCABULARY_SESSION'
    ? {
        ...operation,
        reviews: [...operation.reviews].sort((a, b) =>
          a.vocabularyId.localeCompare(b.vocabularyId),
        ),
        answers: [...operation.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
      }
    : operation;
}
export function offlineActivityAt(client: string, accepted: Date): Date {
  const date = new Date(client),
    delta = date.getTime() - accepted.getTime();
  if (!Number.isFinite(delta) || delta < -30 * 86400000 || delta > 300000)
    throw new Error('INVALID_OFFLINE_TIME');
  return delta > 0 ? accepted : date;
}
export function progressCursor(userId: string, entityType: string, entityId: string): string {
  return Buffer.from(JSON.stringify({ userId, entityType, entityId })).toString('base64url');
}
export function parseProgressCursor(
  value: string | undefined,
  userId: string,
): { entityType: string; entityId: string } | null {
  if (!value) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_CURSOR');
  const c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  if (
    c.userId !== userId ||
    !['VOCABULARY', 'LESSON'].includes(c.entityType) ||
    typeof c.entityId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.entityId)
  )
    throw new Error('INVALID_CURSOR');
  return { entityType: c.entityType, entityId: c.entityId };
}
