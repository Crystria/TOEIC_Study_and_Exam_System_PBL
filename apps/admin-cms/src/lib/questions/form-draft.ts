import { QUESTION_FIXTURES } from './fixtures';
import { QUESTION_DETAIL_FIXTURES } from './detail-fixtures';
import { explicitAnswer, type OptionKey, type QuestionDetail } from './detail-types';
import type { Difficulty, QuestionSummary } from './types';

// UI-only draft and preview, never a write DTO, API record or generated ID.
export const EDITABLE_DEMO_QUESTION_ID = 'demo-q-017';
export const DRAFT_OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export interface QuestionDraft {
  part: 5;
  stem: string;
  difficulty: Difficulty | '';
  options: Record<OptionKey, string>;
  answer: OptionKey | '';
  explanation: string;
}
export type DraftField = 'stem' | 'difficulty' | `option-${OptionKey}` | 'answer';
export type DraftErrors = Partial<Record<DraftField, string>>;
export interface QuestionDraftPreview {
  part: 5;
  stem: string;
  difficulty: Difficulty;
  options: { optionKey: OptionKey; content: string; isCorrect: boolean }[];
  answer: OptionKey;
  explanation: string;
}

export function newQuestionDraft(): QuestionDraft {
  return {
    part: 5,
    stem: '',
    difficulty: '',
    options: { A: '', B: '', C: '', D: '' },
    answer: '',
    explanation: '',
  };
}

export function editQuestionDraft(
  id: string,
  catalog: readonly QuestionSummary[] = QUESTION_FIXTURES,
  details: readonly QuestionDetail[] = QUESTION_DETAIL_FIXTURES,
): { kind: 'found'; draft: QuestionDraft } | { kind: 'not-found' | 'unsupported' } {
  if (!catalog.some((question) => question.id === id)) return { kind: 'not-found' };
  if (id !== EDITABLE_DEMO_QUESTION_ID) return { kind: 'unsupported' };
  const template = details.find((question) => question.id === id);
  if (!template) return { kind: 'unsupported' };
  const options = newQuestionDraft().options;
  for (const key of DRAFT_OPTION_KEYS)
    options[key] = template.options?.find((option) => option.optionKey === key)?.content ?? '';
  return {
    kind: 'found',
    draft: {
      part: 5,
      stem: template.stem ?? '',
      difficulty: template.difficulty,
      options,
      answer: explicitAnswer(template.options) ?? '',
      explanation: template.explanation ?? '',
    },
  };
}

export function validateQuestionDraft(draft: QuestionDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.stem.trim()) errors.stem = 'Nhập nội dung câu hỏi Part 5.';
  if (!['EASY', 'MEDIUM', 'HARD'].includes(draft.difficulty))
    errors.difficulty = 'Chọn độ khó Dễ, Trung bình hoặc Khó.';
  for (const key of DRAFT_OPTION_KEYS)
    if (!draft.options[key]?.trim()) errors[`option-${key}`] = `Nhập nội dung phương án ${key}.`;
  if (!DRAFT_OPTION_KEYS.some((key) => key === draft.answer))
    errors.answer = 'Chọn đúng một đáp án trong bốn phương án A–D.';
  return errors;
}

export function previewQuestionDraft(draft: QuestionDraft) {
  const errors = validateQuestionDraft(draft);
  // Keep the original input, including whitespace, on both paths. No persistence.
  const preview: QuestionDraftPreview | null = Object.keys(errors).length
    ? null
    : {
        part: 5,
        stem: draft.stem,
        difficulty: draft.difficulty as Difficulty,
        options: DRAFT_OPTION_KEYS.map((optionKey) => ({
          optionKey,
          content: draft.options[optionKey],
          isCorrect: draft.answer === optionKey,
        })),
        answer: draft.answer as OptionKey,
        explanation: draft.explanation,
      };
  return { draft, errors, preview };
}
