const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  Importer,
  validateDataset,
  hash,
  equivalent,
  expansionAcceptance,
} = require('./import-toeic.cjs');
const dataset = require('../../data/toeic/ets-2023-test-01/dataset.json');
const target = {
  gateway: 'http://127.0.0.1:3000/api/v1',
  storagePublicOrigin: 'http://127.0.0.1:19000',
  questionBucket: 'configured-question-bucket',
  learningBucket: 'configured-learning-bucket',
};
const clone = () => structuredClone(dataset);
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const topic = { kind: 'topic', sourceId: 'test-topic', payload: { topicName: 'A real topic' } };
const minimal = { datasetId: 'test-import', questions: [] };

test('API-only Exam expansion requires actual pilot readback and preservation evidence without changing UI flags', () => {
  const state = {
    acceptance: {
      ui: false,
      pilot: false,
      examPilotApi: true,
      examPilotReimportApi: true,
      examPilotApiEvidence: 'api',
      examPilotReimportApiEvidence: 'reimport',
    },
  };
  const evidence = {
    api: {
      outcome: 'complete',
      result: { questions: 20, groups: 4, allComplete: true, publicMediaHashMatches: true },
    },
    reimport: { allBusinessModelsUnchangedOnReimport: true },
  };
  assert.equal(
    expansionAcceptance(state, 'exam', true, (p) => evidence[p]),
    'exam-api-only',
  );
  assert.equal(state.acceptance.ui, false);
  assert.equal(state.acceptance.pilot, false);
  assert.throws(() => expansionAcceptance(state, 'exam'), /Pilot acceptance/);
  assert.throws(() => expansionAcceptance(state, 'learning', true), /Exam scope only/);
  assert.throws(() => expansionAcceptance(state, 'all', true), /Exam scope only/);
  const missing = structuredClone(state);
  missing.acceptance.examPilotReimportApi = false;
  assert.throws(() => expansionAcceptance(missing, 'exam', true), /requires verified/);
  assert.throws(() => expansionAcceptance(state, 'exam', true, () => ({})), /does not support/);
});

test('Gateway quota waits honor Retry-After in bounded chunks and retry the same request key', async () => {
  const calls = [],
    waits = [];
  const importer = new Importer({
    dataset: minimal,
    target,
    waitOnRateLimit: true,
    sleep: async (ms) => {
      waits.push(ms);
    },
    fetch: async (_u, o) => {
      calls.push(o);
      if (calls.length === 1)
        return new Response(JSON.stringify({ code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Retry-After': '120', 'Content-Type': 'application/json' },
        });
      return response({ storageKey: 'key' });
    },
  });
  assert.deepEqual(
    await importer.request(
      'POST',
      '/questions/id/media/presign',
      { mediaType: 'AUDIO' },
      'stable-key',
    ),
    { storageKey: 'key' },
  );
  assert.deepEqual(waits, [60000, 60000]);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
});

test('business failures and ambiguous writes never enter the Gateway quota retry path', async () => {
  for (const status of [400, 401, 500]) {
    let calls = 0;
    const importer = new Importer({
      dataset: minimal,
      target,
      waitOnRateLimit: true,
      fetch: async () => {
        calls++;
        return response({ code: 'API_ERROR' }, status);
      },
    });
    await assert.rejects(
      importer.request('POST', '/questions', {}, 'same'),
      new RegExp(`HTTP ${status}`),
    );
    assert.equal(calls, 1);
  }
});

test('long imports refresh only their own session and keep rotated tokens out of checkpoint', async () => {
  const token =
    'header.' + Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url') + '.signature';
  const calls = [];
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      calls.push({ path: u.pathname, body: o.body, auth: o.headers.Authorization });
      return u.pathname.endsWith('/refresh')
        ? response({ accessToken: 'new-access', refreshToken: 'new-refresh' })
        : response({ items: [] });
    },
  });
  importer.token = token;
  importer.refreshToken = 'old-refresh';
  await importer.request('GET', '/questions');
  assert.equal(calls[0].path, '/api/v1/auth/refresh');
  assert.equal(JSON.parse(calls[0].body).refreshToken, 'old-refresh');
  assert.equal(calls[1].auth, 'Bearer new-access');
  assert.equal(importer.refreshToken, 'new-refresh');
  assert(!JSON.stringify(importer.state).includes('refresh'));
});

