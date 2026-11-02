// Read-only UI projections, never API records or authoring DTOs.
export interface VocabularyDetailFixture {
  id: string;
  example: string | null;
}

export type VocabularyDetailTopic =
  | { kind: 'missing' }
  | { kind: 'unresolved'; id: string }
  | { kind: 'found'; id: string; name: string };

export interface VocabularyDetail {
  id: string;
  word: string | null;
  meaning: string | null;
  pronunciation: string | null;
  topic: VocabularyDetailTopic;
  example: string | null;
}

export const VOCABULARY_DETAIL_PREVIEWS = [
  'normal',
  'missing',
  'topic-missing',
  'topic-unknown',
  'long',
] as const;
export type VocabularyDetailPreview = (typeof VOCABULARY_DETAIL_PREVIEWS)[number];
export type VocabularyDetailResult =
  { kind: 'found'; vocabulary: VocabularyDetail } | { kind: 'not-found' } | { kind: 'unsupported' };
