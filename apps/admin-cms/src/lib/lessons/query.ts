import { parseDemoRole } from '../demo/cms-fixtures';
import {
  LESSON_DEMO_PAGE_SIZE,
  type LessonQuery,
  type LessonPreview,
  type LessonPage,
  type LessonSummary,
} from './types';

export function readLessonParams(params: URLSearchParams) {
  const supported = ['keyword', 'category', 'page', 'lessonPreview', 'demoRole'];
  let corrected = [...params.keys()].some((key) => !supported.includes(key));
  function value(key: string) {
    if (params.getAll(key).length > 1) {
      corrected = true;
      return '';
    }
    return params.get(key) ?? '';
  }
  const rawPage = value('page');
  const number = Number(rawPage);
  const validPage = /^\d+$/.test(rawPage) && Number.isSafeInteger(number) && number >= 1;
  if (rawPage && !validPage) corrected = true;
  const rawPreview = value('lessonPreview');
  const validPreview = ['normal', 'slow', 'empty', 'error'].includes(rawPreview);
  if (rawPreview && !validPreview) corrected = true;
  const rawRole = value('demoRole');
  if (rawRole && !['CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(rawRole)) corrected = true;
  const query: LessonQuery = {
    keyword: value('keyword').trim(),
    category: value('category').trim(),
    page: validPage ? number : 1,
  };
  return {
    query,
    preview: (validPreview ? rawPreview : 'normal') as LessonPreview,
    role: parseDemoRole(rawRole),
    corrected,
  };
}

export function lessonHref(current: URLSearchParams, query: LessonQuery, preview: LessonPreview) {
  const params = new URLSearchParams();
  params.set('demoRole', readLessonParams(current).role);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.category) params.set('category', query.category);
  if (query.page !== 1) params.set('page', String(query.page));
  if (preview !== 'normal') params.set('lessonPreview', preview);
  return `/lessons?${params}`;
}

// Local title substring + exact category; neither is a supported Learning API query today.
export function selectLessonPage(
  catalog: readonly LessonSummary[],
  query: LessonQuery,
): LessonPage {
  const keyword = query.keyword.toLocaleLowerCase('vi-VN');
  const filtered = catalog.filter(
    (item) =>
      (!keyword || (item.title ?? '').toLocaleLowerCase('vi-VN').includes(keyword)) &&
      (!query.category || item.category === query.category),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / LESSON_DEMO_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);
  return {
    items: filtered.slice((page - 1) * LESSON_DEMO_PAGE_SIZE, page * LESSON_DEMO_PAGE_SIZE),
    total: filtered.length,
    catalogTotal: catalog.length,
    page,
    totalPages,
  };
}
