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
      UserSyncCompletedEvent: 'user.sync.completed',
    });
    const prefix = config.get<string>('SYNC_QUEUE_PREFIX');
    let provisioned = false;
    this.relay = new PollingOutboxRelay(
      store,
      async (event) => {
        try {
          if (
            (event.envelope as { eventType?: string }).eventType === 'UserSyncAcceptedEvent.v2' &&
            !provisioned
          ) {
            await messaging.declareConsumerQueue(
              (prefix ? prefix + '.' : '') + 'learning-sync.v2',
              ['user.sync.accepted.v2'],
            );
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
      throw new Error('Apply P1 outbox lease migration before starting auth-service');
    }
    this.relay.start();
  }
  async onModuleDestroy() {
    await this.relay.stop();
  }
}
