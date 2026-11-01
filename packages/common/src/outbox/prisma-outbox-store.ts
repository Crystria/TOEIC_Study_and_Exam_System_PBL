import { randomUUID } from 'node:crypto';
import { ClaimedEvent, OutboxStore } from './polling-relay';
import { validateEvent } from '../messaging/event-validation';

export interface OutboxSqlClient {
  $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>;
}
export class PrismaOutboxStore implements OutboxStore {
  constructor(
    private readonly db: OutboxSqlClient,
    private readonly routes: Record<string, string>,
  ) {}
  async claim(limit: number, leaseSeconds: number): Promise<ClaimedEvent[]> {
    const owner = randomUUID();
    const rows = await this.db.$queryRawUnsafe<
      Array<{
        id: string;
        aggregate_id: string;
        event_type: string;
        payload: unknown;
        created_at: Date;
        retry_count: number;
      }>
    >(
      `WITH pending AS (
      SELECT id FROM outbox_events WHERE published_at IS NULL
      AND next_attempt_at <= timezone('UTC', now()) AND (lease_until IS NULL OR lease_until < now())
      ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE outbox_events e SET lease_owner=$2, lease_until=now()+($3 * interval '1 second')
      FROM pending WHERE e.id=pending.id RETURNING e.id,e.aggregate_id,e.event_type,e.payload,e.created_at,e.retry_count`,
      limit,
      owner,
      leaseSeconds,
    );
    return rows.map((row) => {
      const envelope = row.event_type.endsWith('.v2')
        ? row.payload
        : {
            eventId: row.id,
            eventType: row.event_type,
            occurredAt: row.created_at.getTime(),
            payload: row.payload,
          };
      // Validation occurs in publisher, after claim, so poison records get retry metadata.
      return {
        id: row.id,
        aggregateId: row.aggregate_id,
        routingKey: this.routes[row.event_type] ?? '',
        envelope,
        leaseOwner: owner,
        retryCount: row.retry_count,
      };
    });
  }
  async published(event: ClaimedEvent): Promise<void> {
    await this.db.$executeRawUnsafe(
      `UPDATE outbox_events SET published_at=timezone('UTC',now()),lease_owner=NULL,lease_until=NULL,last_error=NULL WHERE id=$1 AND lease_owner=$2`,
      event.id,
      event.leaseOwner,
    );
  }
  async failed(event: ClaimedEvent, nextAttempt: Date, error: string): Promise<void> {
    await this.db.$executeRawUnsafe(
      `UPDATE outbox_events SET retry_count=retry_count+1,next_attempt_at=timezone('UTC',$3::timestamptz),lease_owner=NULL,lease_until=NULL,last_error=$4 WHERE id=$1 AND lease_owner=$2`,
      event.id,
      event.leaseOwner,
      nextAttempt,
      error,
    );
  }
}

export function outboxRoute(event: ClaimedEvent): string {
  if ((event.envelope as { version?: number })?.version === 2) {
    if ((event.envelope as { eventId: string }).eventId !== event.id)
      throw new Error('Outbox event ID mismatch');
    return validateEvent(event.envelope);
  }
  if (!event.routingKey) throw new Error('Unknown legacy outbox route');
  return event.routingKey;
}
