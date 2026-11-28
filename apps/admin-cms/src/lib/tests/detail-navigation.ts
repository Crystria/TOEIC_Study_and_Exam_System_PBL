import { readTestParams, testHref } from './query';
import type { TestDetailPreview } from './detail-types';

// App Router segment decoding is performed once; malformed text stays harmless.
export function decodeTestSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function readTestDetailParams(params: URLSearchParams) {
  const list = readTestParams(params);
  const values = params.getAll('detailPreview');
  const raw = values.length === 1 ? values[0] : '';
  const supported = ['normal', 'slow', 'missing', 'long', 'empty', 'error'];
  const preview: TestDetailPreview = supported.includes(raw)
    ? (raw as TestDetailPreview)
    : 'normal';
  // Never read returnTo or accept a caller-provided pathname. Only literal /tests
  // and the existing list parser/serializer determine the return destination.
  const backHref = testHref(new URLSearchParams({ demoRole: list.role }), list.query, list.preview);
  const normalized = new URLSearchParams(backHref.split('?')[1]);
  if (preview !== 'normal') normalized.set('detailPreview', preview);
  return {
    preview,
    backHref,
    search: normalized.toString(),
    corrected:
      list.corrected ||
      values.length > 1 ||
      Boolean(raw && !supported.includes(raw)) ||
      [...params.keys()].some((key) => !normalized.has(key) && params.get(key) !== ''),
  };
}

export function testDetailHref(id: string, params: URLSearchParams): string {
  return `/tests/${encodeURIComponent(id)}?${readTestDetailParams(params).search}`;
}
