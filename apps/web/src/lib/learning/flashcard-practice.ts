export const DEFAULT_FLASHCARD_PRACTICE_LIMIT = 10;
export const MAX_FLASHCARD_PRACTICE_LIMIT = 50;

export function isFlashcardPracticeLimit(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_FLASHCARD_PRACTICE_LIMIT
  );
}
