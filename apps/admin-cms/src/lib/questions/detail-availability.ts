// Links only for the three implemented IDs; no answer content in the list import.
export const QUESTION_DETAIL_IDS = ['demo-q-017', 'demo-q-018', 'demo-q-019'] as const;
export function hasQuestionDetail(id: string): boolean {
  return QUESTION_DETAIL_IDS.some((supported) => supported === id);
}
