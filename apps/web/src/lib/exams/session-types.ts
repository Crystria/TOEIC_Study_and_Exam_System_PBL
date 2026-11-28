import type { ExamSelection, PartId } from './types';

export const EXAM_CONTENT_VERSION = 'exam-demo-2026-10-v1';
export const EXAM_DRAFT_KEY = 'toeic.exam-demo.v1';

export interface ExamOption {
  key: string;
  text: string;
}
export interface ExamQuestion {
  id: string;
  partId: PartId;
  number: number;
  groupId: string;
  prompt: string;
  options: ExamOption[];
}
export interface ExamPassage {
  id: string;
  title: string;
  paragraphs: string[];
}
export interface ExamGroup {
  id: string;
  partId: PartId;
  title: string;
  instruction: string;
  audioUrl: string | null;
  imageUrl: string | null;
  imageAlt: string;
  passages: ExamPassage[];
  questionIds: string[];
}
export interface ExamQuestionSet {
  questions: ExamQuestion[];
  groups: ExamGroup[];
}
export type LocalExamStatus = 'in-progress' | 'ended' | 'expired';
export interface LocalExamSession {
  schemaVersion: 1;
  contentVersion: string;
  localId: string;
  testId: string;
  selection: ExamSelection;
  startedAt: number;
  deadlineAt: number;
  durationSeconds: number;
  status: LocalExamStatus;
  endedAt: number | null;
  questionIds: string[];
  currentQuestionId: string;
  answers: Record<string, string>;
  flaggedIds: string[];
  highlightedIds: string[];
  revision: number;
  updatedAt: number;
  qa: 'normal' | 'short-timer';
}
export type SessionAction =
  | { type: 'answer'; questionId: string; option: string }
  | { type: 'clear'; questionId: string }
  | { type: 'navigate'; questionId: string }
  | { type: 'flag'; questionId: string }
  | { type: 'highlight'; paragraphId: string }
  | { type: 'end' }
  | { type: 'tick' };
