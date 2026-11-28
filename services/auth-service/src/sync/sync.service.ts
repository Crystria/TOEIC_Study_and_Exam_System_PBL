import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  MessagingService,
  SyncRequest,
  SyncResult,
  ProgressSnapshot,
  normalizeLearningOperation,
  stableHash,
  offlineActivityAt,
  parseProgressCursor,
  progressCursor,
  writeV2Outbox,
} from '@toeic/common';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SyncHead, SyncOperation } from '../generated/prisma';
import { failure } from '../identity';
import { LearningClient } from './learning-client';
type Tx = Prisma.TransactionClient;
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
const max = 9223372036854775807n;
function resultHash(p: SyncResult): string {
  return stableHash({
    userId: p.userId,
    operationId: p.operationId,
    syncVersion: p.syncVersion,
    status: p.status,
    reason: p.reason,
    actionHash: p.actionHash,
    progress: [...p.progress].sort((a, b) =>
      (a.entityType + ':' + a.entityId).localeCompare(b.entityType + ':' + b.entityId),
    ),
  });
}
@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private working?: Promise<void>;
  private closing = false;
  constructor(
    private readonly db: PrismaService,
    private readonly messaging: MessagingService,
    private readonly client: LearningClient,
    private readonly config: ConfigService,
  ) {}
  enabled() {
    if (this.config.get('SYNC_ENABLED') !== 'true') failure(503, 'SYNC_DISABLED');
  }
  async lock(tx: Tx, userId: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`auth-sync:${userId}`},0))::text`;
    return tx.syncHead.upsert({ where: { userId }, create: { userId }, update: {} });
  }
  private async projection(tx: Tx, userId: string, cursor?: string, limit = 50) {
    let after;
    try {
      after = parseProgressCursor(cursor, userId);
    } catch {
      failure(400, 'INVALID_CURSOR');
    }
    const rows = await tx.syncProjection.findMany({
      where: {
        userId,
        ...(after
          ? {
              OR: [
                { entityType: { gt: after.entityType } },
                { entityType: after.entityType, entityId: { gt: after.entityId } },
              ],
            }
          : {}),
      },
      orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit).map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        revision: r.revision.toString(),
        state: r.state,
      })),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last ? progressCursor(userId, last.entityType, last.entityId) : null,
    };
  }
  private async response(
    tx: Tx,
    head: SyncHead,
    operationId: string,
    row?: SyncOperation,
    status = 'PENDING',
    reason: string | null = null,
  ) {
    const page = await this.projection(tx, head.userId);
    return {
      operationId,
      accepted: !!row,
      status: row?.status ?? status,
      reason: row?.reason ?? reason,
      syncVersion: (row?.syncVersion ?? head.syncVersion).toString(),
      resolvedVersion: head.resolvedVersion.toString(),
      appliedVersion: head.appliedVersion.toString(),
      projectedAt: head.projectedAt.toISOString(),
      progress: page.items,
      nextCursor: page.nextCursor,
      projectionReady: head.bootstrapDone,
      operationProgress: row?.progress ?? [],
      ...(row?.status === 'PENDING' && Date.now() - row.acceptedAt.getTime() >= 30000
        ? { delayed: true }
        : {}),
    };
  }
  async accept(userId: string, body: SyncRequest) {
    this.enabled();
    const operation = normalizeLearningOperation(body.operation),
      actionHash = stableHash(operation);
    return this.db.$transaction(async (tx) => {
      const head = await this.lock(tx, userId),
        where = { userId_operationId: { userId, operationId: body.operationId } },
        prior = await tx.syncOperation.findUnique({ where });
      if (prior) {
        if (prior.actionHash !== actionHash) failure(409, 'IDEMPOTENCY_CONFLICT');
        return this.response(tx, head, body.operationId, prior);
      }
      const now = new Date();
      let activityAt: Date;
      try {
        activityAt = offlineActivityAt(body.clientOccurredAt, now);
      } catch {
        failure(400, 'INVALID_OFFLINE_TIME');
      }
      const base = BigInt(body.baseVersion);
      if (base > head.syncVersion) failure(400, 'FUTURE_VERSION');
      if (base < head.syncVersion)
        return this.response(tx, head, body.operationId, undefined, 'CONFLICT', 'STALE_VERSION');
      if (head.pendingOperationId)
        return this.response(tx, head, body.operationId, undefined, 'BUSY', 'OPERATION_PENDING');
      if (head.syncVersion === max) failure(503, 'VERSION_EXHAUSTED');
      const syncVersion = head.syncVersion + 1n,
        eventId = randomUUID(),
        payload = {
          userId,
          deviceId: body.deviceId,
          operationId: body.operationId,
          baseVersion: body.baseVersion,
          syncVersion: syncVersion.toString(),
          activityAt: activityAt.toISOString(),
          operation,
        },
        command = {
          eventId,
          eventType: 'UserSyncAcceptedEvent.v2',
          occurredAt: now.toISOString(),
          version: 2 as const,
          producer: 'auth-service',
          payload,
        };
      const row = await tx.syncOperation.create({
        data: {
          userId,
          operationId: body.operationId,
          syncVersion,
          deviceId: body.deviceId,
          actionHash,
          operation: json(operation),
          command: json(command),
          commandEventId: eventId,
          progress: [],
          acceptedAt: now,
          activityAt,
        },
      });
      await writeV2Outbox(tx as never, userId, command);
      const updated = await tx.syncHead.update({
        where: { userId },
        data: { syncVersion, pendingOperationId: body.operationId },
      });
      await tx.syncDeviceCursor.upsert({
        where: { userId_deviceId: { userId, deviceId: body.deviceId } },
        create: { userId, deviceId: body.deviceId, acceptedVersion: syncVersion },
        update: { acceptedVersion: syncVersion, updatedAt: now },
      });
      return this.response(tx, updated, body.operationId, row);
    });
  }
  async state(userId: string, cursor?: string, limit = 50) {
    this.enabled();
    await this.db.$transaction((tx) => this.lock(tx, userId));
    await this.repair(userId).catch(() => undefined);
    return this.db.$transaction(async (tx) => {
      const head = await this.lock(tx, userId),
        page = await this.projection(tx, userId, cursor, limit),
        pending = head.pendingOperationId
          ? await tx.syncOperation.findUnique({
              where: { userId_operationId: { userId, operationId: head.pendingOperationId } },
            })
          : null;
      return {
        syncVersion: head.syncVersion.toString(),
        resolvedVersion: head.resolvedVersion.toString(),
        appliedVersion: head.appliedVersion.toString(),
        pendingOperationId: head.pendingOperationId,
        projectedAt: head.projectedAt.toISOString(),
        progress: page.items,
        nextCursor: page.nextCursor,
        projectionReady: head.bootstrapDone,
        delayed: !!pending && Date.now() - pending.acceptedAt.getTime() >= 30000,
      };
    });
  }
  async operation(userId: string, operationId: string) {
    this.enabled();
    return this.db.$transaction(async (tx) => {
      const head = await this.lock(tx, userId),
        row = await tx.syncOperation.findUnique({
          where: { userId_operationId: { userId, operationId } },
        });
      if (!row) failure(404, 'OPERATION_NOT_FOUND');
      return this.response(tx, head, operationId, row);
    });
  }
  private async projectionConflict(tx: Tx, userId: string, progress: ProgressSnapshot[]) {
    if (!progress.length) return false;
    const rows = await tx.syncProjection.findMany({
      where: {
        userId,
        OR: progress.map((p) => ({ entityType: p.entityType, entityId: p.entityId })),
      },
    });
    const current = new Map(rows.map((r) => [r.entityType + ':' + r.entityId, r]));
    return progress.some((p) => {
      const row = current.get(p.entityType + ':' + p.entityId);
      return (
        !!row &&
        row.revision === BigInt(p.revision) &&
        stableHash(row.state) !== stableHash(p.state)
      );
    });
  }
  private async merge(tx: Tx, userId: string, progress: ProgressSnapshot[]) {
    // Every caller holds the user/head lock; SQL CAS keeps older deliveries from rolling back state.
    const latest = new Map<string, ProgressSnapshot>();
    for (const p of progress) {
      const key = p.entityType + ':' + p.entityId,
        old = latest.get(key);
      if (!old || BigInt(p.revision) > BigInt(old.revision)) latest.set(key, p);
    }
    if (latest.size) {
      const rows = [...latest.values()].map(
        (p) =>
          Prisma.sql`(${userId},${p.entityType},${p.entityId},${BigInt(p.revision)},${JSON.stringify(p.state)}::jsonb,CURRENT_TIMESTAMP)`,
      );
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO sync_projections(user_id,entity_type,entity_id,revision,state,projected_at) VALUES ${Prisma.join(rows)} ON CONFLICT(user_id,entity_type,entity_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,projected_at=EXCLUDED.projected_at WHERE sync_projections.revision<EXCLUDED.revision`,
      );
    }
    await tx.syncHead.update({ where: { userId }, data: { projectedAt: new Date() } });
  }
  private async quarantine(
    tx: Tx,
    eventId: string,
    userId: string,
    reason: string,
    payload: unknown,
  ) {
    await tx.syncQuarantine.upsert({
      where: { eventId },
      create: { eventId, userId, reason, payload: json(payload) },
      update: {},
    });
    this.logger.error(`Sync quarantined ${eventId}: ${reason}`);
  }
  async consume(envelope: unknown): Promise<void> {
    const route = validateEvent(envelope);
    if (!['learning.sync.resolved.v2', 'learning.progress.changed.v2'].includes(route))
      throw new Error('UNEXPECTED_SYNC_EVENT');
    const e = envelope as { eventId: string; eventType: string; payload: SyncResult },
      payload = e.payload,
      payloadHash = stableHash(e);
    await this.db.$transaction(async (tx) => {
      const head = await this.lock(tx, payload.userId),
        existing = await tx.syncInbox.findUnique({ where: { eventId: e.eventId } });
      if (existing) {
        if (existing.payloadHash !== payloadHash)
          await this.quarantine(tx, e.eventId, payload.userId, 'EVENT_ID_COLLISION', e);
        return;
      }
      let conflict = (await this.projectionConflict(tx, payload.userId, payload.progress))
        ? 'PROJECTION_REVISION_COLLISION'
        : null;
      let op: SyncOperation | null = null;
      if (route === 'learning.sync.resolved.v2') {
        op = await tx.syncOperation.findUnique({
          where: {
            userId_operationId: { userId: payload.userId, operationId: payload.operationId },
          },
        });
        if (
          !op ||
          op.actionHash !== payload.actionHash ||
          op.syncVersion !== BigInt(payload.syncVersion)
        )
          conflict = 'UNMATCHED_SYNC_RESULT';
        else if (op.status !== 'PENDING' && op.resultHash !== resultHash(payload))
          conflict = 'TERMINAL_RESULT_COLLISION';
      }
      if (conflict) await this.quarantine(tx, e.eventId, payload.userId, conflict, e);
      else {
        await this.merge(tx, payload.userId, payload.progress);
        if (op && op.status === 'PENDING') {
          await tx.syncOperation.update({
            where: {
              userId_operationId: { userId: payload.userId, operationId: payload.operationId },
            },
            data: {
              status: payload.status,
              reason: payload.reason,
              progress: json(payload.progress),
              resultHash: resultHash(payload),
              resolvedAt: new Date(),
            },
          });
          let resolved = head.resolvedVersion;
          for (;;) {
            const next = await tx.syncOperation.findUnique({
              where: { userId_syncVersion: { userId: payload.userId, syncVersion: resolved + 1n } },
            });
            if (!next || next.status === 'PENDING') break;
            resolved++;
          }
          await tx.syncHead.update({
            where: { userId: payload.userId },
            data: {
              resolvedVersion: resolved,
              appliedVersion:
                payload.status === 'APPLIED' && op.syncVersion > head.appliedVersion
                  ? op.syncVersion
                  : head.appliedVersion,
              pendingOperationId:
                head.pendingOperationId === op.operationId ? null : head.pendingOperationId,
            },
          });
        }
      }
      await tx.syncInbox.create({
        data: { eventId: e.eventId, eventType: e.eventType, payloadHash },
      });
    });
  }
  async repair(userId: string) {
    const head = await this.db.syncHead.findUnique({ where: { userId } });
    if (!head || head.bootstrapDone) return;
    await this.db.syncHead.update({ where: { userId }, data: { repairAttemptAt: new Date() } });
    const page = await this.client.page(userId, head.bootstrapCursor);
    await this.db.$transaction(async (tx) => {
      const current = await this.lock(tx, userId);
      if (current.bootstrapDone || current.bootstrapCursor !== head.bootstrapCursor) return;
      if (await this.projectionConflict(tx, userId, page.items)) {
        await this.quarantine(
          tx,
          `bootstrap:${userId}:${stableHash(page.items)}`,
          userId,
          'PROJECTION_REVISION_COLLISION',
          page,
        );
        return;
      }
      await this.merge(tx, userId, page.items);
      const watermark = BigInt(page.revisionWatermark),
        changed = current.bootstrapWatermark !== null && current.bootstrapWatermark !== watermark;
      await tx.syncHead.update({
        where: { userId },
        data: changed
          ? { bootstrapCursor: null, bootstrapWatermark: null }
          : {
              bootstrapCursor: page.nextCursor,
              bootstrapWatermark: watermark,
              bootstrapDone: page.nextCursor === null,
            },
      });
    });
  }
  async reconcile(userId: string, operationId: string) {
    const op = await this.db.syncOperation.findUnique({
      where: { userId_operationId: { userId, operationId } },
    });
    if (!op || op.status !== 'PENDING') return;
    await this.db.syncOperation.updateMany({
      where: { userId, operationId, status: 'PENDING' },
      data: { lastReconciledAt: new Date() },
    });
    const ledger = await this.client.ledger(userId, operationId);
    if (ledger && ledger.actionHash === op.actionHash) {
      const payload: SyncResult = { ...ledger, syncVersion: op.syncVersion.toString() };
      const envelope = await this.db.$transaction(async (tx) => {
        await this.lock(tx, userId);
        const current = await tx.syncOperation.findUniqueOrThrow({
          where: { userId_operationId: { userId, operationId } },
        });
        if (current.status !== 'PENDING') return null;
        if (current.reconciliationEnvelope) {
          const saved = current.reconciliationEnvelope as unknown as { payload: SyncResult };
          if (resultHash(saved.payload) !== resultHash(payload))
            throw new Error('LEARNING_LEDGER_CHANGED');
          return current.reconciliationEnvelope;
        }
        const event = {
          eventId: randomUUID(),
          eventType: 'LearningSyncResolvedEvent.v2',
          producer: 'learning-service',
          version: 2 as const,
          occurredAt: new Date().toISOString(),
          payload,
        };
        await tx.syncOperation.update({
          where: { userId_operationId: { userId, operationId } },
          data: { reconciliationEnvelope: json(event) },
        });
        return event;
      });
      if (envelope) await this.consume(envelope);
    } else
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, userId);
        const current = await tx.syncOperation.findUniqueOrThrow({
          where: { userId_operationId: { userId, operationId } },
        });
        if (current.status !== 'PENDING') return;
        await tx.outboxEvent.updateMany({
          where: { id: op.commandEventId, publishedAt: { not: null }, leaseOwner: null },
          data: { publishedAt: null, nextAttemptAt: new Date() },
        });
        await tx.syncOperation.update({
          where: { userId_operationId: { userId, operationId } },
          data: { lastReconciledAt: new Date() },
        });
      });
  }
  async tick() {
    const pending = await this.db.syncOperation.findMany({
      where: {
        status: 'PENDING',
        acceptedAt: { lt: new Date(Date.now() - 30000) },
        OR: [
          { lastReconciledAt: null },
          { lastReconciledAt: { lt: new Date(Date.now() - 30000) } },
        ],
      },
      orderBy: { acceptedAt: 'asc' },
      take: 10,
    });
    for (const op of pending) {
      if (this.closing) return;
      try {
        await this.reconcile(op.userId, op.operationId);
      } catch {
        await this.db.syncOperation.updateMany({
          where: { userId: op.userId, operationId: op.operationId, status: 'PENDING' },
          data: { lastReconciledAt: new Date() },
        });
        this.logger.warn('Sync reconciliation deferred: Learning unavailable');
      }
    }
    for (const head of await this.db.syncHead.findMany({
      where: { bootstrapDone: false },
      orderBy: [{ repairAttemptAt: 'asc' }, { userId: 'asc' }],
      take: 10,
    })) {
      if (this.closing) return;
      try {
        await this.repair(head.userId);
      } catch {
        this.logger.warn('Sync projection bootstrap deferred: Learning unavailable');
      }
    }
  }
  async onModuleInit() {
    if (this.config.get('SYNC_ENABLED') !== 'true') return;
    await this.db.$queryRaw`SELECT sync_version FROM sync_heads LIMIT 0`;
    const prefix = this.config.get<string>('SYNC_QUEUE_PREFIX');
    await this.messaging.subscribe(
      (prefix ? prefix + '.' : '') + 'auth-learning-projection.v2',
      ['learning.sync.resolved.v2', 'learning.progress.changed.v2'],
      (m) => this.consume(JSON.parse(m.content.toString())),
    );
    this.timer = setInterval(() => {
      if (!this.working)
        this.working = this.tick()
          .catch(() => this.logger.warn('Sync maintenance deferred'))
          .finally(() => {
            this.working = undefined;
          });
    }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.working;
  }
}
