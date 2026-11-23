import { readOnly, safeError } from './local-db.mjs';

const parts = [1, 2, 3, 4, 5, 6, 7];
const dayMs = 86_400_000;
const hourMs = 3_600_000;
const wordDates = { id: true, createdAt: true, updatedAt: true };
const eligibleUser = {
  status: 'ACTIVE',
  roles: { some: { roleCode: 'USER' }, every: { roleCode: 'USER' } },
};
const userFields = { id: true, email: true, createdAt: true };

export const listUsers = (auth) =>
  readOnly(auth, (tx) =>
    tx.user.findMany({
      where: eligibleUser,
      select: userFields,
      orderBy: { email: 'asc' },
    }),
  );

export function findUser(auth, selector) {
  return readOnly(auth, (tx) =>
    tx.user.findFirst({
      where: {
        ...eligibleUser,
        ...(selector.includes('@')
          ? { email: selector.toLowerCase() }
          : { id: selector.toLowerCase() }),
      },
      select: userFields,
    }),
  );
}

export async function checkStorage(db) {
  await Promise.all([
    readOnly(db.auth, async (tx) => {
      await tx.syncInbox.findFirst({ select: { payloadHash: true } });
      await tx.syncProjection.findFirst({ select: { revision: true } });
      await tx.syncQuarantine.findFirst({ select: { eventId: true } });
    }),
    readOnly(db.exam, async (tx) => {
      await tx.attemptStartRequest.findFirst({ select: { fingerprint: true } });
      await tx.attemptQuestionSnapshot.findFirst({ select: { questionId: true } });
      await tx.outboxEvent.findFirst({ select: { nextAttemptAt: true } });
    }),
    readOnly(db.learning, async (tx) => {
      await tx.contentIdempotency.findFirst({ select: { requestHash: true } });
      await tx.flashcardSession.findFirst({ select: { completedAt: true } });
      await tx.operationLedger.findFirst({ select: { operationId: true } });
      await tx.outboxEvent.findFirst({ select: { nextAttemptAt: true } });
    }),
    readOnly(db.analytics, async (tx) => {
      await tx.processedEvent.findFirst({ select: { payloadHash: true } });
      await tx.learningActivityFact.findFirst({ select: { eventId: true } });
      await tx.analyticsQuarantine.findFirst({ select: { eventId: true } });
    }),
  ]);
}

