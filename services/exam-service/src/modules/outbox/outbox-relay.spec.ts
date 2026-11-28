import { MessagingService } from '@toeic/common';
import { ConfigService } from '@nestjs/config';
import goldenEvents from '../../../../../packages/contracts/p0/fixtures/events.valid.json';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamOutboxRelay } from './outbox-relay';
describe('Exam outbox relay', () => {
  function setup(type = 'PartPracticeSubmittedEvent', retries = 0) {
    const event = {
      id: 'e1',
      aggregate_id: 'attempt-1',
      event_type: type,
      occurred_at: new Date(),
      payload: { attemptId: 'attempt-1' },
      retry_count: retries,
      last_error: 'offline',
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([event]),
      outboxEvent: { update: jest.fn().mockResolvedValue({}) },
    };
    const messaging = {
      emit: jest.fn().mockResolvedValue(undefined),
      declareConsumerQueue: jest.fn().mockResolvedValue(undefined),
      declareQueue: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(tx)),
    };
    const relay = new ExamOutboxRelay(
      prisma as unknown as PrismaService,
      messaging as unknown as MessagingService,
    );
    return { relay, tx, messaging, prisma };
  }
  it.each([
    ['TestSubmittedEvent', 'test.submitted'],
    ['PartPracticeSubmittedEvent', 'part-practice.submitted'],
  ])('publishes %s with a stable stored event ID', async (type, route) => {
    const { relay, messaging, tx } = setup(type);
    await relay.poll();
    expect(messaging.emit).toHaveBeenCalledWith(
      route,
      'attempt-1',
      expect.objectContaining({ eventId: 'e1', aggregateId: 'attempt-1' }),
    );
    expect(tx.outboxEvent.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });
  it('backs off on broker failure and preserves the unpublished event', async () => {
    const { relay, messaging, tx } = setup();
    messaging.emit.mockRejectedValue(new Error('offline'));
    await relay.poll();
    const update = tx.outboxEvent.update.mock.calls[0][0].data;
    expect(update.retryCount).toEqual({ increment: 1 });
    expect(update.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(update.publishedAt).toBeUndefined();
  });
  it('dead-letters exhausted events instead of publishing another domain event', async () => {
    const { relay, messaging, tx } = setup('TestSubmittedEvent', 10);
    await relay.poll();
    expect(messaging.emit.mock.calls[0][0]).toBe('exam.outbox.dead');
    expect(tx.outboxEvent.update.mock.calls[0][0].data.deadLetteredAt).toBeInstanceOf(Date);
  });
  it('publishes the stored V2 envelope with its original ID', async () => {
    const envelope = goldenEvents[0].data;
    const { relay, tx, messaging } = setup(envelope.eventType);
    tx.$queryRaw.mockResolvedValue([
      {
        id: envelope.eventId,
        aggregate_id: envelope.payload.attemptId,
        event_type: envelope.eventType,
        payload: envelope,
        retry_count: 0,
      },
    ]);
    await relay.poll();
    expect(messaging.declareConsumerQueue).toHaveBeenCalled();
    expect(messaging.emit).toHaveBeenCalledWith(
      'test.submitted.v2',
      envelope.payload.attemptId,
      envelope,
    );
    expect(tx.outboxEvent.update.mock.calls[0][0].where.id).toBe(envelope.eventId);
    expect(tx.outboxEvent.update.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });
  it('dead letters an exhausted corrupt V2 outbox row for inspection', async () => {
    const { relay, tx, messaging } = setup('TestSubmittedEvent.v2', 10);
    await relay.poll();
    expect(messaging.emit.mock.calls[0][0]).toBe('exam.outbox.dead');
    expect(messaging.emit.mock.calls[0][2].payload.originalEvent).toEqual({
      attemptId: 'attempt-1',
    });
    expect(tx.outboxEvent.update.mock.calls[0][0].data.deadLetteredAt).toBeInstanceOf(Date);
  });

  describe('startup while RabbitMQ is unavailable', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('starts without a channel and resumes the stored event after provisioning recovers', async () => {
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
          'part-practice.submitted',
          'attempt-1',
          expect.objectContaining({ eventId: 'e1' }),
        );
        expect(tx.outboxEvent.update.mock.calls[0][0].data.retryCount).toBeUndefined();
        await relay.onModuleDestroy();
        await jest.advanceTimersByTimeAsync(1000);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      } finally {
        await relay.onModuleDestroy();
      }
    });

    it('keeps rows untouched until the queue can be declared', async () => {
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

    it('retains the configured namespace for the holding queue', async () => {
      const messaging = { declareQueue: jest.fn().mockResolvedValue(undefined) };
      const relay = new ExamOutboxRelay(
        {} as PrismaService,
        messaging as unknown as MessagingService,
        new ConfigService({ ANALYTICS_QUEUE_PREFIX: 'qa.test1' }),
      );
      try {
        await relay.onModuleInit();
        expect(messaging.declareQueue).toHaveBeenCalledWith(
          'qa.test1.exam-outbox-dlq',
          'exam.outbox.dead',
        );
      } finally {
        await relay.onModuleDestroy();
      }
    });
  });
});
