const fs = require('node:fs');
const { validateDataset, hash } = require('./import-toeic.cjs');
async function acceptExamPilot(importer, reimportFile) {
  if (!importer.target.verifiedScopes?.includes('exam')) throw Error('Exam target is not verified');
  const validation = validateDataset(importer.dataset, 'pilot', 'exam');
  if (!validation.valid) throw Error('Exam pilot dataset is invalid');
  const records = validation.records;
  const parents = records.filter(r => !(r.kind === 'question' && r.groupSourceId));
  const reimport = JSON.parse(fs.readFileSync(reimportFile, 'utf8').replace(/^\uFEFF/, ''));
  if (reimport.mode !== 'apply' || reimport.batch !== 'pilot' || reimport.scope !== 'exam' ||
      reimport.datasetId !== importer.dataset.datasetId || reimport.version !== importer.dataset.version ||
      reimport.valid !== true || reimport.outcome !== 'complete' ||
      reimport.counts?.question !== 20 || reimport.counts?.group !== 4 || reimport.counts?.test !== 0 ||
      reimport.summary?.add !== 0 || reimport.summary?.update !== 0 || reimport.summary?.same !== parents.length)
    throw Error('Exam requires a successful zero-change pilot reimport report');
  const mediaEvidence = [], recordIds = [];
  for (const record of parents) {
    const map = importer.state.records[record.sourceId];
    if (!map?.id || map.status !== 'verified' || map.kind !== record.kind)
      throw Error('Exam pilot checkpoint mapping is not verified');
    if (await importer.record(record, false) !== 'same') throw Error('Live Exam pilot differs from dataset');
    // readback verifies child order/count and each child payload for groups.
    const row = await importer.readback(record, map.id, importer.payload(record));
    if (row.isComplete === false) throw Error('Exam pilot record is incomplete');
    recordIds.push(map.id);
    for (const media of record.media || []) {
      const stored = importer.state.media[media.sourceId];
      if (stored?.status !== 'verified' || stored.sha256 !== media.sha256 || !stored.storageKey)
        throw Error('Exam pilot media checkpoint is not verified');
      const attached = media.field === 'asset'
        ? row.assets?.some(a => a.storageKey === stored.storageKey)
        : row[media.field] === stored.storageKey;
      if (!attached) throw Error('Exam pilot media is not attached');
      const url = new URL('/' + encodeURIComponent(importer.target.questionBucket) + '/' + stored.storageKey.split('/').map(encodeURIComponent).join('/'), importer.target.storagePublicOrigin);
      const response = await importer.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok || response.headers.get('content-type')?.split(';')[0].trim() !== media.contentType)
        throw Error('Exam pilot public media HTTP/MIME verification failed');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== media.sha256 || hash(fs.readFileSync(media.file)) !== media.sha256)
        throw Error('Exam pilot public/local media SHA-256 mismatch');
      mediaEvidence.push({ sourceId: media.sourceId, sha256: media.sha256, storageKey: stored.storageKey });
    }
  }
  if (new Set(recordIds).size !== recordIds.length) throw Error('Exam pilot contains duplicate parent mappings');
  return { acceptancePath: 'exam-api-db', actorId: importer.actorId,
    questions: 20, groups: 4, livePilotReadback: 'passed', publicMediaHashMatches: true,
    media: mediaEvidence, reimportReportHash: hash(reimport), checkedAt: new Date().toISOString(),
    note: 'Fresh API payload/group/media checks plus zero-change reimport. No UI or whole-database preservation claim.' };
}
module.exports = { acceptExamPilot };
