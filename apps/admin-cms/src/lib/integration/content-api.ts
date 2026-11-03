import { gateway } from '../../../../web/src/lib/integration/client';
import {
  ContractError,
  count,
  id,
  list,
  matchingId,
  mediaUrl,
  optionalText,
  page,
  record,
  segment,
  text,
} from '../../../../web/src/lib/integration/contracts';
import { query } from '../../../../web/src/lib/integration/query';

export type ContentKind = 'topics' | 'vocabulary' | 'lessons';
const paths = { topics: 'vocabulary-topics', vocabulary: 'vocabularies', lessons: 'lessons' };
const fields = {
  topics: ['topicName'],
  vocabulary: ['topicId', 'word', 'phonetic', 'definition', 'example'],
  lessons: ['lessonTitle', 'category', 'contentMarkdown', 'status'],
};
export function parseContent(kind: ContentKind, value: unknown) {
  const r = record(value);
  return {
    id: id(r[kind === 'topics' ? 'topicId' : kind === 'vocabulary' ? 'vocabularyId' : 'lessonId']),
    title: text(
      r[kind === 'topics' ? 'topicName' : kind === 'vocabulary' ? 'word' : 'lessonTitle'],
    ),
    deleted: r.deletedAt != null,
    audioUrl: kind === 'vocabulary' ? mediaUrl(r.audioUrl) : null,
    imageUrl: kind === 'vocabulary' ? mediaUrl(r.imageUrl) : null,
    fields: Object.fromEntries(fields[kind].map((key) => [key, optionalText(r[key]) ?? ''])),
  };
}
export const contentApi = {
  list: (kind: ContentKind, params: URLSearchParams, signal?: AbortSignal) =>
    gateway(
      `learning/admin/${paths[kind]}?${query(kind === 'lessons' ? 'adminLessons' : kind === 'topics' ? 'topics' : 'words', params)}`,
      { signal },
    ).then((v) => page(v, (x) => parseContent(kind, x))),
  read: (kind: ContentKind, itemId: string, signal?: AbortSignal) =>
    gateway(`learning/admin/${paths[kind]}/${segment(itemId)}`, { signal }).then((v) =>
      matchingId(parseContent(kind, v), itemId),
    ),
  async save(kind: ContentKind, input: Record<string, string>, key: string, itemId?: string) {
    const body = Object.fromEntries(
      fields[kind].map((k) => [
        k,
        ['phonetic', 'example'].includes(k) ? input[k]?.trim() || null : input[k]?.trim(),
      ]),
    );
    const r = parseContent(
      kind,
      await gateway(`learning/admin/${paths[kind]}${itemId ? '/' + segment(itemId) : ''}`, {
        method: itemId ? 'PATCH' : 'POST',
        body,
        idempotencyKey: itemId ? undefined : key,
      }),
    );
    return itemId ? matchingId(r, itemId) : r;
  },
  async remove(kind: ContentKind, itemId: string) {
    if (
      record(
        await gateway(`learning/admin/${paths[kind]}/${segment(itemId)}`, { method: 'DELETE' }),
      ).success !== true
    )
      throw new ContractError('delete');
  },
};
export interface QuestionInput {
  part: number;
  type: string;
  questionText: string;
  difficulty: string;
  correctOption: string;
  explanation: string | null;
  transcript: string | null;
  groupId: string | null;
  positionInGroup: number | null;
  options: { optionCode: string; optionText: string }[];
  tags: string[];
}
export const emptyQuestion = (part = 5): QuestionInput => ({
  part,
  type: 'SINGLE_CHOICE',
  questionText: '',
  difficulty: 'MEDIUM',
  correctOption: 'A',
  explanation: null,
  transcript: null,
  groupId: null,
  positionInGroup: null,
  options: ['A', 'B', 'C', 'D']
    .slice(0, part === 2 ? 3 : 4)
    .map((optionCode) => ({ optionCode, optionText: '' })),
  tags: [],
});
export function parseBankQuestion(value: unknown) {
  const r = record(value);
  return {
    id: id(r.questionId),
    audioUrl: mediaUrl(r.audioUrl),
    imageUrl: mediaUrl(r.imageUrl),
    input: {
      part: count(r.part),
      type: text(r.type),
      questionText: optionalText(r.questionText) ?? '',
      difficulty: text(r.difficulty),
      correctOption: text(r.correctOption),
      explanation: optionalText(r.explanation),
      transcript: optionalText(r.transcript),
      groupId: optionalText(r.groupId),
      positionInGroup: r.positionInGroup == null ? null : count(r.positionInGroup),
      options: list(r.options, (v) => {
        const o = record(v);
        return { optionCode: text(o.optionCode), optionText: text(o.optionText) };
      }),
      tags: list(r.tags, (v) => text(v)),
    } satisfies QuestionInput,
  };
}
export function parseGroup(value: unknown) {
  const r = record(value);
  return {
    id: id(r.groupId),
    audioUrl: mediaUrl(r.audioUrl),
    part: count(r.part),
    type: text(r.type),
    instruction: optionalText(r.instruction) ?? '',
    passageText: optionalText(r.passageText) ?? '',
    transcript: optionalText(r.transcript) ?? '',
    assets: list(r.assets ?? [], (value) => {
      const a = record(value);
      return {
        kind: text(a.kind),
        url: mediaUrl(a.publicUrl),
        storageKey: optionalText(a.storageKey),
        content: optionalText(a.content),
        orderNo: count(a.orderNo),
      };
    }),
    questionIds: list(r.questionIds, (v) => id(v)),
    audioKey: optionalText(r.audioKey),
  };
}
export const bankApi = {
  question: (itemId: string, signal?: AbortSignal) =>
    gateway(`questions/${segment(itemId)}`, { signal }).then((v) =>
      matchingId(parseBankQuestion(v), itemId),
    ),
  async saveQuestion(body: QuestionInput, itemId?: string) {
    const q = parseBankQuestion(
      await gateway(`questions${itemId ? '/' + segment(itemId) : ''}`, {
        method: itemId ? 'PATCH' : 'POST',
        body: { ...body, tags: body.tags.map((v) => v.trim()).filter(Boolean) },
      }),
    );
    return itemId ? matchingId(q, itemId) : q;
  },
  groups: (params: URLSearchParams, signal?: AbortSignal) =>
    gateway(`question-groups?${query('groups', params)}`, { signal }).then((v) =>
      page(v, parseGroup),
    ),
  group: (itemId: string, signal?: AbortSignal) =>
    gateway(`question-groups/${segment(itemId)}`, { signal }).then((v) =>
      matchingId(parseGroup(v), itemId),
    ),
  async saveGroup(
    input: {
      part: number;
      type: string;
      instruction: string;
      passageText: string;
      transcript: string;
      assets?: {
        kind: string;
        storageKey: string | null;
        content: string | null;
        orderNo: number;
      }[];
      questionOrder?: string[];
    },
    questions: QuestionInput[],
    itemId?: string,
  ) {
    const g = parseGroup(
      await gateway(`question-groups${itemId ? '/' + segment(itemId) : ''}`, {
        method: itemId ? 'PATCH' : 'POST',
        body: {
          ...input,
          ...(input.assets
            ? {
                assets: input.assets.map(({ kind, storageKey, content, orderNo }) => ({
                  kind,
                  storageKey,
                  content,
                  orderNo,
                })),
              }
            : {}),
          ...(itemId
            ? {}
            : {
                questions: questions.map((q, index) => ({
                  ...q,
                  part: input.part,
                  positionInGroup: index + 1,
                  groupId: undefined,
                })),
              }),
        },
      }),
    );
    return itemId ? matchingId(g, itemId) : g;
  },
  async removeGroup(itemId: string) {
    if (
      record(await gateway(`question-groups/${segment(itemId)}`, { method: 'DELETE' })).success !==
      true
    )
      throw new ContractError('delete');
  },
};
