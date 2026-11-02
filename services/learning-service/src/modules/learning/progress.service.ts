import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserVocabularyProgress, UserLessonProgress } from '../../generated/prisma';
import {
  Tx,
  activeVocabulary,
  event,
  fail,
  hash,
  inputJson,
  nextRevision,
  userLock,
} from '../../core';
import { calculateSm2, vietnamDate } from './sm2';
import { ReviewQuery } from './queries';
export interface Snapshot {
  entityType: 'VOCABULARY' | 'LESSON';
  entityId: string;
  revision: string;
  state: unknown;
}
export function vocabularySnapshot(row: UserVocabularyProgress | null, id: string): Snapshot {
  return {
    entityType: 'VOCABULARY',
    entityId: id,
    revision: row?.revision.toString() ?? '0',
    state: row
      ? {
          quality: row.quality,
          intervalDays: row.intervalDays,
          easinessFactor: Number(row.easinessFactor),
          repetitionNumber: row.repetitionNumber,
          nextReviewDate: row.nextReviewDate.toISOString().slice(0, 10),
          firstLearnedAt: row.firstLearnedAt?.toISOString() ?? null,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  };
}
export function lessonSnapshot(row: UserLessonProgress | null, id: string): Snapshot {
  return {
    entityType: 'LESSON',
    entityId: id,
    revision: row?.revision.toString() ?? '0',
    state: row
      ? {
          status: 'COMPLETED',
          completedAt: row.completedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  };
}
@Injectable()
export class ProgressService {
  constructor(private readonly db: PrismaService) {}
  async replay(tx: Tx, userId: string, operationId: string, action: unknown) {
    const found = await tx.operationLedger.findUnique({
      where: { userId_operationId: { userId, operationId } },
    });
    if (!found) return null;
    if (found.actionHash !== hash(action)) fail(409, 'IDEMPOTENCY_CONFLICT');
    if (found.status === 'REJECTED')
      fail(409, found.reason || 'OPERATION_REJECTED', {
        currentProgress: (found.result as { progress: unknown }).progress,
      });
    return found.result;
  }
  async commit(
    tx: Tx,
    userId: string,
    operationId: string,
    action: { kind: string },
    result: unknown,
    progress: Snapshot[],
    at: Date,
    changed = true,
  ) {
    await tx.operationLedger.create({
      data: {
        userId,
        operationId,
        kind: action.kind,
        actionHash: hash(action),
        result: inputJson(result),
      },
    });
    if (changed) {
      const head = await tx.learningProgressHead.findUnique({ where: { userId } });
      const version = nextRevision(head?.version ?? 0n);
      await tx.learningProgressHead.upsert({
        where: { userId },
        create: { userId, version },
        update: { version },
      });
    }
    if (changed)
      await event(
        tx,
        userId,
        'LearningProgressChangedEvent.v2',
        { userId, operationId, actionHash: hash(action), progress },
        at,
      );
  }
  async reviewInTx(
    tx: Tx,
    userId: string,
    id: string,
    quality: number,
    expected: string,
    operationId: string,
    at: Date,
    sessionId: string | null = null,
  ) {
    if (sessionId === null) await activeVocabulary(tx, id);
    const current = await tx.userVocabularyProgress.findUnique({
      where: { userId_vocabularyId: { userId, vocabularyId: id } },
    });
    if ((current?.revision ?? 0n) !== BigInt(expected))
      fail(409, 'ENTITY_REVISION_CONFLICT', { currentProgress: [vocabularySnapshot(current, id)] });
    const previous = current
      ? {
          easinessFactor: Number(current.easinessFactor),
          repetitionNumber: current.repetitionNumber,
          intervalDays: current.intervalDays,
        }
      : { easinessFactor: 2.5, repetitionNumber: 0, intervalDays: 0 };
    let next;
    try {
      next = calculateSm2(previous, quality, at);
    } catch (error) {
      if ((error as Error).message === 'SM2_DOMAIN_EXHAUSTED')
        fail(503, 'PROGRESS_DOMAIN_EXHAUSTED');
      throw error;
    }
    const firstLearned = !current?.firstLearnedAt && quality >= 3,
      firstLearnedAt = current?.firstLearnedAt ?? (firstLearned ? at : null);
    const data = {
      quality,
      intervalDays: next.intervalDays,
      easinessFactor: next.easinessFactor,
      repetitionNumber: next.repetitionNumber,
      nextReviewDate: new Date(next.nextReviewDate + 'T00:00:00.000Z'),
      firstLearnedAt,
      revision: nextRevision(current?.revision ?? 0n),
      updatedAt: new Date(),
    };
    const row = await tx.userVocabularyProgress.upsert({
      where: { userId_vocabularyId: { userId, vocabularyId: id } },
      create: { userId, vocabularyId: id, ...data },
      update: data,
    });
    await event(
      tx,
      id,
      'VocabularyLearnedEvent.v2',
      {
        userId,
        vocabularyId: id,
        operationId,
        sessionId,
        quality,
        revision: row.revision.toString(),
        firstLearned,
        firstLearnedAt: firstLearnedAt?.toISOString() ?? null,
        activityAt: at.toISOString(),
      },
      at,
    );
    return vocabularySnapshot(row, id);
  }
  async review(
    userId: string,
    id: string,
    body: { operationId: string; quality: number; baseEntityRevision: string },
  ) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.reviewInTransaction(tx, userId, id, body, new Date());
    });
  }
  async reviewInTransaction(
    tx: Tx,
    userId: string,
    id: string,
    body: { operationId: string; quality: number; baseEntityRevision: string },
    at: Date,
  ) {
    const action = {
      kind: 'REVIEW_FLASHCARD',
      vocabularyId: id,
      baseEntityRevision: body.baseEntityRevision,
      quality: body.quality,
    };
    const replay = await this.replay(tx, userId, body.operationId, action);
    if (replay) return replay;
    const progress = [
        await this.reviewInTx(
          tx,
          userId,
          id,
          body.quality,
          body.baseEntityRevision,
          body.operationId,
          at,
        ),
      ],
      result = { operationId: body.operationId, progress };
    await this.commit(tx, userId, body.operationId, action, result, progress, at);
    return result;
  }
  async complete(
    userId: string,
    id: string,
    body: { operationId: string; baseEntityRevision: string },
  ) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.completeInTransaction(tx, userId, id, body, new Date());
    });
  }
  async completeInTransaction(
    tx: Tx,
    userId: string,
    id: string,
    body: { operationId: string; baseEntityRevision: string },
    at: Date,
  ) {
    const action = {
      kind: 'COMPLETE_LESSON',
      lessonId: id,
      baseEntityRevision: body.baseEntityRevision,
    };
    const replay = await this.replay(tx, userId, body.operationId, action);
    if (replay) return replay;
    const available = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM grammar_lessons WHERE id=${id} AND deleted_at IS NULL AND status='PUBLISHED' FOR SHARE`;
    if (!available.length) fail(404, 'LESSON_NOT_FOUND');
    const before = await tx.userLessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: id } },
    });
    if ((before?.revision ?? 0n) !== BigInt(body.baseEntityRevision))
      fail(409, 'ENTITY_REVISION_CONFLICT', { currentProgress: [lessonSnapshot(before, id)] });
    const row =
        before ??
        (await tx.userLessonProgress.create({
          data: { userId, lessonId: id, completedAt: at, updatedAt: new Date(), revision: 1n },
        })),
      progress = [lessonSnapshot(row, id)],
      result = { operationId: body.operationId, progress };
    if (!before)
      await event(
        tx,
        id,
        'LessonCompletedEvent.v2',
        {
          userId,
          lessonId: id,
          operationId: body.operationId,
          revision: row.revision.toString(),
          completedAt: row.completedAt.toISOString(),
        },
        at,
      );
    await this.commit(tx, userId, body.operationId, action, result, progress, at, !before);
    return result;
  }
  async due(userId: string, query: ReviewQuery) {
    const { page, size } = query;
    return this.db.$transaction(
      async (tx) => {
        const where = {
          userId,
          nextReviewDate: { lte: new Date(vietnamDate(new Date()) + 'T00:00:00.000Z') },
          vocabulary: { deletedAt: null, topic: { deletedAt: null }, topicId: query.topicId },
        };
        const [rows, total] = await Promise.all([
          tx.userVocabularyProgress.findMany({
            where,
            skip: (page - 1) * size,
            take: size,
            orderBy: [{ nextReviewDate: 'asc' }, { vocabularyId: 'asc' }],
          }),
          tx.userVocabularyProgress.count({ where }),
        ]);
        return {
          items: rows.map((r) => vocabularySnapshot(r, r.vocabularyId)),
          total,
          page,
          size,
          totalPages: Math.ceil(total / size),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async summary(userId: string) {
    return this.db.$transaction(
      async (tx) => {
        const [
          reviewedVocabularies,
          vocabulariesLearned,
          dueVocabularies,
          grammarLessonsCompleted,
          sessionsCompleted,
          lastVocabulary,
          lastLesson,
        ] = await Promise.all([
          tx.userVocabularyProgress.count({ where: { userId } }),
          tx.userVocabularyProgress.count({ where: { userId, firstLearnedAt: { not: null } } }),
          tx.userVocabularyProgress.count({
            where: {
              userId,
              nextReviewDate: { lte: new Date(vietnamDate(new Date()) + 'T00:00:00.000Z') },
              vocabulary: { deletedAt: null, topic: { deletedAt: null } },
            },
          }),
          tx.userLessonProgress.count({ where: { userId } }),
          tx.vocabularySession.count({ where: { userId, status: 'COMPLETED' } }),
          tx.userVocabularyProgress.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
          }),
          tx.userLessonProgress.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
        ]);
        const dates = [lastVocabulary?.updatedAt, lastLesson?.updatedAt]
          .filter((v): v is Date => !!v)
          .sort((a, b) => b.getTime() - a.getTime());
        return {
          reviewedVocabularies,
          vocabulariesLearned,
          dueVocabularies,
          grammarLessonsCompleted,
          sessionsCompleted,
          updatedAt: dates[0]?.toISOString() ?? null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
