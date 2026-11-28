#!/usr/bin/env node
/*
 * Read-only Exam target verifier for the TOEIC monorepo.
 *
 * Reads PostgreSQL through the generated Question Bank and Exam Prisma clients,
 * reads Question Bank/Exam through the API Gateway, and verifies referenced
 * MinIO objects. It never writes Question Bank, Exam, Learning, MinIO, or the
 * importer checkpoint. It creates and revokes one temporary CONTENT_ADMIN
 * authentication session because the protected read APIs require a JWT.
 *
 * Usage:
 *   node scripts/content/verify-exam-target.cjs <new-evidence-directory>
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = process.cwd();
const dotenv = require('dotenv');
const { Client: MinioClient } = require(
  require.resolve('minio', { paths: [path.join(ROOT, 'services/question-bank-service')] }),
);
const STATE_FILE = path.join(
  ROOT,
  'data/toeic/ets-2023-test-01/import-state.local.json',
);
const DATASET_ID = 'ets-2023-test-01';
const SERVICE_ORDER = [
  'auth-service',
  'question-bank-service',
  'exam-service',
  'learning-service',
];
const GROUPED_PARTS = new Set([3, 4, 6, 7]);
const CONCURRENCY = 5;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const sorted = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalizeNullable = (value) => value ?? null;
const normalizeEndpoint = (value) => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Missing endpoint configuration');
  return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
};
const dbEndpoint = (service, env) => {
  if (!env.DATABASE_URL) throw new Error(`${service}: DATABASE_URL is missing`);
  const url = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error(`${service}: DATABASE_URL must use PostgreSQL`);
  return {
    host: url.hostname,
    port: url.port || '5432',
    name: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
};
const targetIdentity = (target) => ({
  gateway: target.gateway,
  storagePublicOrigin: target.storagePublicOrigin,
  questionBucket: target.questionBucket,
  learningBucket: target.learningBucket,
  databases: Object.fromEntries(
    Object.entries(target.databases || {}).map(([key, value]) => [
      key,
      value && typeof value === 'object'
        ? { host: value.host, port: String(value.port), name: value.name }
        : value,
    ]),
  ),
});
const saveAtomic = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, file);
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeQuestionFromDb(row) {
  return {
    questionId: row.id,
    part: row.part,
    type: row.type,
    questionText: normalizeNullable(row.questionText),
    explanation: normalizeNullable(row.explanation),
    transcript: normalizeNullable(row.transcript),
    difficulty: row.difficulty,
    groupId: normalizeNullable(row.groupId),
    positionInGroup: normalizeNullable(row.positionInGroup),
    audioKey: normalizeNullable(row.audioKey),
    imageKey: normalizeNullable(row.imageKey),
    correctOption: row.correctOption,
    options: row.options
      .map((option) => ({ optionCode: option.optionCode, optionText: option.optionText }))
      .sort((a, b) => a.optionCode.localeCompare(b.optionCode)),
    tags: sorted(row.tags.map((entry) => entry.tag.name)),
  };
}
function normalizeQuestionFromApi(row) {
  return {
    questionId: row.questionId,
    part: row.part,
    type: row.type,
    questionText: normalizeNullable(row.questionText),
    explanation: normalizeNullable(row.explanation),
    transcript: normalizeNullable(row.transcript),
    difficulty: row.difficulty,
    groupId: normalizeNullable(row.groupId),
    positionInGroup: normalizeNullable(row.positionInGroup),
    audioKey: normalizeNullable(row.audioKey),
    imageKey: normalizeNullable(row.imageKey),
    correctOption: row.correctOption,
    options: (row.options || [])
      .map((option) => ({ optionCode: option.optionCode, optionText: option.optionText }))
      .sort((a, b) => a.optionCode.localeCompare(b.optionCode)),
    tags: sorted(row.tags || []),
  };
}
function normalizeGroupFromDb(row) {
  return {
    groupId: row.id,
    part: row.part,
    type: row.type,
    instruction: normalizeNullable(row.instruction),
    audioKey: normalizeNullable(row.audioKey),
    transcript: normalizeNullable(row.transcript),
    passageText: normalizeNullable(row.passageText),
    orderNo: normalizeNullable(row.orderNo),
    assets: row.assets
      .map((asset) => ({
        kind: asset.kind,
        content: normalizeNullable(asset.content),
        storageKey: normalizeNullable(asset.storageKey),
        orderNo: asset.orderNo,
      }))
      .sort((a, b) => a.orderNo - b.orderNo),
    questionIds: row.questions
      .filter((question) => !question.deletedAt)
      .sort((a, b) => (a.positionInGroup ?? 0) - (b.positionInGroup ?? 0))
      .map((question) => question.id),
  };
}
function normalizeGroupFromApi(row) {
  return {
    groupId: row.groupId,
    part: row.part,
    type: row.type,
    instruction: normalizeNullable(row.instruction),
    audioKey: normalizeNullable(row.audioKey),
    transcript: normalizeNullable(row.transcript),
    passageText: normalizeNullable(row.passageText),
    orderNo: normalizeNullable(row.orderNo),
    assets: (row.assets || [])
      .map((asset) => ({
        kind: asset.kind,
        content: normalizeNullable(asset.content),
        storageKey: normalizeNullable(asset.storageKey),
        orderNo: asset.orderNo,
      }))
      .sort((a, b) => a.orderNo - b.orderNo),
    questionIds: row.questionIds || [],
  };
}
function normalizeTestFromDb(row) {
  return {
    testId: row.id,
    title: row.title,
    durationSeconds: row.durationSeconds,
    questions: row.questions
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((question) => ({
        questionId: question.questionId,
        orderNo: question.orderNo,
        part: question.part,
      })),
  };
}
function normalizeTestFromApi(row) {
  return {
    testId: row.testId,
    title: row.title,
    durationSeconds: row.durationSeconds,
    questions: (row.questions || []).map((question) => ({
      questionId: question.questionId,
      orderNo: question.orderNo,
      part: question.part,
    })),
  };
}

async function main() {
  const outArg = process.argv[2];
  if (!outArg) throw new Error('Usage: node scripts/content/verify-exam-target.cjs <new-evidence-directory>');
  const outputDir = path.resolve(ROOT, outArg);
  const targetOutput = path.join(outputDir, 'target.json');
  const baselineOutput = path.join(outputDir, 'baseline.json');
  assert(!fs.existsSync(outputDir), 'Evidence directory already exists; choose a new output directory');
  assert(fs.existsSync(STATE_FILE), 'Importer checkpoint not found; refusing to create a new target identity');

  const state = readJson(STATE_FILE);
  assert(state.datasetId === DATASET_ID, 'Checkpoint belongs to another dataset');
  assert(state.target && state.actorId, 'Checkpoint target/actor is incomplete');

  const rootEnv = dotenv.parse(fs.readFileSync(path.join(ROOT, '.env')));
  const serviceEnv = {};
  // Keep the same service-keyed object shape used by import-state.local.json.
  // An array here would serialize as keys 0..N and falsely fail identity parity.
  const databases = {};
  for (const service of SERVICE_ORDER) {
    const file = path.join(ROOT, 'services', service, '.env');
    assert(fs.existsSync(file), `Missing service environment file: services/${service}/.env`);
    serviceEnv[service] = dotenv.parse(fs.readFileSync(file));
    databases[service] = dbEndpoint(service, serviceEnv[service]);
  }

  const qEnv = serviceEnv['question-bank-service'];
  const learningEnv = serviceEnv['learning-service'];
  const questionBucket = qEnv.MINIO_BUCKET || rootEnv.MINIO_BUCKET;
  const learningBucket = learningEnv.MINIO_BUCKET || rootEnv.MINIO_BUCKET;
  assert(questionBucket && learningBucket, 'Question/Learning MinIO bucket configuration is missing');
  // This script runs on the host, so prefer the browser/host-facing MinIO endpoint.
  const minioPublicEndpoint = normalizeEndpoint(
    qEnv.MINIO_PUBLIC_ENDPOINT || rootEnv.MINIO_PUBLIC_ENDPOINT ||
    qEnv.MINIO_ENDPOINT || rootEnv.MINIO_ENDPOINT || 'localhost:19000',
  );
  const storagePublicBase =
    qEnv.MEDIA_PUBLIC_BASE_URL ||
    rootEnv.MEDIA_PUBLIC_BASE_URL ||
    `${minioPublicEndpoint.origin}/${questionBucket}`;
  const learningMediaBase =
    learningEnv.MEDIA_PUBLIC_BASE_URL ||
    rootEnv.MEDIA_PUBLIC_BASE_URL ||
    'http://localhost:19000/toeic-media';
  const qMediaUrl = new URL(storagePublicBase);
  const lMediaUrl = new URL(learningMediaBase);
  assert(qMediaUrl.origin === lMediaUrl.origin, 'Question Bank and Learning public media origins differ');
  assert(qMediaUrl.pathname.replace(/\/$/, '').endsWith(`/${questionBucket}`), 'Question Bank media URL does not target its configured bucket');

  const configuredTarget = {
    ...state.target,
    storagePublicOrigin: new URL(learningMediaBase).origin,
    questionBucket,
    learningBucket,
    databases,
  };
  assert(
    same(targetIdentity(state.target), targetIdentity(configuredTarget)),
    'Current service environment differs from the checkpoint target identity; stop and reconcile instead of generating a new target',
  );

  const QbPrisma = require('../../services/question-bank-service/src/generated/prisma').PrismaClient;
  const ExamPrisma = require('../../services/exam-service/src/generated/prisma').PrismaClient;
  const qDb = new QbPrisma({ datasources: { db: { url: qEnv.DATABASE_URL } }, log: [] });
  const eDb = new ExamPrisma({ datasources: { db: { url: serviceEnv['exam-service'].DATABASE_URL } }, log: [] });

  let accessToken;
  let refreshToken;
  let actorId;
  let logoutSucceeded = false;
  let primaryError;
  let baselineToWrite;
  let successSummary;

  const apiRequest = async (method, route, body) => {
    const url = new URL(route.replace(/^\/+/, ''), `${state.target.gateway.replace(/\/+$/, '')}/`);
    const response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`${method} ${route}: Gateway returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok)
      throw new Error(`${method} ${route}: HTTP ${response.status} (${data.code || 'API_ERROR'})`);
    return data;
  };

  const listAll = async (route, idField) => {
    const rows = [];
    let expectedTotal;
    let totalPages;
    for (let page = 1; page <= 10000; page++) {
      const data = await apiRequest('GET', `${route}?page=${page}&size=50`);
      assert(Array.isArray(data.items), `${route}: API response has no items[]`);
      if (page === 1) {
        expectedTotal = Number(data.total);
        totalPages = Number(data.totalPages || 0);
        assert(Number.isInteger(expectedTotal) && expectedTotal >= 0, `${route}: invalid total`);
        assert(Number.isInteger(totalPages) && totalPages >= 0, `${route}: invalid totalPages`);
      }
      rows.push(...data.items);
      if (page >= totalPages) {
        assert(rows.length === expectedTotal, `${route}: pagination returned ${rows.length}/${expectedTotal} rows`);
        break;
      }
      if (page === 10000) throw new Error(`${route}: pagination did not terminate`);
    }
    const ids = rows.map((row) => row[idField]);
    assert(ids.every(Boolean), `${route}: at least one API row is missing ${idField}`);
    assert(new Set(ids).size === ids.length, `${route}: duplicate IDs in API catalog`);
    return { rows, ids: sorted(ids), total: expectedTotal };
  };

  try {
    await Promise.all([qDb.$connect(), eDb.$connect()]);

    const [qIdentity, eIdentity] = await Promise.all([
      qDb.$queryRawUnsafe(
        'SELECT current_database() AS database_name, current_user AS database_user, inet_server_addr()::text AS server_address, inet_server_port() AS server_port',
      ),
      eDb.$queryRawUnsafe(
        'SELECT current_database() AS database_name, current_user AS database_user, inet_server_addr()::text AS server_address, inet_server_port() AS server_port',
      ),
    ]);
    assert(qIdentity[0]?.database_name === 'question_db', 'Question Bank DATABASE_URL is connected to the wrong database');
    assert(eIdentity[0]?.database_name === 'exam_db', 'Exam DATABASE_URL is connected to the wrong database');

    const [questions, groups, archivedQuestions, archivedGroups, tests, archivedTests, qMigration, eMigration] = await Promise.all([
      qDb.question.findMany({
        where: {
          deletedAt: null,
          OR: [{ groupId: null }, { group: { deletedAt: null } }],
        },
        include: {
          options: { orderBy: { optionCode: 'asc' } },
          tags: { include: { tag: true } },
        },
        orderBy: { id: 'asc' },
      }),
      qDb.questionGroup.findMany({
        where: { deletedAt: null },
        include: {
          assets: { orderBy: { orderNo: 'asc' } },
          questions: {
            select: { id: true, part: true, groupId: true, positionInGroup: true, deletedAt: true },
          },
        },
        orderBy: [{ orderNo: 'asc' }, { id: 'asc' }],
      }),
      qDb.question.count({ where: { deletedAt: { not: null } } }),
      qDb.questionGroup.count({ where: { deletedAt: { not: null } } }),
      eDb.test.findMany({
        where: { deletedAt: null },
        include: { questions: { orderBy: { orderNo: 'asc' } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      eDb.test.count({ where: { deletedAt: { not: null } } }),
      qDb.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM _prisma_migrations'),
      eDb.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM _prisma_migrations'),
    ]);

    const questionById = new Map(questions.map((question) => [question.id, question]));
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const questionErrors = [];
    for (const question of questions) {
      if (GROUPED_PARTS.has(question.part)) {
        const group = question.groupId ? groupById.get(question.groupId) : undefined;
        if (!group || group.part !== question.part)
          questionErrors.push(`Question ${question.id} has a missing/mismatched active group`);
      } else if (question.groupId || question.positionInGroup != null) {
        questionErrors.push(`Question ${question.id} has an unexpected group assignment`);
      }
    }
    for (const group of groups) {
      const activeMembers = group.questions.filter((question) => !question.deletedAt);
      if (!activeMembers.length)
        questionErrors.push(`Group ${group.id} has no active question members`);
      if (activeMembers.length !== group.questions.length)
        questionErrors.push(`Group ${group.id} contains archived question members`);
      if (activeMembers.some((question) => question.part !== group.part || question.groupId !== group.id))
        questionErrors.push(`Group ${group.id} has a Part/member mismatch`);
      const positions = activeMembers.map((question) => question.positionInGroup);
      if (new Set(positions).size !== positions.length)
        questionErrors.push(`Group ${group.id} has duplicate member positions`);
    }
    assert(questionErrors.length === 0, `Question Bank relational checks failed: ${questionErrors.slice(0, 5).join('; ')}`);

    const email = process.env.TOEIC_IMPORT_EMAIL;
    const password = process.env.TOEIC_IMPORT_PASSWORD;
    assert(email && password, 'Set TOEIC_IMPORT_EMAIL and TOEIC_IMPORT_PASSWORD for a real CONTENT_ADMIN account');
    const login = await fetch(new URL('auth/login', `${state.target.gateway.replace(/\/+$/, '')}/`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId: 'toeic-exam-target-verifier-v1' }),
      signal: AbortSignal.timeout(15000),
    });
    const loginText = await login.text();
    let loginData;
    try { loginData = loginText ? JSON.parse(loginText) : {}; }
    catch { throw new Error(`CONTENT_ADMIN login returned non-JSON HTTP ${login.status}`); }
    assert(login.ok, `CONTENT_ADMIN login failed: HTTP ${login.status} (${loginData.code || 'AUTH_ERROR'})`);
    accessToken = loginData.accessToken;
    refreshToken = loginData.refreshToken;
    actorId = loginData.user?.userId;
    assert(accessToken && refreshToken && loginData.user?.roles?.includes('CONTENT_ADMIN'),
      'A real CONTENT_ADMIN account is required');
    assert(actorId === state.actorId, 'Checkpoint actor differs; keep the existing importer actor');

    const questionList = await listAll('/questions', 'questionId');
    const groupList = await listAll('/question-groups', 'groupId');
    const testList = await listAll('/tests', 'testId');

    const dbQuestionIds = sorted(questions.map((row) => row.id));
    const dbGroupIds = sorted(groups.map((row) => row.id));
    const dbTestIds = sorted(tests.map((row) => row.id));
    assert(same(questionList.ids, dbQuestionIds) && questionList.total === questions.length,
      `Question Bank Question API/DB mismatch (API ${questionList.total}, PostgreSQL ${questions.length}); Elasticsearch may be stale`);
    assert(same(groupList.ids, dbGroupIds) && groupList.total === groups.length,
      `Question Bank Group API/DB mismatch (API ${groupList.total}, PostgreSQL ${groups.length})`);
    assert(same(testList.ids, dbTestIds) && testList.total === tests.length,
      `Exam Test API/DB mismatch (API ${testList.total}, PostgreSQL ${tests.length})`);

    const [questionDetails, groupDetails, testDetails] = await Promise.all([
      mapLimit(questions, CONCURRENCY, async (dbRow) => {
        const apiRow = await apiRequest('GET', `/questions/${encodeURIComponent(dbRow.id)}`);
        assert(apiRow.questionId === dbRow.id, `Question ${dbRow.id}: API returned a different ID`);
        assert(apiRow.isComplete === true, `Question ${dbRow.id}: Question Bank reports incomplete content`);
        assert(same(normalizeQuestionFromDb(dbRow), normalizeQuestionFromApi(apiRow)),
          `Question ${dbRow.id}: PostgreSQL/API content mismatch`);
        return apiRow;
      }),
      mapLimit(groups, CONCURRENCY, async (dbRow) => {
        const apiRow = await apiRequest('GET', `/question-groups/${encodeURIComponent(dbRow.id)}`);
        assert(apiRow.groupId === dbRow.id, `Group ${dbRow.id}: API returned a different ID`);
        assert(apiRow.isComplete === true, `Group ${dbRow.id}: Question Bank reports incomplete group content`);
        assert(same(normalizeGroupFromDb(dbRow), normalizeGroupFromApi(apiRow)),
          `Group ${dbRow.id}: PostgreSQL/API content mismatch`);
        return apiRow;
      }),
      mapLimit(tests, CONCURRENCY, async (dbRow) => {
        const apiRow = await apiRequest('GET', `/tests/${encodeURIComponent(dbRow.id)}`);
        assert(apiRow.testId === dbRow.id, `Test ${dbRow.id}: API returned a different ID`);
        assert(same(normalizeTestFromDb(dbRow), normalizeTestFromApi(apiRow)),
          `Test ${dbRow.id}: PostgreSQL/API structure mismatch`);
        return apiRow;
      }),
    ]);

    const crossServiceErrors = [];
    for (const test of tests) {
      const items = [...test.questions].sort((a, b) => a.orderNo - b.orderNo);
      if (items.length !== 200 || test.durationSeconds !== 7200)
        crossServiceErrors.push(`Test ${test.id} is not a 200-question/7200-second Full Test`);
      if (items.some((item, index) => item.orderNo !== index + 1))
        crossServiceErrors.push(`Test ${test.id} has non-consecutive question order`);
      if (new Set(items.map((item) => item.questionId)).size !== items.length)
        crossServiceErrors.push(`Test ${test.id} has duplicate question IDs`);
      if ([1, 2, 3, 4, 5, 6, 7].some((part) => !items.some((item) => item.part === part)))
        crossServiceErrors.push(`Test ${test.id} is missing a TOEIC Part`);
      if (items.filter((item) => item.part <= 4).length !== 100 || items.filter((item) => item.part >= 5).length !== 100)
        crossServiceErrors.push(`Test ${test.id} does not contain 100 Listening + 100 Reading questions`);
      if (items.some((item, index) => item.part < 1 || item.part > 7 || (index > 0 && item.part < items[index - 1].part)))
        crossServiceErrors.push(`Test ${test.id} has an invalid Part sequence`);
      for (const item of items) {
        const question = questionById.get(item.questionId);
        if (!question || question.part !== item.part) {
          crossServiceErrors.push(`Test ${test.id} references a missing question or mismatched Part (${item.questionId})`);
          continue;
        }
        if (question.groupId) {
          const group = groupById.get(question.groupId);
          const groupMembers = (group?.questions || []).filter((member) => !member.deletedAt);
          if (!group || !groupMembers.every((member) => items.some((candidate) => candidate.questionId === member.id)))
            crossServiceErrors.push(`Test ${test.id} splits a question group (${question.groupId})`);
        }
      }
    }
    assert(crossServiceErrors.length === 0,
      `Cross-service Exam checks failed: ${crossServiceErrors.slice(0, 5).join('; ')}`);

    const gatewayReadyUrl = new URL('/ready', new URL(state.target.gateway).origin);
    const gatewayReady = await fetch(gatewayReadyUrl, { signal: AbortSignal.timeout(10000) });
    assert(gatewayReady.ok, `Gateway readiness failed: HTTP ${gatewayReady.status}`);

    const minioClient = new MinioClient({
      endPoint: minioPublicEndpoint.hostname,
      port: Number(minioPublicEndpoint.port || (minioPublicEndpoint.protocol === 'https:' ? 443 : 80)),
      useSSL: minioPublicEndpoint.protocol === 'https:',
      accessKey: qEnv.MINIO_ACCESS_KEY || rootEnv.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: qEnv.MINIO_SECRET_KEY || rootEnv.MINIO_SECRET_KEY || 'minioadmin',
      region: qEnv.MINIO_REGION || rootEnv.MINIO_REGION || 'us-east-1',
    });
    const bucketExists = await minioClient.bucketExists(questionBucket);
    assert(bucketExists, `Configured MinIO bucket does not exist: ${questionBucket}`);

    const mediaKinds = new Map();
    const addMediaKey = (key, prefix, kind) => {
      if (!key) return;
      assert(!key.startsWith('/') && !key.split('/').includes('..'), 'Unsafe media storage key detected');
      assert(key.startsWith(`${prefix}${kind.toLowerCase()}/`), 'Media storage key does not match its owning resource/type');
      const previousKind = mediaKinds.get(key);
      assert(!previousKind || previousKind === kind, 'One storage object is mapped to incompatible media types');
      mediaKinds.set(key, kind);
    };
    for (const question of questions) {
      addMediaKey(question.audioKey, `questions/part-${question.part}/${question.id}/`, 'AUDIO');
      addMediaKey(question.imageKey, `questions/part-${question.part}/${question.id}/`, 'IMAGE');
    }
    for (const group of groups) {
      addMediaKey(group.audioKey, `groups/part-${group.part}/${group.id}/`, 'AUDIO');
      for (const asset of group.assets)
        if (asset.storageKey) addMediaKey(asset.storageKey, `groups/part-${group.part}/${group.id}/`, asset.kind);
    }
    const mediaKeys = new Set(mediaKinds.keys());
    const mediaPublicResults = await mapLimit([...mediaKeys], CONCURRENCY, async (key) => {
      const stat = await minioClient.statObject(questionBucket, key);
      const metadataType = String(stat.metaData?.['content-type'] || stat.metaData?.['Content-Type'] || '').split(';')[0].toLowerCase();
      const expectedKind = mediaKinds.get(key);
      const actualKind = metadataType === 'audio/mpeg' ? 'AUDIO' :
        ['image/png', 'image/jpeg', 'image/webp'].includes(metadataType) ? 'IMAGE' : 'UNKNOWN';
      assert(actualKind === expectedKind, 'MinIO object content type does not match its media mapping');
      const objectUrl = new URL(
        key.split('/').map((segment) => encodeURIComponent(segment)).join('/'),
        `${storagePublicBase.replace(/\/+$/, '')}/`,
      );
      const response = await fetch(objectUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      assert(response.status === 200, `Public media HEAD failed for a referenced object: HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && stat.size != null)
        assert(contentLength === stat.size, 'Public media size differs from MinIO object metadata');
      return { keyHash: hash(key), bytes: Number(stat.size || 0) };
    });

    const verifiedTarget = {
      ...state.target,
      verifiedAt: new Date().toISOString(),
      verifiedScopes: ['exam'],
      verification:
        'Exam scope verified against Question Bank/Exam PostgreSQL and authenticated Gateway readbacks; checked Full Test references and MinIO objects. Learning scope was not re-verified by this run. A temporary CONTENT_ADMIN session is created and revoked.',
    };
    assert(same(targetIdentity(state.target), targetIdentity(verifiedTarget)),
      'Verifier attempted to alter checkpoint target identity');

    const baseline = {
      at: new Date().toISOString(),
      datasetId: DATASET_ID,
      authentication: {
        actorMatchesCheckpoint: true,
        role: 'CONTENT_ADMIN',
        tokensWrittenToDisk: false,
        temporarySessionRevoked: false,
      },
      databases: {
        questionBank: {
          database: qIdentity[0].database_name,
          activeQuestions: questions.length,
          archivedQuestions,
          activeGroups: groups.length,
          archivedGroups,
          migrationCount: qMigration[0].count,
          questionIdsHash: hash(dbQuestionIds),
          groupIdsHash: hash(dbGroupIds),
          apiAndDatabaseIdsMatch: true,
          apiDetailReadbacksMatch: true,
        },
        exam: {
          database: eIdentity[0].database_name,
          activeTests: tests.length,
          archivedTests,
          testQuestionRows: tests.reduce((sum, test) => sum + test.questions.length, 0),
          migrationCount: eMigration[0].count,
          testIdsHash: hash(dbTestIds),
          apiAndDatabaseIdsMatch: true,
          apiDetailReadbacksMatch: true,
        },
      },
      scope: {
        examVerified: true,
        learningScopeReverified: false,
      },
      crossService: {
        testQuestionReferencesValid: true,
        testGroupsNotSplit: true,
        fullTestStructuresValid: true,
      },
      storage: {
        bucket: questionBucket,
        bucketExists: true,
        referencedObjectCount: mediaKeys.size,
        privateStatSucceeded: true,
        publicHeadSucceeded: mediaKeys.size > 0 && mediaPublicResults.length === mediaKeys.size,
        publicReadVerification: mediaKeys.size > 0 ? 'verified-by-public-HEAD' : 'not-testable-no-referenced-objects',
        publicObjectCount: mediaPublicResults.length,
        referencedObjectBytes: mediaPublicResults.reduce((sum, item) => sum + item.bytes, 0),
      },
      readiness: {
        gateway: { reachable: true, statusCode: gatewayReady.status },
        minioBucket: { reachable: true, bucketExists: true },
      },
      identity: {
        gateway: state.target.gateway,
        storagePublicOrigin: state.target.storagePublicOrigin,
        questionBucket,
        learningBucket,
        databases,
      },
    };

    fs.mkdirSync(outputDir, { recursive: true });
    saveAtomic(targetOutput, verifiedTarget);
    baselineToWrite = baseline;
    successSummary = {
      outcome: 'verified',
      target: path.relative(ROOT, targetOutput),
      baseline: path.relative(ROOT, baselineOutput),
      verifiedScopes: verifiedTarget.verifiedScopes,
      counts: {
        questions: questions.length,
        groups: groups.length,
        tests: tests.length,
        testQuestions: tests.reduce((sum, test) => sum + test.questions.length, 0),
        referencedMediaObjects: mediaKeys.size,
      },
      apiDatabaseParity: true,
      crossServiceIntegrity: true,
      bucketExists: true,
      mediaReadbacks: mediaPublicResults.length,
      publicMediaReadVerified: mediaKeys.size > 0 && mediaPublicResults.length === mediaKeys.size,
      checkpointModified: false,
      contentDatabaseWrites: false,
      minioWrites: false,
      authSessionCreated: true,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (accessToken && refreshToken) {
      try {
        const logoutUrl = new URL('auth/logout', `${state.target.gateway.replace(/\/+$/, '')}/`);
        const response = await fetch(logoutUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refreshToken }),
          signal: AbortSignal.timeout(15000),
        });
        logoutSucceeded = response.ok;
        if (!logoutSucceeded) {
          process.stderr.write(`WARNING: temporary CONTENT_ADMIN session revocation returned HTTP ${response.status}\n`);
          process.exitCode = 1;
        }
      } catch (error) {
        process.stderr.write(`WARNING: could not revoke temporary CONTENT_ADMIN session: ${error.message}\n`);
        process.exitCode = 1;
      }
    }
    if (qDb) await qDb.$disconnect().catch(() => {});
    if (eDb) await eDb.$disconnect().catch(() => {});
    if (!primaryError && baselineToWrite) {
      try {
        baselineToWrite.authentication.temporarySessionRevoked = logoutSucceeded;
        saveAtomic(baselineOutput, baselineToWrite);
      } catch (error) {
        process.stderr.write(`WARNING: could not write verification baseline: ${error.message}\n`);
        process.exitCode = 1;
      }
    }
  }

  if (!primaryError && successSummary) {
    successSummary.authSessionRevoked = logoutSucceeded;
    console.log(JSON.stringify(successSummary, null, 2));
  }
}

main().catch((error) => {
  process.stderr.write(`EXAM TARGET VERIFICATION FAILED: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
