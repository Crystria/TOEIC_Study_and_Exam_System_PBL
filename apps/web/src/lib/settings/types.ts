import type { LearningSettings } from '../dashboard/types';

// Reuse the existing domain shape; version here belongs only to this device's demo.
export type { LearningSettings };
export type SettingsDraft = {
  dailyVocabularyGoal: string;
  dailyStudyMinutes: string;
  targetToeicScore: string;
  plannedExamDate: string;
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
};
export type SettingsErrors = Partial<Record<keyof SettingsDraft, string>>;
export type SettingsPreview = 'ready' | 'loading' | 'error';
export interface SettingsSnapshot {
  schemaVersion: 1;
  source: 'settings-demo';
  updatedAt: string;
  settings: LearningSettings;
}
export interface SettingsRead {
  raw: string | null;
  snapshot: SettingsSnapshot | null;
}
export type SettingsIssue = 'read' | 'write' | 'corrupt' | 'schema' | 'conflict';