async function findTest(db, attempts) {
  const candidates = await readOnly(db.exam, (tx) =>
    tx.test.findMany({
      where: { deletedAt: null, durationSeconds: 7200 },
      select: { id: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  );
  const errors = [];
  let selected;
  for (const { id, createdAt: testCreatedAt } of candidates) {
    if (selected && testCreatedAt.getTime() >= selected.availableAt) break;
    const test = await getTest(db.exam, id);
    if (!test) continue;
    try {
      const prepared = await attempts.prepareHistoricalTest(test);
      const dates = await readOnly(db.question, (tx) =>
        tx.question.findMany({
          where: { id: { in: test.questions.map(({ questionId }) => questionId) } },
          select: {
            createdAt: true,
            group: { select: { createdAt: true, assets: { select: { createdAt: true } } } },
          },
        }),
      );
      if (dates.length !== test.questions.length) throw new Error('Thiếu mốc tạo câu hỏi.');
      const availableAt = Math.max(
        test.createdAt.getTime(),
        ...dates.map(({ createdAt, group }) =>
          group
            ? Math.max(
                createdAt.getTime(),
                group.createdAt.getTime(),
                ...group.assets.map((a) => a.createdAt.getTime()),
              )
            : createdAt.getTime(),
        ),
      );
      if (!selected || availableAt < selected.availableAt)
        selected = { id, title: test.title, availableAt, ...prepared };
    } catch (error) {
      errors.push(test.title + ' (' + safeError(error) + ')');
    }
  }
  if (selected) return selected;
  throw new Error(
    'Thiếu đề Full hợp lệ' + (errors.length ? ' — ' + errors.slice(0, 3).join(', ') : '.'),
  );
}

export function getTest(exam, id) {
  return readOnly(exam, (tx) =>
    tx.test.findFirst({
      where: { id, deletedAt: null },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    }),
  );
}

export function getPlannedLesson(tx, userId, op) {
  return tx.grammarLesson.findFirst({
    where: {
      id: op.lessonId,
      status: 'PUBLISHED',
      deletedAt: null,
      createdAt: { lte: new Date(op.completedAt) },
      updatedAt: new Date(op.updatedAt),
      progress: { none: { userId } },
      legacyProgress: { none: { userId, status: 'COMPLETED' } },
    },
    select: { id: true },
  });
}

async function checkPlannedWords(tx, userId, op, pendingNewWords) {
  const isShared = op.scope === 'SHARED';
  const topic = await (isShared ? tx.vocabularyTopic : tx.personalVocabularyTopic).findFirst({
    where: {
      id: op.topicId,
      updatedAt: new Date(op.selection.topicUpdatedAt),
      ...(isShared ? { deletedAt: null } : { userId }),
    },
    select: { id: true },
  });
  if (!topic) return false;
  const words = await (isShared ? tx.vocabulary : tx.personalVocabulary).findMany({
    where: {
      id: { in: op.selection.words.map(({ id }) => id) },
      topicId: op.topicId,
      ...(isShared ? { deletedAt: null } : { userId }),
    },
    select: {
      id: true,
      updatedAt: true,
      progress: { where: { userId }, select: { revision: true, nextReviewDate: true } },
    },
  });
  const byId = new Map(words.map((word) => [word.id, word]));
  const localDay = new Date(Date.parse(op.startedAt) + 7 * hourMs).toISOString().slice(0, 10);
  return op.selection.words.every(({ id, updatedAt, revision }) => {
    const word = byId.get(id);
    if (!word || word.updatedAt.toISOString() !== updatedAt) return false;
    const progress = word.progress[0];
    const actualRevision = progress?.revision.toString() ?? '0';
    if (op.mode === 'REVIEW' && pendingNewWords.has(id)) return actualRevision === '0';
    return (
      actualRevision === revision &&
      (op.mode !== 'REVIEW' || progress?.nextReviewDate.toISOString().slice(0, 10) <= localDay)
    );
  });
}

export async function checkRemainingPlan(db, attempts, userId, pending) {
  const exam = pending.find(({ kind }) => kind === 'exam');
  if (exam) {
    const test = await getTest(db.exam, exam.testId);
    const current = test && (await attempts.prepareHistoricalTest(test));
    if (current?.catalogHash !== exam.catalogHash)
      throw new Error('Đề thi hoặc câu hỏi đã thay đổi từ khi lập kế hoạch.');
    if (
      pending.some((op) => op.mode === 'PART' && op.durationSeconds !== current.partDurationSeconds)
    )
      throw new Error('Cấu hình thời lượng luyện Part đã thay đổi từ khi lập kế hoạch.');
  }
  const pendingNewWords = new Set(
    pending
      .filter((op) => op.kind === 'flashcards' && op.scope === 'SHARED' && op.mode === 'NEW')
      .flatMap((op) => op.selection.words.map(({ id }) => id)),
  );
  await readOnly(db.learning, async (tx) => {
    const invalid = [];
    for (const op of pending) {
      const valid =
        op.kind === 'flashcards'
          ? await checkPlannedWords(tx, userId, op, pendingNewWords)
          : op.kind !== 'lesson' || (await getPlannedLesson(tx, userId, op));
      if (!valid) invalid.push(op.slot);
    }
    if (invalid.length)
      throw new Error('Tài nguyên hoặc tiến độ đã thay đổi ở các mục: ' + invalid.join(', '));
  });
}

async function findLearningContent(db, userId) {
  const [learned, completed] = await readOnly(db.analytics, (tx) =>
    Promise.all([
      tx.firstLearnedEntity.findMany({
        where: { userId },
        select: { vocabularyId: true, scope: true },
      }),
      tx.completedLessonEntity.findMany({ where: { userId }, select: { lessonId: true } }),
    ]),
  );
  const sharedWord = {
    deletedAt: null,
    word: { not: '' },
    definition: { not: '' },
    progress: { none: { userId } },
    legacyProgress: { none: { userId } },
    id: {
      notIn: learned.filter((word) => word.scope === 'SHARED').map((word) => word.vocabularyId),
    },
  };
  const personalWord = {
    word: { not: '' },
    definition: { not: '' },
    progress: { none: { userId } },
    id: {
      notIn: learned.filter((word) => word.scope === 'PERSONAL').map((word) => word.vocabularyId),
    },
  };
  const stableOrder = [{ createdAt: 'asc' }, { id: 'asc' }];
  return readOnly(db.learning, async (tx) => {
    const [topics, personal, lessons] = await Promise.all([
      tx.vocabularyTopic.findMany({
        where: { deletedAt: null, vocabularies: { some: sharedWord } },
        select: {
          ...wordDates,
          name: true,
          vocabularies: { where: sharedWord, select: wordDates, orderBy: stableOrder, take: 10 },
        },
        orderBy: stableOrder,
      }),
      tx.personalVocabularyTopic.findMany({
        where: { userId, vocabularies: { some: personalWord } },
        select: {
          ...wordDates,
          name: true,
          vocabularies: { where: personalWord, select: wordDates, orderBy: stableOrder, take: 5 },
        },
        orderBy: stableOrder,
      }),
      tx.grammarLesson.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          id: { notIn: completed.map(({ lessonId }) => lessonId) },
          progress: { none: { userId } },
          legacyProgress: { none: { userId, status: 'COMPLETED' } },
        },
        select: { ...wordDates, lessonTitle: true },
        orderBy: stableOrder,
      }),
    ]);
    return { topics, personal, lessons };
  });
}

