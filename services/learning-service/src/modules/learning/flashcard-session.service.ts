import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { event, contentLock, fail, idempotent, inputJson, Tx, userLock } from '../../core';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentService } from './content.service';
import { personalVocabularyView } from './personal-content.service';
import { ProgressService } from './progress.service';
import {
  createDistractorPicker,
  personalQuizDefinitions,
  quizDefinitionLimit,
  sharedQuizDefinitions,
} from './quiz-distractors';
import { QuizAnswer, SessionReview, shuffle } from './session.service';
import { vietnamDate } from './sm2';

export interface FlashcardSessionCreate {
  topicId: string;
  scope: 'SHARED' | 'PERSONAL';
  mode: 'NEW' | 'REVIEW';
  limit: number;
}

export interface FlashcardSessionSubmit {
  operationId: string;
  reviews: SessionReview[];
  answers: QuizAnswer[];
}

interface HistoricalCards {
  topicUpdatedAt: string;
  words: Array<{ id: string; updatedAt: string; revision: string }>;
}

interface PracticeCard {
  id: string;
  word: string;
  definition: string;
  revision: bigint;
  snapshot: Prisma.InputJsonValue;
}

interface PracticeOption {
  code: string;
  text: string;
  vocabularyId?: string;
}

type Round = Prisma.FlashcardSessionGetPayload<{ include: { items: true } }>;

function quizFor(
  definition: string,
  distractors: Array<{ definition: string; vocabularyId?: string }>,
) {
  const confirmation = distractors.length === 0;
  const choices: (Omit<PracticeOption, 'code'> & { correct: boolean })[] = confirmation
    ? [
        { text: 'Có', correct: true },
        { text: 'Không', correct: false },
      ]
    : [
        { text: definition, correct: true },
        ...distractors.map((entry) => ({
          text: entry.definition,
          vocabularyId: entry.vocabularyId,
          correct: false,
        })),
      ];
  const options = shuffle(choices).map((choice, index) => ({ ...choice, code: 'ABCD'[index] }));
  return {
    direction: confirmation ? 'MEANING_CONFIRMATION' : 'WORD_TO_MEANING',
    options: options.map(({ code, text, vocabularyId }) => ({ code, text, vocabularyId })),
    correctOption: options.find((option) => option.correct)!.code,
  };
}

@Injectable()
export class FlashcardSessionService {
  constructor(
    private readonly db: PrismaService,
    private readonly content: ContentService,
    private readonly progress: ProgressService,
  ) {}

