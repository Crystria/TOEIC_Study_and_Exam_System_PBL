import { questionHref, readQuestionParams } from './query';
import type { DetailPreview } from './detail-types';

// App Router supplies the encoded segment here. Decode exactly once, including
// literal percent sequences; malformed encoding remains harmless display text.
export function decodeQuestionSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function readDetailParams(params: URLSearchParams) {
  const list = readQuestionParams(params);
  const values = params.getAll('detailPreview');
  const raw = values.length === 1 ? values[0] : '';
  const supported = ['normal', 'slow', 'missing', 'long', 'empty', 'error'];
  const preview: DetailPreview = supported.includes(raw) ? (raw as DetailPreview) : 'normal';
  // No returnTo or caller-provided pathname is ever used. All navigation is built
  // from the existing list's allowlisted query parser and the literal /questions.
  const roleParams = new URLSearchParams({ demoRole: list.role });
  const backHref = questionHref(roleParams, list.query, list.preview);
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

export function questionDetailHref(id: string, params: URLSearchParams): string {
  return `/questions/${encodeURIComponent(id)}?${readDetailParams(params).search}`;
}
