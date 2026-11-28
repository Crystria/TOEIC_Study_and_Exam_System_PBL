import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const services = {
  auth: ['auth-service', 'users'],
  question: ['question-bank-service', 'questions'],
  exam: ['exam-service', 'tests'],
  learning: ['learning-service', 'vocabularies'],
  analytics: ['analytics-service', 'processed_events'],
};
const localHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);
const connectionOptions = new Set([
  'schema',
  'application_name',
  'connection_limit',
  'connect_timeout',
  'pool_timeout',
  'socket_timeout',
  'sslmode',
  'sslaccept',
  'statement_cache_size',
  'pgbouncer',
]);
const qaName = /(^|[_-])(qa|p6_verify)([_-]|$)/i;

export function digest(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function readEnv(file) {
  return existsSync(file) ? dotenv.parse(readFileSync(file)) : {};
}

export function loadLocalTarget() {
  const rootEnv = readEnv(join(root, '.env'));
  if (process.env.QA_MODE === 'true' || rootEnv.QA_MODE === 'true')
    throw new Error('Script chỉ dùng bộ database local, cấu hình hiện tại là QA.');
  const definitions = {};
  for (const [role, [directory, marker]] of Object.entries(services)) {
    const env = readEnv(join(root, 'services', directory, '.env'));
    const key = role.toUpperCase() + '_DATABASE_URL';
    const configured = process.env[key] ?? env.DATABASE_URL;
    if (!configured) throw new Error('Thiếu DATABASE_URL cho ' + directory + ' hoặc ' + key);
    let url, database;
    try {
      url = new URL(configured);
      database = decodeURIComponent(url.pathname.slice(1));
    } catch {
      throw new Error('DATABASE_URL không hợp lệ cho ' + directory);
    }
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !localHosts.has(url.hostname) ||
      url.hash ||
      [...url.searchParams.keys()].some((option) => !connectionOptions.has(option)) ||
      url.searchParams.getAll('schema').length > 1
    )
      throw new Error(
        'Chỉ chấp nhận PostgreSQL loopback với cấu hình kết nối local cho ' + directory,
      );
    const schema = url.searchParams.get('schema') ?? 'public';
    if (
      !database ||
      database.includes('/') ||
      !schema ||
      env.QA_MODE === 'true' ||
      qaName.test(database) ||
      qaName.test(schema) ||
      database === 'postgres' ||
      ['pg_catalog', 'information_schema'].includes(schema)
    )
      throw new Error('Database hoặc schema không thuộc bộ local cho ' + directory);
    const target = {
      host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
      port: url.port || '5432',
      database,
      schema,
    };
    // Pin localhost so subsequent connections cannot resolve to a different endpoint.
    url.hostname = target.host;
    definitions[role] = { directory, marker, env, target, url: url.href };
  }
  const targets = Object.fromEntries(
    Object.entries(definitions).map(([role, entry]) => [role, entry.target]),
  );
  if (new Set(Object.values(targets).map((target) => JSON.stringify(target))).size !== 5)
    throw new Error('Mỗi service cần database hoặc schema local riêng.');
  return { definitions, targets, fingerprint: digest(targets) };
}

export function openClient(entry) {
  const path = join(root, 'services', entry.directory, 'src/generated/prisma');
  if (!existsSync(join(path, 'index.js')))
    throw new Error('Chưa generate Prisma client cho ' + entry.directory);
  const { PrismaClient } = require(path);
  return new PrismaClient({ datasourceUrl: entry.url });
}

export function readOnly(db, work) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
      return work(tx);
    },
    { timeout: 30_000 },
  );
}

