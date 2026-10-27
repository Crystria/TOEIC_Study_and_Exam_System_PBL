import type { LearningSettings, SettingsDraft, SettingsErrors } from './types';

export function validTimezone(value: string): boolean {
  if (!value || value.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value))
    return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function localToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const validTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
const integer = (value: string, min: number, max: number) =>
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;

export function validateSettings(draft: SettingsDraft): SettingsErrors {
  const errors: SettingsErrors = {};
  // Positive integer representation, without inventing undocumented business caps.
  if (!integer(draft.dailyVocabularyGoal, 1, Number.MAX_SAFE_INTEGER))
    errors.dailyVocabularyGoal = 'Nhập số nguyên dương hợp lệ cho số từ mỗi ngày.';
  if (!integer(draft.dailyStudyMinutes, 1, Number.MAX_SAFE_INTEGER))
    errors.dailyStudyMinutes = 'Nhập số nguyên dương hợp lệ cho số phút mỗi ngày.';
  if (draft.targetToeicScore !== '' && !integer(draft.targetToeicScore, 10, 990))
    errors.targetToeicScore = 'Nhập điểm nguyên từ 10 đến 990; hoặc để trống.';
  if (!validTimezone(draft.timezone))
    errors.timezone = 'Nhập múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.';
  if (draft.plannedExamDate) {
    if (!validCalendarDate(draft.plannedExamDate))
      errors.plannedExamDate = 'Nhập ngày thi hợp lệ hoặc để trống.';
  }
  if (
    (draft.reminderEnabled && !draft.reminderTime) ||
    (draft.reminderTime && !validTime(draft.reminderTime))
  )
    errors.reminderTime = 'Nhập giờ nhắc hợp lệ (00:00–23:59:59); bắt buộc khi bật nhắc học.';
  return errors;
}

export function draftToSettings(draft: SettingsDraft, version: string): LearningSettings {
  return {
    dailyVocabularyGoal: Number(draft.dailyVocabularyGoal),
    dailyStudyMinutes: Number(draft.dailyStudyMinutes),
    targetToeicScore: draft.targetToeicScore === '' ? null : Number(draft.targetToeicScore),
    plannedExamDate: draft.plannedExamDate || null,
    reminderEnabled: draft.reminderEnabled,
    // Preserve wall time and calendar date. Neither is an instant converted through UTC.
    reminderTime: draft.reminderTime
      ? draft.reminderTime.length === 5
        ? `${draft.reminderTime}:00`
        : draft.reminderTime
      : null,
    timezone: draft.timezone,
    version,
  };
}

export function isLearningSettings(value: unknown): value is LearningSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const keys = [
    'dailyVocabularyGoal',
    'dailyStudyMinutes',
    'targetToeicScore',
    'plannedExamDate',
    'reminderEnabled',
    'reminderTime',
    'timezone',
    'version',
  ];
  if (Object.keys(item).length !== keys.length || keys.some((key) => !(key in item))) return false;
  const numberIn = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  return (
    numberIn(item.dailyVocabularyGoal, 1, Number.MAX_SAFE_INTEGER) &&
    numberIn(item.dailyStudyMinutes, 1, Number.MAX_SAFE_INTEGER) &&
    (item.targetToeicScore === null || numberIn(item.targetToeicScore, 10, 990)) &&
    (item.plannedExamDate === null ||
      (typeof item.plannedExamDate === 'string' && validCalendarDate(item.plannedExamDate))) &&
    typeof item.reminderEnabled === 'boolean' &&
    (item.reminderTime === null ||
      (typeof item.reminderTime === 'string' && validTime(item.reminderTime))) &&
    (!item.reminderEnabled || item.reminderTime !== null) &&
    typeof item.timezone === 'string' &&
    validTimezone(item.timezone) &&
    typeof item.version === 'string' &&
    /^(0|[1-9]\d*)$/.test(item.version)
  );
}
