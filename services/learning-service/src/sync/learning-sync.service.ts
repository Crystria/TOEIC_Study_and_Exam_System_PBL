import { HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessagingService,
  SyncCommand,
  SyncResult,
  LearningOperation,
  ProgressSnapshot,
  normalizeLearningOperation,
  stableHash,
  parseProgressCursor,
  progressCursor,
  writeV2Outbox,
} from '@toeic/common';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Tx, fail, inputJson, userLock } from '../core';
import {
  ProgressService,
  vocabularySnapshot,
  lessonSnapshot,
} from '../modules/learning/progress.service';
import { SessionService } from '../modules/learning/session.service';
@Injectable()
export class LearningSyncService implements OnModuleInit {
  constructor(
    private readonly db: PrismaService,
    private readonly progress: ProgressService,
    private readonly sessions: SessionService,
    private readonly messaging: MessagingService,
    private readonly config: ConfigService,
  ) {}
  async onModuleInit() {
    if (this.config.get('SYNC_ENABLED') !== 'true') return;
    await this.db.$queryRaw`SELECT version FROM learning_progress_heads LIMIT 0`;
    const prefix = this.config.get<string>('SYNC_QUEUE_PREFIX');
    await this.messaging.subscribe(
      (prefix ? prefix + '.' : '') + 'learning-sync.v2',
      ['user.sync.accepted.v2'],
      (m) => this.consume(JSON.parse(m.content.toString())),
    );
  }
  async snapshots(
    tx: Tx,
    userId: string,
    operation: LearningOperation,
  ): Promise<ProgressSnapshot[]> {
    if (operation.kind === 'COMPLETE_LESSON')
      return [
        lessonSnapshot(
          await tx.userLessonProgress.findUnique({
            where: { userId_lessonId: { userId, lessonId: operation.lessonId } },
          }),
          operation.lessonId,
        ),
      ];
    const ids =
      operation.kind === 'REVIEW_FLASHCARD'
        ? [operation.vocabularyId]
        : operation.reviews.map((r) => r.vocabularyId).sort();
    return Promise.all(
      ids.map(async (id) =>
        vocabularySnapshot(
          await tx.userVocabularyProgress.findUnique({
            where: { userId_vocabularyId: { userId, vocabularyId: id } },
          }),
          id,
        ),
      ),
    );
  }
  async consume(envelope: unknown): Promise<void> {
    if (validateEvent(envelope) !== 'user.sync.accepted.v2')
      throw new Error('UNEXPECTED_SYNC_EVENT');
    const e = envelope as { eventId: string; eventType: string; payload: SyncCommand },
      body = e.payload,
      operation = normalizeLearningOperation(body.operation),
      actionHash = stableHash(operation),
      payloadHash = stableHash(e);
    await this.db.$transaction(
      async (tx) => {
        await userLock(tx, body.userId);
        const inbox = await tx.processedEvent.findUnique({ where: { eventId: e.eventId } }),
          where = {
            userId_operationId_syncVersion: {
              userId: body.userId,
              operationId: body.operationId,
              syncVersion: BigInt(body.syncVersion),
            },
          };
        const prior = await tx.syncResolution.findUnique({ where });
        if (inbox && inbox.payloadHash !== payloadHash) throw new Error('EVENT_ID_COLLISION');
        if (prior) {
          if (prior.actionHash !== actionHash) throw new Error('SYNC_VERSION_COLLISION');
          const saved = prior.envelope as { eventId: string };
          await tx.outboxEvent.updateMany({
            where: { id: saved.eventId, publishedAt: { not: null }, leaseOwner: null },
            data: { publishedAt: null, nextAttemptAt: new Date() },
          });
          if (!inbox)
            await tx.processedEvent.create({
              data: { eventId: e.eventId, eventType: e.eventType, payloadHash },
            });
          return;
        }
        let status: 'APPLIED' | 'REJECTED' = 'APPLIED',
          reason: string | null = null,
          progress: ProgressSnapshot[] = [];
        const ledger = await tx.operationLedger.findUnique({
          where: { userId_operationId: { userId: body.userId, operationId: body.operationId } },
        });
        if (ledger) {
          if (ledger.actionHash !== actionHash) {
            status = 'REJECTED';
            reason = 'IDEMPOTENCY_CONFLICT';
            progress = await this.snapshots(tx, body.userId, operation);
          } else {
            status = ledger.status as 'APPLIED' | 'REJECTED';
            reason = ledger.reason;
            progress = (ledger.result as unknown as { progress: ProgressSnapshot[] }).progress;
          }
        } else {
          await tx.$executeRawUnsafe('SAVEPOINT learning_sync_action');
          try {
            const activityAt = new Date(body.activityAt);
            let applied: unknown;
            if (operation.kind === 'REVIEW_FLASHCARD')
              applied = await this.progress.reviewInTransaction(
                tx,
                body.userId,
                operation.vocabularyId,
                { ...operation, operationId: body.operationId },
                activityAt,
              );
            else if (operation.kind === 'COMPLETE_LESSON')
              applied = await this.progress.completeInTransaction(
                tx,
                body.userId,
                operation.lessonId,
                { ...operation, operationId: body.operationId },
                activityAt,
              );
            else
              applied = await this.sessions.submitInTransaction(
                tx,
                body.userId,
                operation.sessionId,
                { ...operation, operationId: body.operationId },
                activityAt,
              );
            progress = (applied as { progress: ProgressSnapshot[] }).progress;
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT learning_sync_action');
          } catch (error) {
            if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error;
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT learning_sync_action');
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT learning_sync_action');
            status = 'REJECTED';
            reason = (error.getResponse() as { code?: string }).code || 'INVALID_OPERATION';
            progress = await this.snapshots(tx, body.userId, operation);
            await tx.operationLedger.create({
              data: {
                userId: body.userId,
                operationId: body.operationId,
                kind: operation.kind,
                actionHash,
                status,
                reason,
                result: inputJson({ operationId: body.operationId, progress }),
              },
            });
          }
        }
        const result: SyncResult = {
          userId: body.userId,
          operationId: body.operationId,
          syncVersion: body.syncVersion,
          status,
          reason,
          actionHash,
          progress,
        };
        const response = {
          eventId: randomUUID(),
          eventType: 'LearningSyncResolvedEvent.v2',
          producer: 'learning-service',
          version: 2 as const,
          occurredAt: new Date().toISOString(),
          payload: result,
        };
        await writeV2Outbox(tx as never, body.userId, response);
        await tx.syncResolution.create({
          data: {
            userId: body.userId,
            operationId: body.operationId,
            syncVersion: BigInt(body.syncVersion),
            actionHash,
            result: inputJson(result),
            envelope: inputJson(response),
          },
        });
        await tx.processedEvent.create({
          data: { eventId: e.eventId, eventType: e.eventType, payloadHash },
        });
      },
      { timeout: 15000 },
    );
  }
  async ledger(userId: string, operationId: string) {
    const row = await this.db.operationLedger.findUnique({
      where: { userId_operationId: { userId, operationId } },
    });
    if (!row) fail(404, 'OPERATION_NOT_FOUND');
    return {
      userId,
      operationId,
      status: row.status,
      reason: row.reason,
      actionHash: row.actionHash,
      progress: (row.result as { progress: unknown }).progress,
    };
  }
  async page(userId: string, cursor: string | undefined, limit: number) {
    let after;
    try {
      after = parseProgressCursor(cursor, userId);
    } catch {
      fail(400, 'INVALID_CURSOR');
    }
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      const lessons =
        after?.entityType === 'VOCABULARY'
          ? []
          : await tx.userLessonProgress.findMany({
              where: {
                userId,
                lessonId: after?.entityType === 'LESSON' ? { gt: after.entityId } : undefined,
              },
              orderBy: { lessonId: 'asc' },
              take: limit + 1,
            });
      const vocab = await tx.userVocabularyProgress.findMany({
        where: {
          userId,
          vocabularyId: after?.entityType === 'VOCABULARY' ? { gt: after.entityId } : undefined,
        },
        orderBy: { vocabularyId: 'asc' },
        take: limit + 1,
      });
      const all = [
          ...lessons.map((r) => lessonSnapshot(r, r.lessonId)),
          ...vocab.map((r) => vocabularySnapshot(r, r.vocabularyId)),
        ],
        items = all.slice(0, limit),
        last = items.at(-1),
        head = await tx.learningProgressHead.findUnique({ where: { userId } });
      return {
        items,
        nextCursor:
          all.length > limit && last
            ? progressCursor(userId, last.entityType, last.entityId)
            : null,
        asOf: new Date().toISOString(),
        revisionWatermark: (head?.version ?? 0n).toString(),
      };
    });
  }
}
