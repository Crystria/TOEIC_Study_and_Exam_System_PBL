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
  TestSubmittedEvent: 'test.submitted',
  PartPracticeSubmittedEvent: 'part-practice.submitted',
};
@Injectable()
export class ExamOutboxRelay implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private closing = false;
  private readonly logger = new Logger(ExamOutboxRelay.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}
  async onModuleInit() {
    await this.messaging.declareQueue('exam-outbox-dlq', 'exam.outbox.dead');
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
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.running;
  }
  async poll() {
    await this.prisma.$transaction(
      async (tx) => {
        const events = await tx.$queryRaw<
          EventRow[]
        >`SELECT id, aggregate_id, event_type, occurred_at, payload, retry_count, last_error
        FROM outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at <= now()
        ORDER BY created_at, id LIMIT 50 FOR UPDATE SKIP LOCKED`;
        for (const e of events) {
          const envelope = {
            eventId: e.id,
            eventType: e.event_type,
            aggregateId: e.aggregate_id,
            occurredAt: e.occurred_at.getTime(),
            payload: e.payload,
          };
          try {
            const dead = e.retry_count >= 10,
              route = dead ? 'exam.outbox.dead' : routes[e.event_type];
            if (!route) throw new Error(`Unknown exam outbox event ${e.event_type}`);
            await this.messaging.emit(
              route,
              e.aggregate_id,
              dead
                ? { ...envelope, payload: { originalEvent: envelope, error: e.last_error } }
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
