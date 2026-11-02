import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { defaultLearningSettings, settingsDraft } from '../src/lib/settings/fixture';
import {
  createSettingsRepository,
  parseSettingsSnapshot,
  SETTINGS_DEMO_KEY,
  SettingsStorageError,
} from '../src/lib/settings/repository';
import {
  draftToSettings,
  isLearningSettings,
  localToday,
  validateSettings,
} from '../src/lib/settings/validation';

const now = new Date('2026-10-26T17:30:00.000Z');
const defaults = () => settingsDraft(defaultLearningSettings());
const throwsIssue = (fn: () => unknown, issue: string) =>
  assert.throws(
    fn,
    (error: unknown) => error instanceof SettingsStorageError && error.issue === issue,
  );
function memory() {
  const values = new Map<string, string>();
  const writes: string[] = [];
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
      writes.push(key);
    },
  };
  return { values, writes, storage, repository: createSettingsRepository(() => storage) };
}

test('Settings defaults match existing frontend demo, optional values stay null and loading an absent key never writes', () => {
  const m = memory();
  assert.deepEqual(m.repository.read(), { raw: null, snapshot: null });
  assert.deepEqual(defaultLearningSettings(), {
    dailyVocabularyGoal: 10,
    dailyStudyMinutes: 30,
    targetToeicScore: null,
    plannedExamDate: null,
    reminderEnabled: true,
    reminderTime: '20:00:00',
    timezone: 'Asia/Ho_Chi_Minh',
    version: '0',
  });
  assert.deepEqual(validateSettings(defaults()), {});
  const settings = draftToSettings(defaults(), '0');
  assert.equal(settings.targetToeicScore, null);
  assert.equal(settings.plannedExamDate, null);
  assert.equal(m.writes.length, 0);
});

test('Daily goals reject invalid integer representations without undocumented business caps', () => {
  for (const [field, accepted, rejected] of [
    [
      'dailyVocabularyGoal',
      ['1', '200', '201'],
      ['', '0', '1.5', '1e2', 'NaN', '9007199254740992'],
    ],
    ['dailyStudyMinutes', ['1', '4', '5', '600', '601'], ['', '0', '5.5', '-5']],
  ] as const) {
    for (const value of accepted)
      assert.equal(validateSettings({ ...defaults(), [field]: value })[field], undefined);
    for (const value of rejected)
      assert.ok(validateSettings({ ...defaults(), [field]: value })[field], `${field}: ${value}`);
  }
});

test('Score is optional or an integer in the documented TOEIC domain 10–990; empty is never coerced to zero', () => {
  for (const value of ['', '10', '11', '750', '990'])
    assert.equal(
      validateSettings({ ...defaults(), targetToeicScore: value }).targetToeicScore,
      undefined,
    );
  for (const value of ['0', '5', '991', '995', '750.5'])
    assert.ok(validateSettings({ ...defaults(), targetToeicScore: value }).targetToeicScore);
});

test('Calendar dates are validated without adding an undocumented future-date restriction', () => {
  assert.equal(localToday('Asia/Ho_Chi_Minh', now), '2026-10-27');
  assert.equal(localToday('America/Los_Angeles', now), '2026-10-26');
  for (const value of ['', '2024-02-29', '2026-10-26', '2026-10-27'])
    assert.equal(
      validateSettings({ ...defaults(), plannedExamDate: value }).plannedExamDate,
      undefined,
    );
  for (const value of ['2026-02-29', '2026-04-31', '2026-1-01', '0000-01-01'])
    assert.ok(validateSettings({ ...defaults(), plannedExamDate: value }).plannedExamDate);
});

test('Reminder requires a wall time when enabled, permits null when disabled, and validates IANA timezone in either mode', () => {
  assert.ok(validateSettings({ ...defaults(), reminderTime: '' }).reminderTime);
  const off = { ...defaults(), reminderEnabled: false, reminderTime: '' };
  assert.deepEqual(validateSettings(off), {});
  assert.equal(draftToSettings(off, '0').reminderTime, null);
  for (const value of ['24:00', '20:60', '20:00:60', '8:00'])
    assert.ok(validateSettings({ ...off, reminderTime: value }).reminderTime);
  for (const timezone of ['', 'Asia/Invalid', '+07:00', 'GMT+7', ' Asia/Tokyo'])
    assert.ok(validateSettings({ ...off, timezone }).timezone);
  for (const timezone of ['Asia/Ho_Chi_Minh', 'UTC', 'America/New_York', 'Pacific/Chatham'])
    assert.equal(validateSettings({ ...off, timezone }).timezone, undefined);
});

