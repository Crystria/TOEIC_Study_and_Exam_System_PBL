import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { calendarStart, prediction, streak, weakAreas } from './calculations';
export type Tx = Prisma.TransactionClient;
export function invalid(code: string): never {
  throw new HttpException({ code, message: code }, 400);
}
export async function userLock(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`analytics-user:${userId}`},0))::text`;
}
export function json(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v));
}
function number(value: bigint | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > 2147483647)
    throw new HttpException({ code: 'ANALYTICS_DOMAIN_EXHAUSTED' }, 503);
  return n;
}
@Injectable()
export class AnalyticsQueries {
  async counters(tx: Tx, userId: string, asOf: Date, from: Date | null) {
    const lo = from ?? new Date('0001-01-01T00:00:00Z');
    const [r] = await tx.$queryRaw<Array<Record<string, bigint>>>`
 SELECT (SELECT count(*) FROM first_learned_entities WHERE user_id=${userId} AND first_at>=${lo} AND first_at<=${asOf}) AS "vocabulariesLearned",
 (SELECT count(*) FROM learning_activity_facts WHERE user_id=${userId} AND kind='REVIEW' AND activity_at>=${lo} AND activity_at<=${asOf}) AS "reviewCount",
 (SELECT count(*) FROM completed_lesson_entities WHERE user_id=${userId} AND first_at>=${lo} AND first_at<=${asOf}) AS "grammarLessonsCompleted",
 (SELECT count(*) FROM test_score_facts WHERE user_id=${userId} AND completed_at>=${lo} AND completed_at<=${asOf}) AS "mockTestCount",
 (SELECT count(*) FROM practice_facts WHERE user_id=${userId} AND completed_at>=${lo} AND completed_at<=${asOf}) AS "practiceCount",
 (SELECT count(DISTINCT ((activity_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) FROM learning_activity_facts WHERE user_id=${userId} AND activity_at>=${lo} AND activity_at<=${asOf}) AS "studyDays"`;
    return {
      vocabulariesLearned: number(r.vocabulariesLearned),
      reviewCount: number(r.reviewCount),
      grammarLessonsCompleted: number(r.grammarLessonsCompleted),
      mockTestCount: number(r.mockTestCount),
      practiceCount: number(r.practiceCount),
      studyDays: number(r.studyDays),
    };
  }
  async days(tx: Tx, userId: string, asOf: Date) {
    const rows = await tx.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`SELECT ((activity_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,count(*) FROM learning_activity_facts WHERE user_id=${userId} AND activity_at<=${asOf} GROUP BY day ORDER BY day`;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: number(r.count) }));
  }
  async streak(tx: Tx, userId: string, asOf: Date) {
    return streak(
      (await this.days(tx, userId, asOf)).map((r) => r.date),
      asOf,
    );
  }
  async prediction(tx: Tx, userId: string, asOf: Date) {
    const rows = await tx.$queryRaw<
      Array<{
        attemptId: string;
        completedAt: Date;
        totalScore: number;
        eligibleFullCount: bigint;
      }>
    >`SELECT attempt_id AS "attemptId",completed_at AS "completedAt",total_score AS "totalScore",
      count(*) OVER() AS "eligibleFullCount" FROM test_score_facts
      WHERE user_id=${userId} AND completed_at>=${new Date(asOf.getTime() - 30 * 86400000)}
        AND completed_at<=${asOf}
      ORDER BY completed_at DESC,attempt_id ASC LIMIT 3`;
    return prediction(rows, asOf, number(rows[0]?.eligibleFullCount ?? 0));
  }
  async weak(tx: Tx, userId: string, asOf: Date) {
    const rows = await tx.$queryRaw<
      Array<{ part: number; correct: bigint; total: bigint }>
    >`SELECT p.part,sum(p.correct)::bigint AS correct,sum(p.total)::bigint AS total FROM attempt_part_facts p JOIN attempt_facts a USING(attempt_id) WHERE a.user_id=${userId} AND a.completed_at>=${calendarStart(asOf, 30)} AND a.completed_at<=${asOf} GROUP BY p.part`;
    return {
      items: weakAreas(
        rows.map((r) => ({ part: r.part, correct: number(r.correct), total: number(r.total) })),
        asOf,
      ),
      asOf: asOf.toISOString(),
      windowDays: 30,
      minimumQuestions: 20,
      threshold: 0.3,
      timezone: 'Asia/Ho_Chi_Minh',
    };
  }
  async trend(
    tx: Tx,
    userId: string,
    asOf: Date,
    from: Date | null,
    cursor: string | undefined,
    limit: number,
    timeRange: string,
  ) {
    let after: { completedAt: string; attemptId: string } | null = null;
    if (cursor)
      try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
        if (
          cursor.length > 512 ||
          value.userId !== userId ||
          value.timeRange !== timeRange ||
          !Number.isFinite(Date.parse(value.completedAt)) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value.attemptId,
          )
        )
          throw Error();
        after = value;
      } catch {
        invalid('INVALID_CURSOR');
      }
    const rows = await tx.testScoreFact.findMany({
      where: {
        userId,
        completedAt: { gte: from ?? undefined, lte: asOf },
        ...(after
          ? {
              OR: [
                { completedAt: { gt: new Date(after.completedAt) } },
                { completedAt: new Date(after.completedAt), attemptId: { gt: after.attemptId } },
              ],
            }
          : {}),
      },
      orderBy: [{ completedAt: 'asc' }, { attemptId: 'asc' }],
      take: limit + 1,
    });
    const items = rows.slice(0, limit).map((r) => ({
        attemptId: r.attemptId,
        completedAt: r.completedAt.toISOString(),
        scoreListening: r.scoreListening,
        scoreReading: r.scoreReading,
        totalScore: r.totalScore,
        scoring: r.scoring,
      })),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                userId,
                timeRange,
                attemptId: last.attemptId,
                completedAt: last.completedAt,
              }),
            ).toString('base64url')
          : null,
    };
  }
}
