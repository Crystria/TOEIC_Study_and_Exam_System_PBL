import { LESSON_FIXTURES } from './fixtures';
import { hasLessonDetail } from './detail-availability';
import { LESSON_DETAIL_FIXTURES } from './detail-fixtures';
import type { LessonDetailFixture, LessonDetailPreview, LessonDetailResult } from './detail-types';
import type { LessonSummary } from './types';

// Synchronous in-memory projection. No async state, timers, auth or persistence.
export function readDemoLessonDetail(
  id: string,
  preview: LessonDetailPreview = 'normal',
  catalog: readonly LessonSummary[] = LESSON_FIXTURES,
  details: readonly LessonDetailFixture[] = LESSON_DETAIL_FIXTURES,
): LessonDetailResult {
  const summary = catalog.find((item) => item.id === id);
  if (!summary) return { kind: 'not-found' };
  const detail = details.find((item) => item.id === id);
  if (!hasLessonDetail(id) || !detail) return { kind: 'unsupported' };
  const lesson = {
    id: summary.id,
    title: summary.title,
    category: summary.category,
    body: structuredClone(detail.body),
  };
  if (preview === 'missing') {
    lesson.title = null;
    lesson.category = null;
    lesson.body = { theory: null, structures: null, examples: null, notes: null };
  }
  if (preview === 'long') {
    const text = 'Văn bản dài chỉ để kiểm UI. <strong>Chữ thuần</strong>\n';
    const unbroken = 'LongLiteralText'.repeat(80);
    lesson.title = `${lesson.title ?? ''} ${unbroken}`;
    lesson.category = `${lesson.category ?? ''} ${unbroken}`;
    lesson.body = {
      theory: [...(lesson.body.theory ?? []), text.repeat(5) + unbroken],
      structures: [{ label: 'Cấu trúc dài minh họa', pattern: text + unbroken }],
      examples: [
        {
          sentence: '<img data-ld-injected src=x> ' + unbroken,
          meaning: text,
          explanation: text + unbroken,
        },
      ],
      notes: [text.repeat(5) + unbroken],
    };
  }
  return { kind: 'found', lesson };
}
