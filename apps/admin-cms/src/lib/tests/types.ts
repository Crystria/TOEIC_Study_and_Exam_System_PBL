// CMS read model only, not an Exam API DTO or student attempt contract.
export type TestType = 'FULL' | 'MINI';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type TestPreview = 'normal' | 'slow' | 'empty' | 'error';
export interface TestSummary {
  id: string;
  title: string;
  type: TestType;
  durationSeconds: number | null;
  questionCount: number | null;
  status: TestStatus | null;
}
export interface TestQuery {
  keyword: string;
  type: TestType | '';
  status: TestStatus | '';
  page: number;
  size: number;
}
export interface TestPage {
  items: TestSummary[];
  total: number;
  catalogTotal: number;
  page: number;
  size: number;
  totalPages: number;
}
// Exam ListTestsQueryDto independently specifies page=1, size=20, max size=50.
export const DEFAULT_TEST_QUERY: TestQuery = {
  keyword: '',
  type: '',
  status: '',
  page: 1,
  size: 20,
};
export const TEST_TYPE_LABELS: Record<TestType, string> = { FULL: 'Full Test', MINI: 'Mini Test' };
export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
};
export function formatTestDuration(seconds: number | null): string {
  if (seconds === null) return 'Chưa có dữ liệu';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} phút ${remainder} giây` : `${minutes} phút`;
}
