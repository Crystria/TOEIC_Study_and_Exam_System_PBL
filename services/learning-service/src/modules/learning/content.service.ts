import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import { PrismaService } from '../../prisma/prisma.service';
import { GrammarLesson, Vocabulary, VocabularyTopic, Prisma } from '../../generated/prisma';
import { Tx, contentAudit, contentLock, fail, idempotent, normalized } from '../../core';
import { ContentKind, ContentInput, SearchQuery } from './queries';
import { LearningMediaService } from './media.service';
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false }).disable('image');
markdown.validateLink = (url: string) => {
  try {
    // eslint-disable-next-line no-control-regex -- Strip ASCII controls/spaces so an obfuscated unsafe scheme cannot bypass validation.
    const sanitizedUrl = url.replace(/[\u0000-\u0020]/g, '');
    return ['https:', 'http:'].includes(new URL(sanitizedUrl, 'https://learning.invalid').protocol);
  } catch {
    return false;
  }
};
@Injectable()
export class ContentService {
  constructor(
    private readonly db: PrismaService,
    private readonly media: LearningMediaService,
  ) {}
  async present(
    kind: ContentKind,
    row: VocabularyTopic | Vocabulary | GrammarLesson,
    tx: Tx = this.db,
  ) {
    const base = {
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
    if (kind === 'topics') {
      const r = row as VocabularyTopic;
      return {
        ...base,
        topicId: r.id,
        topicName: r.name,
        vocabularyCount: await tx.vocabulary.count({ where: { topicId: r.id, deletedAt: null } }),
      };
    }
    if (kind === 'vocabularies') {
      const r = row as Vocabulary;
      return {
        ...base,
        vocabularyId: r.id,
        topicId: r.topicId,
        word: r.word,
        phonetic: r.phonetic,
        definition: r.definition,
        example: r.example,
        audioKey: r.audioKey,
        imageKey: r.imageKey,
        audioUrl: this.media.url(r.audioKey),
        imageUrl: this.media.url(r.imageKey),
      };
    }
    const r = row as GrammarLesson;
    return {
      ...base,
      lessonId: r.id,
      lessonTitle: r.lessonTitle,
      category: r.category,
      contentMarkdown: r.contentMarkdown,
      status: r.status,
      contentHtml: markdown.render(r.contentMarkdown),
      renderPolicy: 'NO_RAW_HTML',
    };
  }
  async list(
    kind: ContentKind,
    query: SearchQuery & {
      topicId?: string;
      category?: string;
      status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    },
    admin = false,
  ) {
    const { page, size, keyword } = query,
      skip = (page - 1) * size;
    return this.db.$transaction(
      async (tx) => {
        let rows: Array<VocabularyTopic | Vocabulary | GrammarLesson>, total: number;
        if (kind === 'topics') {
          const where: Prisma.VocabularyTopicWhereInput = {
            ...(!admin ? { deletedAt: null } : {}),
            name: keyword ? { contains: keyword, mode: 'insensitive' } : undefined,
          };
          [rows, total] = await Promise.all([
            tx.vocabularyTopic.findMany({
              where,
              skip,
              take: size,
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
            }),
            tx.vocabularyTopic.count({ where }),
          ]);
        } else if (kind === 'vocabularies') {
          const where: Prisma.VocabularyWhereInput = {
            ...(!admin ? { deletedAt: null, topic: { deletedAt: null } } : {}),
            topicId: query.topicId,
            OR: keyword
              ? [
                  { word: { contains: keyword, mode: 'insensitive' } },
                  { definition: { contains: keyword, mode: 'insensitive' } },
                ]
              : undefined,
          };
          [rows, total] = await Promise.all([
            tx.vocabulary.findMany({
              where,
              skip,
              take: size,
              orderBy: [{ word: 'asc' }, { id: 'asc' }],
            }),
            tx.vocabulary.count({ where }),
          ]);
        } else {
          const where: Prisma.GrammarLessonWhereInput = {
            ...(!admin
              ? { deletedAt: null, status: 'PUBLISHED' as const }
              : { status: query.status }),
            category: query.category,
            lessonTitle: keyword ? { contains: keyword, mode: 'insensitive' } : undefined,
          };
          [rows, total] = await Promise.all([
            tx.grammarLesson.findMany({
              where,
              skip,
              take: size,
              orderBy: [{ lessonTitle: 'asc' }, { id: 'asc' }],
            }),
            tx.grammarLesson.count({ where }),
          ]);
        }
        return {
          items: await Promise.all(rows.map((row) => this.present(kind, row, tx))),
          total,
          page,
          size,
          totalPages: Math.ceil(total / size),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async get(kind: ContentKind, id: string, admin = false, tx: Tx = this.db) {
    const row =
      kind === 'topics'
        ? await tx.vocabularyTopic.findUnique({ where: { id } })
        : kind === 'vocabularies'
          ? await tx.vocabulary.findUnique({ where: { id }, include: { topic: true } })
          : await tx.grammarLesson.findUnique({ where: { id } });
    if (
      !row ||
      (!admin &&
        (row.deletedAt ||
          (kind === 'lessons' && (row as GrammarLesson).status !== 'PUBLISHED') ||
          (kind === 'vocabularies' &&
            (row as Vocabulary & { topic: VocabularyTopic }).topic.deletedAt)))
    )
      fail(404, 'CONTENT_NOT_FOUND');
    return row;
  }
  async create(kind: ContentKind, input: ContentInput, actor: string, key: string, cid: string) {
    validateContent(input);
    try {
      return await this.db.$transaction(async (tx) => {
        await contentLock(tx);
        return idempotent(tx, actor, `${kind}:create`, key, input, async () => {
          let row: VocabularyTopic | Vocabulary | GrammarLesson;
          if (kind === 'topics')
            row = await tx.vocabularyTopic.create({ data: { name: input.topicName! } });
          else if (kind === 'vocabularies') {
            await this.get('topics', input.topicId!, false, tx);
            row = await tx.vocabulary.create({
              data: {
                topicId: input.topicId!,
                word: input.word!,
                wordKey: normalized(input.word!),
                phonetic: input.phonetic,
                definition: input.definition!,
                definitionKey: normalized(input.definition!),
                example: input.example,
              },
            });
          } else
            row = await tx.grammarLesson.create({
              data: {
                lessonTitle: input.lessonTitle!,
                category: input.category!,
                contentMarkdown: input.contentMarkdown!,
                status: input.status!,
                slug: requireSlug(input.lessonTitle!),
                legacyLevel: 'P3',
              },
            });
          const result = await this.present(kind, row, tx);
          await contentAudit(tx, actor, row.id, `${kind.toUpperCase()}_CREATED`, null, result, cid);
          return result;
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') fail(409, 'DUPLICATE_CONTENT');
      throw error;
    }
  }
  async patch(kind: ContentKind, id: string, input: ContentInput, actor: string, cid: string) {
    validateContent(input);
    try {
      return await this.db.$transaction(async (tx) => {
        await contentLock(tx);
        const before = await this.get(kind, id, true, tx);
        if (before.deletedAt) fail(409, 'CONTENT_ARCHIVED');
        let row: VocabularyTopic | Vocabulary | GrammarLesson;
        if (kind === 'topics')
          row = await tx.vocabularyTopic.update({ where: { id }, data: { name: input.topicName } });
        else if (kind === 'vocabularies') {
          if (input.topicId) await this.get('topics', input.topicId, false, tx);
          row = await tx.vocabulary.update({
            where: { id },
            data: {
              topicId: input.topicId,
              word: input.word,
              wordKey: input.word === undefined ? undefined : normalized(input.word),
              phonetic: input.phonetic,
              definition: input.definition,
              definitionKey:
                input.definition === undefined ? undefined : normalized(input.definition),
              example: input.example,
            },
          });
        } else
          row = await tx.grammarLesson.update({
            where: { id },
            data: {
              lessonTitle: input.lessonTitle,
              category: input.category,
              contentMarkdown: input.contentMarkdown,
              status: input.status,
            },
          });
        const result = await this.present(kind, row, tx);
        await contentAudit(
          tx,
          actor,
          id,
          `${kind.toUpperCase()}_UPDATED`,
          await this.present(kind, before, tx),
          result,
          cid,
        );
        return result;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') fail(409, 'DUPLICATE_CONTENT');
      throw error;
    }
  }
  async remove(kind: ContentKind, id: string, actor: string, cid: string) {
    return this.db.$transaction(async (tx) => {
      await contentLock(tx);
      const row = await this.get(kind, id, true, tx);
      if (row.deletedAt) return { success: true };
      const before = await this.present(kind, row, tx);
      if (kind === 'topics') {
        if (await tx.vocabulary.count({ where: { topicId: id, deletedAt: null } }))
          fail(409, 'TOPIC_NOT_EMPTY');
        await tx.vocabularyTopic.update({ where: { id }, data: { deletedAt: new Date() } });
      } else if (kind === 'vocabularies') {
        await tx.vocabulary.update({ where: { id }, data: { deletedAt: new Date() } });
        for (const objectKey of [(row as Vocabulary).audioKey, (row as Vocabulary).imageKey])
          if (objectKey) await this.media.garbage(tx, objectKey);
      } else
        await tx.grammarLesson.update({
          where: { id },
          data: { status: 'ARCHIVED', deletedAt: new Date() },
        });
      await contentAudit(
        tx,
        actor,
        id,
        `${kind.toUpperCase()}_DELETED`,
        before,
        { deleted: true },
        cid,
      );
      return { success: true };
    });
  }
}
function validateContent(input: ContentInput) {
  for (const key of [
    'topicName',
    'word',
    'definition',
    'lessonTitle',
    'category',
    'contentMarkdown',
  ] as const)
    if (input[key] !== undefined && !input[key]!.trim()) fail(400, 'EMPTY_CONTENT');
}
function requireSlug(title: string) {
  return (
    title
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .toLowerCase()
      .slice(0, 100) +
    '-' +
    randomUUID()
  );
}
