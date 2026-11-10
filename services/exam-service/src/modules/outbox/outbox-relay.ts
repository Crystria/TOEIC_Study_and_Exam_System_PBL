import { validateEvent } from '@toeic/contracts/p0/runtime.cjs';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessagingService } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
interface EventRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  occurred_at: Date;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error: string | null;
}
const routes: Record<string, string> = {
  'TestSubmittedEvent.v2': 'test.submitted.v2',
  'PartPracticeSubmittedEvent.v2': 'part.practice.submitted.v2',
  TestSubmittedEvent: 'test.submitted',
  PartPracticeSubmittedEvent: 'part-practice.submitted',
};
@Injectable()
export class ExamOutboxRelay implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private closing = false;
  private deadLetterQueueReady = false;
  private readonly logger = new Logger(ExamOutboxRelay.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly config: ConfigService = new ConfigService(),
  ) {}
  async onModuleInit() {
    try {
      await this.ensureDeadLetterQueue();
    } catch {
      this.logger.warn('Outbox queue is not ready; provisioning will be retried before polling');
    }
    if (this.closing) return;
    this.timer = setInterval(() => {
      if (this.running || this.closing) return;
      this.running = this.poll()
        .catch((error: Error) => this.logger.error(error.message))
        .finally(() => {
          this.running = undefined;
        });
    }, 500);
    this.timer.unref();
  }
  private async ensureDeadLetterQueue() {
    if (this.deadLetterQueueReady) return;
    const prefix = this.config.get<string>('ANALYTICS_QUEUE_PREFIX');
    await this.messaging.declareQueue(
      (prefix ? prefix + '.' : '') + 'exam-outbox-dlq',
      'exam.outbox.dead',
    );
    this.deadLetterQueueReady = true;
  }
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.running;
  }
  async poll() {
    if (this.closing) return;
    // Do not claim rows or consume event retries until the holding queue exists.
    await this.ensureDeadLetterQueue();
    if (this.closing) return;
    await this.prisma.$transaction(
      async (tx) => {
        const events = await tx.$queryRaw<
          EventRow[]
        >`SELECT id, aggregate_id, event_type, occurred_at, payload, retry_count, last_error
        FROM outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at <= now()
        ORDER BY created_at, id LIMIT 50 FOR UPDATE SKIP LOCKED`;
        for (const e of events) {
          const envelope = e.event_type.endsWith('.v2')
            ? (e.payload as unknown as Parameters<MessagingService['emit']>[2])
            : {
                eventId: e.id,
                eventType: e.event_type,
                aggregateId: e.aggregate_id,
                occurredAt: e.occurred_at.getTime(),
                payload: e.payload,
              };
          try {
            const dead = e.retry_count >= 10;
            if (!dead && e.event_type.endsWith('.v2')) {
              validateEvent(envelope);
              if (envelope.eventId !== e.id) throw new Error('OUTBOX_EVENT_ID_MISMATCH');
              const prefix = this.config.get<string>('ANALYTICS_QUEUE_PREFIX');
              await this.messaging.declareConsumerQueue(
                (prefix ? prefix + '.' : '') + 'analytics-service.v2',
                [
                  'test.submitted.v2',
                  'part.practice.submitted.v2',
                  'vocabulary.learned.v2',
                  'lesson.completed.v2',
                ],
              );
            }
            const route = dead ? 'exam.outbox.dead' : routes[e.event_type];
            if (!route) throw new Error(`Unknown exam outbox event ${e.event_type}`);
            await this.messaging.emit(
              route,
              e.aggregate_id,
              dead
                ? {
                    eventId: e.id,
                    eventType: 'ExamOutboxDeadLetter',
                    occurredAt: Date.now(),
                    payload: { originalEvent: envelope, error: e.last_error },
                  }
                : envelope,
            );
            await tx.outboxEvent.update({
              where: { id: e.id },
              data: dead
                ? { deadLetteredAt: new Date() }
                : { publishedAt: new Date(), lastError: null },
            });
            if (dead) this.logger.error(`Exam event ${e.id} moved to DLQ`);
          } catch (error) {
            await tx.outboxEvent.update({
              where: { id: e.id },
              data: {
                retryCount: { increment: 1 },
                lastError: (error as Error).message.slice(0, 1000),
                nextAttemptAt: new Date(
                  Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(e.retry_count, 6)),
                ),
              },
            });
            this.logger.warn(`Exam event ${e.id} publish deferred: ${(error as Error).message}`);
          }
        }
      },
      { timeout: 60_000 },
    );
  }
}
