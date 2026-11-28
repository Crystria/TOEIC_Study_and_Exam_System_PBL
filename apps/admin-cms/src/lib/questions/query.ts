import { parseDemoRole } from '../demo/cms-fixtures';
import {
  DEFAULT_QUERY,
  type Difficulty,
  type QuestionPage,
  type QuestionPart,
  type QuestionPreview,
  type QuestionQuery,
  type QuestionSummary,
} from './types';

export function readQuestionParams(params: URLSearchParams) {
  let corrected = false;
  function value(key: string): string {
    if (params.getAll(key).length > 1) {
      corrected = true;
      return '';
    }
    return params.get(key) ?? '';
  }
  function integer(key: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
    const raw = value(key);
    if (!raw) return fallback;
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1 || number > max) {
      corrected = true;
      return fallback;
    }
    return number;
  }
  const rawPart = value('part');
  const part = /^[1-7]$/.test(rawPart) ? (Number(rawPart) as QuestionPart) : '';
  if (rawPart && !part) corrected = true;
  const rawDifficulty = value('difficulty');
  const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(rawDifficulty)
    ? (rawDifficulty as Difficulty)
    : '';
  if (rawDifficulty && !difficulty) corrected = true;
  const rawPreview = value('questionPreview');
  const preview: QuestionPreview =
    rawPreview === 'slow' || rawPreview === 'empty' || rawPreview === 'error'
      ? rawPreview
      : 'normal';
  if (rawPreview && !['normal', 'slow', 'empty', 'error'].includes(rawPreview)) corrected = true;
  const rawRole = value('demoRole');
  if (rawRole && !['CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(rawRole)) corrected = true;
  const query: QuestionQuery = {
    keyword: value('keyword').trim(),
    part,
    difficulty,
    tag: value('tag').trim(),
    page: integer('page', 1),
    size: integer('size', DEFAULT_QUERY.size, 50),
  };
  return { query, preview, role: parseDemoRole(rawRole), corrected };
}

export function questionHref(
  current: URLSearchParams,
  query: QuestionQuery,
  preview: QuestionPreview,
): string {
  const params = new URLSearchParams();
  params.set('demoRole', parseDemoRole(current.get('demoRole')));
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.part) params.set('part', String(query.part));
  if (query.difficulty) params.set('difficulty', query.difficulty);
  if (query.tag) params.set('tag', query.tag);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.size !== DEFAULT_QUERY.size) params.set('size', String(query.size));
  if (preview !== 'normal') params.set('questionPreview', preview);
  return `/questions?${params}`;
}

// Deliberately simple local substring search, not Elasticsearch multi_match emulation.
export function selectQuestionPage(
  catalog: readonly QuestionSummary[],
  query: QuestionQuery,
): QuestionPage {
  const keyword = query.keyword.toLocaleLowerCase('en-US');
  const filtered = catalog.filter(
    (item) =>
      (!keyword ||
        `${item.stem} ${item.explanation}`.toLocaleLowerCase('en-US').includes(keyword)) &&
      (!query.part || item.part === query.part) &&
      (!query.difficulty || item.difficulty === query.difficulty) &&
      (!query.tag || item.tags.includes(query.tag)),
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
