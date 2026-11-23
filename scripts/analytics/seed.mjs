import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import {
  digest,
  loadLocalTarget,
  loadRuntime,
  openClient,
  readOnly,
  root,
  safeError,
  verifyLocalTarget,
} from './local-db.mjs';
import {
  checkRemainingPlan,
  checkStorage,
  createPlan,
  findUser,
  getPlannedLesson,
  listUsers,
} from './seed-plan.mjs';

const manifestVersion = 1;
const runDirectory = join(root, 'tmp', 'analytics-seed');
const learningScope = 'analytics-history-seed';
// These rows are delivered by this CLI to verified local clients, not by the broker relay.
const holdUntil = new Date('9999-12-31T00:00:00.000Z');
const syncEvent = 'LearningProgressChangedEvent.v2';
const analyticsEvents = new Set([
  'TestSubmittedEvent.v2',
  'PartPracticeSubmittedEvent.v2',
  'VocabularyLearnedEvent.v2',
  'PersonalVocabularyReviewedEvent.v2',
  'FlashcardSessionCompletedEvent.v2',
  'LessonCompletedEvent.v2',
]);
const help = `node scripts/analytics/seed.mjs --list-users
node scripts/analytics/seed.mjs --list-runs [--user <email-or-UUID>]
node scripts/analytics/seed.mjs --user <email-or-UUID> --run-id <id> [--apply]`;

function args() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' },
      'list-users': { type: 'boolean' },
      'list-runs': { type: 'boolean' },
      'run-id': { type: 'string' },
      user: { type: 'string' },
      apply: { type: 'boolean' },
    },
  });
  const { help: showHelp, 'list-users': users, 'list-runs': runs, 'run-id': runId, apply } = values;
  const user = values.user?.trim();
  if (showHelp) return { showHelp };
  const validUser =
    user &&
    (/^[^\s@]+@[^\s@]+$/.test(user) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user));
  if (
    (values.user !== undefined && !validUser) ||
    (users && (runs || user || apply || runId !== undefined)) ||
    (runs && (apply || runId !== undefined)) ||
    (!users && !runs && (!user || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId ?? '')))
  )
    throw new Error('Tham số không hợp lệ.\n' + help);
  return { users, runs, runId, user, apply };
}

