/* npm run history -w @toeic/analytics-service -- --dry-run | --apply */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { validateEvent } = require('@toeic/contracts/p0/runtime.cjs');
const root = path.resolve(__dirname, '../../..');
function client(service) {
  const dir = path.join(root, 'services', service + '-service');
  const datasourceUrl =
    process.env[service.toUpperCase() + '_DATABASE_URL'] ||
    require('dotenv').parse(fs.readFileSync(path.join(dir, '.env'))).DATABASE_URL;
  const url = new URL(datasourceUrl);
  const Db = require(path.join(dir, 'src/generated/prisma')).PrismaClient;
  return {
    db: new Db({ datasourceUrl }),
    target: [url.host, url.pathname, url.searchParams.get('schema')],
  };
}
function stableId(identity) {
  const hex = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    '8' + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
async function run() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--dry-run', '--apply'].includes(args[0]))
    throw Error('Specify --dry-run or --apply');
  const apply = args[0] === '--apply';
  const sources = ['learning', 'exam', 'analytics'].map(client);
  const [learning, exam, db] = sources.map((s) => s.db);
  const base = '../dist/modules/analytics/';
  const clock = new (require(base + 'calculations').AnalyticsClock)();
  const queries = new (require(base + 'analytics.queries').AnalyticsQueries)();
  const projection = new (require(base + 'projection.service').ProjectionService)(
    db,
    queries,
    clock,
  );
  const consumer = new (require(base + 'events.consumer').EventsConsumer)(
    db,
    null,
    null,
    projection,
    clock,
  );
  const counts = { eligible: 0, existing: 0, unrecoverable: 0, conflicts: 0 };
  const stamp = await db.analyticsHistoryCoverage.findUniqueOrThrow({
    where: { key: 'personal-and-quiz' },
  });
  const cutoff = stamp.liveFrom;
  const checkpoint = path.join(
    root,
    'node_modules',
    '.cache',
    'analytics-history-' + stableId([...sources.map((s) => s.target), cutoff]) + '.json',
  );
  const state =
    apply && fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : {};
  function persist() {
    if (apply) {
      fs.mkdirSync(path.dirname(checkpoint), { recursive: true });
      fs.writeFileSync(checkpoint + '.tmp', JSON.stringify(state));
      fs.renameSync(checkpoint + '.tmp', checkpoint);
    }
  }
  async function scan(
    name,
    model,
    options,
    visit,
    key = (r) => ({ id: r.id }),
    orderBy = { id: 'asc' },
  ) {
    if (state[name] === 'done') return;
    let cursor = state[name];
    for (;;) {
      const rows = await model.findMany({
        ...options,
        orderBy,
        take: 100,
        ...(cursor ? { cursor, skip: 1 } : {}),
      });
      for (const row of rows) await visit(row);
      if (rows.length < 100) {
        state[name] = 'done';
        persist();
        return;
      }
      cursor = key(rows.at(-1));
      state[name] = cursor;
      persist();
    }
  }
  async function ingest(e) {
    try {
      validateEvent(e);
    } catch {
      counts.unrecoverable++;
      return;
    }
    const prior = await db.processedEvent.findUnique({ where: { eventId: e.eventId } });
    if (prior?.payloadHash === require('@toeic/common').stableHash(e)) {
      counts.existing++;
      return;
    }
    if (prior) {
      counts.conflicts++;
      return;
    }
    counts.eligible++;
    if (apply) {
      await consumer.consume(e);
      if (await db.analyticsQuarantine.findUnique({ where: { eventId: e.eventId } }))
        counts.conflicts++;
    }
  }
  function recovered(type, producer, identity, payload, at) {
    return ingest({
      eventId: stableId([type, ...identity]),
      eventType: type,
      producer,
      version: 2,
      occurredAt: at,
      payload,
    });
  }
  const compound = (r) => ({
    userId_vocabularyId: { userId: r.userId, vocabularyId: r.vocabularyId },
  });
  try {
    for (const [name, source, types] of [
      [
        'learning',
        learning,
        [
          'VocabularyLearnedEvent.v2',
          'LessonCompletedEvent.v2',
          'PersonalVocabularyReviewedEvent.v2',
          'FlashcardSessionCompletedEvent.v2',
        ],
      ],
      ['exam', exam, ['TestSubmittedEvent.v2', 'PartPracticeSubmittedEvent.v2']],
    ]) {
      await scan(
        name + 'Outbox',
        source.outboxEvent,
        { where: { eventType: { in: types }, createdAt: { lte: cutoff } } },
        (r) => ingest(r.payload),
      );
    }
    for (const [source, model] of [
      ['FLASHCARD', learning.flashcardSession],
      ['LEGACY', learning.vocabularySession],
    ]) {
      await scan(
        source,
        model,
        { where: { status: 'COMPLETED', completedAt: { lte: cutoff } } },
        async (r) => {
          const at = r.completedAt.toISOString(),
            result = r.result;
          if (!result || result.sessionId !== r.id || result.completedAt !== at) {
            counts.unrecoverable++;
            return;
          }
          if (source === 'LEGACY' && Array.isArray(result.progress) && r.operationId) {
            for (const snapshot of result.progress) {
              const state = snapshot?.state;
              if (snapshot?.entityType !== 'VOCABULARY' || !state) {
                counts.unrecoverable++;
                continue;
              }
              await recovered(
                'VocabularyLearnedEvent.v2',
                'learning-service',
                [r.operationId, snapshot.entityId],
                {
                  userId: r.userId,
                  vocabularyId: snapshot.entityId,
                  sessionId: r.id,
                  operationId: r.operationId,
                  quality: state.quality,
                  revision: snapshot.revision,
                  firstLearned: state.firstLearnedAt === at,
                  firstLearnedAt: state.firstLearnedAt,
                  activityAt: at,
                },
                at,
              );
            }
          }
          await recovered(
            'FlashcardSessionCompletedEvent.v2',
            'learning-service',
            [source, r.id],
            {
              userId: r.userId,
              sessionId: r.id,
              scope: r.scope ?? 'SHARED',
              source,
              quizScore: result.quizScore,
              quizTotal: result.quizTotal,
              completedAt: at,
            },
            at,
          );
        },
      );
    }
    await scan(
      'flashcardReviews',
      learning.flashcardSessionItem,
      {
        where: {
          quality: { not: null },
          session: { startedAt: { lte: cutoff } },
        },
        include: { session: { select: { userId: true, scope: true } } },
      },
      async (item) => {
        const snap = item.reviewProgress,
          s = snap?.state;
        if (snap?.entityId !== item.vocabularyId || !s?.updatedAt || s.quality !== item.quality) {
          counts.unrecoverable++;
          return;
        }
        if (new Date(s.updatedAt) > cutoff) return;
        const at = s.updatedAt,
          userId = item.session.userId;
        const prior = await db.learningActivityFact.findFirst({
          where: {
            userId,
            kind: item.session.scope === 'PERSONAL' ? 'PERSONAL_REVIEW' : 'REVIEW',
            operationId: item.questionId,
            entityId: item.vocabularyId,
          },
        });
        if (prior) {
          if (prior.payload.quality !== item.quality || prior.payload.revision !== snap.revision)
            counts.conflicts++;
          else counts.existing++;
          return;
        }
        await recovered(
          item.session.scope === 'PERSONAL'
            ? 'PersonalVocabularyReviewedEvent.v2'
            : 'VocabularyLearnedEvent.v2',
          'learning-service',
          [item.questionId],
          {
            userId,
            operationId: item.questionId,
            sessionId: item.sessionId,
            vocabularyId: item.vocabularyId,
            revision: snap.revision,
            quality: item.quality,
            firstLearned: s.firstLearnedAt === at,
            firstLearnedAt: s.firstLearnedAt,
            activityAt: at,
          },
          at,
        );
      },
      (r) => ({ questionId: r.questionId }),
      { questionId: 'asc' },
    );
    for (const [scope, model] of [
      ['SHARED', learning.userVocabularyProgress],
      ['PERSONAL', learning.userPersonalVocabularyProgress],
    ]) {
      await scan(
        scope + 'Milestones',
        model,
        { where: { firstLearnedAt: { lte: cutoff } } },
        async (r) => {
          const { userId, vocabularyId, firstLearnedAt: firstAt } = r;
          const match = await db.firstLearnedEntity.findUnique({
            where: { userId_scope_vocabularyId: { userId, scope, vocabularyId } },
          });
          if (match && +match.firstAt <= +firstAt) {
            counts.existing++;
            return;
          }
          counts.eligible++;
          if (apply) {
            await db.historicalLearnedWord.upsert({
              where: { userId_scope_vocabularyId: { userId, scope, vocabularyId } },
              create: { userId, scope, vocabularyId, firstAt },
              update: {},
            });
            await projection.rebuild(userId);
          }
        },
        compound,
        [{ userId: 'asc' }, { vocabularyId: 'asc' }],
      );
    }
    await scan(
      'lessons',
      learning.userLessonProgress,
      { where: { completedAt: { lte: cutoff } } },
      async (r) => {
        const at = r.completedAt.toISOString();
        if (
          await db.completedLessonEntity.findUnique({
            where: { userId_lessonId: { userId: r.userId, lessonId: r.lessonId } },
          })
        ) {
          counts.existing++;
          return;
        }
        await recovered(
          'LessonCompletedEvent.v2',
          'learning-service',
          [r.userId, r.lessonId],
          {
            userId: r.userId,
            lessonId: r.lessonId,
            operationId: stableId(['completion', r.userId, r.lessonId]),
            revision: r.revision.toString(),
            completedAt: at,
          },
          at,
        );
      },
      (r) => ({ userId_lessonId: { userId: r.userId, lessonId: r.lessonId } }),
      [{ userId: 'asc' }, { lessonId: 'asc' }],
    );
    await scan(
      'attempts',
      exam.attempt,
      {
        where: { completedAt: { lte: cutoff }, status: { in: ['EXPIRED', 'SUBMITTED'] } },
        include: { parts: { orderBy: { part: 'asc' } } },
      },
      async (r) => {
        if (await db.attemptFact.findUnique({ where: { attemptId: r.id } })) {
          counts.existing++;
          return;
        }
        const at = r.completedAt.toISOString(),
          partStats = r.parts.map((p) => ({
            part: p.part,
            correct: p.correctCount,
            total: p.totalQuestions,
          }));
        const payload = {
          userId: r.userId,
          attemptId: r.id,
          testId: r.testId,
          mode: r.mode,
          correctCount: r.correctCount,
          totalQuestions: r.totalQuestions,
          completedAt: at,
          partStats,
        };
        if (r.mode === 'FULL')
          Object.assign(payload, {
            scoreListening: r.scoreListening,
            scoreReading: r.scoreReading,
            totalScore: r.score,
            scoring: r.scoring,
            correctListeningCount: partStats
              .filter((p) => p.part <= 4)
              .reduce((s, p) => s + p.correct, 0),
            correctReadingCount: partStats
              .filter((p) => p.part >= 5)
              .reduce((s, p) => s + p.correct, 0),
          });
        else if (r.mode === 'PART' && typeof r.accuracy === 'number')
          Object.assign(payload, {
            parts: partStats.map((p) => p.part),
            accuracy: Math.round(r.accuracy * 1e6) / 1e6,
          });
        else {
          counts.unrecoverable++;
          return;
        }
        await recovered(
          r.mode === 'FULL' ? 'TestSubmittedEvent.v2' : 'PartPracticeSubmittedEvent.v2',
          'exam-service',
          [r.id],
          payload,
          at,
        );
      },
    );
    console.log(JSON.stringify({ mode: args[0], cutoff, counts }));
    if (counts.conflicts) process.exitCode = 1;
  } finally {
    await Promise.all(sources.map((s) => s.db.$disconnect()));
  }
}
run().catch((e) => {
  console.error(String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]'));
  process.exitCode = 1;
});
