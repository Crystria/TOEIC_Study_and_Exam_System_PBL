import type { LearningSettings, SettingsIssue, SettingsRead, SettingsSnapshot } from './types';
import { isLearningSettings } from './validation';

export const SETTINGS_DEMO_KEY = 'toeic.learning-settings-demo.v1';
export class SettingsStorageError extends Error {
  constructor(readonly issue: SettingsIssue) {
    super(issue);
  }
}
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseSettingsSnapshot(raw: string): SettingsSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SettingsStorageError('corrupt');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SettingsStorageError('corrupt');
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1) throw new SettingsStorageError('schema');
  if (
    Object.keys(item).length !== 4 ||
    item.source !== 'settings-demo' ||
    !isLearningSettings(item.settings) ||
    typeof item.updatedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.updatedAt) ||
    !Number.isFinite(Date.parse(item.updatedAt)) ||
    new Date(item.updatedAt).toISOString() !== item.updatedAt
  )
    throw new SettingsStorageError('corrupt');
  return item as unknown as SettingsSnapshot;
}

// Explicit local-only adapter. No auth, account progress, Attempt, notifications or API calls.
export function createSettingsRepository(getStorage: () => SettingsStorage) {
  function read(): SettingsRead {
    let raw: string | null;
    try {
      raw = getStorage().getItem(SETTINGS_DEMO_KEY);
    } catch {
      throw new SettingsStorageError('read');
    }
    return { raw, snapshot: raw === null ? null : parseSettingsSnapshot(raw) };
  }
  function save(
    settings: LearningSettings,
    expectedRaw: string | null,
    now = new Date(),
  ): SettingsRead {
    const current = read(); // Refuse corrupt/unsupported snapshots, including changes since page load.
    if (current.raw !== expectedRaw) throw new SettingsStorageError('conflict');
    if (!isLearningSettings(settings)) throw new SettingsStorageError('corrupt');
    const snapshot: SettingsSnapshot = {
      schemaVersion: 1,
      source: 'settings-demo',
      updatedAt: now.toISOString(),
      settings: {
        ...settings,
        version: String(BigInt(current.snapshot?.settings.version ?? '0') + 1n),
      },
    };
    const raw = JSON.stringify(snapshot);
    try {
      getStorage().setItem(SETTINGS_DEMO_KEY, raw);
    } catch {
      throw new SettingsStorageError('write');
    }
    return { snapshot, raw };
  }
  return { read, save };
}
export const settingsRepository = createSettingsRepository(() => window.localStorage);
