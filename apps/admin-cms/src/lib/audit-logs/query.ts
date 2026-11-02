import { parseDemoRole } from '../demo/cms-fixtures';
import {
  AUDIT_DEMO_PAGE_SIZES,
  DEFAULT_AUDIT_QUERY,
  type AuditQuery,
  type AuditPreview,
  type AuditPage,
  type AuditLogSummary,
} from './types';

export function readAuditParams(params: URLSearchParams) {
  const supported = ['keyword', 'action', 'page', 'size', 'auditPreview', 'demoRole'];
  let corrected = [...params.keys()].some((key) => !supported.includes(key));
  function value(key: string) {
    if (params.getAll(key).length > 1) {
      corrected = true;
      return '';
    }
    return params.get(key) ?? '';
  }
  function choice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
    const raw = value(key);
    if (!raw) return fallback;
    if (choices.includes(raw as T)) return raw as T;
    corrected = true;
    return fallback;
  }
  function integer(key: string, fallback: number) {
    const raw = value(key);
    if (!raw) return fallback;
    const number = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(number) || number < 1) {
      corrected = true;
      return fallback;
    }
    return number;
  }
  let size = integer('size', DEFAULT_AUDIT_QUERY.size);
  if (!AUDIT_DEMO_PAGE_SIZES.some((item) => item === size)) {
    corrected = true;
    size = DEFAULT_AUDIT_QUERY.size;
  }
  const query: AuditQuery = {
    keyword: value('keyword').trim(),
    // Open string: a code outside the fixture is retained as a no-match filter.
    action: value('action').trim(),
    page: integer('page', 1),
    size,
  };
  const preview = choice('auditPreview', ['normal', 'slow', 'empty', 'error'] as const, 'normal');
  const role = parseDemoRole(
    choice('demoRole', ['CONTENT_ADMIN', 'SYSTEM_ADMIN'] as const, 'CONTENT_ADMIN'),
  );
  return { query, preview, role, corrected };
}
export function auditHref(
  current: URLSearchParams,
  query: AuditQuery,
  preview: AuditPreview,
): string {
  const params = new URLSearchParams();
  params.set('demoRole', readAuditParams(current).role);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.action) params.set('action', query.action);
  if (query.page !== 1) params.set('page', String(query.page));
  if (query.size !== DEFAULT_AUDIT_QUERY.size) params.set('size', String(query.size));
  if (preview !== 'normal') params.set('auditPreview', preview);
  return `/audit-logs?${params}`;
}
// All filtering/paging is local. Stable fixture order is not database query order.
// Search over literal IDs/action/targetType only; exact action with AND keyword.
export function selectAuditPage(catalog: readonly AuditLogSummary[], query: AuditQuery): AuditPage {
  const keyword = query.keyword.toLocaleLowerCase('vi-VN');
  const filtered = catalog.filter(
    (item) =>
      (!keyword ||
        [item.id, item.action, item.userId, item.targetType, item.targetId].some((text) =>
          (text ?? '').toLocaleLowerCase('vi-VN').includes(keyword),
        )) &&
      (!query.action || item.action === query.action),
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
