import { isScoredMockTest } from '../dashboard/selectors';
import type { PartId } from '../exams/types';
import type {
  ActivityBucket,
  AnalyticsAttempt,
  AnalyticsFilters,
  AnalyticsSnapshot,
  PartSummary,
} from './types';

export const defaultAnalyticsFilters: AnalyticsFilters = {
  range: 'LAST_30_DAYS',
  mode: 'all',
  scope: 'all',
};
export const analyticsRanges = {
  LAST_7_DAYS: '7 ngày',
  LAST_30_DAYS: '30 ngày',
  LAST_90_DAYS: '90 ngày',
  ALL_TIME: 'Toàn bộ',
} as const;
export const analyticsModes = {
  all: 'Tất cả chế độ',
  PRACTICE: 'PRACTICE · Luyện tập',
  MOCK_TEST: 'MOCK_TEST · Thi thử',
} as const;
export const analyticsScopes = {
  all: 'Tất cả phạm vi',
  full: 'Toàn bộ đề',
  parts: 'Một phần đề',
} as const;
const dayMs = 86_400_000;
const titles = [
  'Mô tả hình ảnh',
  'Hỏi và đáp',
  'Hội thoại ngắn',
  'Bài nói ngắn',
  'Hoàn thành câu',
  'Hoàn thành đoạn văn',
  'Đọc hiểu',
];

export function parseAnalyticsFilters(
  query: Record<string, string | string[] | undefined>,
): AnalyticsFilters {
  const value = <T extends string>(
    candidate: string | string[] | undefined,
    allowed: Record<T, string>,
    fallback: T,
  ): T =>
    typeof candidate === 'string' && Object.hasOwn(allowed, candidate)
      ? (candidate as T)
      : fallback;
  return {
    range: value(query.range, analyticsRanges, defaultAnalyticsFilters.range),
    mode: value(query.mode, analyticsModes, 'all'),
    scope: value(query.scope, analyticsScopes, 'all'),
  };
}

export function inAnalyticsWindow(
  timestamp: string,
  snapshotAt: string,
  range: AnalyticsFilters['range'],
): boolean {
  const time = Date.parse(timestamp);
  const end = Date.parse(snapshotAt);
  const days = range === 'LAST_7_DAYS' ? 7 : range === 'LAST_30_DAYS' ? 30 : 90;
  return (
    Number.isFinite(time) &&
    Number.isFinite(end) &&
    time <= end &&
    (range === 'ALL_TIME' || time >= end - days * dayMs)
  );
}

export function isEligibleAnalyticsScore(attempt: AnalyticsAttempt): boolean {
  return (
    attempt.gradingStatus === 'GRADED' &&
    attempt.toeicEligibility === 'eligible' &&
    attempt.scope === 'full' &&
    isScoredMockTest(attempt)
  );
}

