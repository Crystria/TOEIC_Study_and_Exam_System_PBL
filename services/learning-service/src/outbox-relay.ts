import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  MessagingService,
  PollingOutboxRelay,
  PrismaOutboxStore,
  OutboxSqlClient,
  outboxRoute,
} from '@toeic/common';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class ServiceOutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly relay: PollingOutboxRelay;
  constructor(
    private readonly prisma: PrismaService,
    messaging: MessagingService,
    config: ConfigService,
  ) {
    const logger = new Logger(ServiceOutboxRelay.name);
    const store = new PrismaOutboxStore(prisma as unknown as OutboxSqlClient, {
      VocabularyLearnedEvent: 'vocabulary.learned',
      LessonCompletedEvent: 'lesson.completed',
    });
    let provisioned = false;
    const configured =
      config.get<string>('SYNC_QUEUE_PREFIX') || config.get<string>('LEARNING_V2_QUEUE_PREFIX');
    const prefix = configured ? configured + '.' : '';
    this.relay = new PollingOutboxRelay(
      store,
      async (event) => {
        try {
          if ((event.envelope as { version?: number }).version === 2 && !provisioned) {
            await messaging.declareConsumerQueue(`${prefix}analytics-service.v2`, [
              'vocabulary.learned.v2',
              'lesson.completed.v2',
            ]);
            await messaging.declareConsumerQueue(`${prefix}auth-learning-projection.v2`, [
              'learning.progress.changed.v2',
              'learning.sync.resolved.v2',
            ]);
            provisioned = true;
          }
          await messaging.emit(
            outboxRoute(event),
            event.aggregateId,
            event.envelope as Parameters<MessagingService['emit']>[2],
          );
        } catch (error) {
          provisioned = false;
          throw error;
        }
      },
      (error) => logger.error(String(error)),
    );
  }
  async onModuleInit() {
    try {
      await this.prisma.$queryRawUnsafe(
        'SELECT lease_owner, lease_until, retry_count, next_attempt_at FROM outbox_events LIMIT 0',
      );
    } catch {
      throw new Error('Apply P1 outbox lease migration before starting learning-service');
    }
    try {
      await this.prisma.$queryRaw`SELECT version FROM learning_progress_heads LIMIT 0`;
    } catch {
      throw new Error(
        'Apply P4 Learning migration before starting this version, including when SYNC_ENABLED=false',
      );
    }
    this.relay.start();
  }
  async onModuleDestroy() {
    await this.relay.stop();
  }
}