  private async owned(tx: Tx, userId: string, id: string) {
    const round = await tx.flashcardSession.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!round) fail(404, 'SESSION_NOT_FOUND');
    if (round.scope === 'PERSONAL') {
      // Keep private word and distractor snapshots inaccessible once their source is deleted.
      const vocabularyIds = new Set(round.items.map((item) => item.vocabularyId));
      for (const item of round.items) {
        for (const option of item.options as unknown as PracticeOption[]) {
          if (option.vocabularyId) vocabularyIds.add(option.vocabularyId);
        }
      }
      const [topic, activeCount] = await Promise.all([
        tx.personalVocabularyTopic.findUnique({
          where: { id_userId: { id: round.topicId, userId } },
          select: { id: true },
        }),
        tx.personalVocabulary.count({ where: { userId, id: { in: [...vocabularyIds] } } }),
      ]);
      if (!topic || activeCount !== vocabularyIds.size) fail(404, 'SESSION_NOT_FOUND');
    }
    return round;
  }

  private open(round: Round, at = new Date()) {
    if (round.status === 'COMPLETED') fail(409, 'SESSION_ALREADY_COMPLETED');
    if (round.status === 'CANCELED') fail(409, 'SESSION_CANCELED');
    if (round.status === 'EXPIRED' || round.expiresAt <= at) fail(409, 'SESSION_EXPIRED');
  }

  private view(round: Round) {
    return {
      sessionId: round.id,
      topicId: round.topicId,
      scope: round.scope,
      mode: round.mode,
      status:
        round.status === 'IN_PROGRESS' && round.expiresAt <= new Date() ? 'EXPIRED' : round.status,
      startedAt: round.startedAt.toISOString(),
      expiresAt: round.expiresAt.toISOString(),
      vocabularies: round.items.map((item) => item.snapshot),
      quiz: round.items.map((item) => {
        const { word, definition } = item.snapshot as { word: string; definition: string };
        return {
          questionId: item.questionId,
          vocabularyId: item.vocabularyId,
          prompt:
            item.direction === 'MEANING_CONFIRMATION'
              ? `“${word}” có nghĩa là “${definition}” phải không?`
              : word,
          direction: item.direction,
          options: (item.options as unknown as PracticeOption[]).map(({ code, text }) => ({
            code,
            text,
          })),
        };
      }),
      reviews: round.items
        .filter((item) => item.quality !== null)
        .map(({ vocabularyId, quality }) => ({ vocabularyId, quality })),
      result: round.result,
    };
  }

  async create(userId: string, body: FlashcardSessionCreate, key: string) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.view(await this.createInTx(tx, userId, body, key));
    });
  }

  private async createInTx(
    tx: Tx,
    userId: string,
    body: FlashcardSessionCreate,
    key: string,
    historicalAt?: Date,
    selection?: HistoricalCards,
  ) {
    const { sessionId } = await idempotent(
      tx,
      userId,
      'flashcard-session:create',
      key,
      selection ? { ...body, selection, startedAt: historicalAt?.toISOString() } : body,
      async () => {
        const at = historicalAt ?? new Date();
        const due = new Date(vietnamDate(at) + 'T00:00:00.000Z');
        const { cards, definitions } =
          body.scope === 'PERSONAL'
            ? await this.personalCards(tx, userId, body, due, at, selection)
            : await this.sharedCards(tx, userId, body, due, at, selection);
        if (!cards.length) fail(409, 'NO_ELIGIBLE_FLASHCARDS');
        const pickDistractors = createDistractorPicker(definitions);
        const round = await tx.flashcardSession.create({
          data: {
            userId,
            topicId: body.topicId,
            scope: body.scope,
            mode: body.mode,
            startedAt: at,
            expiresAt: new Date(at.getTime() + 86400000),
            items: {
              createMany: {
                data: cards.map((card, position) => {
                  const quiz = quizFor(card.definition, pickDistractors(card));
                  return {
                    questionId: randomUUID(),
                    vocabularyId: card.id,
                    position,
                    expectedRevision: card.revision,
                    snapshot: card.snapshot,
                    direction: quiz.direction,
                    options: inputJson(quiz.options),
                    correctOption: quiz.correctOption,
                  };
                }),
              },
            },
          },
          select: { id: true },
        });
        return { sessionId: round.id };
      },
    );
    return this.owned(tx, userId, sessionId);
  }

  private async sharedCards(
    tx: Tx,
    userId: string,
    body: FlashcardSessionCreate,
    due: Date,
    at: Date,
    selection?: HistoricalCards,
  ) {
    await contentLock(tx);
    const topic = await this.content.get('topics', body.topicId, false, tx);
    const where = {
      topicId: body.topicId,
      deletedAt: null,
      ...(selection && {
        id: { in: selection.words.map((word) => word.id) },
        createdAt: { lte: at },
      }),
    };
    const words =
      body.mode === 'NEW'
        ? (
            await tx.vocabulary.findMany({
              where: { ...where, progress: { none: { userId } } },
              orderBy: { id: 'asc' },
              take: body.limit,
            })
          ).map((word) => ({ word, revision: 0n }))
        : (
            await tx.userVocabularyProgress.findMany({
              where: { userId, vocabulary: where, nextReviewDate: { lte: due } },
              include: { vocabulary: true },
              orderBy: [{ nextReviewDate: 'asc' }, { vocabularyId: 'asc' }],
              take: body.limit,
            })
          ).map(({ vocabulary, revision }) => ({ word: vocabulary, revision }));
    this.checkSelection(topic, words, at, selection);
    const definitions = words.length
      ? await sharedQuizDefinitions(
          tx,
          body.topicId,
          quizDefinitionLimit(words.length),
          'CATALOG',
          selection ? at : null,
        )
      : [];
    const cards: PracticeCard[] = await Promise.all(
      words.map(async ({ word, revision }) => ({
        id: word.id,
        word: word.word,
        definition: word.definition,
        revision,
        snapshot: inputJson(await this.content.present('vocabularies', word, tx)),
      })),
    );
    return { cards, definitions };
  }

  private async personalCards(
    tx: Tx,
    userId: string,
    body: FlashcardSessionCreate,
    due: Date,
    at: Date,
    selection?: HistoricalCards,
  ) {
    const topic = await tx.personalVocabularyTopic.findUnique({
      where: { id_userId: { id: body.topicId, userId } },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    if (!topic) fail(404, 'PERSONAL_CONTENT_NOT_FOUND');
    const where = {
      userId,
      topicId: body.topicId,
      ...(selection && {
        id: { in: selection.words.map((word) => word.id) },
        createdAt: { lte: at },
      }),
    };
    const words =
      body.mode === 'NEW'
        ? (
            await tx.personalVocabulary.findMany({
              where: { ...where, progress: { none: { userId } } },
              orderBy: { id: 'asc' },
              take: body.limit,
            })
          ).map((word) => ({ word, revision: 0n }))
        : (
            await tx.userPersonalVocabularyProgress.findMany({
              where: { userId, vocabulary: where, nextReviewDate: { lte: due } },
              include: { vocabulary: true },
              orderBy: [{ nextReviewDate: 'asc' }, { vocabularyId: 'asc' }],
              take: body.limit,
            })
          ).map(({ vocabulary, revision }) => ({ word: vocabulary, revision }));
    this.checkSelection(topic, words, at, selection);
    const definitionLimit = quizDefinitionLimit(words.length);
    const definitions = words.length
      ? [
          ...(await personalQuizDefinitions(
            tx,
            userId,
            body.topicId,
            definitionLimit,
            selection ? at : null,
          )),
          ...(await sharedQuizDefinitions(
            tx,
            null,
            definitionLimit,
            'CATALOG',
            selection ? at : null,
          )),
        ]
      : [];
    const cards: PracticeCard[] = words.map(({ word, revision }) => ({
      id: word.id,
      word: word.word,
      definition: word.definition,
      revision,
      snapshot: inputJson({
        ...personalVocabularyView(word),
        audioKey: null,
        imageKey: null,
        partOfSpeech: null,
        englishDefinition: null,
      }),
    }));
    return { cards, definitions };
  }

  private checkSelection(
    topic: { createdAt: Date; updatedAt: Date },
    words: Array<{ word: { id: string; updatedAt: Date }; revision: bigint }>,
    at: Date,
    selection?: HistoricalCards,
  ) {
    if (!selection) return;
    const expected = new Map(selection.words.map((word) => [word.id, word]));
    if (
      topic.createdAt > at ||
      topic.updatedAt.toISOString() !== selection.topicUpdatedAt ||
      words.length !== expected.size ||
      words.some(({ word, revision }) => {
        const planned = expected.get(word.id);
        return (
          !planned ||
          planned.updatedAt !== word.updatedAt.toISOString() ||
          planned.revision !== revision.toString()
        );
      })
    )
      fail(409, 'HISTORICAL_FLASHCARD_SELECTION_CHANGED');
  }

  // Seed operations call this in a single user-locked transaction.
  async seedHistoricalSession(
    tx: Tx,
    userId: string,
    input: {
      topicId: string;
      scope: FlashcardSessionCreate['scope'];
      mode: FlashcardSessionCreate['mode'];
      startedAt: Date;
      completedAt: Date;
      selection: HistoricalCards;
      operationId: string;
    },
  ) {
    const { topicId, scope, mode, startedAt, completedAt, selection, operationId } = input;
    const limit = selection.words.length;
    if (limit < 1 || limit > 5 || startedAt >= completedAt || completedAt >= new Date())
      fail(400, 'INVALID_HISTORICAL_FLASHCARD_SESSION');
    const round = await this.createInTx(
      tx,
      userId,
      { topicId, scope, mode, limit },
      operationId,
      startedAt,
      selection,
    );
    const grades = mode === 'REVIEW' ? [5, 4, 4, 3, 5] : [4, 3, 5, 4, 2];
    const reviews = round.items.map(({ vocabularyId }, index) => ({
      vocabularyId,
      quality: grades[index],
    }));
    const answers = round.items.map(({ questionId, correctOption, options }, index) => ({
      questionId,
      selectedOption:
        mode === 'NEW' && index === round.items.length - 1 && round.items.length > 1
          ? (options as unknown as PracticeOption[]).find(({ code }) => code !== correctOption)!
              .code
          : correctOption,
    }));
    await this.reviewInTx(tx, userId, round, reviews, completedAt);
    await this.submitInTx(tx, userId, round.id, { operationId, reviews, answers }, completedAt);
    return {
      sessionId: round.id,
      reviewOperationIds: round.items.map(({ questionId }) => questionId),
    };
  }

  async get(userId: string, id: string) {
    return this.view(await this.owned(this.db, userId, id));
  }

  async review(userId: string, id: string, reviews: SessionReview[]) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.reviewInTx(tx, userId, await this.owned(tx, userId, id), reviews);
    });
  }

  private async reviewInTx(
    tx: Tx,
    userId: string,
    round: Round,
    reviews: SessionReview[],
    historicalAt?: Date,
  ) {
    const items = new Map(round.items.map((item) => [item.vocabularyId, item]));
    if (
      new Set(reviews.map((review) => review.vocabularyId)).size !== reviews.length ||
      reviews.some((review) => !items.has(review.vocabularyId))
    )
      fail(400, 'INVALID_SESSION_REVIEWS');
    const at = historicalAt ?? new Date();
    for (const review of reviews) {
      const item = items.get(review.vocabularyId)!;
      if (item.quality === review.quality) continue;
      if (item.quality !== null) fail(409, 'FLASHCARD_ALREADY_REVIEWED');
      this.open(round, historicalAt);
      const operationId = item.questionId;
      const progress =
        round.scope === 'PERSONAL'
          ? await this.progress.reviewPersonalInTx(
              tx,
              userId,
              item.vocabularyId,
              review.quality,
              item.expectedRevision,
              at,
              operationId,
              round.id,
            )
          : await this.progress.reviewInTx(
              tx,
              userId,
              item.vocabularyId,
              review.quality,
              item.expectedRevision.toString(),
              operationId,
              at,
              round.id,
            );
      if (round.scope === 'SHARED') {
        const action = { kind: 'REVIEW_VOCABULARY_SESSION_CARD', sessionId: round.id, ...review };
        await this.progress.commit(
          tx,
          userId,
          operationId,
          action,
          { operationId, progress: [progress] },
          [progress],
          at,
        );
      }
      await tx.flashcardSessionItem.update({
        where: { questionId: item.questionId },
        data: { quality: review.quality, reviewProgress: inputJson(progress) },
      });
    }
    return { success: true };
  }

  async submit(userId: string, id: string, body: FlashcardSessionSubmit) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      return this.submitInTx(tx, userId, id, body);
    });
  }

  private async submitInTx(
    tx: Tx,
    userId: string,
    id: string,
    body: FlashcardSessionSubmit,
    historicalAt?: Date,
  ) {
    const round = await this.owned(tx, userId, id);
    const action = {
      kind: 'SUBMIT_FLASHCARD_SESSION',
      sessionId: id,
      reviews: [...body.reviews].sort((a, b) => a.vocabularyId.localeCompare(b.vocabularyId)),
      answers: [...body.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
    };
    const replay = await this.progress.replay(tx, userId, body.operationId, action);
    if (replay) return replay;
    this.open(round, historicalAt);
    if (round.items.some((item) => item.quality === null)) fail(409, 'SESSION_REVIEWS_INCOMPLETE');
    const reviews = new Map(
      body.reviews.map(({ vocabularyId, quality }) => [vocabularyId, quality]),
    );
    const answers = new Map(
      body.answers.map(({ questionId, selectedOption }) => [questionId, selectedOption]),
    );
    const count = round.items.length;
    if (body.reviews.length !== count || body.answers.length !== count)
      fail(400, 'INVALID_SESSION_SUBMIT');
    const graded = round.items.map((item) => {
      const selectedOption = answers.get(item.questionId);
      const options = item.options as { code: string }[];
      if (
        reviews.get(item.vocabularyId) !== item.quality ||
        !options.some(({ code }) => code === selectedOption)
      )
        fail(400, 'INVALID_SESSION_SUBMIT');
      return {
        questionId: item.questionId,
        selectedOption,
        correctOption: item.correctOption,
        isCorrect: selectedOption === item.correctOption,
      };
    });
    const at = historicalAt ?? new Date();
    const result = {
      sessionId: id,
      operationId: body.operationId,
      status: 'COMPLETED',
      quizScore: graded.filter((item) => item.isCorrect).length,
      quizTotal: count,
      completedAt: at.toISOString(),
      answers: graded,
      progress: round.items.map((item) => item.reviewProgress),
    };
    await tx.flashcardSession.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: at, result: inputJson(result) },
    });
    await event(
      tx,
      id,
      'FlashcardSessionCompletedEvent.v2',
      {
        userId,
        sessionId: id,
        source: 'FLASHCARD',
        scope: round.scope,
        quizScore: result.quizScore,
        quizTotal: result.quizTotal,
        completedAt: result.completedAt,
      },
      at,
    );
    // Card ratings already recorded their own revisions and events.
    await this.progress.commit(tx, userId, body.operationId, action, result, [], at, false);
    return result;
  }

  async cancel(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await userLock(tx, userId);
      const round = await this.owned(tx, userId, id);
      if (round.status === 'COMPLETED') fail(409, 'SESSION_ALREADY_COMPLETED');
      if (round.status !== 'CANCELED') {
        await tx.flashcardSession.update({ where: { id }, data: { status: 'CANCELED' } });
      }
      return { success: true };
    });
  }
}
