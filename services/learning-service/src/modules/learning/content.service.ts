import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import MarkdownIt from 'markdown-it';
import { PrismaService } from '../../prisma/prisma.service';
import { GrammarLesson, Vocabulary, VocabularyTopic, Prisma } from '../../generated/prisma';
import {
  Tx,
  contentAudit,
  contentAuditData,
  contentLock,
  fail,
  idempotent,
  normalized,
} from '../../core';
import {
  ContentKind,
  ContentInput,
  SearchQuery,
  VocabularyBulkInput,
  VocabularyCreateItem,
  VocabularyImportInput,
} from './queries';
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
        partOfSpeech: r.partOfSpeech,
        definition: r.definition,
        englishDefinition: r.englishDefinition,
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
            deletedAt: null,
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
            deletedAt: null,
            ...(!admin ? { topic: { deletedAt: null } } : {}),
            topicId: query.topicId,
            OR: keyword
              ? [
                  { word: { contains: keyword, mode: 'insensitive' } },
                  { definition: { contains: keyword, mode: 'insensitive' } },
                  { englishDefinition: { contains: keyword, mode: 'insensitive' } },
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
            deletedAt: admin && query.status === 'ARCHIVED' ? undefined : null,
            status: admin ? (query.status ?? { not: 'ARCHIVED' }) : 'PUBLISHED',
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
            row = await tx.vocabulary.create({ data: vocabularyCreateData(input.topicId!, input) });
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
  async createVocabularyBulk(input: VocabularyBulkInput, actor: string, key: string, cid: string) {
    for (const item of input.items) validateContent(item);
    try {
      return await this.db.$transaction(async (tx) => {
        await contentLock(tx);
        return idempotent(tx, actor, 'vocabularies:create-bulk', key, input, async () => {
          await this.get('topics', input.topicId, false, tx);
          const data = input.items.map((item) => vocabularyCreateData(input.topicId, item));
          const rows = await tx.vocabulary.createManyAndReturn({ data });
          const rowsByWord = new Map(rows.map((row) => [row.wordKey, row]));
          const items = [];
          for (const { wordKey } of data) {
            const row = rowsByWord.get(wordKey)!;
            const result = await this.present('vocabularies', row, tx);
            await contentAudit(tx, actor, row.id, 'VOCABULARIES_CREATED', null, result, cid);
            items.push(result);
          }
          return { items };
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') fail(409, 'DUPLICATE_CONTENT');
      throw error;
    }
  }
  async importVocabulary(input: VocabularyImportInput, actor: string, key: string, cid: string) {
    const wordCount = validateVocabularyImport(input);
    try {
      return await this.db.$transaction(
        async (tx) => {
          await contentLock(tx);
          return idempotent(tx, actor, 'vocabularies:import', key, input, async () => {
            let createdCount = 0;
            let updatedCount = 0;
            for (const list of input.lists) {
              const topicId = await this.importTopic(tx, input.source, list.name, actor, cid);
              const { created, updated } = await this.importWords(
                tx,
                topicId,
                list.words,
                actor,
                cid,
              );
              createdCount += created;
              updatedCount += updated;
            }
            return {
              listCount: input.lists.length,
              wordCount,
              createdCount,
              updatedCount,
              unchangedCount: wordCount - createdCount - updatedCount,
            };
          });
        },
        { timeout: 25_000 },
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') fail(409, 'DUPLICATE_CONTENT');
      throw error;
    }
  }
  private async importTopic(tx: Tx, source: string, listName: string, actor: string, cid: string) {
    const name = listName.trim();
    const identity = { importSource: source, importListKey: normalized(name) };
    const existing = await tx.vocabularyTopic.findUnique({
      where: { importSource_importListKey: identity },
    });
    if (existing && existing.name === name && !existing.deletedAt) return existing.id;

    const before = existing ? await this.present('topics', existing, tx) : null;
    const topic = existing
      ? await tx.vocabularyTopic.update({
          where: { id: existing.id },
          data: { name, deletedAt: null },
        })
      : await tx.vocabularyTopic.create({ data: { name, ...identity } });
    await contentAudit(
      tx,
      actor,
      topic.id,
      existing ? 'TOPICS_UPDATED' : 'TOPICS_CREATED',
      before,
      await this.present('topics', topic, tx),
      cid,
    );
    return topic.id;
  }
  private async importWords(
    tx: Tx,
    topicId: string,
    words: VocabularyCreateItem[],
    actor: string,
    cid: string,
  ) {
    const imported = words.map((word) => vocabularyCreateData(topicId, word));
    const existing = await tx.vocabulary.findMany({
      where: { topicId, wordKey: { in: imported.map((word) => word.wordKey) } },
      orderBy: [{ deletedAt: { sort: 'desc', nulls: 'first' } }, { id: 'asc' }],
    });
    const byWord = new Map<string, Vocabulary>();
    for (const row of existing) {
      if (!byWord.has(row.wordKey)) byWord.set(row.wordKey, row);
    }

    const pending = [];
    const audits: Prisma.ContentAuditCreateManyInput[] = [];
    for (const data of imported) {
      const row = byWord.get(data.wordKey);
      if (!row) {
        pending.push(data);
        continue;
      }
      const unchanged = Object.entries(data).every(
        ([field, value]) => value === undefined || row[field as keyof typeof data] === value,
      );
      if (unchanged && !row.deletedAt) continue;

      const updated = await tx.vocabulary.update({
        where: { id: row.id },
        data: {
          ...data,
          // Archived vocabulary media may already have been removed by the cleanup worker.
          ...(row.deletedAt ? { deletedAt: null, audioKey: null, imageKey: null } : {}),
        },
      });
      audits.push(
        contentAuditData(
          actor,
          row.id,
          'VOCABULARIES_UPDATED',
          await this.present('vocabularies', row, tx),
          await this.present('vocabularies', updated, tx),
          cid,
        ),
      );
    }
    const updated = audits.length;
    const created = pending.length
      ? await tx.vocabulary.createManyAndReturn({ data: pending })
      : [];
    for (const row of created) {
      audits.push(
        contentAuditData(
          actor,
          row.id,
          'VOCABULARIES_CREATED',
          null,
          await this.present('vocabularies', row, tx),
          cid,
        ),
      );
    }
    if (audits.length) await tx.contentAudit.createMany({ data: audits });
    return { created: created.length, updated };
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
              partOfSpeech: input.partOfSpeech,
              definition: input.definition,
              englishDefinition: input.englishDefinition,
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
  async removeTopicVocabulary(topicId: string, actor: string, cid: string) {
    return this.db.$transaction(
      async (tx) => {
        await contentLock(tx);
        await this.get('topics', topicId, false, tx);
        const where = { topicId, deletedAt: null };
        const words = await tx.vocabulary.findMany({ where });
        if (!words.length) return { success: true, deletedCount: 0 };

        await tx.vocabulary.updateMany({ where, data: { deletedAt: new Date() } });
        const objectKeys = words.flatMap(({ audioKey, imageKey }) =>
          [audioKey, imageKey].filter((key): key is string => Boolean(key)),
        );
        await this.media.garbageMany(tx, objectKeys);
        const audits = await Promise.all(
          words.map(async (word) =>
            contentAuditData(
              actor,
              word.id,
              'VOCABULARIES_DELETED',
              await this.present('vocabularies', word, tx),
              { deleted: true },
              cid,
            ),
          ),
        );
        await tx.contentAudit.createMany({ data: audits });
        return { success: true, deletedCount: words.length };
      },
      { timeout: 25_000 },
    );
  }
}
function vocabularyCreateData(topicId: string, input: Partial<VocabularyCreateItem>) {
  return {
    topicId,
    word: input.word!,
    wordKey: normalized(input.word!),
    phonetic: input.phonetic,
    partOfSpeech: input.partOfSpeech,
    definition: input.definition!,
    englishDefinition: input.englishDefinition,
    definitionKey: normalized(input.definition!),
    example: input.example,
  };
}
function validateContent(input: ContentInput) {
  for (const key of [
    'topicName',
    'word',
    'definition',
    'partOfSpeech',
    'englishDefinition',
    'lessonTitle',
    'category',
    'contentMarkdown',
  ] as const)
    if (typeof input[key] === 'string' && !input[key].trim()) fail(400, 'EMPTY_CONTENT');
}
function validateVocabularyImport(input: VocabularyImportInput) {
  const wordCount = input.lists.reduce((count, list) => count + list.words.length, 0);
  if (wordCount > 5000) fail(400, 'IMPORT_LIMIT_EXCEEDED');

  const lists = new Set<string>();
  for (const { name, words } of input.lists) {
    const listKey = normalized(name);
    if (!listKey) fail(400, 'EMPTY_CONTENT');
    if (lists.has(listKey)) fail(409, 'DUPLICATE_IMPORT_LIST');
    lists.add(listKey);

    const wordKeys = new Set<string>();
    for (const word of words) {
      validateContent(word);
      const key = normalized(word.word);
      if (wordKeys.has(key)) fail(409, 'DUPLICATE_IMPORT_WORD');
      wordKeys.add(key);
    }
  }
  return wordCount;
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
