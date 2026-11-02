import type { LessonSummary } from './types';

// CMS display models only, not Markdown, Learning entities or API/write DTOs.
// Nullable sections exercise incomplete display; they do not relax authoring rules.
export interface LessonBody {
  theory: readonly string[] | null;
  structures: readonly { label: string; pattern: string }[] | null;
  examples: readonly { sentence: string; meaning: string; explanation: string }[] | null;
  notes: readonly string[] | null;
}
export interface LessonDetailFixture {
  id: string;
  body: LessonBody;
}
export interface LessonDetail extends LessonSummary {
  body: LessonBody;
}
export type LessonDetailPreview = 'normal' | 'missing' | 'long';
export type LessonDetailResult =
  { kind: 'found'; lesson: LessonDetail } | { kind: 'not-found' } | { kind: 'unsupported' };

export const LESSON_CONTENT_SECTIONS = [
  { id: 'ld-theory', label: 'Lý thuyết' },
  { id: 'ld-structures', label: 'Cấu trúc' },
  { id: 'ld-examples', label: 'Ví dụ trong công việc' },
  { id: 'ld-notes', label: 'Lưu ý sử dụng' },
] as const;
