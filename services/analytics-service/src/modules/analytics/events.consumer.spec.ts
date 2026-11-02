import { ConfigService } from '@nestjs/config';
import { MessagingService, stableHash } from '@toeic/common';
import fixtures from '../../../../../packages/contracts/p0/fixtures/events.valid.json';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsClock } from './calculations';
import { EventsConsumer } from './events.consumer';
import { ProjectionService } from './projection.service';

describe('Analytics committed-event replay', () => {
  const event = fixtures.find((f) => f.data.eventType === 'VocabularyLearnedEvent.v2')!.data;
  function setup(outerHash: string | null, innerHash = outerHash) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      processedEvent: { findUnique: jest.fn().mockResolvedValue({ payloadHash: innerHash }) },
      analyticsQuarantine: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      processedEvent: {
        findUnique: jest
          .fn()
          .mockResolvedValue(outerHash === null ? null : { payloadHash: outerHash }),
      },
      $transaction: jest.fn().mockImplementation((work) => work(tx)),
    };
    const consumer = new EventsConsumer(
      db as unknown as PrismaService,
      {} as MessagingService,
      new ConfigService(),
      {} as ProjectionService,
      new AnalyticsClock(),
    );
    return { consumer, db, tx };
  }

  it('handles a burst of 200 identical committed events without taking transaction locks', async () => {
    const { consumer, db } = setup(stableHash(event));
    await Promise.all(Array.from({ length: 200 }, () => consumer.consume(event)));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('still checks for a concurrently committed event inside the transaction', async () => {
    const { consumer, db, tx } = setup(null, stableHash(event));
    await consumer.consume(event);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.processedEvent.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.analyticsQuarantine.upsert).not.toHaveBeenCalled();
  });

  it('quarantines an existing event ID with a different hash', async () => {
    const { consumer, db, tx } = setup('different-payload');
    await consumer.consume(event);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.analyticsQuarantine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reason: 'EVENT_ID_COLLISION' }),
      }),
    );
  });

  it('does not accept legacy inbox entries with no payload hash as exact replays', async () => {
    const { consumer, tx } = setup(null);
    await consumer.consume(event);
    expect(tx.analyticsQuarantine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ reason: 'LEGACY_EVENT_ID_COLLISION' }),
      }),
    );
  });
});
