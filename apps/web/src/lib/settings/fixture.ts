import type { LearningSettings, SettingsDraft } from './types';

// Existing frontend demo defaults. Current Word documents do not specify settings defaults.
// Independent of Dashboard's personalized fixture; confirm with backend before integration.
export function defaultLearningSettings(): LearningSettings {
  return {
    dailyVocabularyGoal: 10,
    dailyStudyMinutes: 30,
    targetToeicScore: null,
    plannedExamDate: null,
    reminderEnabled: true,
    reminderTime: '20:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    version: '0',
  };
}

export function settingsDraft(settings: LearningSettings): SettingsDraft {
  return {
    dailyVocabularyGoal: String(settings.dailyVocabularyGoal),
    dailyStudyMinutes: String(settings.dailyStudyMinutes),
    targetToeicScore: settings.targetToeicScore === null ? '' : String(settings.targetToeicScore),
    plannedExamDate: settings.plannedExamDate ?? '',
    reminderEnabled: settings.reminderEnabled,
    reminderTime: settings.reminderTime ?? '',
    timezone: settings.timezone,
  };
}

// Suggestions only: validation accepts any IANA zone supported by the browser.
export const timezoneSuggestions = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];
