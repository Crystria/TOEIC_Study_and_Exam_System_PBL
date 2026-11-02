import type { TestStatus, TestType } from './types';

// CMS demo projection only. No TestQuestion structure or API response contract.
export interface TestDetail {
  id: string;
  title: string | null;
  type: TestType | null;
  durationSeconds: number | null;
  questionCount: number | null;
  status: TestStatus | null;
}
export type TestDetailPreview = 'normal' | 'slow' | 'missing' | 'long' | 'empty' | 'error';
export type TestDetailResult =
  { kind: 'found'; test: TestDetail } | { kind: 'unsupported' } | { kind: 'not-found' };
