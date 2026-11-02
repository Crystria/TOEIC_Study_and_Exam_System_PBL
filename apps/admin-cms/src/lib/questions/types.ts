// CMS list view model only. Not a complete Question DTO or an authoring contract.
export type QuestionPart = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionPreview = 'normal' | 'slow' | 'empty' | 'error';

export interface QuestionSummary {
  id: string;
  stem: string;
  explanation: string;
  part: QuestionPart;
  difficulty: Difficulty;
  tags: readonly string[];
}

export interface QuestionQuery {
  keyword: string;
  part: QuestionPart | '';
  difficulty: Difficulty | '';
  tag: string;
  page: number;
  size: number;
}

export interface QuestionPage {
  items: readonly QuestionSummary[];
  total: number;
  catalogTotal: number;
  page: number;
  size: number;
  totalPages: number;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};
export const DEFAULT_QUERY: QuestionQuery = {
  keyword: '',
  part: '',
  difficulty: '',
  tag: '',
  page: 1,
  size: 20,
};
