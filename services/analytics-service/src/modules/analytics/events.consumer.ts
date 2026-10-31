import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma';
import { ConsumedMessage, EventEnvelope, MessagingService } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyActivity, MS_PER_DAY, startOfDay } from './streak';

interface TestSubmittedPayload {
  attemptId: string;
  userId: string;
  testId: string;
  mode?: string;
  testType?: string;
  score: number;
  totalCorrect: number;
  totalScore?: number;
  completedAt?: number;
  partDetails?: PartStat[];
}
interface PartStat {
  part: number;
  skill: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
}
interface PartSubmittedPayload {
  attemptId: string;
  userId: string;
  testId: string;
  mode: 'PART';
  parts: number[];
  accuracy: number;
  correctCount: number;
  totalQuestions: number;
  partStats: PartStat[];
  completedAt: number;
}

interface VocabularyLearnedPayload {
  userId: string;
  vocabularyId: string;
  quality: number;
}

interface LessonCompletedPayload {
  userId: string;
  lessonId: string;
}

type EventApplier<T> = (tx: Prisma.TransactionClient, envelope: EventEnvelope<T>) => Promise<void>;

const TOPIC_TEST_SUBMITTED = 'test.submitted';
const TOPIC_PART_SUBMITTED = 'part-practice.submitted';
const TOPIC_VOCABULARY_LEARNED = 'vocabulary.learned';
const TOPIC_LESSON_COMPLETED = 'lesson.completed';
const CONSUMER_GROUP = 'analytics-service';

const ACTIVITY_TEST_SUBMITTED = 'TEST_SUBMITTED';
const ACTIVITY_VOCABULARY_LEARNED = 'VOCABULARY_LEARNED';
const ACTIVITY_LESSON_COMPLETED = 'LESSON_COMPLETED';

