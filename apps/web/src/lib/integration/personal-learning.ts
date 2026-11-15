import { gateway } from './client';
import {
  ContractError,
  id,
  matchingId,
  page,
  parseLesson,
  parseTopic,
  parseWord,
  record,
  segment,
} from './contracts';
import { query } from './query';

export interface PersonalTopicInput {
  topicName: string;
}

export interface PersonalWordInput {
  topicId: string;
  word: string;
  phonetic?: string | null;
  definition: string;
  example?: string | null;
}

export interface PersonalLessonInput {
  lessonTitle: string;
  category: string;
  contentMarkdown: string;
}

export type PersonalTopic = ReturnType<typeof parseTopic>;
export type PersonalWord = ReturnType<typeof parseWord>;
export type PersonalLesson = ReturnType<typeof parseLesson>;

function personalLesson(value: unknown): PersonalLesson {
  const result = parseLesson(value);
  if (result.status !== 'PRIVATE') throw new ContractError('personal.lesson.status');
  return result;
}

function inputFields(input: object, fields: readonly string[]) {
  const source = input as Record<string, unknown>;
  const body = Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(source, field) && source[field] !== undefined)
      .map((field) => {
        const value = source[field];
        return [
          field,
          typeof value === 'string'
            ? ['phonetic', 'example'].includes(field)
              ? value.trim() || null
              : value.trim()
            : value,
        ];
      }),
  );
  if (!Object.keys(body).length) throw new ContractError('personal.input');
  return body;
}

function collection<T extends { id: string }, Input extends object>(
  path: string,
  domain: 'topics' | 'words' | 'lessons',
  parse: (value: unknown) => T,
  fields: readonly (keyof Input & string)[],
) {
  const route = `learning/personal/${path}`;
  return {
    list: (params = new URLSearchParams(), signal?: AbortSignal) =>
      gateway(`${route}?${query(domain, params)}`, { signal }).then((value) => page(value, parse)),
    get: (itemId: string, signal?: AbortSignal) =>
      gateway(`${route}/${segment(itemId)}`, { signal }).then((value) =>
        matchingId(parse(value), itemId),
      ),
    create: (input: Input, idempotencyKey: string) =>
      gateway(route, {
        method: 'POST',
        body: inputFields(input, fields),
        idempotencyKey: id(idempotencyKey),
      }).then(parse),
    update: (itemId: string, input: Partial<Input>) =>
      gateway(`${route}/${segment(itemId)}`, {
        method: 'PATCH',
        body: inputFields(input, fields),
      }).then((value) => matchingId(parse(value), itemId)),
    async remove(itemId: string) {
      const response = record(await gateway(`${route}/${segment(itemId)}`, { method: 'DELETE' }));
      if (response.id !== itemId || response.deleted !== true)
        throw new ContractError('personal.delete');
      return { id: itemId, deleted: true as const };
    },
  };
}

export const personalLearningApi = {
  topics: collection<PersonalTopic, PersonalTopicInput>('vocabulary-topics', 'topics', parseTopic, [
    'topicName',
  ]),
  words: collection<PersonalWord, PersonalWordInput>('vocabularies', 'words', parseWord, [
    'topicId',
    'word',
    'phonetic',
    'definition',
    'example',
  ]),
  lessons: collection<PersonalLesson, PersonalLessonInput>('lessons', 'lessons', personalLesson, [
    'lessonTitle',
    'category',
    'contentMarkdown',
  ]),
};
