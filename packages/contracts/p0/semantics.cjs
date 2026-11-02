const assert = require('node:assert/strict');
const defaults = require('./defaults.json');
const maxRevision = 9223372036854775807n;
function unique(items, key, label) {
  assert.equal(new Set(items.map(key)).size, items.length, label);
}

function semantic(value, definition) {
  function visit(node, key = '') {
    if (node === null) return;
    if (node === null || typeof node !== 'object') {
      if (
        [
          'revision',
          'baseVersion',
          'syncVersion',
          'resolvedVersion',
          'appliedVersion',
          'baseEntityRevision',
          'userVersion',
          'sessionVersion',
        ].includes(key)
      ) {
        assert.equal(typeof node, 'string', 'Revision must be string');
        assert.ok(BigInt(node) <= maxRevision, 'Signed BIGINT overflow');
      }
      return;
    }
    if (Array.isArray(node)) return node.forEach((item) => visit(item));
    if (Array.isArray(node.partStats)) {
      const totals = [6, 25, 39, 30, 30, 16, 54];
      unique(node.partStats, (part) => part.part, 'Duplicate Part');
      node.partStats.forEach((part) => {
        assert.ok(part.correct <= part.total, 'Correct exceeds total');
        assert.equal(part.total, totals[part.part - 1], 'Incomplete TOEIC Part');
      });
      assert.equal(
        node.partStats.reduce((n, p) => n + p.correct, 0),
        node.correctCount,
        'Correct breakdown mismatch',
      );
      assert.equal(
        node.partStats.reduce((n, p) => n + p.total, 0),
        node.totalQuestions,
        'Question total mismatch',
      );
      if (node.mode === 'FULL') {
        assert.equal(
          node.totalScore,
          node.scoreListening + node.scoreReading,
          'Scaled score sum mismatch',
        );
        assert.equal(
          node.correctListeningCount,
          node.partStats.filter((p) => p.part <= 4).reduce((n, p) => n + p.correct, 0),
        );
        assert.equal(
          node.correctReadingCount,
          node.partStats.filter((p) => p.part >= 5).reduce((n, p) => n + p.correct, 0),
        );
        assert.deepEqual(
          node.partStats.map((p) => p.part).sort((a, b) => a - b),
          [1, 2, 3, 4, 5, 6, 7],
        );
      } else {
        assert.deepEqual(
          [...node.parts].sort((a, b) => a - b),
          node.partStats.map((p) => p.part).sort((a, b) => a - b),
        );
        const expected = Math.round((node.correctCount / node.totalQuestions) * 1e6) / 1e6;
        assert.ok(Math.abs(node.accuracy - expected) < 1e-10, 'Accuracy mismatch');
      }
    }
    if (Array.isArray(node.reviews))
      unique(node.reviews, (item) => item.vocabularyId, 'Duplicate session vocabulary');
    if (Array.isArray(node.answers))
      unique(node.answers, (item) => item.questionId, 'Duplicate quiz question');
    if (Array.isArray(node.progress))
      unique(
        node.progress,
        (item) => `${item.entityType}:${item.entityId}`,
        'Duplicate progress entity',
      );
    if ('firstLearned' in node) {
      if (node.firstLearned) {
        assert.ok(node.quality >= 3, 'firstLearned requires quality >= 3');
        assert.notEqual(node.firstLearnedAt, null, 'firstLearned requires timestamp');
      }
      if (node.quality >= 3)
        assert.notEqual(node.firstLearnedAt, null, 'Successful review requires learned timestamp');
    }
    if ('baseVersion' in node && 'syncVersion' in node && 'operation' in node) {
      assert.equal(
        BigInt(node.syncVersion),
        BigInt(node.baseVersion) + 1n,
        'Sync sequence must increment once',
      );
    }
    if ('sessionVersion' in node && 'sessionId' in node && 'reason' in node)
      assert.equal(
        node.sessionId === null,
        node.sessionVersion === null,
        'Session identity/version pair',
      );
    if (node.status === 'APPLIED' && 'reason' in node) assert.equal(node.reason, null);
    if (node.status === 'REJECTED' && 'reason' in node)
      assert.ok(typeof node.reason === 'string' && node.reason.length > 0);
    if (node.payload && node.occurredAt) {
      for (const field of ['activityAt', 'completedAt'])
        if (node.payload[field]) {
          assert.ok(
            Date.parse(node.payload[field]) <= Date.parse(node.occurredAt),
            'Activity after event commit time',
          );
        }
    }
    Object.entries(node).forEach(([childKey, child]) => visit(child, childKey));
  }
  visit(value);
  if (definition === 'RegisterRequest') {
    assert.equal(value.password, value.confirmPassword, 'Confirmation mismatch');
    assert.ok(Buffer.byteLength(value.password, 'utf8') <= 72, 'BCrypt byte limit');
  }
  if (definition === 'PresignRequest') {
    const audio = value.kind === 'AUDIO';
    assert.ok(
      value.sizeBytes <= (audio ? defaults.audioMaxBytes : defaults.imageMaxBytes),
      'Media too large',
    );
    assert.ok(
      audio
        ? value.contentType === 'audio/mpeg'
        : ['image/jpeg', 'image/png', 'image/webp'].includes(value.contentType),
      'Media kind/content type mismatch',
    );
  }
}

module.exports = { semantic };
