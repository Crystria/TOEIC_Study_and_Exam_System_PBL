import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { ConsumedMessage, EventEnvelope, MessagingService } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyActivity, MS_PER_DAY, startOfDay } from './streak';

interface TestSubmittedPayload {
  attemptId: string;
  userId: string;
  testId: string;
  testType: string;
  score: number;
  totalCorrect: number;
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

type EventApplier<T> = (
  tx: Prisma.TransactionClient,
  envelope: EventEnvelope<T>,
) => Promise<void>;

const TOPIC_TEST_SUBMITTED = 'test.submitted';
const TOPIC_VOCABULARY_LEARNED = 'vocabulary.learned';
const TOPIC_LESSON_COMPLETED = 'lesson.completed';
const CONSUMER_GROUP = 'analytics-service';

const ACTIVITY_TEST_SUBMITTED = 'TEST_SUBMITTED';
const ACTIVITY_VOCABULARY_LEARNED = 'VOCABULARY_LEARNED';
const ACTIVITY_LESSON_COMPLETED = 'LESSON_COMPLETED';

const FULL_TEST_MAX_SCORE = 990;
const MINI_TEST_MAX_SCORE = 495;

@Injectable()
export class EventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(EventsConsumer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.messaging.subscribe(
      CONSUMER_GROUP,
      [TOPIC_TEST_SUBMITTED, TOPIC_VOCABULARY_LEARNED, TOPIC_LESSON_COMPLETED],
      (message) => this.route(message),
    );
  }

  private async route(message: ConsumedMessage): Promise<void> {
    switch (message.routingKey) {
      case TOPIC_TEST_SUBMITTED:
        return this.consume<TestSubmittedPayload>(message, (tx, envelope) =>
          this.onTestSubmitted(tx, envelope),
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
  private async consume<T>(
    message: ConsumedMessage,
    apply: EventApplier<T>,
  ): Promise<void> {
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
        await tx.processedEvent.create({
          data: { eventId: envelope.eventId, eventType: envelope.eventType },
        });
        await apply(tx, envelope);
      });

      this.logger.debug(`Processed ${envelope.eventType}#${envelope.eventId}`);
    } catch (error) {
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
    const { attemptId, userId, testType, score, totalCorrect } = envelope.payload;
    const occurredAt = this.occurredAt(envelope);

    await tx.scoreHistory.upsert({
      where: { attemptId },
      create: { userId, attemptId, testType, score, takenAt: occurredAt },
      update: { testType, score },
    });

    await tx.learningActivity.create({
      data: {
        userId,
        activityType: ACTIVITY_TEST_SUBMITTED,
        refId: attemptId,
        occurredAt,
        metadata: { testType, score, totalCorrect },
      },
    });

    await this.recomputeLearningStat(tx, userId);
    await this.recomputeWeakAreaPlaceholder(tx, userId, testType, score);
    await this.updateStreak(tx, userId, occurredAt);
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
  private async recomputeLearningStat(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
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
   * errorRate từ điểm và gom theo testType (part = 0 nghĩa là tổng hợp).
   */
  private async recomputeWeakAreaPlaceholder(
    tx: Prisma.TransactionClient,
    userId: string,
    testType: string,
    score: number,
  ): Promise<void> {
    const maxScore = testType === 'MINI' ? MINI_TEST_MAX_SCORE : FULL_TEST_MAX_SCORE;
    const errorRate = this.clamp01(1 - score / maxScore);
    const skillArea = testType;
    const part = 0;

    const existing = await tx.weakArea.findUnique({
      where: { userId_skillArea_part: { userId, skillArea, part } },
    });

    if (!existing) {
      await tx.weakArea.create({
        data: { userId, skillArea, part, errorRate, sampleCount: 1 },
      });
      return;
    }

    const sampleCount = existing.sampleCount + 1;
    const blended = (existing.errorRate * existing.sampleCount + errorRate) / sampleCount;
    await tx.weakArea.update({
      where: { id: existing.id },
      data: { errorRate: blended, sampleCount },
    });
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

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}
