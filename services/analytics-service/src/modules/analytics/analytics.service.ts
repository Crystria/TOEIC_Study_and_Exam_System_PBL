import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsQueries, Tx } from './analytics.queries';
import {
  AnalyticsClock,
  calendarStart,
  vietnamDay,
  DAY,
  streak as calculateStreak,
} from './calculations';
import { PageQueryDto, ProgressQueryDto, TimeRange } from './dto/progress-query.dto';
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: PrismaService,
    private readonly queries: AnalyticsQueries,
    private readonly clock: AnalyticsClock,
  ) {}
  private read<T>(run: (tx: Tx, asOf: Date) => Promise<T>) {
    const asOf = this.clock.now();
    return this.db.$transaction((tx) => run(tx, asOf), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  getProgress(userId: string, query: ProgressQueryDto) {
    return this.read(async (tx, asOf) => {
      const from =
        query.timeRange === TimeRange.ALL_TIME
          ? null
          : calendarStart(asOf, query.timeRange === TimeRange.LAST_7_DAYS ? 7 : 30);
      const lifetime = await this.queries.counters(tx, userId, asOf, null),
        inRange = from ? await this.queries.counters(tx, userId, asOf, from) : lifetime,
        prediction = await this.queries.prediction(tx, userId, asOf),
        weak = await this.queries.weak(tx, userId, asOf),
        trend = await this.queries.trend(
          tx,
          userId,
          asOf,
          from,
          query.cursor,
          query.limit,
          query.timeRange,
        ),
        stat = await tx.userStatistic.findUnique({ where: { userId } }),
        days = await this.queries.days(tx, userId, asOf);
      const streak = calculateStreak(
          days.map((r) => r.date),
          asOf,
        ),
        today = vietnamDay(asOf),
        earliest = from ? vietnamDay(from) : (days[0]?.date ?? today),
        start = Math.max(Date.parse(earliest), Date.parse(today) - 365 * DAY),
        dailyActivity = [];
      const map = new Map(days.map((r) => [r.date, r.count]));
      for (let date = start; date <= Date.parse(today); date += DAY) {
        const day = new Date(date).toISOString().slice(0, 10);
        dailyActivity.push({ date: day, count: map.get(day) ?? 0 });
      }
      return {
        timeRange: query.timeRange,
        timezone: 'Asia/Ho_Chi_Minh',
        from: from?.toISOString() ?? null,
        asOf: asOf.toISOString(),
        lifetime,
        inRange,
        learningStreakDays: streak.learningStreakDays,
        longestStreak: streak.longestStreak,
        vocabulariesLearned: lifetime.vocabulariesLearned,
        grammarLessonsCompleted: lifetime.grammarLessonsCompleted,
        mockTestCount: lifetime.mockTestCount,
        practiceCount: lifetime.practiceCount,
        scoreTrend: trend.items,
        scoreTrendNextCursor: trend.nextCursor,
        predictedToeicScore: prediction.predictedToeicScore,
        weakAreas: weak.items,
        updatedAt: stat?.updatedAt.toISOString() ?? null,
        dailyActivity,
        dailyActivityTruncated: start > Date.parse(earliest),
      };
    });
  }
  private async history(userId: string, query: PageQueryDto, mode: 'FULL' | 'PART') {
    const asOf = this.clock.now(),
      offset = (query.page - 1) * query.size;
    // Count and page share one statement snapshot, including an empty/out-of-range page.
    const [row] = await this.db.$queryRaw<Array<{ total: bigint; items: Prisma.JsonValue[] }>>`
      WITH history AS MATERIALIZED (
        SELECT attempt_id,completed_at,payload FROM attempt_facts
        WHERE user_id=${userId} AND mode=${mode} AND completed_at<=${asOf}
      ), page AS (SELECT * FROM history ORDER BY completed_at DESC,attempt_id ASC
        OFFSET ${offset} LIMIT ${query.size})
      SELECT (SELECT count(*) FROM history) AS total,
        coalesce((SELECT jsonb_agg(payload ORDER BY completed_at DESC,attempt_id ASC) FROM page),'[]'::jsonb) AS items`;
    const total = Number(row.total);
    if (!Number.isSafeInteger(total)) throw Error('ANALYTICS_COUNT_OVERFLOW');
    return {
      items: row.items,
      total,
      page: query.page,
      size: query.size,
      totalPages: Math.ceil(total / query.size),
    };
  }
  getScores(userId: string, query: PageQueryDto) {
    return this.history(userId, query, 'FULL');
  }
  getPractices(userId: string, query: PageQueryDto) {
    return this.history(userId, query, 'PART');
  }
  getStreak(userId: string) {
    return this.queries.streak(this.db, userId, this.clock.now());
  }
  getPrediction(userId: string) {
    return this.queries.prediction(this.db, userId, this.clock.now());
  }
  getWeakAreas(userId: string) {
    return this.queries.weak(this.db, userId, this.clock.now());
  }
}
