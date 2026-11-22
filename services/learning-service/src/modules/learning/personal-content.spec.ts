import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { PersonalContentService } from './personal-content.service';
import {
  PersonalLessonCreate,
  PersonalLessonPatch,
  PersonalTopicCreate,
  PersonalTopicPatch,
  PersonalVocabularyCreate,
  PersonalVocabularyPatch,
} from './personal-content.dto';

const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000010';
const now = new Date('2026-11-13T00:00:00.000Z');

describe('Personal content validation', () => {
  const invalid = (type: new () => object, body: object) =>
    validateSync(plainToInstance(type, body), { whitelist: true, forbidNonWhitelisted: true });

  it('rejects owner injection, whitespace, excessive length and null required patch values', () => {
    expect(invalid(PersonalTopicCreate, { topicName: 'Owned', userId: other })).not.toEqual([]);
    expect(invalid(PersonalTopicCreate, { topicName: ' \t\n ' })).not.toEqual([]);
    expect(invalid(PersonalTopicCreate, { topicName: 'x'.repeat(256) })).not.toEqual([]);
    expect(
      invalid(PersonalVocabularyCreate, { topicId: id, word: 'word', definition: ' ' }),
    ).not.toEqual([]);
    expect(
      invalid(PersonalLessonCreate, {
        lessonTitle: 'Title',
        category: 'Notes',
        contentMarkdown: 'x'.repeat(100001),
      }),
    ).not.toEqual([]);
    for (const [type, body] of [
      [PersonalTopicPatch, { topicName: null }],
      [PersonalVocabularyPatch, { topicId: null }],
      [PersonalVocabularyPatch, { word: null }],
      [PersonalVocabularyPatch, { definition: null }],
      [PersonalLessonPatch, { contentMarkdown: null }],
      [PersonalLessonPatch, { status: 'PUBLISHED' }],
    ] as Array<[new () => object, object]>)
      expect(invalid(type, body)).not.toEqual([]);
  });

  it('accepts partial edits and explicit clearing of nullable pronunciation/example', () => {
    expect(invalid(PersonalVocabularyPatch, { phonetic: null, example: null })).toEqual([]);
    expect(invalid(PersonalLessonPatch, { contentMarkdown: '# My notes' })).toEqual([]);
    expect(plainToInstance(PersonalTopicCreate, { topicName: '  Mine  ' }).topicName).toBe('Mine');
  });
});

describe('Personal content ownership', () => {
  function setup() {
    const row = {
      id,
      userId: user,
      name: 'Private',
      topicId: id,
      word: 'word',
      phonetic: null,
      definition: 'Meaning',
      example: null,
      lessonTitle: 'Note',
      category: 'My notes',
      contentMarkdown: '# Private',
      createdAt: now,
      updatedAt: now,
    };
    const model = () => ({
      findFirst: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(where.userId === user ? row : null),
      ),
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      delete: jest.fn().mockResolvedValue(row),
    });
    const db = {
      personalVocabularyTopic: model(),
      personalVocabulary: model(),
      personalGrammarLesson: model(),
      contentIdempotency: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((run: (tx: object) => unknown) => run(db));
    return { db, service: new PersonalContentService(db as unknown as PrismaService) };
  }

  it('returns indistinguishable 404s for reads, edits and deletion by another account', async () => {
    const { db, service } = setup();
    for (const call of [
      () => service.readTopic(other, id),
      () => service.patchTopic(other, id, { topicName: 'Stolen' }),
      () => service.removeTopic(other, id),
      () => service.readVocabulary(other, id),
      () => service.patchVocabulary(other, id, { word: 'Stolen' }),
      () => service.removeVocabulary(other, id),
      () => service.readLesson(other, id),
      () => service.patchLesson(other, id, { lessonTitle: 'Stolen' }),
      () => service.removeLesson(other, id),
    ])
      await expect(call()).rejects.toMatchObject({
        status: 404,
        response: { code: 'PERSONAL_CONTENT_NOT_FOUND' },
      });
    for (const model of [
      db.personalVocabularyTopic,
      db.personalVocabulary,
      db.personalGrammarLesson,
    ]) {
      expect(model.update).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
      expect(model.findFirst).toHaveBeenCalledWith({ where: { id, userId: other } });
    }
  });

  it('scopes every list/count to its owner and does not disclose owner identifiers', async () => {
    const { db, service } = setup();
    const topics = await service.listTopics(user, { page: 2, size: 1, keyword: 'Private' });
    const words = await service.listVocabulary(user, { page: 1, size: 10 });
    const lessons = await service.listLessons(user, { page: 1, size: 10, category: 'My notes' });
    for (const model of [
      db.personalVocabularyTopic,
      db.personalVocabulary,
      db.personalGrammarLesson,
    ]) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: user }) }),
      );
      expect(model.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: user }) }),
      );
    }
    expect(topics).toMatchObject({ page: 2, size: 1, total: 1 });
    expect(topics.items[0]).toMatchObject({
      topicId: id,
      topicName: 'Private',
      vocabularyCount: 1,
    });
    expect(words.items[0]).toMatchObject({ vocabularyId: id, audioUrl: null, imageUrl: null });
    expect(lessons.items[0]).toMatchObject({ lessonId: id, status: 'PRIVATE' });
    for (const item of [...topics.items, ...words.items, ...lessons.items])
      expect(item).not.toHaveProperty('userId');
  });

  it('rejects foreign topic references before writing vocabulary', async () => {
    const { db, service } = setup();
    await expect(
      service.createVocabulary(
        other,
        { topicId: id, word: 'word', definition: 'meaning' },
        'owned-key',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.personalVocabulary.create).not.toHaveBeenCalled();
  });

  it('requires nonempty patches and reuses a previously confirmed create result', async () => {
    const { db, service } = setup();
    expect(() => service.patchTopic(user, id, {})).toThrow();
    expect(() => service.patchVocabulary(user, id, {})).toThrow();
    expect(() => service.patchLesson(user, id, {})).toThrow();
    const first = await service.createTopic(user, { topicName: 'Private' }, 'same-key');
    const saved = db.contentIdempotency.create.mock.calls[0][0].data;
    db.contentIdempotency.findUnique.mockResolvedValue(saved);
    expect(await service.createTopic(user, { topicName: 'Private' }, 'same-key')).toEqual(first);
    expect(db.personalVocabularyTopic.create).toHaveBeenCalledTimes(1);
    await expect(
      service.createTopic(user, { topicName: 'Different' }, 'same-key'),
    ).rejects.toMatchObject({ status: 409 });
  });
});
