import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgressQueryDto, TimeRange } from './dto/progress-query.dto';

const RANGE_DAYS: Record<TimeRange, number | null> = {
  [TimeRange.LAST_7_DAYS]: 7,
  [TimeRange.LAST_30_DAYS]: 30,
  [TimeRange.LAST_90_DAYS]: 90,
  [TimeRange.ALL_TIME]: null,
};

// SRS: chỉ quy định điều kiện kích hoạt dự đoán là >= 3 lần nộp bài trong 30 ngày.
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

    // TODO: SRS mới chỉ chốt điều kiện kích hoạt (>= 3 lần nộp/30 ngày),
    // công thức dự đoán điểm chưa được đặc tả. Placeholder dưới đây dùng
    // trung bình cộng điểm các lần nộp gần nhất và sẽ được thay bằng mô hình
    // hồi quy/trọng số độ mới khi có đặc tả chính thức.
    const predictedScore = Math.round(
      recentScores.reduce((sum, value) => sum + value, 0) / recentScores.length,
    );

    return {
      available: true,
      predictedScore,
      recentAttempts: recentScores.length,
      windowDays: PREDICTION_WINDOW_DAYS,
      method: 'PLACEHOLDER_MEAN',
    };
  }

  private rangeStart(range: TimeRange): Date | null {
    const days = RANGE_DAYS[range] ?? null;
    return days === null ? null : new Date(Date.now() - days * MS_PER_DAY);
  }
}
