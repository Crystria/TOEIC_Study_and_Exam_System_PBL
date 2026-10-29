import { parseDemoRole } from '../demo/cms-fixtures';
import {
  DEFAULT_VOCABULARY_QUERY,
  type VocabularyQuery,
  type VocabularyPreview,
  type VocabularyPage,
  type VocabularySummary,
} from './types';

export function readVocabularyParams(params: URLSearchParams) {
  const supported = ['keyword', 'topicId', 'page', 'size', 'vocabularyPreview', 'demoRole'];
  let corrected = [...params.keys()].some((key) => !supported.includes(key));
  function value(key: string) {
    if (params.getAll(key).length > 1) {
      corrected = true;
      return '';
    }
    return params.get(key) ?? '';
  }
  function choice<T extends string>(key: string, choices: readonly T[], fallback: T | ''): T | '' {
    const raw = value(key);
    if (!raw) return fallback;
    if (choices.includes(raw as T)) return raw as T;
    corrected = true;
    return fallback;
  }
  function integer(key: string, fallback: number, max = Number.MAX_SAFE_INTEGER) {
    const raw = value(key);
    if (!raw) return fallback;
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1 || number > max) {
      corrected = true;
      return fallback;
    }
    return number;
  }
  const query: VocabularyQuery = {
    keyword: value('keyword').trim(),
    topicId: value('topicId').trim(),
    page: integer('page', 1),
    size: integer('size', DEFAULT_VOCABULARY_QUERY.size, 50),
  };
  const preview = choice(
    'vocabularyPreview',
    ['normal', 'slow', 'empty', 'error'] as const,
    'normal',
  ) as VocabularyPreview;
  const rawRole = choice('demoRole', ['CONTENT_ADMIN', 'SYSTEM_ADMIN'] as const, 'CONTENT_ADMIN');
  return { query, preview, role: parseDemoRole(rawRole), corrected };
}
export function vocabularyHref(
  current: URLSearchParams,
  query: VocabularyQuery,
  preview: VocabularyPreview,
): string {
  const params = new URLSearchParams();
  params.set('demoRole', readVocabularyParams(current).role);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.topicId) params.set('topicId', query.topicId);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.size !== DEFAULT_VOCABULARY_QUERY.size) params.set('size', String(query.size));
  if (preview !== 'normal') params.set('vocabularyPreview', preview);
  return `/vocabulary?${params}`;
}
// Local word/meaning substring + exact topic ID. Database collation equivalence is not claimed.
export function selectVocabularyPage(
  catalog: readonly VocabularySummary[],
  query: VocabularyQuery,
): VocabularyPage {
  const keyword = query.keyword.toLocaleLowerCase('vi-VN');
  const filtered = catalog.filter(
    (item) =>
      (!keyword ||
        [item.word, item.meaning].some((text) =>
          (text ?? '').toLocaleLowerCase('vi-VN').includes(keyword),
        )) &&
      (!query.topicId || item.topicId === query.topicId),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / query.size));
  const page = Math.min(query.page, totalPages);
  return {
    items: filtered.slice((page - 1) * query.size, page * query.size),
    total: filtered.length,
    catalogTotal: catalog.length,
    page,
    size: query.size,
    totalPages,
  };
}
