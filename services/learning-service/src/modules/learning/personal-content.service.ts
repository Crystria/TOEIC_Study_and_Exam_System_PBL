import { Injectable } from '@nestjs/common';
import {
  PersonalGrammarLesson,
  PersonalVocabulary,
  PersonalVocabularyTopic,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { fail, idempotent, Tx, userLock } from '../../core';
import {
  PersonalLessonCreate,
  PersonalLessonPatch,
  PersonalLessonQuery,
  PersonalTopicCreate,
  PersonalTopicPatch,
  PersonalTopicQuery,
  PersonalVocabularyCreate,
  PersonalVocabularyPatch,
  PersonalVocabularyQuery,
} from './personal-content.dto';

const timestamps = (row: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  deletedAt: null,
});

export const personalVocabularyView = (row: PersonalVocabulary) => ({
  ...timestamps(row),
  vocabularyId: row.id,
  topicId: row.topicId,
  word: row.word,
  phonetic: row.phonetic,
  definition: row.definition,
  example: row.example,
  audioUrl: null,
  imageUrl: null,
});

const lessonView = (row: PersonalGrammarLesson) => ({
  ...timestamps(row),
  lessonId: row.id,
  lessonTitle: row.lessonTitle,
  category: row.category,
  contentMarkdown: row.contentMarkdown,
  status: 'PRIVATE' as const,
});

const pageView = <T>(items: T[], total: number, page: number, size: number) => ({
  items,
  total,
  page,
  size,
  totalPages: Math.ceil(total / size),
});

function requirePatch(input: object) {
  if (!Object.values(input).some((value) => value !== undefined)) fail(400, 'EMPTY_CONTENT');
}

@Injectable()
export class PersonalContentService {
  constructor(private readonly db: PrismaService) {}

  private async topic(tx: Tx, userId: string, id: string) {
    const row = await tx.personalVocabularyTopic.findFirst({ where: { id, userId } });
    if (!row) fail(404, 'PERSONAL_CONTENT_NOT_FOUND');
    return row;
  }

  private async vocabulary(tx: Tx, userId: string, id: string) {
    const row = await tx.personalVocabulary.findFirst({ where: { id, userId } });
    if (!row) fail(404, 'PERSONAL_CONTENT_NOT_FOUND');
    return row;
  }

  private async lesson(tx: Tx, userId: string, id: string) {
    const row = await tx.personalGrammarLesson.findFirst({ where: { id, userId } });
    if (!row) fail(404, 'PERSONAL_CONTENT_NOT_FOUND');
    return row;
  }

  private async topicView(tx: Tx, row: PersonalVocabularyTopic) {
    return {
      ...timestamps(row),
      topicId: row.id,
      topicName: row.name,
      vocabularyCount: await tx.personalVocabulary.count({
        where: { topicId: row.id, userId: row.userId },
      }),
    };
  }

  private mutate<T>(userId: string, run: (tx: Tx) => Promise<T>) {
    return this.db.$transaction(async (tx) => {
      // Serialize the owner's edits, including moving words and deleting topics.
      await userLock(tx, userId);
      return run(tx);
    });
  }

