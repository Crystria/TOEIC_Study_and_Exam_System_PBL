// Availability only: the list does not import detail content.
export const VOCABULARY_DETAIL_IDS = ['demo-vocabulary-001', 'demo-vocabulary-002'] as const;
export function hasVocabularyDetail(id: string): boolean {
  return VOCABULARY_DETAIL_IDS.some((supported) => supported === id);
}
