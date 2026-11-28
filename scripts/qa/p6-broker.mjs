import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { require, root } from './config.mjs';
export async function brokerBenchmark(env) {
  const connection = await require('amqplib').connect(env.RABBITMQ_URL),
    exchange = 'qa.p6.benchmark',
    queue = exchange + '.consumer';
  const pub = await connection.createConfirmChannel(),
    sub = await connection.createChannel();
  let received = 0,
    invalid = 0;
  const count = 60000,
    start = performance.now();
  try {
    await pub.assertExchange(exchange, 'topic', { durable: true });
    await sub.assertQueue(queue, { durable: true });
    await sub.bindQueue(queue, exchange, 'vocabulary.learned.v2');
    await sub.prefetch(1000);
    const validate = require(join(root, 'packages/contracts/p0/runtime.cjs')).validateEvent,
      golden = require(join(root, 'packages/contracts/p0/fixtures/events.valid.json')).find(
        (e) => e.data.eventType === 'VocabularyLearnedEvent.v2',
      ).data;
    await sub.consume(queue, (m) => {
      if (!m) return;
      try {
        validate(JSON.parse(m.content));
      } catch {
        invalid++;
      }
      received++;
      sub.ack(m);
    });
    for (let i = 0; i < count; i++) {
      const value = { ...golden, eventId: randomUUID() };
      if (
        !pub.publish(exchange, 'vocabulary.learned.v2', Buffer.from(JSON.stringify(value)), {
          persistent: true,
        })
      )
        await new Promise((r) => pub.once('drain', r));
      if (i % 1000 === 999) await pub.waitForConfirms();
    }
    await pub.waitForConfirms();
    const publishedAt = performance.now();
    while (received < count && performance.now() - start < 60000)
      await new Promise((r) => setTimeout(r, 20));
    const consumedAt = performance.now();
    assert.equal(received, count);
    assert.equal(invalid, 0);
    return {
      messages: count,
      publishPerSecond: count / ((publishedAt - start) / 1000),
      consumePerSecond: count / ((consumedAt - start) / 1000),
      drainLagMs: consumedAt - publishedAt,
      passed: count / ((consumedAt - start) / 1000) >= 5000,
      scope:
        'persistent broker transport + V2 validation + consumer ack; isolated exchange, excludes business projection transactions',
    };
  } finally {
    await sub.deleteQueue(queue);
    await pub.deleteExchange(exchange);
    await pub.close();
    await sub.close();
    await connection.close();
  }
}
