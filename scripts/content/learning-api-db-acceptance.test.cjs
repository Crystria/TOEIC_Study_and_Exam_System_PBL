const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hash, targetIdentity } = require('./import-toeic.cjs');
const { verifyLearningEvidence } = require('./learning-api-db-acceptance.cjs');
test('Learning evidence binds target, dataset, verified mappings and zero-change reimport', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-evidence-'));
  try {
    const target = { gateway: 'http://localhost:3000/api/v1', verifiedScopes: ['learning'], databases: { learning: { host: 'localhost', port: '5432', name: 'learning_db' } } };
    const dataset = { datasetId: 'test', version: '1' };
    const pilot = ['topic', 'word', 'lesson'].map(kind => ({ kind, sourceId: kind }));
    const state = { datasetId: 'test', actorId: 'admin', target, records: Object.fromEntries(pilot.map(r => [r.sourceId, { kind: r.kind, id: r.kind, status: 'verified' }])) };
    const report = { datasetId: 'test', version: '1', valid: true, outcome: 'complete', batch: 'pilot', scope: 'learning', counts: { topic: 1, word: 1, lesson: 1 }, summary: { add: 0, update: 0, same: 3 } };
    const baseline = { catalog: Object.fromEntries([['topics', 'topic'], ['words', 'word'], ['lessons', 'lesson']].map(([key, id]) => [key, { count: 1, idsHash: hash([id]), databaseAndApiMatch: true }])) };
    const write = (file, data) => { const full = path.join(dir, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, JSON.stringify(data)); };
    write('api-readback/report.json', { ...report, mode: 'plan' });
    write('db-api/target.json', target);
    write('db-api/baseline.json', baseline);
    write('reimport.json', { ...report, mode: 'apply' });
    const options = { state, dataset, target, pilot, hash, targetIdentity, evidenceDir: dir, reimportReport: path.join(dir, 'reimport.json') };
    assert.equal(verifyLearningEvidence(options).acceptancePath, 'learning-api-db');
    assert.equal(state.acceptance, undefined);
    assert.throws(() => verifyLearningEvidence({ ...options, target: { ...target, gateway: 'http://localhost:9999/api/v1' } }), /another target/);
    assert.throws(() => verifyLearningEvidence({ ...options, dataset: { ...dataset, version: '2' } }), /differs/);
    state.records.word.id = 'unrelated';
    assert.throws(() => verifyLearningEvidence(options), /IDs differ/);
    state.records.word.id = 'word';
    write('reimport.json', { ...report, mode: 'apply', summary: { add: 1, update: 0, same: 2 } });
    assert.throws(() => verifyLearningEvidence(options), /incomplete/);
    write('reimport.json', { ...report, mode: 'apply' });
    state.records.word.status = 'pending';
    assert.throws(() => verifyLearningEvidence(options), /verified pilot mappings/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