function at(day, hour, minute = 0) {
  return new Date(Date.parse(day + 'T00:00:00+07:00') + (hour * 60 + minute) * 60_000);
}

function chooseCards(topics, when, exclude = new Set()) {
  for (const topic of topics) {
    if (topic.createdAt > when) continue;
    const words = topic.vocabularies.filter(
      ({ id, createdAt }) => createdAt <= when && !exclude.has(id),
    );
    if (words.length) return { topic, words: words.slice(0, 5) };
  }
  return null;
}

function flashcards(slot, scope, mode, cards, when) {
  return {
    slot,
    kind: 'flashcards',
    scope,
    mode,
    topicId: cards.topic.id,
    title: cards.topic.name,
    startedAt: when.toISOString(),
    completedAt: new Date(when.getTime() + 4 * 60_000).toISOString(),
    selection: {
      topicUpdatedAt: cards.topic.updatedAt.toISOString(),
      words: cards.words.map(({ id, updatedAt }) => ({
        id,
        updatedAt: updatedAt.toISOString(),
        revision: mode === 'NEW' ? '0' : '1',
      })),
    },
  };
}

function examActivity(slot, test, mode, selectedParts, startedAt, accuracyPercent) {
  const durationSeconds = mode === 'FULL' ? 7200 : test.partDurationSeconds;
  const partElapsed = { 2: 13 * 60, 5: 10 * 60, 7: 24 * 60 };
  const elapsed =
    mode === 'FULL' ? 70 * 60 : Math.min(partElapsed[selectedParts[0]], durationSeconds - 30);
  return {
    slot,
    kind: 'exam',
    mode,
    parts: selectedParts,
    testId: test.id,
    title: test.title,
    durationSeconds,
    accuracyPercent,
    catalogHash: test.catalogHash,
    startedAt: startedAt.toISOString(),
    completedAt: new Date(startedAt.getTime() + elapsed * 1_000).toISOString(),
  };
}

