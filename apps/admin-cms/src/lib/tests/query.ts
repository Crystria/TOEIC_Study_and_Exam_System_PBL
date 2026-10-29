import { parseDemoRole } from '../demo/cms-fixtures';
import {
  DEFAULT_TEST_QUERY,
  type TestQuery,
  type TestPreview,
  type TestPage,
  type TestSummary,
} from './types';

export function readTestParams(params: URLSearchParams) {
  let corrected = false;
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
  const query: TestQuery = {
    keyword: value('keyword').trim(),
    type: choice('type', ['FULL', 'MINI'] as const, ''),
    status: choice('status', ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, ''),
    page: integer('page', 1),
    size: integer('size', DEFAULT_TEST_QUERY.size, 50),
  };
  const preview = choice(
    'testPreview',
    ['normal', 'slow', 'empty', 'error'] as const,
    'normal',
  ) as TestPreview;
  const rawRole = choice('demoRole', ['CONTENT_ADMIN', 'SYSTEM_ADMIN'] as const, 'CONTENT_ADMIN');
  return { query, preview, role: parseDemoRole(rawRole), corrected };
}
export function testHref(current: URLSearchParams, query: TestQuery, preview: TestPreview): string {
  const params = new URLSearchParams();
  params.set('demoRole', readTestParams(current).role);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.type) params.set('type', query.type);
  if (query.status) params.set('status', query.status);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.size !== DEFAULT_TEST_QUERY.size) params.set('size', String(query.size));
  if (preview !== 'normal') params.set('testPreview', preview);
  return `/tests?${params}`;
}
// Local title substring only. No database/collation or API equivalence is claimed.
export function selectTestPage(catalog: readonly TestSummary[], query: TestQuery): TestPage {
  const keyword = query.keyword.toLocaleLowerCase('vi-VN');
  const filtered = catalog.filter(
    (item) =>
      (!keyword || item.title.toLocaleLowerCase('vi-VN').includes(keyword)) &&
      (!query.type || item.type === query.type) &&
      (!query.status || item.status === query.status),
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
