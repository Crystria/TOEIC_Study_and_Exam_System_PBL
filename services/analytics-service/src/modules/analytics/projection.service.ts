import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsClock } from './calculations';
import { AnalyticsQueries, Tx, userLock } from './analytics.queries';
@Injectable()
export class ProjectionService {
  constructor(
    private readonly db: PrismaService,
    private readonly queries: AnalyticsQueries,
    private readonly clock: AnalyticsClock,
  ) {}
  async rebuild(userId: string) {
    return this.db.$transaction(
      async (tx) => {
        await userLock(tx, userId);
        await this.rebuildTx(tx, userId);
      },
      { timeout: 30000 },
    );
  }
  async rebuildTx(tx: Tx, userId: string) {
    const asOf = this.clock.now();
    await tx.firstLearnedEntity.deleteMany({ where: { userId } });
    await tx.completedLessonEntity.deleteMany({ where: { userId } });
    await tx.$executeRaw`INSERT INTO first_learned_entities(user_id,scope,vocabulary_id,first_at)
      SELECT user_id, scope, vocabulary_id, min(first_at) FROM (
        SELECT user_id, CASE kind WHEN 'REVIEW' THEN 'SHARED' ELSE 'PERSONAL' END AS scope,
          entity_id AS vocabulary_id, (payload->>'firstLearnedAt')::timestamptz AT TIME ZONE 'UTC' AS first_at
        FROM learning_activity_facts WHERE user_id=${userId} AND kind IN ('REVIEW','PERSONAL_REVIEW') AND payload->>'firstLearnedAt' IS NOT NULL
        UNION ALL SELECT user_id,scope,vocabulary_id,first_at FROM historical_learned_words WHERE user_id=${userId}
      ) words GROUP BY user_id,scope,vocabulary_id`;
    await tx.$executeRaw`INSERT INTO completed_lesson_entities(user_id,lesson_id,first_at) SELECT user_id,entity_id,min(activity_at) FROM learning_activity_facts WHERE user_id=${userId} AND kind='LESSON' GROUP BY user_id,entity_id`;
    const days = await this.queries.days(tx, userId, asOf);
    await tx.userActivityDay.deleteMany({ where: { userId } });
    if (days.length)
      await tx.userActivityDay.createMany({
        data: days.map((r) => ({ userId, activityDate: new Date(r.date + 'T00:00:00Z') })),
      });
    const counters = await this.queries.counters(tx, userId, asOf, null),
      s = await this.queries.streak(tx, userId, asOf),
      p = await this.queries.prediction(tx, userId, asOf),
      weak = await this.queries.weak(tx, userId, asOf),
      data = {
        ...counters,
        learningStreakDays: s.learningStreakDays,
        longestStreak: s.longestStreak,
        predictedToeicScore: p.predictedToeicScore,
        updatedAt: asOf,
      };
    await tx.userStatistic.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await tx.userWeakArea.deleteMany({ where: { userId } });
    await tx.userWeakArea.createMany({
      data: weak.items.map((r) => ({
        userId,
        part: r.part,
        correct: r.correct,
        total: r.total,
        weaknessScore: r.weaknessScore,
        isWeak: r.isWeak,
        calculatedAt: asOf,
      })),
    });
  }
}
