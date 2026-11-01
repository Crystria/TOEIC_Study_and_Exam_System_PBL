const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { JwtService } = require('@nestjs/jwt');
const {
  offlineActivityAt,
  normalizeLearningOperation,
  stableHash,
  progressCursor,
  parseProgressCursor,
  learningServiceToken,
  verifyLearningServiceToken,
} = require('../dist');
const { validateRequest } = require('@toeic/contracts/p0/runtime.cjs');
test('offline clock accepts exactly 30 days, clamps five future minutes and rejects out-of-window values', () => {
  const accepted = new Date('2026-11-01T00:00:00Z');
  for (const delta of [-30 * 86400000, 0, 300000]) {
    const client = new Date(accepted.getTime() + delta);
    assert.equal(
      offlineActivityAt(client.toISOString(), accepted).getTime(),
      delta > 0 ? accepted.getTime() : client.getTime(),
    );
  }
  for (const delta of [-30 * 86400000 - 1, 300001])
    assert.throws(() =>
      offlineActivityAt(new Date(accepted.getTime() + delta).toISOString(), accepted),
    );
  assert.throws(() => offlineActivityAt('invalid', accepted));
});
test('session canonical identity is independent of answer/review order while changing a choice changes identity', () => {
  const op = {
    kind: 'SUBMIT_VOCABULARY_SESSION',
    sessionId: randomUUID(),
    reviews: ['b', 'a'].map((vocabularyId) => ({ vocabularyId, quality: 5 })),
    answers: ['y', 'x'].map((questionId) => ({ questionId, selectedOption: 'A' })),
  };
  const a = stableHash(normalizeLearningOperation(op)),
    b = stableHash(
      normalizeLearningOperation({
        ...op,
        reviews: [...op.reviews].reverse(),
        answers: [...op.answers].reverse(),
      }),
    );
  assert.equal(a, b);
  assert.notEqual(
    a,
    stableHash(
      normalizeLearningOperation({
        ...op,
        answers: op.answers.map((r) => ({ ...r, selectedOption: 'B' })),
      }),
    ),
  );
});
test('projection cursor is bounded and scoped to its user', () => {
  const u = randomUUID(),
    v = randomUUID(),
    cursor = progressCursor(u, 'VOCABULARY', v);
  assert.deepEqual(parseProgressCursor(cursor, u), { entityType: 'VOCABULARY', entityId: v });
  for (const bad of [cursor + '!', 'a'.repeat(513), progressCursor(randomUUID(), 'VOCABULARY', v)])
    assert.throws(() => parseProgressCursor(bad, u));
});
test('internal Learning credentials enforce scope, audience, subject, algorithm and expiry', async () => {
  const secret = 'p4-tests-only-32-byte-secret-123456';
  const token = await learningServiceToken(secret, 'learning:progress:read');
  await verifyLearningServiceToken(secret, 'Bearer ' + token, 'learning:progress:read');
  await assert.rejects(
    verifyLearningServiceToken(secret, 'Bearer ' + token, 'learning:operations:read'),
  );
  for (const options of [
    { subject: 'learning-service' },
    { audience: 'toeic-auth-internal' },
    { expiresIn: -1 },
  ]) {
    const bad = await new JwtService().signAsync(
      { scope: 'learning:progress:read' },
      {
        secret,
        algorithm: 'HS256',
        subject: 'auth-service',
        issuer: 'toeic-services',
        audience: 'toeic-learning-internal',
        expiresIn: 30,
        ...options,
      },
    );
    await assert.rejects(
      verifyLearningServiceToken(secret, 'Bearer ' + bad, 'learning:progress:read'),
    );
  }
  await assert.rejects(verifyLearningServiceToken(secret, undefined, 'learning:progress:read'));
});
test('sync runtime rejects repeated session items and signed BIGINT overflow', () => {
  const id = randomUUID(),
    b = {
      deviceId: 'a',
      operationId: randomUUID(),
      baseVersion: '9223372036854775808',
      clientOccurredAt: new Date().toISOString(),
      operation: {
        kind: 'REVIEW_FLASHCARD',
        vocabularyId: id,
        baseEntityRevision: '0',
        quality: 5,
      },
    };
  assert.throws(() => validateRequest('SyncRequest', b));
  const session = {
    kind: 'SUBMIT_VOCABULARY_SESSION',
    sessionId: randomUUID(),
    reviews: Array.from({ length: 5 }, () => ({ vocabularyId: id, quality: 4 })),
    answers: Array.from({ length: 5 }, () => ({ questionId: randomUUID(), selectedOption: 'A' })),
  };
  assert.throws(() =>
    validateRequest('SyncRequest', { ...b, baseVersion: '0', operation: session }),
  );
});