test('importer revokes only its own login and keeps tokens out of the checkpoint', async () => {
  const calls = [];
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      calls.push({ path: u.pathname, body: JSON.parse(o.body), headers: o.headers });
      if (u.pathname.endsWith('/login'))
        return response({
          accessToken: 'access-secret',
          refreshToken: 'refresh-secret',
          user: { userId: 'actor', roles: ['CONTENT_ADMIN'] },
        });
      return response({ success: true });
    },
  });
  await importer.login({ email: 'admin@example.test', password: 'test-only' });
  assert(!JSON.stringify(importer.state).includes('secret'));
  assert.equal(await importer.logout(), true);
  assert.equal(calls[1].path, '/api/v1/auth/logout');
  assert.deepEqual(calls[1].body, { refreshToken: 'refresh-secret' });
  assert.equal(calls[1].headers.Authorization, 'Bearer access-secret');
  assert.equal(importer.token, undefined);
  assert.equal(importer.refreshToken, undefined);
  assert.equal(await importer.logout(), false);
  assert.equal(calls.length, 2);
});

test('failed media attachment reports the source ID for reconciliation', async () => {
  const calls = [];
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (_u, o) => {
      calls.push(o.method);
      return response({ questionId: 'question-id', audioKey: null });
    },
  });
  importer.state.records.question = { id: 'question-id', kind: 'question' };
  await assert.rejects(
    importer.attach(
      { kind: 'question', sourceId: 'question' },
      { sourceId: 'pilot-clip', field: 'audioKey' },
      'expected-key',
    ),
    /pilot-clip: attachment readback failed/,
  );
  assert.deepEqual(calls, ['PATCH', 'GET']);
});

