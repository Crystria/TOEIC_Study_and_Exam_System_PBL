import { clients, require } from './config.mjs';
/** Read-only QA exporter; stdout contains counters/ages, never users, payloads or credentials. */
export async function observe(env = process.env) {
  const dbs = clients(),
    [auth, questions, exam, analytics, learning] = dbs;
  try {
    const now = Date.now(),
      outbox = {};
    for (const [name, db] of [
      ['auth', auth],
      ['questions', questions],
      ['exam', exam],
      ['learning', learning],
    ]) {
      const hasDead = !!db.outboxEvent.fields.deadLetteredAt;
      const where = { publishedAt: null, ...(hasDead ? { deadLetteredAt: null } : {}) };
      const oldest = await db.outboxEvent.findFirst({ where, orderBy: { createdAt: 'asc' } });
      outbox[name] = {
        pending: await db.outboxEvent.count({ where }),
        oldestAgeSeconds: oldest ? Math.max(0, (now - oldest.createdAt.getTime()) / 1000) : 0,
        deadLetters: hasDead
          ? await db.outboxEvent.count({ where: { deadLetteredAt: { not: null } } })
          : null,
      };
    }
    const pending = await auth.syncOperation.findMany({
        where: { status: 'PENDING' },
        select: { acceptedAt: true },
      }),
      last = await analytics.userStatistic.aggregate({ _max: { updatedAt: true } });
    const result = {
      at: new Date(now).toISOString(),
      outbox,
      sync: {
        pending: pending.length,
        oldestAgeSeconds: pending.length
          ? Math.max(...pending.map((p) => (now - p.acceptedAt.getTime()) / 1000))
          : 0,
      },
      analytics: {
        quarantine: await analytics.analyticsQuarantine.count(),
        lastProjectionAt: last._max.updatedAt?.toISOString() ?? null,
      },
      mail: { pending: await auth.emailDelivery.count({ where: { deliveredAt: null } }) },
    };
    const mq = await require('amqplib').connect(
      env.RABBITMQ_URL || 'amqp://toeic:toeic@localhost:5772',
    );
    try {
      const ch = await mq.createChannel();
      result.queues = {};
      for (const q of [
        'qa.p6.domain.analytics-service.v2',
        'qa.p6.sync.learning-sync.v2',
        'qa.p6.sync.auth-learning-projection.v2',
      ]) {
        const r = await ch.checkQueue(q);
        result.queues[q] = { ready: r.messageCount, consumers: r.consumerCount };
      }
      await ch.close();
    } finally {
      await mq.close();
    }
    try {
      if(process.env.P6_RABBITMQ_PORT==='6772'&&!env.RABBITMQ_MANAGEMENT_URL)throw Error('Dedicated management endpoint not configured');
      const u = new URL(env.RABBITMQ_URL || 'amqp://toeic:toeic@localhost:5772');
      const response = await fetch(
        (env.RABBITMQ_MANAGEMENT_URL || 'http://localhost:15672') + '/api/queues/%2F',
        {
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(
                decodeURIComponent(u.username) + ':' + decodeURIComponent(u.password),
              ).toString('base64'),
          },
          signal: AbortSignal.timeout(2000),
        },
      );
      if (!response.ok) throw Error('Management unavailable');
      const rows = await response.json();
      result.brokerQueues = Object.fromEntries(
        rows
          .filter((q) => q.name.startsWith('qa.p6.') || q.name === 'qa-p6-search')
          .map((q) => [
            q.name,
            {
              ready: q.messages_ready,
              unacknowledged: q.messages_unacknowledged,
              consumers: q.consumers,
            },
          ]),
      );
    } catch {
      result.managementStatus = 'unavailable';
    }
    return result;
  } finally {
    await Promise.all(dbs.map((d) => d.$disconnect()));
  }
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/observe.mjs'))
  console.log(JSON.stringify(await observe(), null, 2));
