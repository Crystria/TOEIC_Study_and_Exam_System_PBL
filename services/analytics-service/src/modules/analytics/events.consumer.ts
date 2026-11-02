import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingService, stableHash } from '@toeic/common';
import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsClock } from './calculations';
import { Tx, json, userLock } from './analytics.queries';
import { ProjectionService } from './projection.service';
type Payload = {
  userId: string;
  attemptId?: string;
  testId?: string;
  mode?: string;
  completedAt?: string;
  scoreListening?: number;
  scoreReading?: number;
  totalScore?: number;
  scoring?: unknown;
  correctCount?: number;
  totalQuestions?: number;
  accuracy?: number;
  partStats?: Array<{ part: number; correct: number; total: number }>;
  vocabularyId?: string;
  lessonId?: string;
  operationId?: string;
  sessionId?: string | null;
  revision?: string;
  quality?: number;
  firstLearned?: boolean;
  firstLearnedAt?: string | null;
  activityAt?: string;
};
type Envelope = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  version: number;
  payload: Payload;
};
@Injectable()
export class EventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(EventsConsumer.name);
  constructor(
    private readonly db: PrismaService,
    private readonly messaging: MessagingService,
    private readonly config: ConfigService,
    private readonly projection: ProjectionService,
    private readonly clock: AnalyticsClock,
  ) {}
  async onModuleInit() {
    await this.db.$queryRaw`SELECT payload_hash FROM attempt_facts LIMIT 0`;
    if (this.config.get('ANALYTICS_CONSUMER_ENABLED') === 'false') return;
    const prefix = this.config.get<string>('ANALYTICS_QUEUE_PREFIX');
    if (prefix === (this.config.get<string>('AUTHORIZATION_QUEUE_PREFIX') || 'authorization'))
      throw new Error('Analytics domain and authorization queues must use different namespaces');
    await this.messaging.subscribe(
      (prefix ? prefix + '.' : '') + 'analytics-service.v2',
      [
        'test.submitted.v2',
        'part.practice.submitted.v2',
        'vocabulary.learned.v2',
        'lesson.completed.v2',
      ],
      (m) => this.consume(JSON.parse(m.content.toString())),
    );
  }
  private async quarantine(tx: Tx, e: Envelope, reason: string) {
    await tx.analyticsQuarantine.upsert({
      where: { eventId: e.eventId },
      create: { eventId: e.eventId, reason, payload: json(e) },
      update: {},
    });
    this.logger.error(`Analytics quarantined ${e.eventId}: ${reason}`);
  }
  async consume(value: unknown): Promise<void> {
    const route = validateEvent(value);
    if (
      ![
        'test.submitted.v2',
        'part.practice.submitted.v2',
        'vocabulary.learned.v2',
        'lesson.completed.v2',
      ].includes(route)
    )
      throw Error('UNEXPECTED_ANALYTICS_EVENT');
    const e = value as Envelope,
      p = canonicalPayload(e.eventType, e.payload),
      payloadHash = stableHash(e),
      isAttempt = !!p.attemptId;
    // An identical committed inbox entry is enough to acknowledge a transport replay.
    // Keep new events and hash collisions on the locked, transactional path below.
    const processed = await this.db.processedEvent.findUnique({ where: { eventId: e.eventId } });
    if (processed?.payloadHash === payloadHash) return;
    await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`analytics-event:${e.eventId}`},0))::text`;
        if (isAttempt)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`analytics-attempt:${p.attemptId}`},0))::text`;
        await userLock(tx, p.userId);
        const inbox = await tx.processedEvent.findUnique({ where: { eventId: e.eventId } });
        if (inbox) {
          if (inbox.payloadHash !== payloadHash)
            await this.quarantine(
              tx,
              e,
              inbox.payloadHash ? 'EVENT_ID_COLLISION' : 'LEGACY_EVENT_ID_COLLISION',
            );
          return;
        }
        const at = new Date(p.activityAt ?? p.completedAt!),
          now = this.clock.now();
        let reason: string | null = null,
          duplicate = false;
        if (
          at.getTime() > now.getTime() + 300000 ||
          Date.parse(e.occurredAt) > now.getTime() + 300000 ||
          (p.firstLearnedAt && Date.parse(p.firstLearnedAt) > Date.parse(e.occurredAt))
        )
          reason = 'INVALID_ACTIVITY_TIME';
        const kind = isAttempt
            ? p.mode === 'FULL'
              ? 'FULL'
              : 'PART'
            : p.vocabularyId
              ? 'REVIEW'
              : 'LESSON',
          entityId = p.attemptId ?? p.vocabularyId ?? p.lessonId!,
          businessKey = stableHash({
            kind,
            userId: p.userId,
            entityId,
            ...(kind === 'REVIEW' ? { operationId: p.operationId } : {}),
          });
        const fingerprint =
          kind === 'LESSON'
            ? stableHash({
                userId: p.userId,
                lessonId: p.lessonId,
                revision: p.revision,
                completedAt: p.completedAt,
              })
            : stableHash(p);
        if (!reason && isAttempt) {
          const prior = await tx.attemptFact.findUnique({ where: { attemptId: p.attemptId! } });
          if (prior) {
            duplicate = prior.payloadHash === fingerprint;
            if (!duplicate) reason = 'ATTEMPT_ID_COLLISION';
          }
        }
        const prior = await tx.learningActivityFact.findUnique({ where: { businessKey } });
        if (!reason && prior) {
          duplicate = prior.payloadHash === fingerprint;
          if (!duplicate) reason = 'BUSINESS_KEY_COLLISION';
        }
        if (!reason && !duplicate && !isAttempt) {
          const collision = await tx.learningActivityFact.findUnique({
            where: {
              userId_kind_entityId_revision: {
                userId: p.userId,
                kind,
                entityId,
                revision: BigInt(p.revision!),
              },
            },
          });
          if (collision) reason = 'ENTITY_REVISION_COLLISION';
        }
        if (reason) await this.quarantine(tx, e, reason);
        else if (!duplicate) {
          if (isAttempt) {
            await tx.attemptFact.create({
              data: {
                attemptId: p.attemptId!,
                userId: p.userId,
                testId: p.testId!,
                mode: p.mode!,
                completedAt: at,
                payloadHash: fingerprint,
                payload: json(p),
              },
            });
            await tx.attemptPartFact.createMany({
              data: p.partStats!.map((r) => ({ attemptId: p.attemptId!, ...r })),
            });
            if (p.mode === 'FULL')
              await tx.testScoreFact.create({
                data: {
                  attemptId: p.attemptId!,
                  userId: p.userId,
                  completedAt: at,
                  scoreListening: p.scoreListening!,
                  scoreReading: p.scoreReading!,
                  totalScore: p.totalScore!,
                  scoring: json(p.scoring),
                },
              });
            else
              await tx.practiceFact.create({
                data: {
                  attemptId: p.attemptId!,
                  userId: p.userId,
                  completedAt: at,
                  correctCount: p.correctCount!,
                  totalQuestions: p.totalQuestions!,
                  accuracy: p.accuracy!,
                },
              });
          }
          await tx.learningActivityFact.create({
            data: {
              eventId: e.eventId,
              businessKey,
              userId: p.userId,
              kind,
              entityId,
              operationId: p.operationId,
              revision: p.revision ? BigInt(p.revision) : null,
              activityAt: at,
              payloadHash: fingerprint,
              payload: json(p),
            },
          });
          await this.projection.rebuildTx(tx, p.userId);
        }
        await tx.processedEvent.create({
          data: { eventId: e.eventId, eventType: e.eventType, payloadHash, schemaVersion: 2 },
        });
      },
      { timeout: 30000 },
    );
  }
}

function canonicalPayload(type: string, payload: Payload): Payload {
  const common = [
    'userId',
    'attemptId',
    'testId',
    'mode',
    'completedAt',
    'partStats',
    'correctCount',
    'totalQuestions',
  ];
  const keys =
    type === 'TestSubmittedEvent.v2'
      ? [
          ...common,
          'scoreListening',
          'scoreReading',
          'totalScore',
          'correctListeningCount',
          'correctReadingCount',
          'scoring',
        ]
      : type === 'PartPracticeSubmittedEvent.v2'
        ? [...common, 'parts', 'accuracy']
        : type === 'VocabularyLearnedEvent.v2'
          ? [
              'userId',
              'vocabularyId',
              'operationId',
              'sessionId',
              'quality',
              'revision',
              'firstLearned',
              'firstLearnedAt',
              'activityAt',
            ]
          : ['userId', 'lessonId', 'operationId', 'revision', 'completedAt'];
  return Object.fromEntries(
    keys.map((k) => [k, (payload as unknown as Record<string, unknown>)[k]]),
  ) as unknown as Payload;
}
