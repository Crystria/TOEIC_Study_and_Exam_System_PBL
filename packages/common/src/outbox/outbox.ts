import { randomUUID } from 'node:crypto';

export interface OutboxEventRecord {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
  publishedAt: Date | null;
}

/**
 * Client tối thiểu (Prisma transaction client) cần cho Outbox.
 * Mỗi service tự sinh Prisma client với model `outboxEvents`.
 */
export interface OutboxPrismaClient {
  outboxEvents: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export interface OutboxInput<T> {
  aggregateId: string;
  eventType: string;
  payload: T;
}

/**
 * Ghi một outbox event trong CÙNG transaction với nghiệp vụ.
 * Dùng: `await writeOutbox(tx, { aggregateId, eventType, payload })`.
 */
export async function writeOutbox<T>(
  client: OutboxPrismaClient,
  input: OutboxInput<T>,
): Promise<void> {
  await client.outboxEvents.create({
    data: {
      id: randomUUID(),
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload as Record<string, unknown>,
      createdAt: new Date(),
      publishedAt: null,
    },
  });
}
