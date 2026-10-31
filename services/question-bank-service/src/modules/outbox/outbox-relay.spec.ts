import { MessagingService } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxRelay } from './outbox-relay';
describe('outbox relay', () => {
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
    const messaging = { emit: jest.fn().mockResolvedValue(undefined) };
    return {
      tx,
      messaging,
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
});
