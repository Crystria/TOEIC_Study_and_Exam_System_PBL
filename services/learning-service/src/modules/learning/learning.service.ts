import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { MessagingService, writeOutbox } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListLessonsQueryDto } from './dtos/list-lessons-query.dto';
import { ListVocabulariesQueryDto } from './dtos/list-vocabularies-query.dto';
import { calculateSm2, Sm2State } from './sm2';

const DEFAULT_SM2_STATE: Sm2State = { easinessFactor: 2.5, repetition: 0, interval: 1 };

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  async listVocabularyTopics() {
    return this.prisma.vocabularyTopic.findMany({
      include: { _count: { select: { vocabularies: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listVocabularies(query: ListVocabulariesQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;

    const where: Prisma.VocabularyWhereInput = {
      ...(query.topicId ? { topicId: query.topicId } : {}),
      ...(query.keyword
        ? {
            OR: [
              { word: { contains: query.keyword, mode: 'insensitive' } },
              { meaning: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vocabulary.findMany({
        where,
        include: { topic: true },
        orderBy: { word: 'asc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.vocabulary.count({ where }),
    ]);

    return { items, total, page, size };
  }

  async getReviewToday(userId: string) {
    return this.prisma.userProgress.findMany({
      where: { userId, nextReviewAt: { lte: new Date() } },
      include: { vocabulary: { include: { topic: true } } },
      orderBy: { nextReviewAt: 'asc' },
    });
  }

  async reviewFlashcard(vocabularyId: string, quality: number, userId: string) {
    const vocabulary = await this.prisma.vocabulary.findUnique({ where: { id: vocabularyId } });
    if (!vocabulary) {
      throw new NotFoundException('Vocabulary not found');
    }

    const current = await this.prisma.userProgress.findUnique({
      where: { userId_vocabularyId: { userId, vocabularyId } },
    });
    const state: Sm2State = current
      ? {
          easinessFactor: current.easinessFactor,
          repetition: current.repetition,
          interval: current.interval,
        }
      : DEFAULT_SM2_STATE;

    const result = calculateSm2(state, quality);
    const now = new Date();

    const progress = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.userProgress.upsert({
        where: { userId_vocabularyId: { userId, vocabularyId } },
        create: {
          userId,
          vocabularyId,
          easinessFactor: result.easinessFactor,
          repetition: result.repetition,
          interval: result.interval,
          nextReviewAt: result.nextReviewAt,
          lastReviewAt: now,
        },
        update: {
          easinessFactor: result.easinessFactor,
          repetition: result.repetition,
          interval: result.interval,
          nextReviewAt: result.nextReviewAt,
          lastReviewAt: now,
        },
      });

      await writeOutbox(tx as never, {
        aggregateId: saved.id,
        eventType: 'VocabularyLearnedEvent',
        payload: {
          userId,
          vocabularyId,
          quality,
          easinessFactor: result.easinessFactor,
          repetition: result.repetition,
          interval: result.interval,
          nextReviewAt: result.nextReviewAt.toISOString(),
        },
      });

      return saved;
    });

    await this.messaging.emit('vocabulary.learned', progress.id, {
      eventId: randomUUID(),
      eventType: 'VocabularyLearnedEvent',
      occurredAt: Date.now(),
      payload: {
        userId,
        vocabularyId,
        quality,
        repetition: result.repetition,
        interval: result.interval,
        nextReviewAt: result.nextReviewAt.toISOString(),
      },
    });

    return progress;
  }

  async listLessons(query: ListLessonsQueryDto) {
    return this.prisma.grammarLesson.findMany({
      where: {
        ...(query.level ? { level: query.level } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  async findLesson(id: string) {
    const lesson = await this.prisma.grammarLesson.findUnique({ where: { id } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  async completeLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.grammarLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const now = new Date();

    const progress = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId, status: 'COMPLETED', completedAt: now },
        update: { status: 'COMPLETED', completedAt: now },
      });

      await writeOutbox(tx as never, {
        aggregateId: saved.id,
        eventType: 'LessonCompletedEvent',
        payload: { userId, lessonId, completedAt: now.toISOString() },
      });

      return saved;
    });

    await this.messaging.emit('lesson.completed', progress.id, {
      eventId: randomUUID(),
      eventType: 'LessonCompletedEvent',
      occurredAt: Date.now(),
      payload: { userId, lessonId, completedAt: now.toISOString() },
    });

    return progress;
  }

  async getProgress(userId: string) {
    const [totalVocabularies, reviewed, dueToday, totalLessons, completedLessons, recentSessions] =
      await this.prisma.$transaction([
        this.prisma.vocabulary.count(),
        this.prisma.userProgress.count({ where: { userId } }),
        this.prisma.userProgress.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
        this.prisma.grammarLesson.count(),
        this.prisma.lessonProgress.count({ where: { userId, status: 'COMPLETED' } }),
        this.prisma.learningSession.findMany({
          where: { userId },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true, endedAt: true, durationSeconds: true },
        }),
      ]);

    const totalMinutes = recentSessions.reduce((sum, session) => {
      const duration = session.durationSeconds ?? 0;
      return sum + Math.max(0, Math.round(duration / 60));
    }, 0);

    const lastSessionAt = recentSessions[0]?.startedAt ?? null;
    const currentStreak = lastSessionAt ? this.calculateUserStreak(recentSessions) : 0;

    return {
      userId,
      vocabulary: {
        total: totalVocabularies,
        reviewed,
        dueToday,
        masteryRate: totalVocabularies > 0 ? reviewed / totalVocabularies : 0,
      },
      lessons: { total: totalLessons, completed: completedLessons },
      studySummary: {
        totalMinutes,
        sessions: recentSessions.length,
        currentStreak,
        lastSessionAt: lastSessionAt?.toISOString() ?? null,
      },
      streak: lastSessionAt ? { userId, lastStudyAt: lastSessionAt.toISOString() } : null,
    };
  }

  private calculateUserStreak(sessions: { startedAt: Date }[]): number {
    if (!sessions.length) {
      return 0;
    }

    const uniqueDays = new Set(
      sessions.map((session) => new Date(session.startedAt).toISOString().slice(0, 10)),
    );
    const days = Array.from(uniqueDays).sort().reverse();

    let streak = 0;
    let cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);

    for (const day of days) {
      const current = new Date(day);
      const diff = Math.round((cursor.getTime() - current.getTime()) / (24 * 60 * 60 * 1000));
      if (diff === 0 || diff === 1) {
        streak += 1;
        cursor = new Date(current);
      } else {
        break;
      }
    }

    return streak;
  }
}
