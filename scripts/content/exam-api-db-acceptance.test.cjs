const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateDataset } = require('./import-toeic.cjs');
const { acceptExamPilot } = require('./exam-api-db-acceptance.cjs');
const dataset = require('../../data/toeic/ets-2023-test-01/dataset.json');
test('Exam API/DB gate verifies fresh payload/media and rejects changed pilot or wrong media', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-acceptance-'));
  try {
    const parents = validateDataset(dataset, 'pilot', 'exam').records.filter(r => !(r.kind === 'question' && r.groupSourceId));
    const state = { records: {}, media: {} }, mediaByUrl = new Map();
    for (const r of parents) {
      state.records[r.sourceId] = { id: r.sourceId, kind: r.kind, status: 'verified' };
      for (const m of r.media || []) {
        state.media[m.sourceId] = { status: 'verified', sha256: m.sha256, storageKey: m.sourceId };
        mediaByUrl.set('/bucket/' + encodeURIComponent(m.sourceId), m);
      }
    }
    const file = path.join(dir, 'reimport.json');
    const report = { mode: 'apply', batch: 'pilot', scope: 'exam', valid: true, outcome: 'complete', datasetId: dataset.datasetId, version: dataset.version, counts: { question: 20, group: 4, test: 0 }, summary: { add: 0, update: 0, same: parents.length } };
    fs.writeFileSync(file, JSON.stringify(report));
    const importer = { dataset, state, actorId: 'admin', target: { verifiedScopes: ['exam'], questionBucket: 'bucket', storagePublicOrigin: 'http://localhost:19000' },
      record: async () => 'same', payload: r => r.payload,
      readback: async r => { const row = { isComplete: true, assets: [] }; for (const m of r.media || []) { if (m.field === 'asset') row.assets.push({storageKey: m.sourceId}); else row[m.field] = m.sourceId; } return row; },
      fetch: async url => { const m = mediaByUrl.get(url.pathname); return new Response(fs.readFileSync(m.file), { headers: { 'content-type': m.contentType } }); },
    };
    const result = await acceptExamPilot(importer, file);
    assert.equal(result.publicMediaHashMatches, true);
    assert.equal(result.media.length, 7);
    assert.equal(state.acceptance, undefined);
    await assert.rejects(() => acceptExamPilot({ ...importer, record: async () => 'update' }, file), /differs/);
    await assert.rejects(() => acceptExamPilot({ ...importer, fetch: async () => new Response('wrong', {headers: {'content-type': 'application/octet-stream'}}) }, file), /MIME/);
    await assert.rejects(() => acceptExamPilot({ ...importer, target: { verifiedScopes: [] } }, file), /not verified/);
    fs.writeFileSync(file, JSON.stringify({ ...report, summary: { add: 1, update: 0, same: 8 } }));
    await assert.rejects(() => acceptExamPilot(importer, file), /zero-change/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