export async function createPlan(db, attempts, user) {
  const [exam, learning] = await Promise.allSettled([
    findTest(db, attempts),
    findLearningContent(db, user.id),
  ]);
  const missing = [exam, learning].flatMap((result) =>
    result.status === 'rejected' ? [safeError(result.reason)] : [],
  );
  if (learning.status === 'fulfilled') {
    if (!learning.value.topics.length)
      missing.push('Thiếu chủ đề còn hiệu lực có từ vựng chưa học.');
    if (!learning.value.lessons.length)
      missing.push('Thiếu bài ngữ pháp đã xuất bản mà tài khoản chưa hoàn thành.');
  }
  if (missing.length) throw new Error(missing.join('\n'));
  const test = exam.value;
  const { topics, personal, lessons } = learning.value;
  const today = new Date(Date.now() + 7 * hourMs).toISOString().slice(0, 10);
  const days = [7, 5, 3, 2, 1]
    .map((offset) =>
      new Date(Date.parse(today + 'T00:00:00Z') - offset * dayMs).toISOString().slice(0, 10),
    )
    .filter((day) => {
      const first = at(day, 16, 25);
      return (
        user.createdAt <= first &&
        test.availableAt <= at(day, 17).getTime() &&
        Boolean(chooseCards(topics, first))
      );
    });
  if (days.length < 3)
    throw new Error(
      'Thiếu ngày hợp lệ. Cần ít nhất 3 ngày sau khi tài khoản và tài nguyên đã tồn tại.',
    );

  const first = days[0];
  const second = days[1];
  const middle = days[Math.floor(days.length / 2)];
  const penultimate = days.at(-2);
  const last = days.at(-1);
  const initial = chooseCards(topics, at(first, 16, 25));
  const initialIds = new Set(initial.words.map(({ id }) => id));
  const extra = chooseCards(topics, at(second, 16, 45), initialIds);
  const owned = chooseCards(personal, at(last, 19, 30));
  let lessonAt = at(penultimate, 19);
  let lesson = lessons.find(({ createdAt }) => createdAt <= lessonAt);
  if (!lesson) {
    lessonAt = at(last, 19, 10);
    lesson = lessons.find(({ createdAt }) => createdAt <= lessonAt);
  }
  if (!lesson) throw new Error('Bài ngữ pháp chưa tồn tại trong khoảng ngày có thể tạo lịch sử.');
  const activities = [
    flashcards('shared-new-1', 'SHARED', 'NEW', initial, at(first, 16, 25)),
    examActivity('full-1', test, 'FULL', parts, at(first, 17), 55),
    examActivity('part-2', test, 'PART', [2], at(second, 16), 76),
    flashcards('shared-review', 'SHARED', 'REVIEW', initial, at(middle, 16, 25)),
    examActivity('full-2', test, 'FULL', parts, at(middle, 17), 65),
    examActivity('part-5', test, 'PART', [5], at(penultimate, 18, 30), 45),
    {
      slot: 'lesson',
      kind: 'lesson',
      lessonId: lesson.id,
      title: lesson.lessonTitle,
      updatedAt: lesson.updatedAt.toISOString(),
      completedAt: lessonAt.toISOString(),
    },
    examActivity('full-3', test, 'FULL', parts, at(last, 17), 78),
    examActivity('part-7', test, 'PART', [7], at(last, 18, 40), 70),
  ];
  if (extra)
    activities.push(flashcards('shared-new-2', 'SHARED', 'NEW', extra, at(second, 16, 45)));
  if (owned)
    activities.push(flashcards('personal-new', 'PERSONAL', 'NEW', owned, at(last, 19, 30)));
  activities.sort(
    (a, b) => a.completedAt.localeCompare(b.completedAt) || a.slot.localeCompare(b.slot),
  );
  return {
    days,
    activities,
    skipped: [
      ...(!extra ? ['Phiên học từ mới thứ hai: thiếu từ đủ điều kiện.'] : []),
      ...(!owned ? ['Phiên cá nhân: tài khoản chưa có từ vựng phù hợp.'] : []),
    ],
  };
}
