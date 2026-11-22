/* Read-only database/API target inspection; never logs connection secrets. */
const fs = require('node:fs'),
  path = require('node:path'),
  dotenv = require('dotenv');
const { saveAtomic, hash } = require('./import-toeic.cjs');
const out = process.argv[2];
if (!out)
  throw Error('Usage: node scripts/content/verify-local-target.cjs <new-evidence-directory>');
async function main() {
  if (fs.existsSync(path.join(out, 'target.json')))
    throw Error('Target evidence already exists; choose a new output directory');
  const services = ['auth-service', 'question-bank-service', 'exam-service', 'learning-service'];
  const databases = {};
  for (const service of services) {
    const env = dotenv.parse(fs.readFileSync(`services/${service}/.env`)),
      u = new URL(env.DATABASE_URL);
    databases[service] = {
      host: u.hostname,
      port: u.port || '5432',
      name: u.pathname.slice(1),
      source: 'Existing service environment; Docker Compose uses the same database name',
    };
  }
  const learningEnv = dotenv.parse(fs.readFileSync('services/learning-service/.env'));
  const { PrismaClient } = require('../../services/learning-service/src/generated/prisma');
  const db = new PrismaClient({ datasources: { db: { url: learningEnv.DATABASE_URL } }, log: [] });
  let identity;
  try {
    const rows = {
      topics: await db.vocabularyTopic.findMany(),
      words: await db.vocabulary.findMany(),
      lessons: await db.grammarLesson.findMany(),
    };
    const progress = {
      vocabulary: await db.userVocabularyProgress.findMany(),
      lessons: await db.userLessonProgress.findMany(),
      sessions: await db.vocabularySession.findMany(),
    };
    const email = process.env.TOEIC_IMPORT_EMAIL,
      password = process.env.TOEIC_IMPORT_PASSWORD;
    if (!email || !password)
      throw Error(
        'Set real CONTENT_ADMIN credentials in TOEIC_IMPORT_EMAIL and TOEIC_IMPORT_PASSWORD',
      );
    const gateway = 'http://127.0.0.1:3000/api/v1';
    const login = await fetch(gateway + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId: 'test1-target-inspection' }),
    });
    identity = await login.json();
    if (!login.ok || !identity.user?.roles.includes('CONTENT_ADMIN'))
      throw Error('CONTENT_ADMIN login failed');
    const summaries = {};
    for (const [kind, route, id] of [
      ['topics', 'vocabulary-topics', 'topicId'],
      ['words', 'vocabularies', 'vocabularyId'],
      ['lessons', 'lessons', 'lessonId'],
    ]) {
      const items = [];
      for (let page = 1; ; page++) {
        const r = await fetch(`${gateway}/learning/admin/${route}?page=${page}&size=50`, {
          headers: { Authorization: 'Bearer ' + identity.accessToken },
        });
        if (!r.ok) throw Error(`Learning catalog HTTP ${r.status}`);
        const j = await r.json();
        items.push(...j.items);
        if (page >= j.totalPages) break;
      }
      const dbIds = rows[kind].map((x) => x.id).sort(),
        apiIds = items.map((x) => x[id]).sort();
      if (JSON.stringify(dbIds) !== JSON.stringify(apiIds))
        throw Error(`Configured Learning DB and Gateway ${kind} IDs differ`);
      summaries[kind] = { count: items.length, idsHash: hash(apiIds), databaseAndApiMatch: true };
    }
    const root = dotenv.parse(fs.readFileSync('.env')),
      q = dotenv.parse(fs.readFileSync('services/question-bank-service/.env'));
    const storageBase =
      learningEnv.MEDIA_PUBLIC_BASE_URL ||
      root.MEDIA_PUBLIC_BASE_URL ||
      'http://localhost:19000/toeic-media';
    const target = {
      gateway,
      verifiedAt: new Date().toISOString(),
      verifiedScopes: ['learning'],
      databases,
      storagePublicOrigin: new URL(storageBase).origin,
      questionBucket: q.MINIO_BUCKET || root.MINIO_BUCKET,
      learningBucket: learningEnv.MINIO_BUCKET || root.MINIO_BUCKET,
      verification:
        'Compared existing local Compose/service config and all Learning resource IDs through PostgreSQL read-only Prisma and Gateway; media upload bucket must also match presign response',
    };
    const safeProgress = JSON.parse(
      JSON.stringify(progress, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    );
    saveAtomic(path.join(out, 'target.json'), target);
    saveAtomic(path.join(out, 'baseline.json'), {
      at: new Date().toISOString(),
      catalog: summaries,
      progress: safeProgress,
      progressHash: hash(safeProgress),
    });
    console.log(
      JSON.stringify(
        {
          target: path.join(out, 'target.json'),
          catalog: summaries,
          progressHash: hash(safeProgress),
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      if (identity?.accessToken && identity?.refreshToken) {
        const response = await fetch('http://127.0.0.1:3000/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + identity.accessToken,
          },
          body: JSON.stringify({ refreshToken: identity.refreshToken }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw Error('Target inspection authentication cleanup failed');
      }
    } finally {
      await db.$disconnect();
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
