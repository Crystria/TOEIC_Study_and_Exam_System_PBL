// CMS demo summaries only; not an authoring DTO or a student learning contract.
export interface VocabularyTopicSummary {
  id: string;
  name: string;
}
export interface VocabularySummary {
  id: string;
  word: string | null;
  meaning: string | null;
  pronunciation: string | null;
  topicId: string | null;
}
export type VocabularyPreview = 'normal' | 'slow' | 'empty' | 'error';
export interface VocabularyQuery {
  keyword: string;
  topicId: string;
  page: number;
  size: number;
}
export interface VocabularyPage {
  items: VocabularySummary[];
  total: number;
  catalogTotal: number;
  page: number;
  size: number;
  totalPages: number;
}
// Independently verified in Learning ListVocabulariesQueryDto, not copied from Exam.
export const DEFAULT_VOCABULARY_QUERY: VocabularyQuery = {
  keyword: '',
  topicId: '',
  page: 1,
  size: 20,
};
