import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgressQueryDto, TimeRange } from './dto/progress-query.dto';

const RANGE_DAYS: Record<TimeRange, number | null> = {
  [TimeRange.LAST_7_DAYS]: 7,
  [TimeRange.LAST_30_DAYS]: 30,
  [TimeRange.LAST_90_DAYS]: 90,
  [TimeRange.ALL_TIME]: null,
};

const PREDICTION_MIN_ATTEMPTS = 3;
const PREDICTION_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProgress(userId: string, query: ProgressQueryDto) {
    const since = this.rangeStart(query.time_range);

    const [stat, grouped] = await Promise.all([
      this.prisma.userLearningStat.findUnique({ where: { userId } }),
      this.prisma.learningActivity.groupBy({
        by: ['activityType'],
        where: { userId, ...(since ? { occurredAt: { gte: since } } : {}) },
        _count: { _all: true },
      }),
    ]);

    const activities = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.activityType] = row._count._all;
      return acc;
    }, {});

    return {
      timeRange: query.time_range,
      since: since?.toISOString() ?? null,
      lifetime: {
        totalStudyDays: stat?.totalStudyDays ?? 0,
        totalLessons: stat?.totalLessons ?? 0,
        totalVocabLearned: stat?.totalVocabLearned ?? 0,
        updatedAt: stat?.updatedAt ?? null,
      },
      activitiesInRange: activities,
      totalActivities: Object.values(activities).reduce((sum, value) => sum + value, 0),
    };
  }

  async getScores(userId: string) {
    const items = await this.prisma.scoreHistory.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });

    const scores = items
      .map((item) => item.score)
      .filter((value): value is number => value !== null);
    return {
      items,
      summary: {
        totalAttempts: items.length,
        latest: scores[0] ?? null,
        best: scores.length > 0 ? Math.max(...scores) : null,
        average:
          scores.length > 0
            ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
            : null,
      },
    };
  }

  async getStreak(userId: string) {
    const streak = await this.prisma.dailyStreak.findUnique({ where: { userId } });
    return (
      streak ?? {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
      }
    );
  }

  async getWeakAreas(userId: string) {
    const items = await this.prisma.weakArea.findMany({
      where: { userId },
      orderBy: { errorRate: 'desc' },
    });
    return { items };
  }

  async getPrediction(userId: string) {
    const since = new Date(Date.now() - PREDICTION_WINDOW_DAYS * MS_PER_DAY);
    const recentAttempts = await this.prisma.scoreHistory.findMany({
      where: { userId, takenAt: { gte: since } },
      orderBy: { takenAt: 'asc' },
    });

    const recentScores = recentAttempts
      .map((attempt) => attempt.score)
      .filter((value): value is number => value !== null);

    if (recentScores.length < PREDICTION_MIN_ATTEMPTS) {
      return {
        available: false,
        reason: `Cần tối thiểu ${PREDICTION_MIN_ATTEMPTS} lần nộp bài có điểm trong ${PREDICTION_WINDOW_DAYS} ngày gần nhất`,
        recentAttempts: recentScores.length,
        windowDays: PREDICTION_WINDOW_DAYS,
      };
    }

    const maxScore = recentAttempts.reduce((max, attempt) => {
      const localMax = attempt.testType === 'MINI' ? 495 : 990;
      return Math.max(max, localMax);
    }, 990);

    const weightedAverage = recentScores.reduce((sum, score, index) => {
      const weight = index + 1;
      return sum + score * weight;
    }, 0);

    const totalWeight = recentScores.reduce((sum, _, index) => sum + (index + 1), 0);
    const baseline = weightedAverage / totalWeight;
    const trend = recentScores[recentScores.length - 1] - recentScores[0];
    const predictedScore = Math.round(Math.max(0, Math.min(maxScore, baseline + trend * 0.25)));

    return {
      available: true,
      predictedScore,
      recentAttempts: recentScores.length,
      windowDays: PREDICTION_WINDOW_DAYS,
      method: 'WEIGHTED_RECENT_TREND',
      stats: {
        averageScore: Math.round(
          recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length,
        ),
        latestScore: recentScores[recentScores.length - 1],
        trend,
      },
    };
  }

  private rangeStart(range: TimeRange): Date | null {
    const days = RANGE_DAYS[range] ?? null;
    return days === null ? null : new Date(Date.now() - days * MS_PER_DAY);
  }
}
