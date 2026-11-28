import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { validateAuth, type AuthFormValues } from '../src/lib/auth-preview';
import { createDemoDashboard } from '../src/lib/dashboard/mock-data';
import {
  isScoredMockTest,
  selectPrediction,
  selectScoreHistory,
} from '../src/lib/dashboard/selectors';

const valid: AuthFormValues = {
  fullName: 'Minh Anh',
  email: 'demo@example.com',
  password: 'Example123',
  confirmPassword: 'Example123',
};

test('registration follows SRS password, name, email and confirmation rules', () => {
  assert.deepEqual(validateAuth(valid, 'register'), {});
  for (const password of ['short1A', 'lowercase123', 'UPPERCASE123', 'OnlyLetters']) {
    assert.ok(validateAuth({ ...valid, password, confirmPassword: password }, 'register').password);
  }
  assert.ok(validateAuth({ ...valid, fullName: '  A  ' }, 'register').fullName);
  assert.ok(validateAuth({ ...valid, email: 'not-an-email' }, 'register').email);
  assert.ok(validateAuth({ ...valid, confirmPassword: 'different' }, 'register').confirmPassword);
});

test('login requires credentials without applying new-password policy to existing accounts', () => {
  assert.deepEqual(validateAuth({ ...valid, password: 'old' }, 'login'), {});
  const errors = validateAuth({ ...valid, email: '', password: '' }, 'login');
  assert.ok(errors.email);
  assert.ok(errors.password);
});

test('practice, partial tests, duplicate parts and missing skills never enter TOEIC trend', () => {
  const full = createDemoDashboard('ready').attempts[0];
  assert.equal(isScoredMockTest(full), true);
  assert.equal(isScoredMockTest({ ...full, mode: 'PRACTICE' }), false);
  assert.equal(isScoredMockTest({ ...full, selectedPartIds: [5] }), false);
  assert.equal(isScoredMockTest({ ...full, selectedPartIds: [1, 1, 2, 3, 4, 5, 6, 7] }), false);
  assert.equal(isScoredMockTest({ ...full, selectedPartIds: [5], testPartIds: [5] }), false);
  assert.equal(isScoredMockTest({ ...full, scoreListening: null }), false);
  assert.equal(isScoredMockTest({ ...full, totalScore: 601 }), false);
  assert.equal(isScoredMockTest({ ...full, selectedPartIds: [2, 5], testPartIds: [2, 5] }), true);
});

test('prediction requires three scored whole-test attempts in the last thirty days', () => {
  const ready = createDemoDashboard('ready');
  assert.equal(selectPrediction(ready), 660);
  assert.equal(selectScoreHistory(ready, 'LAST_30_DAYS').length, 3);
  assert.equal(selectScoreHistory(ready, 'LAST_7_DAYS').length, 1);
  const insufficient = createDemoDashboard('insufficient');
  insufficient.predictedToeicScore = 800; // Even a stale API value must remain hidden.
  assert.equal(selectPrediction(insufficient), null);
  ready.attempts[0].completedAt = '2026-09-01T00:00:00Z';
  assert.equal(selectPrediction(ready), null);
  assert.equal(selectScoreHistory(ready, 'ALL_TIME').length, 3);
});

test('invalid and future completion dates are excluded', () => {
  const data = createDemoDashboard('ready');
  data.attempts[0].completedAt = 'invalid';
  data.attempts[1].completedAt = '2099-01-01T00:00:00Z';
  assert.equal(selectScoreHistory(data, 'ALL_TIME').length, 1);
});

test('new learner has null prediction and target with SRS daily defaults', () => {
  const empty = createDemoDashboard('empty');
  assert.equal(selectPrediction(empty), null);
  assert.equal(empty.settings.targetToeicScore, null);
  assert.equal(empty.settings.dailyVocabularyGoal, 10);
  assert.equal(empty.settings.dailyStudyMinutes, 30);
  assert.equal(empty.settings.reminderTime, '20:00:00');
  assert.equal(empty.settings.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(empty.statistics.learningStreakDays, 0);
});
