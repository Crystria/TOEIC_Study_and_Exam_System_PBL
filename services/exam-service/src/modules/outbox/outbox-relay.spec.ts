import { MessagingService } from '@toeic/common';
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
    const messaging = { emit: jest.fn().mockResolvedValue(undefined) };
    const relay = new ExamOutboxRelay(
      {
        $transaction: (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      } as unknown as PrismaService,
      messaging as unknown as MessagingService,
    );
    return { relay, tx, messaging };
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
});
