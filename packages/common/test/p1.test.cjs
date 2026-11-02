const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { JwtService } = require('@nestjs/jwt');
const {
  accessJwtOptions,
  PollingOutboxRelay,
  MessagingService,
  StorageAdapter,
  AuthorizationStateVerifier,
  validateEvent,
} = require('../dist');
const pair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
test('RS256 signing/verification and algorithm/issuer isolation', async () => {
  const config = isolatedConfig({
    JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
    JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
  });
  const issuer = new JwtService(accessJwtOptions(config, true));
  const verifier = new JwtService(accessJwtOptions(config));
  const token = await issuer.signAsync({ sub: 'u', type: 'access', roles: ['USER'] });
  assert.equal((await verifier.verifyAsync(token)).sub, 'u');
  await assert.rejects(
    verifier.verifyAsync(await new JwtService({ secret: 'other' }).signAsync({ sub: 'u' })),
  );
  await assert.rejects(
    verifier.verifyAsync(await issuer.signAsync({ sub: 'u' }, { issuer: 'other' })),
  );
  assert.throws(() => accessJwtOptions(isolatedConfig()), /required/);
  assert.throws(() => accessJwtOptions(isolatedConfig({ JWT_ACCESS_PUBLIC_KEY: 'not a key' })));
});
test('publish confirm failure does not mark outbox published; retry retains ID', async () => {
  const event = {
    id: 'e',
    aggregateId: 'a',
    routingKey: 'legacy',
    envelope: {},
    leaseOwner: 'worker',
    retryCount: 0,
  };
  let claims = 0,
    failed = 0,
    published = 0;
  const store = {
    claim: async () => (claims++ === 0 ? [event] : []),
    published: async () => published++,
    failed: async (e, date) => {
      assert.equal(e.id, 'e');
      assert.ok(date > Date.now());
      failed++;
    },
  };
  const relay = new PollingOutboxRelay(
    store,
    async () => {
      throw Error('broker unavailable');
    },
    () => {},
  );
  await relay.poll();
  await relay.stop();
  assert.equal(failed, 1);
  assert.equal(published, 0);
});
test('crash after publish before marking permits replay of same event', async () => {
  const event = {
    id: 'same',
    aggregateId: 'a',
    routingKey: 'legacy',
    envelope: {},
    leaseOwner: 'worker',
    retryCount: 0,
  };
  let count = 0,
    claims = 0;
  const ids = [];
  const store = {
    claim: async () => (claims++ % 2 === 0 ? [event] : []),
    published: async () => {
      if (count++ === 0) throw Error('DB unavailable');
    },
    failed: async () => {},
  };
  const relay = new PollingOutboxRelay(
    store,
    async (e) => {
      ids.push(e.id);
    },
    () => {},
  );
  await relay.poll();
  await relay.poll();
  await relay.stop();
  assert.deepEqual(ids, ['same', 'same']);
});
test('mandatory return is a failed publish despite positive broker confirm', async () => {
  const service = new MessagingService(isolatedConfig());
  const channel = new EventEmitter();
  channel.publish = () => {
    channel.emit('return', {});
  };
  channel.waitForConfirms = async () => {};
  service.publishChannel = channel;
  await assert.rejects(
    service.emit('missing', 'a', {
      eventId: 'e',
      eventType: 'Legacy',
      occurredAt: Date.now(),
      payload: {},
    }),
    /Unroutable/,
  );
});
test('retry confirms delivery to same consumer before original ack', async () => {
  const service = new MessagingService(isolatedConfig());
  const calls = [];
  service.confirmedPublish = async (ex, route) => {
    assert.equal(ex, '');
    assert.equal(route, 'consumer.v2.retry.1000');
    calls.push('confirm');
  };
  const channel = { ack: () => calls.push('ack'), nack: () => calls.push('nack') };
  await service.dispatch(
    channel,
    {
      fields: { routingKey: 'test.submitted.v2' },
      properties: { headers: {} },
      content: Buffer.from(
        JSON.stringify(require('@toeic/contracts/p0/fixtures/events.valid.json')[0].data),
      ),
    },
    async () => {
      throw Error('DB');
    },
    'consumer.v2',
  );
  assert.deepEqual(calls, ['confirm', 'ack']);
});
test('failed retry publish keeps original recoverable', async () => {
  const service = new MessagingService(isolatedConfig());
  service.confirmedPublish = async () => {
    throw Error('disconnected');
  };
  const calls = [];
  await service.dispatch(
    { ack: () => calls.push('ack'), nack: (_m, _all, requeue) => calls.push(requeue) },
    { fields: { routingKey: 'legacy' }, properties: { headers: {} }, content: Buffer.from('{}') },
    async () => {
      throw Error('DB');
    },
    'consumer',
  );
  assert.deepEqual(calls, [true]);
});
test('poison v2 is dead lettered without calling business handler', async () => {
  const service = new MessagingService(isolatedConfig());
  let called = false;
  const calls = [];
  service.confirmedPublish = async () => {
    calls.push('confirm-dlq');
  };
  await service.dispatch(
    { ack: () => calls.push('ack'), nack: (_m, _all, requeue) => calls.push(requeue) },
    { fields: { routingKey: 'test.submitted.v2' }, properties: {}, content: Buffer.from('{}') },
    async () => {
      called = true;
    },
    'consumer.v2',
  );
  assert.equal(called, false);
  assert.deepEqual(calls, ['confirm-dlq', 'ack']);
});
test('runtime validators accept golden events and reject semantic invalidity', () => {
  for (const fixture of require('@toeic/contracts/p0/fixtures/events.valid.json'))
    assert.ok(validateEvent(fixture.data).endsWith('.v2'));
  for (const fixture of require('@toeic/contracts/p0/fixtures/events.invalid.json'))
    assert.throws(() => validateEvent(fixture.data), fixture.name);
});
test('private avatar tickets enforce owner, metadata, TTL and size', async () => {
  let metadata = { size: 100, contentType: 'image/png' };
  const adapter = new StorageAdapter(
    {
      presignPut: async () => 'https://storage/put',
      presignGet: async () => 'https://storage/get',
      head: async () => metadata,
    },
    { bucket: 'toeic-user', prefix: 'avatars/' },
  );
  const ticket = await adapter.presign('u', 'u', 'image/png', 100);
  assert.equal(await adapter.confirm(ticket, 'u', 'u'), ticket.objectKey);
  await assert.rejects(adapter.confirm(ticket, 'other', 'u'));
  metadata = { size: 101, contentType: 'image/png' };
  await assert.rejects(adapter.confirm(ticket, 'u', 'u'));
  await assert.rejects(adapter.presign('u', 'u', 'audio/mpeg', 100));
  await assert.rejects(adapter.presign('u', 'u', 'image/png', 2097153));
  await assert.rejects(adapter.confirm({ ...ticket, expiresAt: 0 }, 'u', 'u'));
});
test('authorization cache invalidation and dependency outage fail closed', async () => {
  let fail = false,
    calls = 0;
  const claims = { sub: 'u', sid: 's', userVersion: '1', sessionVersion: '1' };
  const verifier = new AuthorizationStateVerifier(async () => {
    calls++;
    if (fail) throw Error('offline');
    return {
      userId: 'u',
      sessionId: 's',
      userVersion: '1',
      sessionVersion: '1',
      status: 'ACTIVE',
      sessionRevoked: false,
    };
  });
  await verifier.verify(claims);
  await verifier.verify(claims);
  assert.equal(calls, 1);
  await assert.rejects(verifier.verify({ ...claims, userVersion: '2' }), /REVOKED/);
  verifier.invalidate('u');
  fail = true;
  await assert.rejects(verifier.verify(claims), /UNAVAILABLE/);
});

test('V2 outbox row and retries preserve the validated envelope event ID', async () => {
  const { writeV2Outbox, outboxRoute } = require('../dist');
  const envelope = require('../../contracts/p0/fixtures/events.valid.json')[0].data;
  let row;
  await writeV2Outbox(
    {
      outboxEvent: {
        create: async ({ data }) => {
          row = data;
        },
      },
    },
    'aggregate',
    envelope,
  );
  assert.equal(row.id, envelope.eventId);
  assert.deepEqual(row.payload, envelope);
  assert.equal(outboxRoute({ id: row.id, envelope: row.payload }), validateEvent(envelope));
  assert.throws(() => outboxRoute({ id: 'different', envelope }), /ID mismatch/);
});

function isolatedConfig(values = {}) {
  return { get: (name) => values[name] };
}

test('isolated P6 avatar bucket keeps the private URL policy',()=>{assert.doesNotThrow(()=>new StorageAdapter({}, {bucket:'toeic-user-p6',prefix:'avatars/'}));assert.throws(()=>new StorageAdapter({}, {bucket:'toeic-user-p6',prefix:'avatars/',publicBase:'http://public'}));assert.throws(()=>new StorageAdapter({}, {bucket:'other',prefix:'avatars/'}));});