test('real pilot and expanded Learning data satisfy quality gates and exact DTO fields', () => {
  for (const batch of ['pilot', 'all'])
    assert.equal(validateDataset(dataset, batch, 'learning').valid, true);
  assert.equal(
    validateDataset(dataset, 'pilot', 'learning').records.filter((r) => r.kind === 'word').length,
    20,
  );
  assert.equal(dataset.words.length, 100);
  const schemas = require('../../packages/contracts/openapi/auth-learning-analytics.v1.json')
    .components.schemas;
  const Ajv = require('ajv');
  const ajv = new Ajv({ strict: false, validateFormats: false });
  for (const [kind, rows, schema] of [
    ['topic', dataset.topics, 'TopicCreate'],
    ['word', dataset.words, 'VocabularyCreate'],
    ['lesson', dataset.lessons, 'LessonCreate'],
  ]) {
    const s = structuredClone(schemas[schema]);
    for (const [key, value] of Object.entries(s.properties))
      if (value.$ref) s.properties[key] = schemas[value.$ref.split('/').at(-1)];
    const check = ajv.compile(s);
    for (const r of rows)
      assert.equal(
        check(
          kind === 'word'
            ? { ...r.payload, topicId: '00000000-0000-4000-8000-000000000001' }
            : r.payload,
        ),
        true,
        JSON.stringify(check.errors),
      );
  }
});
test('unheard listening clips block pilot writes; exactly 20 source questions remain intact', () => {
  const d = clone(),
    question = d.questions.find((q) => q.questionNumber === 1);
  question.quality.approved = false;
  question.quality.audioContentReviewed = false;
  question.media.find((m) => m.mediaType === 'AUDIO').contentReviewed = false;
  const v = validateDataset(d, 'pilot', 'exam');
  assert.equal(v.valid, false);
  assert.equal(v.records.filter((r) => r.kind === 'question').length, 20);
  assert(v.errors.some((e) => e.includes('listening content not verified')));
  assert.equal(v.records.filter((r) => r.kind === 'test').length, 0);
});
test('Part 2 option D is rejected even with a superficially valid answer', () => {
  const d = clone(),
    q = d.questions.find((q) => q.questionNumber === 7);
  q.payload.options.push({ optionCode: 'D', optionText: 'D' });
  q.payload.correctOption = 'D';
  assert(
    validateDataset(d, 'pilot', 'exam').errors.some(
      (e) => e.includes(q.sourceId) && e.includes('invalid choices'),
    ),
  );
});
test('duplicate stable IDs and vocabulary senses cannot silently create duplicates', () => {
  const d = clone();
  d.words.push(structuredClone(d.words[0]));
  const e = validateDataset(d, 'pilot', 'learning').errors;
  assert(e.some((x) => x.includes('Duplicate/missing')));
  assert(e.some((x) => x.includes('duplicate word/POS/sense')));
});
test('Part 6 placeholders and batch group membership are validated', () => {
  const d = clone(),
    g = d.groups.find((g) => g.payload.part === 6 && g.batches.includes('pilot'));
  g.payload.passageText = g.payload.passageText.replace('[[4]]', '[[3]]');
  d.questions.find((q) => q.questionNumber === 132).batches = [];
  const e = validateDataset(d, 'pilot', 'exam').errors;
  assert(e.some((x) => x.includes('placeholders mismatch')));
  assert(e.some((x) => x.includes('batch splits')));
});
test('Part 7 document order is part of readback, and unfinished questions block a 42-group Full dataset', () => {
  const g = dataset.groups.find((g) => g.questionNumbers[0] === 186),
    row = structuredClone(g.payload);
  row.assets[0].orderNo = 2;
  assert.equal(equivalent(row, g.payload), false);
  const unfinished = clone();
  unfinished.questions.find((q) => q.questionNumber === 104).payload.options = [];
  assert(
    validateDataset(unfinished, 'all', 'exam').errors.some((e) =>
      e.includes('q104: invalid choices/key'),
    ),
  );
  assert.equal(
    dataset.groups.filter((g) => g.payload.part === 7 && g.documentCount === 1).length,
    10,
  );
  assert.equal(
    dataset.groups.filter((g) => g.payload.part === 7 && g.documentCount === 2).length,
    2,
  );
  assert.equal(
    dataset.groups.filter((g) => g.payload.part === 7 && g.documentCount === 3).length,
    3,
  );
});
test('create committed but response lost: resume discovers the row without a second POST', async () => {
  let row,
    posts = 0;
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      if (o.method === 'POST') {
        posts++;
        row = { topicId: 'id-1', ...JSON.parse(o.body) };
        throw Error('response dropped after commit');
      }
      if (u.pathname.endsWith('/id-1')) return response(row);
      return response({ items: row ? [row] : [], totalPages: 1 });
    },
  });
  await assert.rejects(importer.record(topic, true), /Transport failed/);
  assert.equal(importer.state.records[topic.sourceId].status, 'pending');
  await importer.record(topic, true);
  assert.equal(posts, 1);
  assert.equal(importer.state.records[topic.sourceId].status, 'verified');
});
test('ambiguous create with no visible match refuses an automatic replay', async () => {
  let posts = 0;
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (_u, o) => {
      if (o.method === 'POST') {
        posts++;
        throw Error('timeout');
      }
      return response({ items: [], totalPages: 1 });
    },
  });
  await assert.rejects(importer.record(topic, true));
  await assert.rejects(importer.record(topic, true), /refusing another POST/);
  assert.equal(posts, 1);
});
test('unowned existing content is not overwritten when the payload differs', async () => {
  const lesson = {
    kind: 'lesson',
    sourceId: 'lesson-1',
    payload: { lessonTitle: 'Existing title', contentMarkdown: 'new', status: 'DRAFT' },
  };
  let writes = 0;
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (_u, o) => {
      if (o.method !== 'GET') writes++;
      return response({
        items: [
          {
            lessonId: 'id-1',
            lessonTitle: 'Existing title',
            contentMarkdown: 'old',
            status: 'DRAFT',
          },
        ],
        totalPages: 1,
      });
    },
  });
  await assert.rejects(importer.record(lesson, true), /refusing overwrite/);
  assert.equal(writes, 0);
});
test('a mapped resource returning the wrong ID blocks before any mutation', async () => {
  const state = {
    schemaVersion: 1,
    datasetId: minimal.datasetId,
    target,
    records: { 'test-topic': { id: 'original', kind: 'topic', status: 'verified' } },
    media: {},
  };
  const importer = new Importer({
    dataset: minimal,
    target,
    state,
    fetch: async () => response({ topicId: 'different', ...topic.payload }),
  });
  await assert.rejects(importer.record(topic, true), /identity changed/);
});
test('repeated import reads unchanged content without PATCH or progress writes', async () => {
  let posts = 0,
    patches = 0;
  const row = { topicId: 'id-1', ...topic.payload };
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      if (o.method === 'POST') posts++;
      if (o.method === 'PATCH') patches++;
      assert(!u.pathname.includes('progress'));
      return response(u.pathname.endsWith('/id-1') ? row : { items: [row], totalPages: 1 });
    },
  });
  await importer.record(topic, true);
  await importer.record(topic, true);
  assert.equal(posts, 0);
  assert.equal(patches, 0);
});
test('multiple backend matches block rather than pick an arbitrary row', async () => {
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async () =>
      response({
        items: [
          { topicId: 'one', ...topic.payload },
          { topicId: 'two', ...topic.payload },
        ],
        totalPages: 1,
      }),
  });
  await assert.rejects(importer.record(topic, true), /multiple backend matches/);
});
test('storage PUT uses only backend-presigned URL, then PATCH, then attachment readback', async () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'content-import-test-')),
    file = path.join(dir, 'clip.mp3');
  fs.writeFileSync(file, Buffer.from('test transport bytes'));
  const media = {
    sourceId: 'media-1',
    file,
    sha256: hash(fs.readFileSync(file)),
    mediaType: 'AUDIO',
    contentType: 'audio/mpeg',
    field: 'audioKey',
    contentReviewed: true,
  };
  const question = { kind: 'question', sourceId: 'q-1' },
    calls = [];
  let attached = false;
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      calls.push([o.method, u.pathname]);
      if (u.pathname.endsWith('/presign'))
        return response({
          storageKey: 'questions/part-1/q/audio/clip.mp3',
          bucket: target.questionBucket,
          uploadUrl: target.storagePublicOrigin + '/signed-object?signature=SECRET',
          expiresIn: 300,
        });
      if (o.method === 'PUT') return new Response(null, { status: 200 });
      if (o.method === 'PATCH') {
        attached = true;
        return response({ questionId: 'q' });
      }
      return response({
        questionId: 'q',
        audioKey: attached ? 'questions/part-1/q/audio/clip.mp3' : null,
      });
    },
  });
  importer.state.records['q-1'] = { id: 'q', kind: 'question' };
  await importer.upload(question, media);
  assert.deepEqual(
    calls.map((x) => x[0]),
    ['POST', 'PUT', 'PATCH', 'GET'],
  );
  assert.equal(importer.state.media['media-1'].status, 'verified');
  assert(!JSON.stringify(importer.state).includes('SECRET'));
  await importer.upload(question, media);
  assert.equal(calls.filter((x) => x[0] === 'PUT').length, 1);
});
test('lost attachment acknowledgement is reconciled without another presign or PUT', async () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'content-import-test-')),
    file = path.join(dir, 'clip.mp3');
  fs.writeFileSync(file, 'fixture');
  const media = {
    sourceId: 'media-1',
    file,
    sha256: hash(fs.readFileSync(file)),
    mediaType: 'AUDIO',
    contentType: 'audio/mpeg',
    field: 'audioKey',
    contentReviewed: true,
  };
  let calls = 0;
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (_u, o) => {
      calls++;
      assert.equal(o.method, 'GET');
      return response({ questionId: 'q', audioKey: 'existing-object' });
    },
  });
  importer.state.records['q-1'] = { id: 'q', kind: 'question' };
  importer.state.media['media-1'] = {
    storageKey: 'existing-object',
    sha256: media.sha256,
    status: 'uploaded',
  };
  await importer.upload({ kind: 'question', sourceId: 'q-1' }, media);
  assert.equal(calls, 1);
  assert.equal(importer.state.media['media-1'].status, 'verified');
});
test('checkpoint cannot be reused against another environment', () => {
  assert.throws(
    () =>
      new Importer({
        dataset: minimal,
        target,
        state: {
          datasetId: minimal.datasetId,
          target: { ...target, questionBucket: 'other' },
          records: {},
          media: {},
        },
      }),
    /another dataset\/target/,
  );
});
test('atomic group create response loss is reconciled by member source tag without exposing IDs in instructions', async () => {
  const questions = [1, 2].map((n) => ({
    kind: 'question',
    sourceId: 'source-q' + n,
    groupSourceId: 'source-group',
    payload: {
      part: 7,
      type: 'SINGLE_CHOICE',
      questionText: 'Question ' + n,
      positionInGroup: n,
      tags: ['source-q' + n],
    },
  }));
  const group = {
    kind: 'group',
    sourceId: 'source-group',
    payload: {
      part: 7,
      instruction: 'Questions 147-148',
      assets: [{ kind: 'TEXT', orderNo: 1, content: 'Source passage' }],
    },
  };
  let committed = false,
    posts = 0;
  const fetch = async (u, o) => {
    if (o.method === 'POST') {
      posts++;
      committed = true;
      throw Error('lost acknowledgement');
    }
    if (u.pathname.endsWith('/groups-id'))
      return response({ groupId: 'groups-id', ...group.payload, questionIds: ['q1', 'q2'] });
    for (let n of [1, 2])
      if (u.pathname.endsWith('/q' + n))
        return response({ questionId: 'q' + n, ...questions[n - 1].payload, groupId: 'groups-id' });
    return response({
      items: committed ? [{ questionId: 'q1', ...questions[0].payload, groupId: 'groups-id' }] : [],
      totalPages: 1,
    });
  };
  const importer = new Importer({ dataset: { datasetId: 'group-test', questions }, target, fetch });
  await assert.rejects(importer.record(group, true));
  await importer.record(group, true);
  assert.equal(posts, 1);
  assert.equal(importer.state.records['source-q2'].id, 'q2');
  assert(!group.payload.instruction.includes('source-'));
});
test('Learning media uses the controller-confirmed non-admin presign and confirm paths', async () => {
  const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'content-import-test-')),
    file = path.join(dir, 'word.mp3');
  fs.writeFileSync(file, 'fixture');
  const m = {
      sourceId: 'word-media',
      file,
      sha256: hash(fs.readFileSync(file)),
      mediaType: 'AUDIO',
      contentType: 'audio/mpeg',
      field: 'audioKey',
      contentReviewed: true,
    },
    paths = [];
  const importer = new Importer({
    dataset: minimal,
    target,
    fetch: async (u, o) => {
      paths.push(u.pathname);
      if (u.pathname.endsWith('/presign'))
        return response({
          objectKey: 'learning/word/audio.mp3',
          uploadId: 'upload-1',
          putUrl:
            target.storagePublicOrigin +
            '/' +
            target.learningBucket +
            '/learning/word/audio.mp3?signature=SECRET',
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        });
      if (o.method === 'PUT') return new Response(null, { status: 200 });
      if (u.pathname.endsWith('/confirm'))
        return response({ objectKey: 'learning/word/audio.mp3' });
      return response({ vocabularyId: 'word-id', audioKey: 'learning/word/audio.mp3' });
    },
  });
  importer.state.records.word = { id: 'word-id', kind: 'word' };
  await importer.upload({ kind: 'word', sourceId: 'word' }, m);
  assert(paths.includes('/api/v1/learning/vocabularies/word-id/media/presign'));
  assert(paths.includes('/api/v1/learning/vocabularies/word-id/media/confirm'));
});
