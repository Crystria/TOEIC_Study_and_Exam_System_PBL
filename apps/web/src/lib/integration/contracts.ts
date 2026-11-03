/** Runtime validation at the Gateway boundary. No fixture types are API contracts. */
export class ContractError extends Error {
  constructor(readonly field: string) {
    super(`Dữ liệu server không hợp lệ: ${field}.`);
  }
}
export function record(value: unknown, field = 'response'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ContractError(field);
  return Object.fromEntries(Object.entries(value));
}
export function list<T>(value: unknown, parse: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new ContractError('array');
  return value.map(parse);
}
export function text(value: unknown, field = 'text'): string {
  if (typeof value !== 'string') throw new ContractError(field);
  return value;
}
export function id(value: unknown): string {
  const result = text(value, 'id');
  if (!result.trim()) throw new ContractError('id');
  return result;
}
/** A valid shape alone cannot acknowledge a different entity. */
export function matchingId<T extends { id: string }>(value: T, expected: string): T {
  if (value.id !== expected) throw new ContractError('response.id');
  return value;
}
export function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}
export function number(value: unknown, field = 'number'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ContractError(field);
  return value;
}
export function count(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new ContractError('count');
  return result;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ContractError('boolean');
  return value;
}
export function date(value: unknown): string {
  const result = text(value, 'date');
  if (!Number.isFinite(Date.parse(result))) throw new ContractError('date');
  return result;
}
export function mediaUrl(value: unknown): string | null {
  const source = optionalText(value);
  if (!source) return null;
  try {
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href; // Only a complete URL supplied by the server; never an object key.
  } catch {
    return null;
  }
}
export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  status: string;
  roles: string[];
}
export function parseUser(value: unknown): User {
  const r = record(value);
  return {
    id: id(r.userId),
    email: text(r.email),
    fullName: text(r.fullName),
    phoneNumber: optionalText(r.phoneNumber),
    avatarUrl: mediaUrl(r.avatarUrl),
    status: text(r.status),
    roles: list(r.roles, (role) => text(role)),
  };
}
export function parseTokens(value: unknown) {
  const r = record(value);
  return { accessToken: id(r.accessToken), refreshToken: id(r.refreshToken) };
}
export function parseSessionUser(value: unknown): User {
  const r = record(value);
  return parseUser({ ...r, userId: r.id });
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
export function page<T>(value: unknown, parse: (item: unknown) => T): Page<T> {
  const r = record(value);
  const result = {
    items: list(r.items, parse),
    total: count(r.total),
    page: count(r.page),
    size: count(r.size),
  };
  if (!result.page || !result.size || result.size > 50 || result.items.length > result.size)
    throw new ContractError('pagination');
  return result;
}
export function parseTopic(value: unknown) {
  const r = record(value);
  return {
    id: id(r.topicId),
    name: text(r.topicName),
    description: null,
    wordCount: count(r.vocabularyCount),
  };
}
export function parseWord(value: unknown) {
  const r = record(value);
  return {
    id: id(r.vocabularyId),
    topicId: id(r.topicId),
    word: text(r.word),
    meaning: text(r.definition),
    pronunciation: optionalText(r.phonetic),
    example: optionalText(r.example),
    audioUrl: mediaUrl(r.audioUrl),
    imageUrl: mediaUrl(r.imageUrl),
  };
}
export function parseLesson(value: unknown) {
  const r = record(value);
  return {
    id: id(r.lessonId),
    title: text(r.lessonTitle),
    content: text(r.contentMarkdown),
    level: text(r.category),
    status: text(r.status),
  };
}
export function parseLearningProgress(value: unknown) {
  const r = record(value);
  return {
    vocabulary: {
      reviewed: count(r.reviewedVocabularies),
      dueToday: count(r.dueVocabularies),
      learned: count(r.vocabulariesLearned),
    },
    lessons: { completed: count(r.grammarLessonsCompleted) },
  };
}
export function parseTest(value: unknown) {
  const r = record(value);
  const durationSeconds = count(r.durationSeconds);
  if (!durationSeconds) throw new ContractError('test');
  const questions =
    r.questions === undefined
      ? null
      : list(r.questions, (value) => {
          const q = record(value),
            part = count(q.part),
            orderNo = count(q.orderNo);
          if (part < 1 || part > 7 || !orderNo) throw new ContractError('test.questions');
          return { questionId: id(q.questionId), part, orderNo };
        });
  return {
    id: id(r.testId),
    title: text(r.title),
    type: 'FULL',
    status: r.deletedAt == null ? 'ACTIVE' : 'ARCHIVED',
    durationSeconds,
    questionCount: questions ? questions.length : count(r.totalQuestions),
    questions,
  };
}
export function parseQuestionSummary(value: unknown) {
  const r = record(value),
    part = count(r.part);
  if (part < 1 || part > 7) throw new ContractError('question.part');
  return {
    id: id(r.questionId),
    part,
    type: text(r.type),
    stem: optionalText(r.questionText) ?? '',
    difficulty: text(r.difficulty),
    status: r.isComplete === true ? 'COMPLETE' : 'INCOMPLETE',
    tags: list(r.tags, (v) => text(v)),
    groupId: optionalText(r.groupId),
  };
}
export function parseQuestion(value: unknown) {
  const r = record(value);
  const summary = parseQuestionSummary(r);
  const options = list(r.options, (value) => {
    const o = record(value);
    return {
      optionKey: text(o.optionCode),
      content: text(o.optionText),
      isCorrect: text(o.optionCode) === text(r.correctOption),
      mediaUrl: null,
    };
  });
  return {
    ...summary,
    options,
    explanation: optionalText(r.explanation),
    mediaUrl: mediaUrl(r.audioUrl) ?? mediaUrl(r.imageUrl),
  };
}
export function parseAudit(value: unknown) {
  const r = record(value);
  return {
    id: id(r.auditId),
    actorId: optionalText(r.actorUserId),
    action: text(r.action),
    resourceType: 'USER',
    resourceId: optionalText(r.targetUserId),
    createdAt: date(r.occurredAt),
    metadata: { before: r.beforeData ?? null, after: r.afterData ?? null },
  };
}
export function parseAnalyticsProgress(value: unknown) {
  const r = record(value),
    l = record(r.lifetime),
    activities = record(r.inRange);
  return {
    timeRange: text(r.timeRange),
    lifetime: {
      totalStudyDays: count(l.studyDays),
      totalLessons: count(l.grammarLessonsCompleted),
      totalVocabLearned: count(l.vocabulariesLearned),
    },
    activities: Object.fromEntries(
      Object.entries(activities).map(([key, value]) => [key, count(value)]),
    ),
    predictedToeicScore: r.predictedToeicScore == null ? null : count(r.predictedToeicScore),
    dailyActivity: list(r.dailyActivity, (value) => {
      const d = record(value);
      return { date: date(d.date), count: count(d.count) };
    }),
    scoreTrend: list(r.scoreTrend, (value) => {
      const s = record(value);
      return {
        attemptId: id(s.attemptId),
        completedAt: date(s.completedAt),
        totalScore: count(s.totalScore),
      };
    }),
    trendTruncated: r.scoreTrendNextCursor != null,
    nextCursor: optionalText(r.scoreTrendNextCursor),
    dailyActivityTruncated: r.dailyActivityTruncated === true,
    weakAreas: list(r.weakAreas, (value) => {
      const p = record(value);
      return {
        part: count(p.part),
        correct: count(p.correct),
        total: count(p.total),
        isWeak: p.isWeak === true,
      };
    }),
  };
}
export function parseStreak(value: unknown) {
  const r = record(value);
  return { current: count(r.learningStreakDays), longest: count(r.longestStreak) };
}
export const segment = (value: string) => {
  if (!value.trim() || /^(demo-|local-)/i.test(value))
    throw new ContractError('API id (demo ID rejected)');
  return encodeURIComponent(value);
};
