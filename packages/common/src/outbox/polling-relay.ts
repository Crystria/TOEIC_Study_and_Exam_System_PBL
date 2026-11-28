export interface ClaimedEvent {
  id: string;
  aggregateId: string;
  routingKey: string;
  envelope: unknown;
  leaseOwner: string;
  retryCount: number;
}

/** Stores must commit claim/lease before returning. All updates compare leaseOwner. */
export interface OutboxStore {
  claim(limit: number, leaseSeconds: number): Promise<ClaimedEvent[]>;
  published(event: ClaimedEvent): Promise<void>;
  failed(event: ClaimedEvent, nextAttempt: Date, error: string): Promise<void>;
}

export class PollingOutboxRelay {
  private active?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private closing = false;
  constructor(
    private readonly store: OutboxStore,
    private readonly publish: (event: ClaimedEvent) => Promise<void>,
    private readonly onError: (error: unknown) => void,
  ) {}
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.poll().catch(this.onError);
    }, 500);
    this.timer.unref();
  }
  poll(): Promise<void> {
    if (this.closing) return Promise.resolve();
    if (this.active) return this.active;
    this.active = this.run().finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  private async run(): Promise<void> {
    // Claim one at a time: never queue a batch behind an expiring 30-second lease.
    for (let n = 0; n < 100 && !this.closing; n++) {
      const events = await this.store.claim(1, 30);
      if (!events.length) return;
      const event = events[0];
      try {
        await this.publish(event);
        await this.store.published(event);
      } catch (error) {
        const delay = Math.min(
          60_000,
          1000 * 2 ** Math.min(event.retryCount, 6) + Math.floor(Math.random() * 250),
        );
        await this.store.failed(event, new Date(Date.now() + delay), String(error).slice(0, 1000));
        const attempts = event.retryCount + 1;
        this.onError(
          new Error(
            `Outbox ${event.id}, attempt ${attempts}${attempts >= 20 ? ', ALERT: repeated publish failure' : ''}: ${String(error)}`,
          ),
        );
      }
    }
  }
  async stop(): Promise<void> {
    this.closing = true;
    clearInterval(this.timer);
    await this.active;
  }
}