export function analyticsDate(timestamp: string, timezone: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

function dayKey(timestamp: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

function activityBuckets(
  data: AnalyticsSnapshot,
  filters: AnalyticsFilters,
  learning: AnalyticsSnapshot['learning'],
  attempts: AnalyticsAttempt[],
): ActivityBucket[] {
  const buckets = new Map<string, ActivityBucket>();
  const add = (timestamp: string, kind: 'vocabulary' | 'grammar' | 'exams', quantity: number) => {
    const day = dayKey(timestamp, data.timezone);
    let key = day;
    if (filters.range === 'LAST_30_DAYS') {
      const date = new Date(`${day}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      key = date.toISOString().slice(0, 10);
    } else if (filters.range !== 'LAST_7_DAYS') key = day.slice(0, 7);
    const label =
      key.length === 7
        ? `${key.slice(5)}/${key.slice(0, 4)}`
        : `${filters.range === 'LAST_30_DAYS' ? 'Tuần ' : ''}${key.slice(8)}/${key.slice(5, 7)}`;
    const bucket = buckets.get(key) ?? { key, label, vocabulary: 0, grammar: 0, exams: 0 };
    bucket[kind] += quantity;
    buckets.set(key, bucket);
  };
  learning.forEach((fact) => add(fact.occurredAt, fact.kind, fact.quantity));
  attempts.forEach((attempt) => add(attempt.completedAt, 'exams', 1));
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function selectAnalytics(data: AnalyticsSnapshot, filters: AnalyticsFilters) {
  // IDs are unique facts in this demo contract; protect counts/eligibility against duplicate events.
  const attempts = [
    ...new Map(data.attempts.map((attempt) => [attempt.attemptId, attempt])).values(),
  ].filter(
    (attempt) =>
      inAnalyticsWindow(attempt.completedAt, data.snapshotAt, filters.range) &&
      (filters.mode === 'all' || attempt.mode === filters.mode) &&
      (filters.scope === 'all' || attempt.scope === filters.scope),
  );
  const learning = [...new Map(data.learning.map((fact) => [fact.id, fact])).values()].filter(
    (fact) =>
      Number.isInteger(fact.quantity) &&
      fact.quantity > 0 &&
      inAnalyticsWindow(fact.occurredAt, data.snapshotAt, filters.range),
  );
  const scores = attempts
    .filter(isEligibleAnalyticsScore)
    .sort(
      (a, b) =>
        Date.parse(a.completedAt) - Date.parse(b.completedAt) ||
        a.attemptId.localeCompare(b.attemptId),
    );
  const recent = scores
    .filter((attempt) => inAnalyticsWindow(attempt.completedAt, data.snapshotAt, 'LAST_30_DAYS'))
    .reverse();
  const fixture = data.prediction;
  const prediction =
    recent.length >= 3 &&
    fixture?.source === 'demo-fixture' &&
    fixture.supportingAttemptIds.length === 3 &&
    new Set(fixture.supportingAttemptIds).size === 3 &&
    recent
      .slice(0, 3)
      .every((attempt, index) => attempt.attemptId === fixture.supportingAttemptIds[index]) &&
    Number.isInteger(fixture.score) &&
    fixture.score >= 10 &&
    fixture.score <= 990 &&
    fixture.score % 5 === 0
      ? fixture.score
      : null;
  const parts: PartSummary[] = titles.map((title, index) => {
    const partId = (index + 1) as PartId;
    const rows = attempts.flatMap((attempt) => {
      if (attempt.gradingStatus !== 'GRADED' || !attempt.selectedPartIds.includes(partId))
        return [];
      const matches = attempt.partResults.filter((row) => row.partId === partId);
      if (matches.length !== 1) return [];
      const row = matches[0];
      return Number.isInteger(row.correct) &&
        Number.isInteger(row.total) &&
        row.total > 0 &&
        row.correct >= 0 &&
        row.correct <= row.total
        ? [row]
        : [];
    });
    const correct = rows.reduce((sum, row) => sum + row.correct, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return {
      partId,
      title,
      correct,
      total,
      samples: rows.length,
      accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : null,
    };
  });
  const quantity = (kind: 'vocabulary' | 'grammar') => {
    const facts = learning.filter((fact) => fact.kind === kind);
    return facts.length ? facts.reduce((sum, fact) => sum + fact.quantity, 0) : null;
  };
  const days = new Set([
    ...learning.map((fact) => dayKey(fact.occurredAt, data.timezone)),
    ...attempts.map((attempt) => dayKey(attempt.completedAt, data.timezone)),
  ]);
  return {
    attempts,
    scores,
    parts,
    prediction,
    predictionCount: recent.length,
    vocabulary: quantity('vocabulary'),
    grammar: quantity('grammar'),
    studyDays: days.size || null,
    latestScore: scores.at(-1)?.totalScore ?? null,
    weakParts: parts
      .filter((part) => part.accuracy !== null)
      .sort((a, b) => a.accuracy! - b.accuracy! || a.partId - b.partId)
      .slice(0, 3),
    buckets: activityBuckets(data, filters, learning, attempts),
  };
}

export type AnalyticsSelection = ReturnType<typeof selectAnalytics>;
