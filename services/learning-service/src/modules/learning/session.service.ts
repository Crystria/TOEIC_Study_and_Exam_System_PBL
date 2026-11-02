import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import {
  Tx,
  contentLock,
  fail,
  hash,
  idempotent,
  inputJson,
  normalized,
  userLock,
} from '../../core';
import { ContentService } from './content.service';
import { ProgressService, Snapshot } from './progress.service';
import { vietnamDate } from './sm2';
export interface SessionReview {
  vocabularyId: string;
  quality: number;
}
export interface QuizAnswer {
  questionId: string;
  selectedOption: string;
}
type SessionRow = Prisma.VocabularySessionGetPayload<{ include: { items: true } }>;
function shuffle<T>(values: T[]): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
@Injectable()
export class SessionService {
  constructor(
    private readonly db: PrismaService,
    private readonly content: ContentService,
    private readonly progress: ProgressService,
  ) {}
  private async owned(tx: Tx, userId: string, id: string) {
    const row = await tx.vocabularySession.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!row) fail(404, 'SESSION_NOT_FOUND');
    return row;
  }
  private available(row: SessionRow) {
    if (row.status === 'CANCELED') fail(409, 'SESSION_CANCELED');
    if (row.status === 'EXPIRED' || row.expiresAt <= new Date()) fail(409, 'SESSION_EXPIRED');
  }
  private view(row: SessionRow) {
    const items = [...row.items].sort((a, b) => a.position - b.position);
    return {
      sessionId: row.id,
      topicId: row.topicId,
      mode: row.mode,
      status: row.status === 'IN_PROGRESS' && row.expiresAt <= new Date() ? 'EXPIRED' : row.status,
      startedAt: row.startedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      vocabularies: items.map((i) => i.snapshot),
      quiz: items.map((i) => ({
        questionId: i.questionId,
        vocabularyId: i.vocabularyId,
        prompt: (i.snapshot as Prisma.JsonObject).word,
        direction: 'WORD_TO_MEANING',
        options: i.options,
      })),
      reviews: items
        .filter((i) => i.quality !== null)
        .map((i) => ({ vocabularyId: i.vocabularyId, quality: i.quality })),
      result: row.result,
    };
  }
  async create(userId: string, body: { topicId: string; mode: 'NEW' | 'REVIEW' }, key: string) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      await contentLock(tx);
      return idempotent(tx, userId, 'session:create', key, body, async () => {
        await this.content.get('topics', body.topicId, false, tx);
        const due = new Date(vietnamDate(new Date()) + 'T00:00:00.000Z');
        const cards = await tx.vocabulary.findMany({
          where: {
            topicId: body.topicId,
            deletedAt: null,
            progress:
              body.mode === 'NEW'
                ? { none: { userId } }
                : { some: { userId, nextReviewDate: { lte: due } } },
          },
          orderBy: { id: 'asc' },
          take: 5,
        });
        const pool = await tx.$queryRaw<
          Array<{ definition: string }>
        >`SELECT DISTINCT ON (normalized_definition) definition FROM vocabularies WHERE topic_id=${body.topicId} AND deleted_at IS NULL ORDER BY normalized_definition,id LIMIT 4`;
        if (cards.length !== 5 || pool.length < 4) fail(409, 'INSUFFICIENT_QUIZ_DATA');
        const now = new Date();
        const row = await tx.vocabularySession.create({
          data: {
            userId,
            topicId: body.topicId,
            mode: body.mode,
            startedAt: now,
            expiresAt: new Date(now.getTime() + 86400000),
          },
        });
        for (const [position, card] of cards.entries()) {
          const correct = normalized(card.definition),
            seen = new Set<string>([correct]);
          const distractors = pool
            .filter((p) => {
              const k = normalized(p.definition);
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .slice(0, 3)
            .map((p) => p.definition);
          if (distractors.length !== 3) fail(409, 'INSUFFICIENT_QUIZ_DATA');
          const choices = shuffle([
            { text: card.definition, correct: true },
            ...distractors.map((text) => ({ text, correct: false })),
          ]);
          const state = await tx.userVocabularyProgress.findUnique({
            where: { userId_vocabularyId: { userId, vocabularyId: card.id } },
          });
          await tx.vocabularySessionItem.create({
            data: {
              sessionId: row.id,
              vocabularyId: card.id,
              questionId: randomUUID(),
              position,
              expectedRevision: state?.revision ?? 0n,
              snapshot: inputJson(await this.content.present('vocabularies', card, tx)),
              options: inputJson(choices.map((c, n) => ({ code: 'ABCD'[n], text: c.text }))),
              correctOption: 'ABCD'[choices.findIndex((c) => c.correct)],
            },
          });
        }
        return this.view(await this.owned(tx, userId, row.id));
      });
    });
  }
  async get(userId: string, id: string) {
    return this.view(await this.owned(this.db, userId, id));
  }
  async draft(userId: string, id: string, reviews: SessionReview[]) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      const session = await this.owned(tx, userId, id);
      this.available(session);
      if (session.status !== 'IN_PROGRESS') fail(409, 'SESSION_ALREADY_COMPLETED');
      if (
        new Set(reviews.map((r) => r.vocabularyId)).size !== reviews.length ||
        reviews.some((r) => !session.items.some((i) => i.vocabularyId === r.vocabularyId))
      )
        fail(400, 'INVALID_SESSION_REVIEWS');
      for (const review of reviews)
        await tx.vocabularySessionItem.update({
          where: { sessionId_vocabularyId: { sessionId: id, vocabularyId: review.vocabularyId } },
          data: { quality: review.quality },
        });
      return { success: true };
    });
  }
  async submit(
    userId: string,
    id: string,
    body: { operationId: string; reviews: SessionReview[]; answers: QuizAnswer[] },
  ) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.submitInTransaction(tx, userId, id, body, new Date());
    });
  }
  async submitInTransaction(
    tx: Tx,
    userId: string,
    id: string,
    body: { operationId: string; reviews: SessionReview[]; answers: QuizAnswer[] },
    at: Date,
  ) {
    const reviews = [...body.reviews].sort((a, b) => a.vocabularyId.localeCompare(b.vocabularyId)),
      answers = [...body.answers].sort((a, b) => a.questionId.localeCompare(b.questionId));
    const action = { kind: 'SUBMIT_VOCABULARY_SESSION', sessionId: id, reviews, answers };
    const replay = await this.progress.replay(tx, userId, body.operationId, action);
    if (replay) return replay;
    const session = await this.owned(tx, userId, id);
    if (session.status === 'COMPLETED') fail(409, 'SESSION_ALREADY_COMPLETED');
    this.available(session);
    if (
      reviews.length !== 5 ||
      answers.length !== 5 ||
      new Set(reviews.map((r) => r.vocabularyId)).size !== 5 ||
      new Set(answers.map((a) => a.questionId)).size !== 5 ||
      reviews.some((r) => !session.items.some((i) => i.vocabularyId === r.vocabularyId)) ||
      answers.some((a) => !session.items.some((i) => i.questionId === a.questionId))
    )
      fail(400, 'INVALID_SESSION_SUBMIT');
    const progress: Snapshot[] = [],
      graded: Array<{
        questionId: string;
        selectedOption: string;
        correctOption: string;
        isCorrect: boolean;
      }> = [];
    for (const item of [...session.items].sort((a, b) =>
      a.vocabularyId.localeCompare(b.vocabularyId),
    )) {
      const review = reviews.find((r) => r.vocabularyId === item.vocabularyId)!,
        answer = answers.find((a) => a.questionId === item.questionId)!;
      progress.push(
        await this.progress.reviewInTx(
          tx,
          userId,
          item.vocabularyId,
          review.quality,
          item.expectedRevision.toString(),
          body.operationId,
          at,
          id,
        ),
      );
      const isCorrect = answer.selectedOption === item.correctOption;
      await tx.vocabularySessionItem.update({
        where: { sessionId_vocabularyId: { sessionId: id, vocabularyId: item.vocabularyId } },
        data: {
          quality: review.quality,
          selectedOption: answer.selectedOption,
          quizCorrect: isCorrect,
        },
      });
      graded.push({
        questionId: item.questionId,
        selectedOption: answer.selectedOption,
        correctOption: item.correctOption,
        isCorrect,
      });
    }
    const result = {
      sessionId: id,
      operationId: body.operationId,
      status: 'COMPLETED',
      quizScore: graded.filter((a) => a.isCorrect).length,
      quizTotal: 5,
      completedAt: at.toISOString(),
      answers: graded,
      progress,
    };
    const changed = await tx.vocabularySession.updateMany({
      where: { id, userId, status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED',
        completedAt: at,
        operationId: body.operationId,
        submitHash: hash(action),
        result: inputJson(result),
      },
    });
    if (changed.count !== 1) fail(409, 'SESSION_ALREADY_COMPLETED');
    await this.progress.commit(tx, userId, body.operationId, action, result, progress, at);
    return result;
  }
  async cancel(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      const row = await this.owned(tx, userId, id);
      if (row.status === 'COMPLETED') fail(409, 'SESSION_ALREADY_COMPLETED');
      if (row.status !== 'CANCELED')
        await tx.vocabularySession.update({ where: { id }, data: { status: 'CANCELED' } });
      return { success: true };
    });
  }
}
