import type { Difficulty } from './types';

// Local CMS read model only, not the REST response or an authoring DTO.
// Nulls exercise incomplete display; they do not relax Word/Prisma constraints.
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export interface QuestionDetailOption {
  optionKey: OptionKey;
  content: string | null;
  isCorrect: boolean | null;
}
export interface QuestionDetail {
  id: string;
  part: 5;
  difficulty: Difficulty;
  tags: readonly string[];
  stem: string | null;
  options: readonly QuestionDetailOption[] | null;
  explanation: string | null;
}
export type DetailPreview = 'normal' | 'slow' | 'missing' | 'long' | 'empty' | 'error';
export type DetailResult =
  { kind: 'found'; question: QuestionDetail } | { kind: 'unsupported' } | { kind: 'not-found' };

// Only explicit complete flags establish an answer. Never use array order or text.
export function explicitAnswer(options: QuestionDetail['options']): OptionKey | null {
  if (
    !options ||
    options.length !== 4 ||
    new Set(options.map((option) => option.optionKey)).size !== 4 ||
    !options.every((option) => ['A', 'B', 'C', 'D'].includes(option.optionKey)) ||
    options.some((option) => typeof option.isCorrect !== 'boolean')
  )
    return null;
  const correct = options.filter((option) => option.isCorrect === true);
  return correct.length === 1 ? correct[0].optionKey : null;
}
