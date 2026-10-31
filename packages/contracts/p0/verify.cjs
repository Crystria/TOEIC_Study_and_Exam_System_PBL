/* P0 specification self-checks only. No service, DB, broker or network calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

const load = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const domain = load('schemas/domain.schema.json');
const defaults = load('defaults.json');
const registry = load('events.json');
const routes = load('routes.json');
const ajv = new Ajv({ allErrors: true, jsonPointers: true, strictKeywords: true });
ajv.addSchema(domain);
for (const entry of registry) ajv.addSchema(load(entry.schema));
for (const name of Object.keys(domain.definitions))
  ajv.compile({ $ref: `${domain.$id}#/definitions/${name}` });
const maxRevision = 9223372036854775807n;
let assertions = 0;

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

function checkFixture(fixture, definition, expectedValid) {
  const validate = ajv.compile({ $ref: `${domain.$id}#/definitions/${definition}` });
  let stage = 'valid';
  if (!validate(fixture.data)) stage = 'schema';
  else {
    try {
      semantic(fixture.data, definition);
    } catch {
      stage = 'semantic';
    }
  }
  assert.equal(stage, expectedValid ? 'valid' : fixture.expectedStage, fixture.name);
  assertions++;
}

const seenEvents = new Set();
for (const [file, expectedValid] of [
  ['events.valid.json', true],
  ['events.invalid.json', false],
]) {
  for (const fixture of load(`fixtures/${file}`)) {
    const entry = registry.find((item) => item.eventType === fixture.data.eventType);
    assert.ok(entry, `Unknown fixture event ${fixture.name}`);
    const validate = ajv.getSchema(entry.schemaId);
    let stage = 'valid';
    if (!validate(fixture.data)) stage = 'schema';
    else {
      try {
        semantic(fixture.data, entry.payloadDefinition);
      } catch {
        stage = 'semantic';
      }
    }
    assert.equal(stage, expectedValid ? 'valid' : fixture.expectedStage, fixture.name);
    if (expectedValid) seenEvents.add(entry.eventType);
    assertions++;
  }
}
assert.equal(seenEvents.size, registry.length, 'Every event needs a positive fixture');
for (const fixture of load('fixtures/requests.json'))
  checkFixture(fixture, fixture.definition, fixture.valid);

function dayKey(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: defaults.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const addDays = (day, amount) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
const cases = load('fixtures/algorithms.json');
for (const c of cases.sm2) {
  const distance = 5 - c.quality;
  const cents = Math.max(
    130,
    Math.round(c.state.easinessFactor * 100) + 10 - distance * (8 + distance * 2),
  );
  const repetitionNumber = c.quality < 3 ? 0 : c.state.repetitionNumber + 1;
  const intervalDays =
    c.quality < 3 || repetitionNumber === 1
      ? 1
      : repetitionNumber === 2
        ? 6
        : Math.max(1, Math.floor((c.state.intervalDays * cents) / 100 + 0.5));
  assert.deepEqual(
    {
      easinessFactor: cents / 100,
      repetitionNumber,
      intervalDays,
      nextReviewDate: addDays(dayKey(c.activityAt), intervalDays),
    },
    c.expected,
    c.name,
  );
  assertions++;
}
for (const c of cases.prediction) {
  const from = Date.parse(c.asOf) - defaults.predictionWindowHours * 3600000;
  const attempts = c.attempts
    .filter(
      (item) =>
        item.mode === 'FULL' &&
        item.validScore &&
        Date.parse(item.completedAt) >= from &&
        Date.parse(item.completedAt) <= Date.parse(c.asOf),
    )
    .sort(
      (a, b) =>
        Date.parse(b.completedAt) - Date.parse(a.completedAt) ||
        a.attemptId.localeCompare(b.attemptId),
    )
    .slice(0, 3);
  const weighted = attempts.reduce(
    (sum, item, i) => sum + item.totalScore * defaults.predictionWeights[i],
    0,
  );
  const result =
    attempts.length < 3 ? null : Math.max(10, Math.min(990, Math.floor(weighted / 5 + 0.5) * 5));
  assert.equal(result, c.expected, c.name);
  assertions++;
}
for (const c of cases.weakAreas) {
  const correct = c.samples.reduce((sum, sample) => sum + sample.correct, 0);
  const total = c.samples.reduce((sum, sample) => sum + sample.total, 0);
  const available = total >= defaults.weakAreaMinimumQuestions;
  assert.deepEqual(
    {
      status: available ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
      correct,
      total,
      weaknessScore: available ? (total - correct) / total : null,
      isWeak: available ? (total - correct) * 100 >= total * 30 : null,
    },
    c.expected,
    c.name,
  );
  assertions++;
}
for (const c of cases.streak) {
  const days = [...new Set(c.activityAt.map(dayKey))].sort();
  let current = 0,
    longest = 0,
    previous = null;
  for (const day of days) {
    current = previous && addDays(previous, 1) === day ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  const today = dayKey(c.asOf);
  if (!previous || (previous !== today && previous !== addDays(today, -1))) current = 0;
  assert.deepEqual({ current, longest, lastDate: previous }, c.expected, c.name);
  assertions++;
}
for (const c of cases.syncAdmission) {
  let result;
  if (c.replay === 'SAME_APPLIED') result = { http: 200, status: 'APPLIED', version: '1' };
  else if (c.replay === 'DIFFERENT_HASH')
    result = { http: 409, status: 'IDEMPOTENCY_CONFLICT', version: c.head };
  else if (BigInt(c.base) < BigInt(c.head))
    result = { http: 200, status: 'CONFLICT', version: c.head };
  else if (BigInt(c.base) > BigInt(c.head))
    result = { http: 400, status: 'FUTURE_VERSION', version: c.head };
  else if (c.pending) result = { http: 200, status: 'BUSY', version: c.head };
  else result = { http: 200, status: 'PENDING', version: String(BigInt(c.head) + 1n) };
  assert.deepEqual(result, c.expected, c.name);
  assertions++;
}
for (const c of cases.projection) {
  let result = { revision: '0', stateHash: '', quarantined: 0 };
  for (const update of c.updates) {
    if (BigInt(update.revision) > BigInt(result.revision)) result = { ...result, ...update };
    else if (update.revision === result.revision && update.stateHash !== result.stateHash)
      result.quarantined++;
  }
  assert.deepEqual(result, c.expected, c.name);
  assertions++;
}

function validateOpenApi(file, internal = false) {
  const api = load(file);
  assert.equal(api.openapi, '3.1.0');
  const operationIds = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      assert.ok(
        node.$ref.startsWith('#/components/schemas/'),
        `External unresolved OpenAPI ref ${node.$ref}`,
      );
      assert.ok(api.components.schemas[node.$ref.slice('#/components/schemas/'.length)], node.$ref);
    }
    Object.values(node).forEach(walk);
  }
  walk(api);
  for (const [url, methods] of Object.entries(api.paths))
    for (const [method, operation] of Object.entries(methods)) {
      assert.ok(!operationIds.has(operation.operationId));
      operationIds.add(operation.operationId);
      if (!internal) {
        const route = routes.find((item) => item.path === url && item.method === method);
        assert.ok(route, url);
        assert.equal(operation.operationId, route.operationId);
        assert.equal(operation['x-access'], route.access);
        assert.equal(operation.security.length === 0, route.access === 'PUBLIC');
        assert.equal(
          operation.requestBody?.content['application/json'].schema.$ref,
          route.request ? `#/components/schemas/${route.request}` : undefined,
        );
        assert.equal(
          operation.responses[route.status].content['application/json'].schema.$ref,
          `#/components/schemas/${route.response}`,
        );
      }
      const params = operation.parameters || [];
      for (const match of url.matchAll(/\{([^}]+)\}/g))
        assert.ok(params.some((p) => p.name === match[1] && p.in === 'path' && p.required));
      assertions++;
    }
  if (!internal) {
    assert.equal(operationIds.size, routes.length);
    const expectedPublic = [
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/verify-email',
      '/auth/resend-verification',
    ].sort();
    assert.deepEqual(
      routes
        .filter((r) => r.access === 'PUBLIC')
        .map((r) => r.path)
        .sort(),
      expectedPublic,
    );
    for (const [name, definition] of Object.entries(domain.definitions)) {
      const expected = JSON.parse(
        JSON.stringify(definition).replaceAll(
          `${domain.$id}#/definitions/`,
          '#/components/schemas/',
        ),
      );
      assert.deepEqual(api.components.schemas[name], expected, `Schema drift ${name}`);
    }
  } else for (const url of Object.keys(api.paths)) assert.ok(url.startsWith('/internal/v1/'));
}
validateOpenApi('../openapi/auth-learning-analytics.v1.json');
validateOpenApi('../openapi/auth-learning-analytics.internal.v1.json', true);
for (const entry of registry) {
  assert.ok(entry.routingKey.endsWith('.v2'));
  assert.ok(entry.queues.every((queue) => queue.endsWith('.v2')));
}
console.log(
  `P0 contracts PASS: ${Object.keys(domain.definitions).length} domain definitions, ${registry.length} event schemas, ${routes.length} public operations, ${assertions} fixture/specification checks.`,
);
console.log(
  'Specification-only verification; services, live data, migrations and infrastructure were not tested.',
);
