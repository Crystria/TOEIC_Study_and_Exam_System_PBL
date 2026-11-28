// CMS demo view model, not a Learning API DTO or a student progress contract.
export interface LessonSummary {
  id: string;
  title: string | null;
  category: string | null;
}
export type LessonPreview = 'normal' | 'slow' | 'empty' | 'error';
export interface LessonQuery {
  keyword: string;
  category: string;
  page: number;
}
export interface LessonPage {
  items: LessonSummary[];
  total: number;
  catalogTotal: number;
  page: number;
  totalPages: number;
}
// Presentation choice for this local demo only. Learning defines no page/size contract.
export const LESSON_DEMO_PAGE_SIZE = 6;
export const DEFAULT_LESSON_QUERY: LessonQuery = { keyword: '', category: '', page: 1 };
