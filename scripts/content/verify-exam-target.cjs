const fs = require('node:fs');
const dotenv = require('dotenv');
const { hash } = require('./import-toeic.cjs');
async function verifyExamTarget(gateway, token) {
  const clients = [];
  try {
    const catalog = {};
    for (const [service, models] of [
      ['question-bank', [['question', 'questions', 'questionId'], ['questionGroup', 'question-groups', 'groupId']]],
      ['exam', [['test', 'tests', 'testId']]],
    ]) {
      const env = dotenv.parse(fs.readFileSync(`services/${service}-service/.env`));
      const dbUrl = new URL(env.DATABASE_URL);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname)) throw Error('Exam verification requires local databases');
      const { PrismaClient } = require(`../../services/${service}-service/src/generated/prisma`);
      const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL, log: [] });
      clients.push(db);
      for (const [model, route, idField] of models) {
        const rows = await db[model].findMany({ where: { deletedAt: null }, select: { id: true } });
        const items = [];
        for (let page = 1; ; page++) {
          if (page > 10000) throw Error('Exam pagination did not terminate');
          const res = await fetch(`${gateway}/${route}?page=${page}&size=50`, {
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw Error(`Exam ${route} catalog HTTP ${res.status}`);
          const body = await res.json();
          if (!Array.isArray(body.items)) throw Error('Unexpected Exam catalog');
          items.push(...body.items);
          if (page >= (body.totalPages || 1)) break;
        }
        const dbIds = rows.map(r => r.id).sort(), apiIds = items.map(r => r[idField]).sort();
        if (JSON.stringify(dbIds) !== JSON.stringify(apiIds)) throw Error(`Exam ${route} DB/API IDs differ; reconcile DB and search index before proceeding`);
        catalog[route] = { count: rows.length, idsHash: hash(dbIds), databaseAndApiMatch: true };
      }
    }
    const root = dotenv.parse(fs.readFileSync('.env'));
    const q = dotenv.parse(fs.readFileSync('services/question-bank-service/.env'));
    const endpoint = new URL((q.MINIO_ENDPOINT || 'localhost:19000').replace(/^(?!https?:\/\/)/, 'http://'));
    if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw Error('Exam verification requires local storage');
    const bucket = q.MINIO_BUCKET || root.MINIO_BUCKET || 'toeic-media';
    const { Client } = require('minio');
    const storage = new Client({ endPoint: endpoint.hostname, port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
      useSSL: endpoint.protocol === 'https:', accessKey: q.MINIO_ACCESS_KEY || root.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: q.MINIO_SECRET_KEY || root.MINIO_SECRET_KEY || 'minioadmin' });
    if (!await storage.bucketExists(bucket)) throw Error('Exam media bucket does not exist');
    const ready = await fetch(new URL('/ready', gateway), { signal: AbortSignal.timeout(5000) });
    await ready.body?.cancel();
    if (!ready.ok) throw Error('Gateway is not ready');
    return { catalog, storage: { bucket, endpoint: endpoint.origin, bucketExists: true },
      note: 'Env configuration and DB/API catalog snapshots, not process environment attestation. Empty catalogs cannot uniquely identify a database. Presign bucket/origin is checked again by importer.' };
  } finally { await Promise.all(clients.map(db => db.$disconnect())); }
}
module.exports = { verifyExamTarget };
