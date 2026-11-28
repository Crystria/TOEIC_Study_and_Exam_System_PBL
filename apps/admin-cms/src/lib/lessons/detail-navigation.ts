import { lessonHref, readLessonParams } from './query';
import type { LessonDetailPreview } from './detail-types';

export function decodeLessonSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function readLessonDetailParams(params: URLSearchParams) {
  const listParams = new URLSearchParams(params);
  listParams.delete('detailPreview');
  const list = readLessonParams(listParams);
  const values = params.getAll('detailPreview');
  const raw = values.length === 1 ? values[0] : '';
  const preview: LessonDetailPreview = raw === 'missing' || raw === 'long' ? raw : 'normal';
  // Existing list parser/serializer owns the allowlist, never caller-provided paths.
  const backHref = lessonHref(listParams, list.query, list.preview);
  const normalized = new URLSearchParams(backHref.split('?')[1]);
  if (preview !== 'normal') normalized.set('detailPreview', preview);
  return {
    preview,
    backHref,
    search: normalized.toString(),
    corrected:
      list.corrected ||
      values.length > 1 ||
      Boolean(raw && !['normal', 'missing', 'long'].includes(raw)),
  };
}

export function lessonDetailHref(id: string, params: URLSearchParams): string {
  return `/lessons/${encodeURIComponent(id)}?${readLessonDetailParams(params).search}`;
}
