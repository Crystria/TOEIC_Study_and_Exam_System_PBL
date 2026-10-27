import type { ExamQuestionSet, LocalExamSession } from './session-types';

// Review-only data. Never include this type in the active session/question payload.
export interface QuestionReview {
  correctOption: string;
  explanation: string | null;
  transcript: string | null;
  outcome: 'correct' | 'incorrect' | 'unanswered';
}
export type ReviewFilter = 'all' | 'correct' | 'incorrect' | 'unanswered' | 'flagged';
export interface ReviewDocument {
  source: 'local-demo' | 'example';
  set: ExamQuestionSet;
  answers: Record<string, string>;
  flaggedIds: string[];
  highlightedIds: string[];
  // Null explicitly means ungraded, not zero correct answers.
  solutions: Record<string, QuestionReview> | null;
}
export interface DemoHistory {
  schemaVersion: 1;
  source: 'local-demo';
  sessions: LocalExamSession[];
}
export const DEMO_HISTORY_KEY = 'toeic.exam-demo-history.v1';
export const DEMO_HISTORY_LIMIT = 30;
