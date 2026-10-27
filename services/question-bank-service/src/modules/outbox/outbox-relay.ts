import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessagingService } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';

const routes: Record<string, string> = {
  QuestionCreatedEvent: 'question.created',
  QuestionUpdatedEvent: 'question.updated',
  QuestionDeletedEvent: 'question.deleted',
  QuestionGroupCreatedEvent: 'question-group.created',
  QuestionGroupUpdatedEvent: 'question-group.updated',
  QuestionGroupDeletedEvent: 'question-group.deleted',
};
interface PendingEvent {
  id: string;
  aggregate_id: string;
  event_type: string;
  occurred_at: Date;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error: string | null;
}
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private closing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}
  async onModuleInit() {
    await this.messaging.declareQueue('question-bank-outbox-dlq', 'question-bank.outbox.dead');
    this.timer = setInterval(() => {
      if (!this.running && !this.closing) {
        this.running = this.poll()
          .catch((error: Error) => this.logger.error(`Outbox poll failed: ${error.message}`))
          .finally(() => {
            this.running = undefined;
          });
      }
    }, 500);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.running;
  }
  async poll(): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const events = await tx.$queryRaw<
          PendingEvent[]
        >`SELECT id, aggregate_id, event_type, occurred_at, payload, retry_count, last_error
        FROM outbox_events WHERE published_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at <= now()
        ORDER BY created_at, id LIMIT 50 FOR UPDATE SKIP LOCKED`;
        for (const event of events) {
          const envelope = {
            eventId: event.id,
            eventType: event.event_type,
            aggregateId: event.aggregate_id,
            occurredAt: event.occurred_at.getTime(),
            payload: event.payload,
          };
          try {
            const dead = event.retry_count >= 10;
            const route = dead ? 'question-bank.outbox.dead' : routes[event.event_type];
            if (!route) throw new Error(`Unknown outbox event ${event.event_type}`);
            await this.messaging.emit(
              route,
              event.aggregate_id,
              dead
                ? { ...envelope, payload: { originalEvent: envelope, error: event.last_error } }
                : envelope,
            );
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: dead
                ? { deadLetteredAt: new Date() }
                : { publishedAt: new Date(), lastError: null },
            });
            if (dead)
              this.logger.error(
                `Outbox ${event.id} sent to dead-letter queue after ${event.retry_count} retries`,
              );
          } catch (error) {
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                retryCount: { increment: 1 },
                lastError: (error as Error).message.slice(0, 1000),
                nextAttemptAt: new Date(
                  Date.now() + Math.min(60_000, 1000 * 2 ** Math.min(event.retry_count, 6)),
                ),
              },
            });
            this.logger.warn(`Outbox ${event.id} publish failed: ${(error as Error).message}`);
          }
        }
      },
      { timeout: 60_000 },
    );
  }
}
