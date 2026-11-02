import { parseDemoRole } from '../demo/cms-fixtures';
import {
  DEFAULT_USER_QUERY,
  USER_STATUSES,
  type UserQuery,
  type UserPreview,
  type UserPage,
  type UserSummary,
} from './types';

export function readUserParams(params: URLSearchParams) {
  const supported = ['keyword', 'status', 'page', 'size', 'userPreview', 'demoRole'];
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
  const query: UserQuery = {
    keyword: value('keyword').trim(),
    status: choice('status', USER_STATUSES, ''),
    page: integer('page', 1),
    size: integer('size', DEFAULT_USER_QUERY.size, 50),
  };
  const preview = choice(
    'userPreview',
    ['normal', 'slow', 'empty', 'error'] as const,
    'normal',
  ) as UserPreview;
  const rawRole = choice('demoRole', ['CONTENT_ADMIN', 'SYSTEM_ADMIN'] as const, 'CONTENT_ADMIN');
  return { query, preview, role: parseDemoRole(rawRole), corrected };
}
export function userHref(current: URLSearchParams, query: UserQuery, preview: UserPreview): string {
  const params = new URLSearchParams();
  params.set('demoRole', readUserParams(current).role);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.status) params.set('status', query.status);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.size !== DEFAULT_USER_QUERY.size) params.set('size', String(query.size));
  if (preview !== 'normal') params.set('userPreview', preview);
  return `/users?${params}`;
}
// Local fullName/email substring with AND status; no role filter exists in UsersService.
// Stable fixture order, not database collation/createdAt ordering or a server response.
export function selectUserPage(catalog: readonly UserSummary[], query: UserQuery): UserPage {
  const keyword = query.keyword.toLocaleLowerCase('vi-VN');
  const filtered = catalog.filter(
    (item) =>
      (!keyword ||
        [item.fullName, item.email].some((text) =>
          (text ?? '').toLocaleLowerCase('vi-VN').includes(keyword),
        )) &&
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
