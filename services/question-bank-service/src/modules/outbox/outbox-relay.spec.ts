import { MessagingService } from '@toeic/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxRelay } from './outbox-relay';
describe('outbox relay', () => {
  it('keeps the QA producer dead-letter queue separate from the developer queue', async () => {
    const messaging = { declareQueue: jest.fn().mockResolvedValue(undefined) };
    const relay = new OutboxRelay(
      {} as PrismaService,
      messaging as unknown as MessagingService,
      new ConfigService({ QUESTION_OUTBOX_DLQ: 'qa.p6.question-bank-outbox-dlq' }),
    );
    await relay.onModuleInit();
    expect(messaging.declareQueue).toHaveBeenCalledWith(
      'qa.p6.question-bank-outbox-dlq',
      'question-bank.outbox.dead',
    );
    await relay.onModuleDestroy();
  });
  const event = {
    id: 'event-1',
    aggregate_id: 'q1',
    event_type: 'QuestionUpdatedEvent',
    occurred_at: new Date(),
    payload: { questionId: 'q1' },
    retry_count: 0,
    last_error: null,
  };
  function setup(retries = 0) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ ...event, retry_count: retries }]),
      outboxEvent: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const messaging = {
      emit: jest.fn().mockResolvedValue(undefined),
      declareQueue: jest.fn().mockResolvedValue(undefined),
    };
    return {
      tx,
      messaging,
      prisma,
      relay: new OutboxRelay(
        prisma as unknown as PrismaService,
        messaging as unknown as MessagingService,
      ),
    };
  }
  it('publishes the stored event identity then marks it published', async () => {
    const { relay, tx, messaging } = setup();
    await relay.poll();
    expect(messaging.emit).toHaveBeenCalledWith(
      'question.updated',
      'q1',
      expect.objectContaining({ eventId: 'event-1', aggregateId: 'q1', payload: event.payload }),
    );
    expect(tx.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { publishedAt: expect.any(Date), lastError: null } }),
    );
  });
  it('retains unpublished events and backs off on broker failure', async () => {
    const { relay, tx, messaging } = setup();
    messaging.emit.mockRejectedValue(new Error('broker offline'));
    await relay.poll();
    const data = tx.outboxEvent.update.mock.calls[0][0].data;
    expect(data.retryCount).toEqual({ increment: 1 });
    expect(data.lastError).toBe('broker offline');
    expect(data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(data.publishedAt).toBeUndefined();
  });
  it('moves exhausted events to a durable dead-letter route', async () => {
    const { relay, tx, messaging } = setup(10);
    await relay.poll();
    expect(messaging.emit).toHaveBeenCalledWith(
      'question-bank.outbox.dead',
      'q1',
      expect.objectContaining({ eventId: 'event-1' }),
    );
    expect(tx.outboxEvent.update.mock.calls[0][0].data.deadLetteredAt).toBeInstanceOf(Date);
  });

  describe('startup while RabbitMQ is unavailable', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('starts without a channel, preserves rows, and publishes after provisioning recovers', async () => {
      const { relay, messaging, prisma, tx } = setup();
      messaging.declareQueue.mockRejectedValueOnce(
        new Error('RabbitMQ publish channel is not ready'),
      );
      try {
        await expect(relay.onModuleInit()).resolves.toBeUndefined();
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(tx.outboxEvent.update).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(500);
        expect(messaging.declareQueue).toHaveBeenCalledTimes(2);
        expect(messaging.emit).toHaveBeenCalledWith(
          'question.updated',
          'q1',
          expect.objectContaining({ eventId: 'event-1' }),
        );
        expect(tx.outboxEvent.update.mock.calls[0][0].data.retryCount).toBeUndefined();
        await relay.onModuleDestroy();
        await jest.advanceTimersByTimeAsync(1000);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      } finally {
        await relay.onModuleDestroy();
      }
    });

    it('does not query or update outbox events while queue provisioning keeps failing', async () => {
      const { relay, messaging, prisma, tx } = setup();
      messaging.declareQueue.mockRejectedValue(new Error('broker offline'));
      try {
        await relay.onModuleInit();
        await jest.advanceTimersByTimeAsync(1500);
        expect(messaging.declareQueue).toHaveBeenCalledTimes(4);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(messaging.emit).not.toHaveBeenCalled();
        expect(tx.outboxEvent.update).not.toHaveBeenCalled();
      } finally {
        await relay.onModuleDestroy();
      }
    });
  });
});
