// Evidence validation only. Never edits checkpoint acceptance flags or business data.
const fs = require('node:fs');
const path = require('node:path');
function verifyLearningEvidence({ state, dataset, target, evidenceDir, reimportReport, pilot, hash, targetIdentity }) {
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (!state?.actorId || state.datasetId !== dataset.datasetId || !evidenceDir || !reimportReport)
    throw Error('Learning API/DB acceptance requires an existing pilot checkpoint and both evidence paths');
  const api = read(path.join(evidenceDir, 'api-readback/report.json'));
  const baseline = read(path.join(evidenceDir, 'db-api/baseline.json'));
  const verifiedTarget = read(path.join(evidenceDir, 'db-api/target.json'));
  const reimport = read(reimportReport);
  if (hash(targetIdentity(state.target)) !== hash(targetIdentity(target)) ||
      hash(targetIdentity(verifiedTarget)) !== hash(targetIdentity(target)) ||
      !verifiedTarget.verifiedScopes?.includes('learning'))
    throw Error('Learning evidence belongs to another target');
  const kinds = { topic: 'topics', word: 'words', lesson: 'lessons' };
  const counts = Object.fromEntries(Object.keys(kinds).map(k => [k, pilot.filter(r => r.kind === k).length]));
  const total = pilot.length;
  for (const [report, mode] of [[api, 'plan'], [reimport, 'apply']]) {
    if (report.outcome !== 'complete' || report.valid !== true || report.mode !== mode ||
        report.batch !== 'pilot' || report.scope !== 'learning' ||
        report.datasetId !== dataset.datasetId || report.version !== dataset.version ||
        report.summary?.add !== 0 || report.summary?.update !== 0 || report.summary?.same !== total ||
        Object.entries(counts).some(([k, n]) => report.counts?.[k] !== n))
      throw Error('Learning API readback/reimport evidence is incomplete or differs from the pilot');
  }
  for (const [kind, catalogKey] of Object.entries(kinds)) {
    const records = pilot.filter(r => r.kind === kind).map(r => state.records?.[r.sourceId]);
    if (records.some(r => !r?.id || r.kind !== kind || r.status !== 'verified'))
      throw Error('Learning checkpoint is missing verified pilot mappings');
    const ids = records.map(r => r.id).sort();
    const catalog = baseline.catalog?.[catalogKey];
    if (new Set(ids).size !== ids.length || catalog?.databaseAndApiMatch !== true ||
        catalog.count !== ids.length || catalog.idsHash !== hash(ids))
      throw Error('Learning DB/API evidence IDs differ from the pilot checkpoint');
  }
  return { acceptancePath: 'learning-api-db', pilotRecords: total,
    evidenceDir: path.resolve(evidenceDir), reimportReport: path.resolve(reimportReport),
    evidenceHash: hash({ api, baseline, verifiedTarget, reimport }) };
}
module.exports = { verifyLearningEvidence };