  listTopics(userId: string, { page, size, keyword }: PersonalTopicQuery) {
    return this.db.$transaction(
      async (tx) => {
        const where: Prisma.PersonalVocabularyTopicWhereInput = {
          userId,
          name: keyword ? { contains: keyword, mode: 'insensitive' } : undefined,
        };
        const [rows, total] = await Promise.all([
          tx.personalVocabularyTopic.findMany({
            where,
            skip: (page - 1) * size,
            take: size,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          }),
          tx.personalVocabularyTopic.count({ where }),
        ]);
        return pageView(
          await Promise.all(rows.map((row) => this.topicView(tx, row))),
          total,
          page,
          size,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  readTopic(userId: string, id: string) {
    return this.db.$transaction(async (tx) => this.topicView(tx, await this.topic(tx, userId, id)));
  }

  createTopic(userId: string, input: PersonalTopicCreate, key: string) {
    return this.mutate(userId, (tx) =>
      idempotent(tx, userId, 'personal:topics:create', key, input, async () =>
        this.topicView(
          tx,
          await tx.personalVocabularyTopic.create({ data: { userId, name: input.topicName } }),
        ),
      ),
    );
  }

  patchTopic(userId: string, id: string, input: PersonalTopicPatch) {
    requirePatch(input);
    return this.mutate(userId, async (tx) => {
      await this.topic(tx, userId, id);
      return this.topicView(
        tx,
        await tx.personalVocabularyTopic.update({
          where: { id_userId: { id, userId } },
          data: { name: input.topicName },
        }),
      );
    });
  }

  removeTopic(userId: string, id: string) {
    return this.mutate(userId, async (tx) => {
      await this.topic(tx, userId, id);
      // The composite FK cascades only this owner's private words atomically.
      await tx.personalVocabularyTopic.delete({ where: { id_userId: { id, userId } } });
      return { id, deleted: true, success: true };
    });
  }

  listVocabulary(userId: string, { page, size, keyword, topicId }: PersonalVocabularyQuery) {
    return this.db.$transaction(
      async (tx) => {
        if (topicId) await this.topic(tx, userId, topicId);
        const where: Prisma.PersonalVocabularyWhereInput = {
          userId,
          topicId,
          OR: keyword
            ? [
                { word: { contains: keyword, mode: 'insensitive' } },
                { definition: { contains: keyword, mode: 'insensitive' } },
              ]
            : undefined,
        };
        const [rows, total] = await Promise.all([
          tx.personalVocabulary.findMany({
            where,
            skip: (page - 1) * size,
            take: size,
            orderBy: [{ word: 'asc' }, { id: 'asc' }],
          }),
          tx.personalVocabulary.count({ where }),
        ]);
        return pageView(rows.map(personalVocabularyView), total, page, size);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async readVocabulary(userId: string, id: string) {
    return personalVocabularyView(await this.vocabulary(this.db, userId, id));
  }

  createVocabulary(userId: string, input: PersonalVocabularyCreate, key: string) {
    return this.mutate(userId, (tx) =>
      idempotent(tx, userId, 'personal:vocabularies:create', key, input, async () => {
        await this.topic(tx, userId, input.topicId);
        return personalVocabularyView(
          await tx.personalVocabulary.create({
            data: {
              userId,
              topicId: input.topicId,
              word: input.word,
              phonetic: input.phonetic,
              definition: input.definition,
              example: input.example,
            },
          }),
        );
      }),
    );
  }

  patchVocabulary(userId: string, id: string, input: PersonalVocabularyPatch) {
    requirePatch(input);
    return this.mutate(userId, async (tx) => {
      await this.vocabulary(tx, userId, id);
      if (input.topicId) await this.topic(tx, userId, input.topicId);
      return personalVocabularyView(
        await tx.personalVocabulary.update({
          where: { id_userId: { id, userId } },
          data: {
            topicId: input.topicId,
            word: input.word,
            phonetic: input.phonetic,
            definition: input.definition,
            example: input.example,
          },
        }),
      );
    });
  }

  removeVocabulary(userId: string, id: string) {
    return this.mutate(userId, async (tx) => {
      await this.vocabulary(tx, userId, id);
      await tx.personalVocabulary.delete({ where: { id_userId: { id, userId } } });
      return { id, deleted: true, success: true };
    });
  }

  listLessons(userId: string, { page, size, keyword, category }: PersonalLessonQuery) {
    return this.db.$transaction(
      async (tx) => {
        const where: Prisma.PersonalGrammarLessonWhereInput = {
          userId,
          category,
          lessonTitle: keyword ? { contains: keyword, mode: 'insensitive' } : undefined,
        };
        const [rows, total] = await Promise.all([
          tx.personalGrammarLesson.findMany({
            where,
            skip: (page - 1) * size,
            take: size,
            orderBy: [{ lessonTitle: 'asc' }, { id: 'asc' }],
          }),
          tx.personalGrammarLesson.count({ where }),
        ]);
        return pageView(rows.map(lessonView), total, page, size);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async readLesson(userId: string, id: string) {
    return lessonView(await this.lesson(this.db, userId, id));
  }

  createLesson(userId: string, input: PersonalLessonCreate, key: string) {
    return this.mutate(userId, (tx) =>
      idempotent(tx, userId, 'personal:lessons:create', key, input, async () =>
        lessonView(
          await tx.personalGrammarLesson.create({
            data: {
              userId,
              lessonTitle: input.lessonTitle,
              category: input.category,
              contentMarkdown: input.contentMarkdown,
            },
          }),
        ),
      ),
    );
  }

  patchLesson(userId: string, id: string, input: PersonalLessonPatch) {
    requirePatch(input);
    return this.mutate(userId, async (tx) => {
      await this.lesson(tx, userId, id);
      return lessonView(
        await tx.personalGrammarLesson.update({
          where: { id_userId: { id, userId } },
          data: {
            lessonTitle: input.lessonTitle,
            category: input.category,
            contentMarkdown: input.contentMarkdown,
          },
        }),
      );
    });
  }

  removeLesson(userId: string, id: string) {
    return this.mutate(userId, async (tx) => {
      await this.lesson(tx, userId, id);
      await tx.personalGrammarLesson.delete({ where: { id_userId: { id, userId } } });
      return { id, deleted: true, success: true };
    });
  }
}
