import { readVocabularyParams, vocabularyHref } from './query';
import { VOCABULARY_DETAIL_PREVIEWS, type VocabularyDetailPreview } from './detail-types';

// Decode the route segment once at the page boundary, never again inside the reader/href builder.
export function decodeVocabularySegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function readVocabularyDetailParams(params: URLSearchParams) {
  const listParams = new URLSearchParams(params);
  listParams.delete('detailPreview');
  const list = readVocabularyParams(listParams);
  const values = params.getAll('detailPreview');
  const raw = values.length === 1 ? values[0] : '';
  const valid = VOCABULARY_DETAIL_PREVIEWS.includes(raw as VocabularyDetailPreview);
  const preview: VocabularyDetailPreview = valid ? (raw as VocabularyDetailPreview) : 'normal';
  const backHref = vocabularyHref(listParams, list.query, list.preview);
  const normalized = new URLSearchParams(backHref.split('?')[1]);
  if (preview !== 'normal') normalized.set('detailPreview', preview);
  return {
    preview,
    backHref,
    search: normalized.toString(),
    corrected: list.corrected || values.length > 1 || Boolean(raw && !valid),
  };
}

export function vocabularyDetailHref(id: string, params: URLSearchParams): string {
  // Dot-only/empty segments would be normalized as navigation rather than an opaque ID.
  if (!id || id === '.' || id === '..') throw new RangeError('ID must be a path segment');
  return `/vocabulary/${encodeURIComponent(id)}?${readVocabularyDetailParams(params).search}`;
}
