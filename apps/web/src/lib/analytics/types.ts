import type { PreviewScenario, ScoreAttempt, TimeRange } from '../dashboard/types';
import type { AttemptMode, ExamScope, PartId } from '../exams/types';

export type AnalyticsRange = TimeRange | 'LAST_90_DAYS';
export type AnalyticsPreview = PreviewScenario | 'loading' | 'ungraded';

export interface AnalyticsFilters {
  range: AnalyticsRange;
  mode: 'all' | AttemptMode;
  scope: 'all' | ExamScope;
}

export interface PartResult {
  partId: PartId;
  correct: number;
  // Includes unanswered questions in the selected scope, not just saved answers.
  total: number;
}

// UI domain for illustrative graded facts; not the current backend response.
export interface AnalyticsAttempt extends ScoreAttempt {
  scope: ExamScope;
  gradingStatus: 'GRADED' | 'PENDING' | 'FAILED';
  toeicEligibility: 'eligible' | 'ineligible';
  partResults: PartResult[];
}

export interface LearningFact {
  id: string;
  kind: 'vocabulary' | 'grammar';
  occurredAt: string;
  quantity: number;
}

export interface DemoPrediction {
  source: 'demo-fixture';
  score: number;
  supportingAttemptIds: string[];
}

export interface AnalyticsSnapshot {
  source: 'demo';
  snapshotAt: string;
  timezone: string;
  targetScore: number | null;
  learning: LearningFact[];
  attempts: AnalyticsAttempt[];
  prediction: DemoPrediction | null;
}

export interface ActivityBucket {
  key: string;
  label: string;
  vocabulary: number;
  grammar: number;
  exams: number;
}

export interface PartSummary extends PartResult {
  title: string;
  accuracy: number | null;
  samples: number;
}