test('Round-trip keeps calendar date and reminder wall time across date boundaries and DST, without UTC conversion', () => {
  for (const timezone of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Pacific/Auckland']) {
    const m = memory();
    const input = draftToSettings(
      { ...defaults(), timezone, plannedExamDate: '2026-11-01', reminderTime: '01:30:45' },
      '0',
    );
    m.repository.save(input, null, now);
    const restored = m.repository.read().snapshot!.settings;
    assert.equal(restored.plannedExamDate, '2026-11-01');
    assert.equal(restored.reminderTime, '01:30:45');
    assert.equal(restored.timezone, timezone);
  }
  assert.equal(
    draftToSettings({ ...defaults(), reminderTime: '20:00' }, '0').reminderTime,
    '20:00:00',
  );
});

test('Storage checks schema, source, timestamps, strict fields and domain types; past saved dates remain valid', () => {
  const m = memory();
  const raw = m.repository.save(
    { ...defaultLearningSettings(), plannedExamDate: '2020-01-01' },
    null,
    now,
  ).raw!;
  assert.ok(parseSettingsSnapshot(raw));
  const base = JSON.parse(raw);
  for (const changed of [
    { ...base, source: 'account' },
    { ...base, updatedAt: '2026-02-30T00:00:00.000Z' },
    { ...base, extra: true },
    { ...base, settings: { ...base.settings, selectedPartIds: [1] } },
    { ...base, settings: { ...base.settings, targetToeicScore: 0 } },
    { ...base, settings: { ...base.settings, dailyVocabularyGoal: '10' } },
    { ...base, settings: { ...base.settings, reminderTime: null } },
    { ...base, settings: { ...base.settings, version: '-1' } },
    { ...base, settings: { ...base.settings, version: '01' } },
  ])
    throwsIssue(() => parseSettingsSnapshot(JSON.stringify(changed)), 'corrupt');
  for (const schemaVersion of [2, '1', null])
    throwsIssue(() => parseSettingsSnapshot(JSON.stringify({ ...base, schemaVersion })), 'schema');
  for (const bad of ['', '{', 'null', '[]'])
    throwsIssue(() => parseSettingsSnapshot(bad), 'corrupt');
  assert.equal(
    isLearningSettings({ ...defaultLearningSettings(), reminderEnabled: 'true' }),
    false,
  );
});

test('Corrupt and unsupported snapshots are never overwritten, even if introduced between load and save', () => {
  for (const raw of ['{broken', JSON.stringify({ schemaVersion: 9 })]) {
    const m = memory();
    m.values.set(SETTINGS_DEMO_KEY, raw);
    assert.throws(() => m.repository.read());
    assert.throws(() => m.repository.save(defaultLearningSettings(), null, now));
    assert.equal(m.values.get(SETTINGS_DEMO_KEY), raw);
    assert.equal(m.writes.length, 0);
  }
});

test('Stale drafts detect changes and deletion; versions increase without numeric precision loss', () => {
  const m = memory();
  const first = m.repository.save(defaultLearningSettings(), null, now);
  const second = m.repository.save(
    { ...first.snapshot!.settings, dailyVocabularyGoal: 50 },
    first.raw,
    now,
  );
  throwsIssue(() => m.repository.save(defaultLearningSettings(), first.raw, now), 'conflict');
  assert.equal(m.repository.read().raw, second.raw);
  const large = JSON.parse(second.raw!);
  large.settings.version = '9007199254740993';
  m.values.set(SETTINGS_DEMO_KEY, JSON.stringify(large));
  const current = m.repository.read();
  assert.equal(
    m.repository.save(defaultLearningSettings(), current.raw, now).snapshot!.settings.version,
    '9007199254740994',
  );
  m.values.delete(SETTINGS_DEMO_KEY);
  throwsIssue(() => m.repository.save(defaultLearningSettings(), second.raw, now), 'conflict');
});

test('Read/security and quota errors preserve data and can be retried; repository only writes its own key', () => {
  const m = memory();
  for (const key of [
    'toeic.exam-demo.v1',
    'toeic.exam-demo-history.v1',
    'toeic.learning-preview.v1',
  ])
    m.values.set(key, 'untouched');
  let blocked = true;
  const repository = createSettingsRepository(() => {
    if (blocked) throw new DOMException('Blocked', 'SecurityError');
    return m.storage;
  });
  throwsIssue(() => repository.read(), 'read');
  blocked = false;
  const saved = repository.save(defaultLearningSettings(), null, now);
  let quota = true;
  const quotaRepository = createSettingsRepository(() => ({
    ...m.storage,
    setItem: (key, raw) => {
      if (quota) throw new DOMException('Full', 'QuotaExceededError');
      m.storage.setItem(key, raw);
    },
  }));
  throwsIssue(() => quotaRepository.save(defaultLearningSettings(), saved.raw, now), 'write');
  assert.equal(repository.read().raw, saved.raw);
  quota = false;
  quotaRepository.save(defaultLearningSettings(), saved.raw, now);
  assert.ok(m.writes.every((key) => key === SETTINGS_DEMO_KEY));
  for (const key of [
    'toeic.exam-demo.v1',
    'toeic.exam-demo-history.v1',
    'toeic.learning-preview.v1',
  ])
    assert.equal(m.values.get(key), 'untouched');
});
