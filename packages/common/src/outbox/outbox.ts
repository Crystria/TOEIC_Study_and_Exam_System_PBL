import { randomUUID } from 'node:crypto';

export interface OutboxEventRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
  createdAt: Date;
  publishedAt: Date | null;
  retryCount: number;
  lastError: string | null;
}

/**
 * Client tối thiểu (Prisma transaction client) cần cho Outbox.
 * Mỗi service tự sinh Prisma client với model `outboxEvent`.
 */
export interface OutboxPrismaClient {
  outboxEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export interface OutboxInput<T> {
  aggregateType?: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  occurredAt?: Date;
  retryCount?: number;
}

/**
 * Ghi một outbox event trong CÙNG transaction với nghiệp vụ.
 * Dùng: `await writeOutbox(tx, { aggregateId, eventType, payload })`.
 */
export async function writeOutbox<T>(
  client: OutboxPrismaClient,
  input: OutboxInput<T>,
): Promise<void> {
  const data: Record<string, unknown> = {
    id: randomUUID(),
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload as Record<string, unknown>,
    createdAt: new Date(),
    publishedAt: null,
  };

  if (input.aggregateType !== undefined) {
    data.aggregateType = input.aggregateType;
  }
  if (input.occurredAt !== undefined) {
    data.occurredAt = input.occurredAt;
  }
  if (input.retryCount !== undefined) {
    data.retryCount = input.retryCount;
  }

  await client.outboxEvent.create({ data });
}
