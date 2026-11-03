import { gateway } from './client';
import {
  list,
  page,
  parseAnalyticsProgress,
  parseLesson,
  parseLearningProgress,
  parseStreak,
  parseTest,
  parseTopic,
  parseUser,
  parseWord,
  record,
  count,
  text,
  boolean,
  segment,
  matchingId,
  ContractError,
} from './contracts';
import { parseAttempt, parseAttemptHistory } from './attempt-contract';
import { query } from './query';

export function parseProgressSnapshot(value: unknown) {
  const r = record(value),
    state = r.state == null ? null : record(r.state),
    revision = text(r.revision);
  if (!/^(0|[1-9][0-9]*)$/.test(revision)) throw new ContractError('revision');
  return {
    entityId: text(r.entityId),
    entityType: text(r.entityType),
    revision,
    completedAt: state?.completedAt == null ? null : text(state.completedAt),
    nextReviewAt: state?.nextReviewDate == null ? null : text(state.nextReviewDate),
  };
}
function parseOperation(value: unknown) {
  const r = record(value);
  return { operationId: text(r.operationId), progress: list(r.progress, parseProgressSnapshot) };
}
export const learningApi = {
  topics: (signal?: AbortSignal, params = new URLSearchParams()) =>
    gateway(`learning/vocabulary-topics?${query('topics', params)}`, { signal }).then((v) =>
      page(v, parseTopic),
    ),
  words: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`learning/vocabularies?${query('words', params)}`, { signal }).then((v) =>
      page(v, parseWord),
    ),
  lessons: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`learning/lessons?${query('lessons', params)}`, { signal }).then((v) =>
      page(v, parseLesson),
    ),
  lesson: (id: string, signal?: AbortSignal) =>
    gateway(`learning/lessons/${segment(id)}`, { signal }).then((v) =>
      matchingId(parseLesson(v), id),
    ),
  progress: (signal?: AbortSignal) =>
    gateway('learning/progress', { signal }).then(parseLearningProgress),
  due: async (signal?: AbortSignal, params = new URLSearchParams()) => {
    const result = page(
      await gateway(`learning/review-today?${query('words', params)}`, { signal }),
      parseProgressSnapshot,
    );
    const items = await Promise.all(
      result.items.map(async (p) => ({
        vocabularyId: p.entityId,
        revision: p.revision,
        nextReviewAt: p.nextReviewAt,
        word: matchingId(
          parseWord(await gateway(`learning/vocabularies/${segment(p.entityId)}`, { signal })),
          p.entityId,
        ),
      })),
    );
    return { ...result, items };
  },
  async review(id: string, quality: number, revision: string, operationId: string) {
    if (!Number.isInteger(quality) || quality < 0 || quality > 5)
      throw new ContractError('quality');
    const result = parseOperation(
      await gateway(`learning/flashcards/${segment(id)}/review`, {
        method: 'POST',
        body: { quality, baseEntityRevision: revision, operationId },
      }),
    );
    const p = result.progress.find((p) => p.entityId === id && p.entityType === 'VOCABULARY');
    if (result.operationId !== operationId || !p) throw new ContractError('review');
    return p;
  },
  async complete(id: string, revision: string, operationId: string) {
    const result = parseOperation(
      await gateway(`learning/lessons/${segment(id)}/complete`, {
        method: 'POST',
        body: { baseEntityRevision: revision, operationId },
      }),
    );
    const p = result.progress.find((p) => p.entityId === id && p.entityType === 'LESSON');
    if (result.operationId !== operationId || !p?.completedAt)
      throw new ContractError('completion');
    return p;
  },
  async entityProgress(entityId: string, signal?: AbortSignal) {
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const r = record(
        await gateway(
          `sync/users/me?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          { signal },
        ),
      );
      if (r.projectionReady !== true) throw new Error('Tiến độ đang đồng bộ. Vui lòng thử lại.');
      const p = list(r.progress, parseProgressSnapshot).find((p) => p.entityId === entityId);
      if (p) return p;
      cursor = r.nextCursor == null ? null : text(r.nextCursor);
      if (cursor && seen.has(cursor)) throw new ContractError('progress.cursor');
      if (cursor) seen.add(cursor);
    } while (cursor);
    return { entityId, revision: '0', completedAt: null, nextReviewAt: null, entityType: 'LESSON' };
  },
};
export const examApi = {
  list: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`tests?${query('tests', params)}`, { signal }).then((v) => page(v, parseTest)),
  detail: (id: string, signal?: AbortSignal) =>
    gateway(`tests/${segment(id)}`, { signal }).then((v) => matchingId(parseTest(v), id)),
  result: async (id: string, signal?: AbortSignal) => {
    const result = parseAttempt(await gateway(`attempts/${segment(id)}`, { signal }));
    if (result.attemptId !== id) throw new ContractError('attempt.attemptId');
    return result;
  },
  history: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`attempts?${query('attempts', params)}`, { signal }).then((v) =>
      page(v, parseAttemptHistory),
    ),
  parts: async (testId: string, signal?: AbortSignal) => {
    const r = record(await gateway(`tests/${segment(testId)}/parts`, { signal }));
    if (r.testId !== testId) throw new ContractError('parts.testId');
    return list(r.parts, (value) => {
      const p = record(value);
      return {
        part: count(p.part),
        totalQuestions: count(p.totalQuestions),
        available: boolean(p.available),
      };
    });
  },
  async start(
    testId: string,
    mode: string,
    parts: number[],
    durationSeconds: number,
    idempotencyKey: string,
  ) {
    const result = parseAttempt(
      await gateway(`tests/${segment(testId)}/${mode === 'FULL' ? 'attempts' : 'part-attempts'}`, {
        method: 'POST',
        idempotencyKey,
        ...(mode === 'FULL' ? {} : { body: { parts, durationSeconds } }),
      }),
    );
    if (result.testId !== testId || result.mode !== mode) throw new ContractError('start');
    return result;
  },
  async draft(attemptId: string, answers: { questionId: string; selectedOption: string | null }[]) {
    const r = record(
      await gateway(`attempts/${segment(attemptId)}/draft`, { method: 'PUT', body: { answers } }),
    );
    if (r.attemptId !== attemptId || count(r.saved) !== answers.length)
      throw new ContractError('draft');
    return r;
  },
  async submit(
    attemptId: string,
    answers: { questionId: string; selectedOption: string | null }[],
  ) {
    const r = parseAttempt(
      await gateway(`attempts/${segment(attemptId)}/submit`, { method: 'POST', body: { answers } }),
    );
    if (r.attemptId !== attemptId || r.status === 'IN_PROGRESS') throw new ContractError('submit');
    return r;
  },
};
export const analyticsApi = {
  progress: async (range: string, signal?: AbortSignal, cursor?: string) => {
    const r = parseAnalyticsProgress(
      await gateway(
        `analytics/progress?${query('analytics', new URLSearchParams({ timeRange: range, ...(cursor ? { cursor } : {}) }))}`,
        { signal },
      ),
    );
    if (r.timeRange !== range) throw new ContractError('analytics.timeRange');
    return r;
  },
  streak: (signal?: AbortSignal) => gateway('analytics/streak', { signal }).then(parseStreak),
  scores: (signal?: AbortSignal) =>
    gateway('analytics/scores', { signal }).then((v) =>
      list(record(v).items, (value) => {
        const r = record(value);
        return { attemptId: text(r.attemptId), testType: 'FULL', takenAt: text(r.completedAt) };
      }),
    ),
};
export const profileApi = {
  read: (signal?: AbortSignal) => gateway('users/me', { signal }).then(parseUser),
  update: (fullName: string, phoneNumber: string) =>
    gateway('users/me', {
      method: 'PATCH',
      body: { fullName: fullName.trim(), phoneNumber: phoneNumber.trim() || null },
    }).then(parseUser),
};