export async function verifyLocalTarget(config, db) {
  const entries = await Promise.all(
    Object.entries(config.definitions).map(async ([role, definition]) => {
      const identity = await readOnly(db[role], async (tx) => {
        const [row] = await tx.$queryRaw`
        SELECT current_database() AS database, current_schema() AS schema,
               d.oid::text AS "databaseOid", n.oid::text AS "schemaOid",
               to_regclass(format('%I.%I', n.nspname, ${definition.marker}::text)) IS NOT NULL AS ready
        FROM pg_database d, pg_namespace n
        WHERE d.datname = current_database() AND n.nspname = current_schema()
      `;
        return row;
      });
      if (
        !identity?.ready ||
        identity.database !== definition.target.database ||
        identity.schema !== definition.target.schema
      )
        throw new Error(
          'Sai database, schema hoặc chưa áp dụng migration local cho ' + definition.directory,
        );
      return [role, [identity.databaseOid, identity.schemaOid]];
    }),
  );
  return Object.fromEntries(entries);
}

export function loadRuntime(config, db) {
  require('reflect-metadata');
  require('ts-node').register({
    project: join(root, 'services/exam-service/tsconfig.json'),
    transpileOnly: true,
  });
  const source = (role, file) =>
    require(join(root, 'services', config.definitions[role].directory, 'src', file));
  const { ConfigService } = require('@nestjs/config');
  const { stableHash } = require('@toeic/common');
  const { QuestionsService } = source('question', 'modules/questions/questions.service.ts');
  const { QuestionBankGrpcController } = source(
    'question',
    'grpc/question-bank.grpc.controller.ts',
  );
  const questionRead = (method, ids) =>
    readOnly(db.question, (tx) => {
      const questions = new QuestionsService(tx);
      return new QuestionBankGrpcController(questions)[method]({ question_ids: ids });
    });
  const bank = {
    getQuestionBundle: (ids) => questionRead('getQuestions', ids),
    getAnswerBundle: (ids) => questionRead('getAnswerKey', ids),
  };
  const { AttemptsService } = source('exam', 'modules/attempts/attempts.service.ts');
  const { TestsService } = source('exam', 'modules/tests/tests.service.ts');
  const { ScoringService } = source('exam', 'scoring/scoring.service.ts');
  const examConfig = new ConfigService(config.definitions.exam.env);
  const attempts = new AttemptsService(
    db.exam,
    bank,
    new TestsService(db.exam, bank),
    undefined,
    new ScoringService(examConfig),
    examConfig,
  );
  const { ContentService } = source('learning', 'modules/learning/content.service.ts');
  const { LearningMediaService } = source('learning', 'modules/learning/media.service.ts');
  const { FlashcardSessionService } = source(
    'learning',
    'modules/learning/flashcard-session.service.ts',
  );
  const { ProgressService } = source('learning', 'modules/learning/progress.service.ts');
  const { userLock, contentLock } = source('learning', 'core.ts');
  const learningConfig = new ConfigService(config.definitions.learning.env);
  const progress = new ProgressService(db.learning);
  const content = new ContentService(
    db.learning,
    new LearningMediaService(learningConfig, db.learning),
  );
  const flashcards = new FlashcardSessionService(db.learning, content, progress);
  const { EventsConsumer } = source('analytics', 'modules/analytics/events.consumer.ts');
  const { ProjectionService } = source('analytics', 'modules/analytics/projection.service.ts');
  const { AnalyticsQueries } = source('analytics', 'modules/analytics/analytics.queries.ts');
  const { AnalyticsClock } = source('analytics', 'modules/analytics/calculations.ts');
  const clock = new AnalyticsClock();
  const projection = new ProjectionService(db.analytics, new AnalyticsQueries(), clock);
  const analytics = new EventsConsumer(db.analytics, undefined, undefined, projection, clock);
  const { SyncService } = source('auth', 'sync/sync.service.ts');
  const authSync = new SyncService(db.auth);
  // Construct only the domain handlers. Nest lifecycle hooks would start relays and network clients.
  return { attempts, progress, flashcards, analytics, authSync, userLock, contentLock, stableHash };
}

export function safeError(error) {
  const errorCode = error?.getResponse?.()?.code;
  return stripVTControlCharacters(String(errorCode ?? error?.message ?? error))
    .replace(/(?:postgres(?:ql)?|amqps?|rediss?):\/\/[^\s'"<>]+/gi, '[connection URL]')
    .trim();
}
