const assert = require('node:assert/strict');
const fs = require('node:fs');
const amqp = require('amqplib');
const { randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { MessagingService } = require('../dist');
const env = fs.existsSync('../../.env')
  ? require('dotenv').parse(fs.readFileSync('../../.env'))
  : {};
const exchange = 'p1.verify.' + randomUUID() + '.events';
const config = new ConfigService({
  RABBITMQ_URL: process.env.P1_RABBITMQ_URL || env.RABBITMQ_URL,
  RABBITMQ_EXCHANGE: exchange,
});
const service = new MessagingService(config);
const queue = 'p1.verify.' + randomUUID() + '.v2';
const fixture = require('@toeic/contracts/p0/fixtures/events.valid.json')[0].data;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(50);
  }
  throw Error('Broker verification deadline exceeded');
}
let connection, channel;
(async () => {
  try {
    await service.onModuleInit();
    await until(() => !!service.publishChannel, 6000);
    connection = await amqp.connect(config.get('RABBITMQ_URL'));
    channel = await connection.createConfirmChannel();
    let calls = 0,
      delivered = 0;
    await service.subscribe(queue, 'test.submitted.v2', async () => {
      calls++;
      if (calls < 3) throw Error('simulated transient consumer failure');
      delivered++;
    });
    await service.emit('test.submitted.v2', 'test', { ...fixture, eventId: randomUUID() });
    await until(() => delivered === 1);
    assert.equal(calls, 3);
    // Malformed body bypasses emitter validation to exercise the consumer poison path.
    channel.publish(exchange, 'test.submitted.v2', Buffer.from('{}'), { persistent: true });
    await channel.waitForConfirms();
    let dead;
    await until(async () => {
      dead = await channel.get(queue + '.dlq', { noAck: true });
      return !!dead;
    });
    assert.equal(dead.properties.headers['x-failure-reason'], 'INVALID_EVENT');
    const previous = service.publishChannel;
    await service.connection.close();
    await until(() => service.publishChannel && service.publishChannel !== previous);
    await service.emit('test.submitted.v2', 'test', { ...fixture, eventId: randomUUID() });
    await until(() => delivered >= 2);
    console.log(
      'PASS: real RabbitMQ delayed consumer-local retry, confirmed DLQ and reconnect/resubscribe.',
    );
  } finally {
    await service.onModuleDestroy();
    if (channel) {
      for (const name of [
        queue,
        queue + '.dlq',
        ...[1000, 5000, 30000].map((delay) => queue + '.retry.' + delay),
      ]) {
        assert.ok(name.startsWith('p1.verify.'));
        await channel.deleteQueue(name);
      }
      await channel.deleteQueue(exchange + '.dlq');
      await channel.deleteExchange(exchange + '.dlx');
      await channel.deleteExchange(exchange);
      await channel.close();
    }
    if (connection) await connection.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
