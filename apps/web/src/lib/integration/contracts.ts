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
    id: id(r.id),
    email: text(r.email),
    fullName: text(r.fullName),
    phoneNumber: optionalText(r.phoneNumber),
    avatarUrl: mediaUrl(r.avatarUrl),
    status: text(r.status),
    roles: list(r.roles, (role) => text(record(role).code)),
  };
}
export function parseTokens(value: unknown) {
  const r = record(value);
  return { accessToken: id(r.accessToken), refreshToken: id(r.refreshToken) };
}
export function parseSessionUser(value: unknown): User {
  const r = record(value);
  return parseUser({ ...r, roles: list(r.roles, (value) => ({ code: text(value) })) });
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
    id: id(r.id),
    name: text(r.name),
    description: optionalText(r.description),
    wordCount: count(record(r._count).vocabularies),
  };
}
export function parseWord(value: unknown) {
  const r = record(value);
  return {
    id: id(r.id),
    topicId: id(r.topicId),
    word: text(r.word),
    meaning: text(r.meaning),
    pronunciation: optionalText(r.pronunciation),
    example: optionalText(r.example),
    audioUrl: mediaUrl(r.audioUrl),
    imageUrl: mediaUrl(r.imageUrl),
  };
}
export function parseLesson(value: unknown) {
  const r = record(value);
  return {
    id: id(r.id),
    title: text(r.title),
    content: text(r.content),
    level: text(r.level),
    status: text(r.status),
  };
}
export function parseLearningProgress(value: unknown) {
  const r = record(value),
    v = record(r.vocabulary),
    l = record(r.lessons);
  return {
    vocabulary: { total: count(v.total), reviewed: count(v.reviewed), dueToday: count(v.dueToday) },
    lessons: { total: count(l.total), completed: count(l.completed) },
  };
}
export function parseReview(value: unknown) {
  const r = record(value);
  return {
    vocabularyId: id(r.vocabularyId),
    repetition: count(r.repetition),
    interval: count(r.interval),
    nextReviewAt: r.nextReviewAt == null ? null : date(r.nextReviewAt),
  };
}
export function parseCompletion(value: unknown) {
  const r = record(value);
  if (r.status !== 'COMPLETED') throw new ContractError('completion.status');
  return { lessonId: id(r.lessonId), completedAt: date(r.completedAt) };
}
export function parseTest(value: unknown) {
  const r = record(value);
  const durationSeconds = count(r.durationSeconds);
  if (!durationSeconds || !['FULL', 'MINI'].includes(text(r.type))) throw new ContractError('test');
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
    id: id(r.id),
    title: text(r.title),
    type: text(r.type),
    status: text(r.status),
    durationSeconds,
    questionCount: questions ? questions.length : count(record(r._count).questions),
    questions,
  };
}
export function parseQuestionSummary(value: unknown) {
  const r = record(value),
    part = count(r.part);
  if (part < 1 || part > 7) throw new ContractError('question.part');
  return {
    id: id(r.id),
    part,
    type: text(r.type),
    stem: text(r.stem),
    difficulty: text(r.difficulty),
    status: text(r.status),
    tags: list(r.tags, (v) => text(v)),
  };
}
export function parseQuestion(value: unknown) {
  const r = record(value);
  const summary = parseQuestionSummary({
    ...r,
    tags: list(r.tags, (v) => text(record(record(v).tag).name)),
  });
  const options = list(r.options, (value) => {
    const o = record(value);
    return {
      optionKey: text(o.optionKey),
      content: text(o.content),
      isCorrect: boolean(o.isCorrect),
      mediaUrl: mediaUrl(o.mediaUrl),
    };
  });
  return {
    ...summary,
    options,
    explanation: optionalText(r.explanation),
    mediaUrl: mediaUrl(r.mediaUrl),
  };
}
export function parseAudit(value: unknown) {
  const r = record(value);
  return {
    id: id(r.id),
    actorId: optionalText(r.userId),
    action: text(r.action),
    resourceType: optionalText(r.targetType),
    resourceId: optionalText(r.targetId),
    createdAt: date(r.createdAt),
    metadata: r.metadata ?? null,
  };
}
export function parseAnalyticsProgress(value: unknown) {
  const r = record(value),
    l = record(r.lifetime),
    activities = record(r.activitiesInRange);
  return {
    timeRange: text(r.timeRange),
    lifetime: {
      totalStudyDays: count(l.totalStudyDays),
      totalLessons: count(l.totalLessons),
      totalVocabLearned: count(l.totalVocabLearned),
    },
    activities: Object.fromEntries(
      Object.entries(activities).map(([key, value]) => [key, count(value)]),
    ),
  };
}
export function parseStreak(value: unknown) {
  const r = record(value);
  return { current: count(r.currentStreak), longest: count(r.longestStreak) };
}
export function parseScores(value: unknown) {
  return list(record(value).items, (value) => {
    const r = record(value);
    // score intentionally excluded: source currently emits raw correct-count as score.
    return { attemptId: id(r.attemptId), testType: text(r.testType), takenAt: date(r.takenAt) };
  });
}
export function parseResult(value: unknown) {
  const r = record(value);
  if (!['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'].includes(text(r.status)))
    throw new ContractError('attempt.status');
  return {
    attemptId: id(r.attemptId),
    testId: id(r.testId),
    title: optionalText(r.testTitle),
    status: text(r.status),
    totalCorrect:
      r.status === 'IN_PROGRESS' || r.totalCorrect == null ? null : count(r.totalCorrect),
    answers: list(r.answers, (value) => {
      const a = record(value);
      return {
        questionId: id(a.questionId),
        selectedOption: optionalText(a.selectedOption),
        isCorrect: r.status === 'IN_PROGRESS' || a.isCorrect == null ? null : boolean(a.isCorrect),
      };
    }),
  };
}
export const segment = (value: string) => {
  if (!value.trim() || /^(demo-|local-)/i.test(value))
    throw new ContractError('API id (demo ID rejected)');
  return encodeURIComponent(value);
};
