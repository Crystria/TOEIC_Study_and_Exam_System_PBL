import { Injectable } from '@nestjs/common';
export const TIMEZONE = 'Asia/Ho_Chi_Minh',
  DAY = 86400000;
@Injectable()
export class AnalyticsClock {
  now(): Date {
    return new Date();
  }
}
export function vietnamDay(at: Date): string {
  return new Date(at.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function calendarStart(asOf: Date, days: number): Date {
  return new Date(
    new Date(vietnamDay(asOf) + 'T00:00:00.000Z').getTime() - (days - 1) * DAY - 7 * 3600000,
  );
}
export function streak(days: string[], asOf: Date) {
  const dates = [...new Set(days)].filter((d) => d <= vietnamDay(asOf)).sort();
  let longest = 0,
    run = 0,
    last: string | null = null;
  for (const date of dates) {
    run = last && Date.parse(date) - Date.parse(last) === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = date;
  }
  const age = last ? (Date.parse(vietnamDay(asOf)) - Date.parse(last)) / DAY : Infinity;
  return {
    learningStreakDays: age <= 1 ? run : 0,
    longestStreak: longest,
    lastActivityDate: last,
    timezone: TIMEZONE,
    asOf: asOf.toISOString(),
  };
}
export function prediction(
  rows: Array<{ attemptId: string; totalScore: number; completedAt: Date }>,
  asOf: Date,
  eligibleFullCount = rows.length,
) {
  const selected = rows
    .filter((r) => r.completedAt.getTime() >= asOf.getTime() - 30 * DAY && r.completedAt <= asOf)
    .sort(
      (a, b) =>
        b.completedAt.getTime() - a.completedAt.getTime() || a.attemptId.localeCompare(b.attemptId),
    )
    .slice(0, 3);
  return {
    predictedToeicScore:
      selected.length < 3
        ? null
        : Math.max(
            10,
            Math.min(
              990,
              5 *
                Math.floor(
                  (5 * selected[0].totalScore +
                    3 * selected[1].totalScore +
                    2 * selected[2].totalScore +
                    25) /
                    50,
                ),
            ),
          ),
    eligibleFullCount,
    usedAttemptIds: selected.length < 3 ? [] : selected.map((r) => r.attemptId),
    reason: selected.length < 3 ? 'INSUFFICIENT_FULL_ATTEMPTS' : null,
    method: 'WEIGHTED_LATEST_3_FULL',
    windowDays: 30,
    asOf: asOf.toISOString(),
  };
}
export function weakAreas(
  rows: Array<{ part: number; correct: number; total: number }>,
  asOf: Date,
) {
  return Array.from({ length: 7 }, (_, i) => {
    const subset = rows.filter((r) => r.part === i + 1),
      correct = subset.reduce((s, r) => s + r.correct, 0),
      total = subset.reduce((s, r) => s + r.total, 0),
      available = total >= 20;
    return {
      part: i + 1,
      status: available ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
      correct,
      total,
      weaknessScore: available ? Math.round(((total - correct) / total) * 1e6) / 1e6 : null,
      isWeak: available ? (total - correct) * 10 >= total * 3 : null,
      calculatedAt: asOf.toISOString(),
    };
  });
}