function readManifest(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function saveManifest(file, run) {
  run.updatedAt = new Date().toISOString();
  mkdirSync(runDirectory, { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  writeFileSync(temporary, JSON.stringify(run, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  renameSync(temporary, file);
}

function listRuns(target, user) {
  let entries;
  try {
    entries = readdirSync(runDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    entries = [];
  }
  const rows = [];
  const statuses = { complete: 'Đã hoàn tất', incomplete: 'Chưa hoàn tất', failed: 'Thất bại' };
  for (const entry of entries) {
    if (!entry.isFile() || !/^[0-9a-f]{64}\.json$/.test(entry.name)) continue;
    try {
      const run = readManifest(join(runDirectory, entry.name));
      if (
        run?.target !== target ||
        run.version !== manifestVersion ||
        (user &&
          ![run.user.id, run.user.email].some(
            (value) => value.toLowerCase() === user.toLowerCase(),
          ))
      )
        continue;
      rows.push({
        runId: run.runId,
        email: run.user.email,
        userId: run.user.id,
        startedAt: run.startedAt,
        status: statuses[run.status],
        recorded: Object.values(run.progress).filter(({ sourceId }) => sourceId).length,
        delivered: Object.values(run.progress).filter(({ delivered }) => delivered).length,
        planned: run.plan.activities.length,
        error: run.failure?.message ?? '',
      });
    } catch (error) {
      console.warn('Không đọc được hồ sơ ' + entry.name + ' — ' + safeError(error));
    }
  }
  rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (rows.length) console.table(rows);
  else console.log('Chưa có lượt --apply phù hợp trên máy này.');
}

function printPlan(config, user, runId, plan) {
  console.table(
    Object.entries(config.targets).map(([service, target]) => ({ service, ...target })),
  );
  console.log('Tài khoản', user.email, user.id);
  console.log('Lượt chạy', runId);
  console.log('Ngày học tại Việt Nam', plan.days.join(', '));
  console.table(
    plan.activities.map((op) => ({
      operation: op.slot,
      resource: op.title,
      resourceId: op.testId ?? op.lessonId ?? op.topicId,
      completedAt: op.completedAt,
      words: op.selection?.words.length ?? '',
    })),
  );
  for (const reason of plan.skipped) console.log('Bỏ qua', reason);
}

function checkManifest(run, config, databaseIds, user, runId) {
  if (
    run.version !== manifestVersion ||
    run.target !== config.fingerprint ||
    digest(run.databaseIds) !== digest(databaseIds) ||
    run.user.id !== user.id ||
    run.runId !== runId ||
    run.planHash !== digest(run.plan)
  )
    throw new Error('Hồ sơ lượt chạy không khớp database, tài khoản hoặc kế hoạch đã lưu.');
}

function operationUuid(key) {
  const hex = digest(key).slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    '8' + hex.slice(17, 20),
    hex.slice(20),
  ].join('-');
}

async function committedKeys(db, userId, prefix) {
  const committed = await Promise.all([
    readOnly(db.exam, (tx) =>
      tx.attemptStartRequest.findMany({
        where: { userId, key: { startsWith: prefix } },
        select: { key: true },
      }),
    ),
    readOnly(db.learning, (tx) =>
      tx.contentIdempotency.findMany({
        where: { actorId: userId, scope: learningScope, key: { startsWith: prefix } },
        select: { key: true },
      }),
    ),
  ]);
  return new Set(committed.flat().map(({ key }) => key));
}

async function runLearningOperation(db, runtime, userId, key, op) {
  const operationId = operationUuid(key);
  const requestHash = digest(op);
  const completedAt = new Date(op.completedAt);
  return db.learning.$transaction(
    async (tx) => {
      await runtime.userLock(tx, userId);
      const identity = { actorId: userId, scope: learningScope, key };
      const previous = await tx.contentIdempotency.findUnique({
        where: { actorId_scope_key: identity },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new Error('Thao tác Learning không khớp hồ sơ lượt chạy.');
        return previous.result;
      }
      let sourceId,
        eventCount,
        operationIds = [operationId];
      if (op.kind === 'flashcards') {
        const session = await runtime.flashcards.seedHistoricalSession(tx, userId, {
          ...op,
          operationId,
          startedAt: new Date(op.startedAt),
          completedAt,
        });
        sourceId = session.sessionId;
        operationIds = [...operationIds, ...session.reviewOperationIds];
        eventCount = session.reviewOperationIds.length * (op.scope === 'SHARED' ? 2 : 1) + 1;
      } else {
        await runtime.contentLock(tx);
        const lesson = await getPlannedLesson(tx, userId, op);
        if (!lesson)
          throw new Error('Bài ngữ pháp hoặc tiến độ học đã thay đổi sau khi lập kế hoạch.');
        await runtime.progress.completeInTransaction(
          tx,
          userId,
          lesson.id,
          {
            operationId,
            baseEntityRevision: '0',
          },
          completedAt,
        );
        sourceId = lesson.id;
        eventCount = 2;
      }
      const events = await tx.outboxEvent.findMany({
        where: {
          publishedAt: null,
          AND: [
            { payload: { path: ['payload', 'userId'], equals: userId } },
            {
              OR: [
                ...operationIds.map((id) => ({
                  payload: { path: ['payload', 'operationId'], equals: id },
                })),
                ...(op.kind === 'flashcards'
                  ? [{ payload: { path: ['payload', 'sessionId'], equals: sourceId } }]
                  : []),
              ],
            },
          ],
        },
        select: { id: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (events.length !== eventCount)
        throw new Error('Số sự kiện Learning phát sinh không khớp thao tác.');
      const eventIds = events.map(({ id }) => id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { nextAttemptAt: holdUntil },
      });
      const result = { sourceId, eventIds };
      await tx.contentIdempotency.create({ data: { ...identity, requestHash, result } });
      return result;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

async function runExamOperation(db, runtime, userId, key, op) {
  const sourceId = await runtime.attempts.seedHistoricalAttempt({
    ...op,
    userId,
    key,
    startedAt: new Date(op.startedAt),
    completedAt: new Date(op.completedAt),
    holdUntil,
  });
  const events = await readOnly(db.exam, (tx) =>
    tx.outboxEvent.findMany({
      where: { aggregateId: sourceId, nextAttemptAt: holdUntil },
      select: { id: true },
    }),
  );
  if (events.length !== 1) throw new Error('Thiếu sự kiện Exam của lượt làm ' + sourceId);
  return { sourceId, eventIds: [events[0].id] };
}

async function deliverEvent(db, runtime, source, eventId, userId) {
  const event = await readOnly(source, (tx) =>
    tx.outboxEvent.findUnique({ where: { id: eventId } }),
  );
  const envelope = event?.payload;
  if (
    event?.nextAttemptAt.getTime() !== holdUntil.getTime() ||
    envelope?.eventId !== eventId ||
    envelope?.eventType !== event.eventType ||
    envelope?.payload?.userId !== userId
  )
    throw new Error('Sự kiện không thuộc lượt chạy local ' + eventId);
  const fingerprint = runtime.stableHash(envelope);
  const where = { eventId };
  if (event.eventType === syncEvent) {
    const prior = await db.auth.syncInbox.findUnique({ where });
    if (!prior) await runtime.authSync.consume(envelope);
    const inbox = prior ?? (await db.auth.syncInbox.findUnique({ where }));
    if (inbox?.payloadHash !== fingerprint || (await db.auth.syncQuarantine.findUnique({ where })))
      throw new Error('Auth từ chối sự kiện đồng bộ ' + eventId);
  } else if (analyticsEvents.has(event.eventType)) {
    await runtime.analytics.consume(envelope);
    const inbox = await db.analytics.processedEvent.findUnique({ where });
    if (
      inbox?.payloadHash !== fingerprint ||
      (await db.analytics.analyticsQuarantine.findUnique({ where }))
    )
      throw new Error('Analytics từ chối sự kiện ' + eventId);
  } else {
    throw new Error('Loại sự kiện nằm ngoài phạm vi script ' + event.eventType);
  }
  if (!event.publishedAt)
    await source.outboxEvent.updateMany({
      where: { id: eventId, nextAttemptAt: holdUntil, publishedAt: null },
      data: { publishedAt: new Date() },
    });
}

async function applyPlan(db, runtime, file, run, prefix) {
  let currentSlot;
  run.status = 'incomplete';
  delete run.failure;
  saveManifest(file, run);
  try {
    for (const op of run.plan.activities) {
      currentSlot = op.slot;
      if (!(await findUser(db.auth, run.user.id)))
        throw new Error('Tài khoản đích không còn đủ điều kiện.');
      const key = prefix + op.slot;
      const source = op.kind === 'exam' ? db.exam : db.learning;
      const result =
        op.kind === 'exam'
          ? await runExamOperation(db, runtime, run.user.id, key, op)
          : await runLearningOperation(db, runtime, run.user.id, key, op);
      const previous = run.progress[op.slot];
      const delivered =
        previous?.delivered === true &&
        previous.sourceId === result.sourceId &&
        digest(previous.eventIds) === digest(result.eventIds);
      run.progress[op.slot] = { ...result, delivered };
      saveManifest(file, run);
      for (const eventId of result.eventIds)
        await deliverEvent(db, runtime, source, eventId, run.user.id);
      run.progress[op.slot].delivered = true;
      saveManifest(file, run);
      console.log('Đã ghi và đối chiếu', op.slot, result.sourceId);
    }
    run.status = 'complete';
  } catch (error) {
    run.status = 'failed';
    run.failure = { operation: currentSlot, message: safeError(error) };
    throw error;
  } finally {
    saveManifest(file, run);
  }
}

async function main() {
  const options = args();
  if (options.showHelp) return console.log(help);
  const config = loadLocalTarget();
  if (options.runs) return listRuns(config.fingerprint, options.user);

  const db = {};
  let lockClient;
  try {
    if (options.users) {
      db.auth = openClient(config.definitions.auth);
      return console.table(await listUsers(db.auth));
    }
    for (const [role, entry] of Object.entries(config.definitions)) db[role] = openClient(entry);
    const databaseIds = await verifyLocalTarget(config, db);
    const user = await findUser(db.auth, options.user);
    if (!user) throw new Error('Không tìm thấy tài khoản đang hoạt động chỉ có vai trò USER.');
    await checkStorage(db);
    const runtime = loadRuntime(config, db);
    const runKey = digest([config.fingerprint, user.id, options.runId]);
    const prefix = 'analytics-seed:' + runKey + ':';
    const file = join(runDirectory, runKey + '.json');

    const prepare = async () => {
      const previous = readManifest(file);
      if (previous) {
        checkManifest(previous, config, databaseIds, user, options.runId);
        if (previous.status !== 'complete') {
          const recorded = await committedKeys(db, user.id, prefix);
          const pending = previous.plan.activities.filter((op) => !recorded.has(prefix + op.slot));
          await checkRemainingPlan(db, runtime.attempts, user.id, pending);
        }
        return previous;
      }
      if ((await committedKeys(db, user.id, prefix)).size)
        throw new Error(
          'Lượt này đã ghi dữ liệu nhưng thiếu hồ sơ JSON. Hãy khôi phục hồ sơ trước khi tiếp tục.',
        );
      const plan = await createPlan(db, runtime.attempts, user, runKey);
      const now = new Date().toISOString();
      return {
        version: manifestVersion,
        runId: options.runId,
        user: { id: user.id, email: user.email },
        target: config.fingerprint,
        databaseIds,
        plan,
        planHash: digest(plan),
        status: 'incomplete',
        startedAt: now,
        updatedAt: now,
        progress: {},
      };
    };

    if (!options.apply) {
      const run = await prepare();
      printPlan(config, user, options.runId, run.plan);
      console.log('Chạy thử. Database giữ nguyên.');
      return;
    }
    // A separate connection keeps the per-user lock across source and projection commits.
    lockClient = openClient(config.definitions.auth);
    await lockClient.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const [lock] = await tx.$queryRaw`
        SELECT pg_try_advisory_xact_lock(hashtextextended(${'analytics-seed:' + user.id}, 0)) AS acquired
      `;
        if (!lock.acquired) throw new Error('Một lượt tạo Analytics đang chạy cho tài khoản này.');
        const run = await prepare();
        printPlan(config, user, options.runId, run.plan);
        if (run.status === 'complete') {
          console.log('Lượt này đã hoàn tất.');
          return;
        }
        await applyPlan(db, runtime, file, run, prefix);
        console.log('Hoàn tất lượt', options.runId, '— hồ sơ', file);
      },
      { timeout: 600_000, maxWait: 10_000 },
    );
  } finally {
    await Promise.allSettled(
      [...Object.values(db), ...(lockClient ? [lockClient] : [])].map((client) =>
        client.$disconnect(),
      ),
    );
  }
}

main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
