export type PartId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TestType = 'FULL_TEST' | 'MINI_TEST';
export type AttemptMode = 'PRACTICE' | 'MOCK_TEST';
export type ExamScope = 'full' | 'parts';

export interface TestPart {
  id: PartId;
  name: string;
  description: string;
  skill: 'LISTENING' | 'READING';
  questionCount: number;
  durationSeconds: number | null;
  active: boolean;
}

export interface ExamTest {
  id: string;
  title: string;
  description: string;
  collection: string;
  type: TestType;
  durationSeconds: number;
  parts: TestPart[];
  available: boolean;
}

// UI domain only; this is not the current backend's CreateAttempt DTO.
export interface ExamSelection {
  mode: AttemptMode;
  scope: ExamScope;
  partIds: number[];
}

export type ExamQuery = Record<string, string | string[] | undefined>;
export type SelectionResult =
  { ok: true; selection: ExamSelection } | { ok: false; message: string };

export type ExamPreview = 'default' | 'empty' | 'error' | 'loading' | 'unavailable';