@Injectable()
export class EventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(EventsConsumer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.messaging.subscribe(
      this.config.get<string>('ANALYTICS_CONSUMER_QUEUE') ?? CONSUMER_GROUP,
      [
        TOPIC_TEST_SUBMITTED,
        TOPIC_PART_SUBMITTED,
        TOPIC_VOCABULARY_LEARNED,
        TOPIC_LESSON_COMPLETED,
      ],
      (message) => this.route(message),
    );
  }

  private async route(message: ConsumedMessage): Promise<void> {
    switch (message.routingKey) {
      case TOPIC_TEST_SUBMITTED:
        return this.consume<TestSubmittedPayload>(message, (tx, envelope) =>
          this.onTestSubmitted(tx, envelope),
        );
      case TOPIC_PART_SUBMITTED:
        return this.consume<PartSubmittedPayload>(message, (tx, envelope) =>
          this.onPartSubmitted(tx, envelope),
        );
      case TOPIC_VOCABULARY_LEARNED:
        return this.consume<VocabularyLearnedPayload>(message, (tx, envelope) =>
          this.onVocabularyLearned(tx, envelope),
        );
      case TOPIC_LESSON_COMPLETED:
        return this.consume<LessonCompletedPayload>(message, (tx, envelope) =>
          this.onLessonCompleted(tx, envelope),
        );
      default:
        this.logger.warn(`Unhandled routing key ${message.routingKey}`);
    }
  }

  /**
   * Xử lý chung: parse envelope -> chống trùng (idempotent) -> apply trong transaction.
   * `ProcessedEvent` được ghi CÙNG transaction với nghiệp vụ nên hoặc tất cả thành công
   * hoặc rollback, đảm bảo event không bị xử lý 2 lần.
   */
  private async consume<T>(message: ConsumedMessage, apply: EventApplier<T>): Promise<void> {
    if (!message.content?.length) {
      return;
    }

    let envelope: EventEnvelope<T>;
    try {
      envelope = JSON.parse(message.content.toString()) as EventEnvelope<T>;
    } catch (error) {
      this.logger.error(`Malformed event payload: ${(error as Error).message}`);
      return;
    }

    if (!envelope?.eventId || !envelope.eventType) {
      this.logger.warn('Ignoring event without eventId/eventType');
      return;
    }

    try {
      const processed = await this.prisma.processedEvent.findUnique({
        where: { eventId: envelope.eventId },
      });
      if (processed) {
        this.logger.debug(`Skip duplicated ${envelope.eventType}#${envelope.eventId}`);
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        const userId = (envelope.payload as { userId?: string }).userId;
        if (userId)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`analytics-user:${userId}`}, 0))`;
        await tx.processedEvent.create({
          data: { eventId: envelope.eventId, eventType: envelope.eventType },
        });
        await apply(tx, envelope);
      });

      this.logger.debug(`Processed ${envelope.eventType}#${envelope.eventId}`);
    } catch (error) {
      if (await this.prisma.processedEvent.findUnique({ where: { eventId: envelope.eventId } }))
        return;
      // Rethrow để MessagingService retry (header x-retry) rồi đẩy DLQ sau MAX_RETRIES.
      this.logger.error(
        `Failed to process ${envelope.eventType}#${envelope.eventId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async onTestSubmitted(
    tx: Prisma.TransactionClient,
    envelope: EventEnvelope<TestSubmittedPayload>,
  ): Promise<void> {
    const { attemptId, userId, totalCorrect } = envelope.payload;
    const mode = 'FULL',
      score = envelope.payload.totalScore ?? envelope.payload.score;
    if (!Number.isInteger(score) || score < 10 || score > 990)
      throw new Error('Invalid Full score');
    const stats = envelope.payload.partDetails ?? [];
    this.validateStats(stats);
    if (
      !Number.isInteger(totalCorrect) ||
      totalCorrect < 0 ||
      totalCorrect > 200 ||
      (stats.length &&
        (stats.length !== 7 ||
          stats.reduce((n, p) => n + p.totalQuestions, 0) !== 200 ||
          stats.reduce((n, p) => n + p.correctCount, 0) !== totalCorrect))
    )
      throw new Error('Invalid Full submission counts');
    const occurredAt = envelope.payload.completedAt
      ? new Date(envelope.payload.completedAt)
      : this.occurredAt(envelope);

    await tx.scoreHistory.upsert({
      where: { attemptId },
      create: {
        userId,
        attemptId,
        testType: mode,
        mode,
        score,
        parts: stats.map((p) => p.part),
        accuracy: stats.length
          ? totalCorrect / stats.reduce((n, p) => n + p.totalQuestions, 0)
          : null,
        takenAt: occurredAt,
      },
      update: { testType: mode, mode, score },
    });

    await tx.learningActivity.create({
      data: {
        userId,
        activityType: ACTIVITY_TEST_SUBMITTED,
        refId: attemptId,
        occurredAt,
        metadata: {
          mode,
          score,
          totalCorrect,
          partStats: stats as unknown as Prisma.InputJsonValue,
        },
      },
    });

    await this.recomputeLearningStat(tx, userId);
    await this.recomputeWeakAreas(tx, userId);
    await this.updateStreak(tx, userId, occurredAt);
  }

  private async onPartSubmitted(
    tx: Prisma.TransactionClient,
    envelope: EventEnvelope<PartSubmittedPayload>,
  ) {
    const p = envelope.payload;
    this.validateStats(p.partStats);
    if (
      p.mode !== 'PART' ||
      !Number.isFinite(p.completedAt) ||
      !Array.isArray(p.parts) ||
      new Set(p.parts).size !== p.parts.length ||
      p.parts.length !== p.partStats.length ||
      !p.parts.every((part) => p.partStats.some((s) => s.part === part))
    )
      throw new Error('Invalid Part submission metadata');
    if (
      !p.partStats.length ||
      p.partStats.reduce((n, s) => n + s.totalQuestions, 0) !== p.totalQuestions ||
      p.partStats.reduce((n, s) => n + s.correctCount, 0) !== p.correctCount ||
      Math.abs(p.accuracy - p.correctCount / p.totalQuestions) > 1e-9
    )
      throw new Error('Invalid Part submission counts');
    const occurredAt = new Date(p.completedAt);
    await tx.scoreHistory.upsert({
      where: { attemptId: p.attemptId },
      create: {
        userId: p.userId,
        attemptId: p.attemptId,
        testType: 'PART',
        mode: 'PART',
        score: null,
        accuracy: p.accuracy,
        parts: p.parts,
        takenAt: occurredAt,
      },
      update: { mode: 'PART', testType: 'PART', score: null, accuracy: p.accuracy, parts: p.parts },
    });
    await tx.learningActivity.create({
      data: {
        userId: p.userId,
        activityType: 'PART_PRACTICE_SUBMITTED',
        refId: p.attemptId,
        occurredAt,
        metadata: {
          mode: 'PART',
          accuracy: p.accuracy,
          correctCount: p.correctCount,
          totalQuestions: p.totalQuestions,
          partStats: p.partStats as unknown as Prisma.InputJsonValue,
        },
      },
    });
    await this.recomputeLearningStat(tx, p.userId);
    await this.recomputeWeakAreas(tx, p.userId);
    await this.updateStreak(tx, p.userId, occurredAt);
  }

  private validateStats(stats: PartStat[]) {
    if (
      !Array.isArray(stats) ||
      new Set(stats.map((p) => p.part)).size !== stats.length ||
      stats.some(
        (p) =>
          !Number.isInteger(p.part) ||
          p.part < 1 ||
          p.part > 7 ||
          !Number.isInteger(p.totalQuestions) ||
          p.totalQuestions < 1 ||
          !Number.isInteger(p.correctCount) ||
          p.correctCount < 0 ||
          p.correctCount > p.totalQuestions ||
          p.skill !== (p.part <= 4 ? 'LISTENING' : 'READING') ||
          !Number.isFinite(p.accuracy) ||
          Math.abs(p.accuracy - p.correctCount / p.totalQuestions) > 1e-9,
      )
    )
      throw new Error('Invalid per-part statistics');
  }

  private async onVocabularyLearned(
    tx: Prisma.TransactionClient,
    envelope: EventEnvelope<VocabularyLearnedPayload>,
  ): Promise<void> {
    const { userId, vocabularyId, quality } = envelope.payload;
    const occurredAt = this.occurredAt(envelope);

    await tx.learningActivity.create({
      data: {
        userId,
        activityType: ACTIVITY_VOCABULARY_LEARNED,
        refId: vocabularyId,
        occurredAt,
        metadata: { quality },
      },
    });

    await this.bumpLearningStat(tx, userId, { vocabularyLearned: 1, activityDay: occurredAt });
    await this.updateStreak(tx, userId, occurredAt);
  }

  private async onLessonCompleted(
    tx: Prisma.TransactionClient,
    envelope: EventEnvelope<LessonCompletedPayload>,
  ): Promise<void> {
    const { userId, lessonId } = envelope.payload;
    const occurredAt = this.occurredAt(envelope);

    await tx.learningActivity.create({
      data: {
        userId,
        activityType: ACTIVITY_LESSON_COMPLETED,
        refId: lessonId,
        occurredAt,
      },
    });

    await this.bumpLearningStat(tx, userId, { lessons: 1, activityDay: occurredAt });
    await this.updateStreak(tx, userId, occurredAt);
  }

  /**
   * Recompute thống kê tuyệt đối từ bảng hoạt động (dùng cho TestSubmittedEvent).
   * TODO: thay bằng aggregate phía DB khi khối lượng dữ liệu lớn.
   */
  private async recomputeLearningStat(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const activities = await tx.learningActivity.findMany({
      where: { userId },
      select: { activityType: true, occurredAt: true },
    });

    const studyDays = new Set(activities.map((a) => this.dayKey(a.occurredAt)));
    const totalLessons = activities.filter(
      (a) => a.activityType === ACTIVITY_LESSON_COMPLETED,
    ).length;
    const totalVocabLearned = activities.filter(
      (a) => a.activityType === ACTIVITY_VOCABULARY_LEARNED,
    ).length;

    const totals = { totalStudyDays: studyDays.size, totalLessons, totalVocabLearned };
    await tx.userLearningStat.upsert({
      where: { userId },
      create: { userId, ...totals },
      update: totals,
    });
  }

  /**
   * Bump thống kê tăng dần (dùng cho VocabularyLearned/LessonCompleted).
   * `totalStudyDays` chỉ tăng khi đây là hoạt động đầu tiên trong ngày.
   */
  private async bumpLearningStat(
    tx: Prisma.TransactionClient,
    userId: string,
    delta: { lessons?: number; vocabularyLearned?: number; activityDay: Date },
  ): Promise<void> {
    const dayStart = startOfDay(delta.activityDay);
    const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
    const activitiesThisDay = await tx.learningActivity.count({
      where: { userId, occurredAt: { gte: dayStart, lt: dayEnd } },
    });
    const studyDayIncrement = activitiesThisDay === 1 ? 1 : 0;

    await tx.userLearningStat.upsert({
      where: { userId },
      create: {
        userId,
        totalStudyDays: studyDayIncrement,
        totalLessons: delta.lessons ?? 0,
        totalVocabLearned: delta.vocabularyLearned ?? 0,
      },
      update: {
        totalStudyDays: { increment: studyDayIncrement },
        totalLessons: { increment: delta.lessons ?? 0 },
        totalVocabLearned: { increment: delta.vocabularyLearned ?? 0 },
      },
    });
  }

  /**
   * Placeholder cho WeakArea.
   * TODO: SRS yêu cầu điểm yếu theo part dựa trên tỉ lệ sai thực tế, nhưng
   * TestSubmittedEvent hiện chưa mang breakdown đúng/sai theo part. Tạm suy ra
   * errorRate từ điểm và gom theo mode (part = 0 nghĩa là tổng hợp).
   */
  private async recomputeWeakAreas(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const activities = await tx.learningActivity.findMany({
      where: { userId, activityType: { in: ['TEST_SUBMITTED', 'PART_PRACTICE_SUBMITTED'] } },
      select: { refId: true, metadata: true },
    });
    const byAttempt = new Map<string, PartStat[]>();
    for (const activity of activities) {
      const stats = (activity.metadata as unknown as { partStats?: PartStat[] } | null)?.partStats;
      if (activity.refId && Array.isArray(stats)) byAttempt.set(activity.refId, stats);
    }
    const totals = new Map<number, { total: number; correct: number }>();
    for (const stats of byAttempt.values())
      for (const p of stats) {
        const existing = totals.get(p.part) ?? { total: 0, correct: 0 };
        existing.total += p.totalQuestions;
        existing.correct += p.correctCount;
        totals.set(p.part, existing);
      }
    for (const [part, count] of totals) {
      const skillArea = part <= 4 ? 'LISTENING' : 'READING';
      const values = { sampleCount: count.total, errorRate: 1 - count.correct / count.total };
      await tx.weakArea.upsert({
        where: { userId_skillArea_part: { userId, skillArea, part } },
        create: { userId, skillArea, part, ...values },
        update: values,
      });
    }
  }

  private async updateStreak(
    tx: Prisma.TransactionClient,
    userId: string,
    activityDate: Date,
  ): Promise<void> {
    const current = await tx.dailyStreak.findUnique({ where: { userId } });
    const next = applyActivity(current, activityDate);

    await tx.dailyStreak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastActivityDate: next.lastActivityDate,
      },
      update: {
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastActivityDate: next.lastActivityDate,
      },
    });
  }

  private occurredAt(envelope: EventEnvelope<unknown>): Date {
    const ms = Number(envelope.occurredAt);
    return Number.isFinite(ms) ? new Date(ms) : new Date();
  }

  private dayKey(date: Date): string {
    return startOfDay(date).toISOString().slice(0, 10);
  }
}
