import { gateway } from './client';
import {
  list,
  page,
  parseAnalyticsProgress,
  parseCompletion,
  parseLesson,
  parseLearningProgress,
  parseResult,
  parseReview,
  parseScores,
  parseStreak,
  parseTest,
  parseTopic,
  parseUser,
  parseWord,
  record,
  count,
  number,
  text,
  boolean,
  segment,
  matchingId,
  ContractError,
} from './contracts';
import { query } from './query';

export const learningApi = {
  topics: (signal?: AbortSignal) =>
    gateway('learning/vocabulary-topics', { signal }).then((v) => list(v, parseTopic)),
  words: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`learning/vocabularies?${query('words', params)}`, { signal }).then((v) =>
      page(v, parseWord),
    ),
  lessons: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`learning/lessons?${query('lessons', params)}`, { signal }).then((v) =>
      list(v, parseLesson),
    ),
  lesson: (id: string, signal?: AbortSignal) =>
    gateway(`learning/lessons/${segment(id)}`, { signal }).then((v) =>
      matchingId(parseLesson(v), id),
    ),
  progress: (signal?: AbortSignal) =>
    gateway('learning/progress', { signal }).then(parseLearningProgress),
  due: (signal?: AbortSignal) =>
    gateway('learning/review-today', { signal }).then((v) =>
      list(v, (value) => {
        const r = record(value);
        const review = parseReview(r);
        return { ...review, word: matchingId(parseWord(r.vocabulary), review.vocabularyId) };
      }),
    ),
  async review(id: string, quality: number) {
    if (!Number.isInteger(quality) || quality < 0 || quality > 5)
      throw new Error('Chất lượng nhớ phải từ 0 đến 5.');
    const result = parseReview(
      await gateway(`learning/flashcards/${segment(id)}/review`, {
        method: 'POST',
        body: { quality },
      }),
    );
    if (result.vocabularyId !== id)
      throw new Error('Server xác nhận sai từ vựng. Hãy tải lại lịch ôn.');
    return result;
  },
  async complete(id: string) {
    const result = parseCompletion(
      await gateway(`learning/lessons/${segment(id)}/complete`, { method: 'POST' }),
    );
    if (result.lessonId !== id)
      throw new Error('Server xác nhận sai bài học. Hãy tải lại tiến độ.');
    return result;
  },
};
export const examApi = {
  list: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`tests?${query('tests', params)}`, { signal }).then((v) => page(v, parseTest)),
  detail: (id: string, signal?: AbortSignal) =>
    gateway(`tests/${segment(id)}`, { signal }).then((v) => matchingId(parseTest(v), id)),
  result: (id: string, signal?: AbortSignal) =>
    gateway(`attempts/${segment(id)}`, { signal }).then((v) => {
      const result = parseResult(v);
      if (result.attemptId !== id) throw new ContractError('attempt.attemptId');
      return result;
    }),
};
export const analyticsApi = {
  progress: (range: string, signal?: AbortSignal) =>
    gateway(
      `analytics/progress?${query('analytics', new URLSearchParams({ time_range: range }))}`,
      { signal },
    ).then((v) => {
      const result = parseAnalyticsProgress(v);
      if (result.timeRange !== range) throw new ContractError('analytics.timeRange');
      return result;
    }),
  streak: (signal?: AbortSignal) => gateway('analytics/streak', { signal }).then(parseStreak),
  scores: (signal?: AbortSignal) => gateway('analytics/scores', { signal }).then(parseScores),
  weakAreas: (signal?: AbortSignal) =>
    gateway('analytics/weak-areas', { signal }).then((v) =>
      list(record(v).items, (value) => {
        const r = record(value),
          errorRate = number(r.errorRate);
        if (errorRate < 0 || errorRate > 1) throw new Error('Tỷ lệ lỗi server không hợp lệ.');
        return {
          skillArea: text(r.skillArea),
          part: count(r.part),
          errorRate,
          sampleCount: count(r.sampleCount),
        };
      }),
    ),
  prediction: (signal?: AbortSignal) =>
    gateway('analytics/prediction', { signal }).then((v) => {
      const r = record(v),
        available = boolean(r.available);
      return {
        available,
        reason: available ? 'Công thức dự đoán backend chưa khớp đặc tả.' : text(r.reason),
        recentAttempts: count(r.recentAttempts),
        method: available ? text(r.method) : null,
      };
    }),
};
export const profileApi = {
  read: (signal?: AbortSignal) => gateway('users/me', { signal }).then(parseUser),
  update: (fullName: string, phoneNumber: string) =>
    gateway('users/me', {
      method: 'PATCH',
      body: { fullName: fullName.trim(), phoneNumber: phoneNumber.trim() },
    }).then(parseUser),
};

export const EXAM_BLOCKERS = [
  'Backend chưa nhận chế độ PRACTICE/TEST và danh sách Part khi tạo phiên.',
  'Chưa lưu và kiểm tra deadline phía server; chưa có response khôi phục câu hỏi và deadline sau reload.',
  'Chưa có cơ chế chống tạo/nộp trùng sau lỗi mạng và quy đổi điểm TOEIC đã xác nhận.',
] as const;
