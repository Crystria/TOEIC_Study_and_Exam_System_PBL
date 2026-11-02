import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createDemoAnalytics } from '../src/lib/analytics/mock-data';
import { analyticsRepository } from '../src/lib/analytics/repository';
import {
  analyticsDate,
  defaultAnalyticsFilters as defaults,
  inAnalyticsWindow,
  isEligibleAnalyticsScore,
  parseAnalyticsFilters,
  selectAnalytics,
} from '../src/lib/analytics/selectors';
import type { AnalyticsFilters } from '../src/lib/analytics/types';

test('Analytics excludes practice, partial, missing skills, pending and denied scores even if a numeric score exists', () => {
  const full = createDemoAnalytics('ready').attempts[0];
  assert.equal(isEligibleAnalyticsScore(full), true);
  for (const attempt of [
    { ...full, mode: 'PRACTICE' as const },
    { ...full, scope: 'parts' as const },
    { ...full, selectedPartIds: [2, 5] },
    { ...full, selectedPartIds: [5], testPartIds: [5] },
    { ...full, scoreReading: null },
    { ...full, gradingStatus: 'PENDING' as const },
    { ...full, gradingStatus: 'FAILED' as const },
    { ...full, toeicEligibility: 'ineligible' as const },
    { ...full, totalScore: 42 },
  ])
    assert.equal(isEligibleAnalyticsScore(attempt), false);
  assert.equal(
    isEligibleAnalyticsScore({ ...full, selectedPartIds: [2, 5], testPartIds: [2, 5] }),
    true,
  );
});

test('all four time ranges update activity, eligible points and Part samples together', () => {
  const data = createDemoAnalytics('ready');
  const ranges: Array<[AnalyticsFilters['range'], number, number]> = [
    ['LAST_7_DAYS', 5, 1],
    ['LAST_30_DAYS', 7, 3],
    ['LAST_90_DAYS', 8, 4],
    ['ALL_TIME', 9, 5],
  ];
  let previousVocabulary = 0;
  for (const [range, attempts, scores] of ranges) {
    const selected = selectAnalytics(data, { ...defaults, range });
    assert.equal(selected.attempts.length, attempts);
    assert.equal(selected.scores.length, scores);
    assert.ok(selected.vocabulary! > previousVocabulary);
    previousVocabulary = selected.vocabulary!;
    assert.equal(
      selected.buckets.reduce((sum, row) => sum + row.exams, 0),
      attempts,
    );
    assert.equal(
      selected.buckets.reduce((sum, row) => sum + row.vocabulary, 0),
      selected.vocabulary,
    );
    assert.equal(selected.parts[0].samples, scores);
  }
  assert.equal(selectAnalytics(data, { ...defaults, range: 'ALL_TIME' }).vocabulary, 128);
  assert.equal(selectAnalytics(data, { ...defaults, range: 'ALL_TIME' }).grammar, 12);
});

test('mode and scope only filter exam facts; practice still contributes graded Part results', () => {
  const data = createDemoAnalytics('ready');
  const all = selectAnalytics(data, defaults);
  const practice = selectAnalytics(data, { ...defaults, mode: 'PRACTICE' });
  assert.equal(practice.attempts.length, 1);
  assert.equal(practice.scores.length, 0);
  assert.equal(practice.prediction, null);
  assert.equal(practice.vocabulary, all.vocabulary);
  assert.equal(practice.grammar, all.grammar);
  assert.equal(practice.parts[4].correct, 12);
  assert.equal(practice.parts[4].total, 20);
  assert.equal(practice.parts[4].accuracy, 60);
  assert.equal(practice.parts[0].accuracy, null);
  const impossible = selectAnalytics(data, { ...defaults, mode: 'PRACTICE', scope: 'full' });
  assert.equal(impossible.attempts.length, 0);
  assert.equal(impossible.latestScore, null);
  assert.equal(impossible.weakParts.length, 0);
  assert.equal(impossible.vocabulary, all.vocabulary);
  const partial = selectAnalytics(data, { ...defaults, mode: 'MOCK_TEST', scope: 'parts' });
  assert.equal(partial.attempts.length, 1);
  assert.equal(partial.scores.length, 0);
  assert.equal(partial.parts[1].correct, 16);
});

test('Part percentages use summed correct/total, include unanswered denominator and preserve a genuine zero', () => {
  const data = createDemoAnalytics('empty');
  const full = createDemoAnalytics('ready').attempts[0];
  data.attempts = [
    { ...full, attemptId: 'small', partResults: [{ partId: 5, correct: 1, total: 1 }] },
    {
      ...full,
      attemptId: 'large',
      partResults: [
        { partId: 5, correct: 0, total: 9 },
        { partId: 1, correct: 0, total: 6 },
      ],
    },
  ];
  const selected = selectAnalytics(data, defaults);
  assert.equal(selected.parts[4].accuracy, 10); // Not the unweighted mean, 50%.
  assert.equal(selected.parts[4].total, 10);
  assert.equal(selected.parts[0].accuracy, 0);
  assert.equal(selected.parts[2].accuracy, null);
  assert.equal(selected.weakParts[0].partId, 1);
});

test('ungraded and malformed Part facts cannot produce accuracy or weak areas', () => {
  const data = createDemoAnalytics('ungraded');
  let selected = selectAnalytics(data, defaults);
  assert.equal(selected.attempts.length, 1);
  assert.equal(selected.scores.length, 0);
  assert.equal(selected.prediction, null);
  assert.ok(selected.parts.every((part) => part.accuracy === null));
  data.attempts[0].gradingStatus = 'GRADED';
  data.attempts[0].partResults = [
    { partId: 1, correct: 7, total: 6 },
    { partId: 2, correct: 0, total: 0 },
    { partId: 3, correct: -1, total: 39 },
    { partId: 4, correct: 1.5, total: 30 },
    { partId: 5, correct: 2, total: 30 },
    { partId: 5, correct: 2, total: 30 },
  ];
  selected = selectAnalytics(data, defaults);
  assert.ok(selected.parts.every((part) => part.accuracy === null));
});

test('prediction is an authored fixture gated by three distinct eligible matches within 30 days', () => {
  const data = createDemoAnalytics('ready');
  assert.equal(selectAnalytics(data, defaults).prediction, 660);
  assert.equal(selectAnalytics(data, { ...defaults, range: 'LAST_7_DAYS' }).prediction, null);
  assert.equal(selectAnalytics(data, { ...defaults, range: 'ALL_TIME' }).predictionCount, 3);
  assert.equal(selectAnalytics(createDemoAnalytics('insufficient'), defaults).prediction, null);
  data.attempts.push(structuredClone(data.attempts[0]));
  assert.equal(selectAnalytics(data, defaults).predictionCount, 3);
  data.prediction!.score = 725; // No client formula recomputes or overrides an authored fixture.
  assert.equal(selectAnalytics(data, defaults).prediction, 725);
  data.prediction!.supportingAttemptIds = ['wrong', 'wrong', 'wrong'];
  assert.equal(selectAnalytics(data, defaults).prediction, null);
});

test('old, future, invalid or newly pending scores never unlock a stale prediction', () => {
  for (const timestamp of ['2026-09-01T00:00:00Z', '2027-01-01T00:00:00Z', 'invalid']) {
    const data = createDemoAnalytics('ready');
    data.attempts[0].completedAt = timestamp;
    assert.equal(selectAnalytics(data, defaults).prediction, null);
  }
  const data = createDemoAnalytics('ready');
  data.attempts[0].gradingStatus = 'PENDING';
  assert.equal(selectAnalytics(data, defaults).prediction, null);
});

test('time windows are inclusive rolling 24-hour days with no future facts; labels use Vietnam dates', () => {
  const end = '2026-10-23T02:00:00Z';
  assert.equal(inAnalyticsWindow('2026-09-23T02:00:00Z', end, 'LAST_30_DAYS'), true);
  assert.equal(inAnalyticsWindow('2026-09-23T01:59:59.999Z', end, 'LAST_30_DAYS'), false);
  assert.equal(inAnalyticsWindow('2026-10-23T02:00:00.001Z', end, 'ALL_TIME'), false);
  assert.equal(inAnalyticsWindow('bad', end, 'ALL_TIME'), false);
  assert.equal(analyticsDate('2026-10-22T18:00:00Z', 'Asia/Ho_Chi_Minh'), '23/10/2026');
});

test('activity grouping uses Vietnam dates and Monday weeks, without losing filtered totals', () => {
  const data = createDemoAnalytics('empty');
  data.learning = [
    { id: 'midnight', kind: 'vocabulary', quantity: 2, occurredAt: '2026-10-18T18:00:00Z' },
  ];
  assert.equal(selectAnalytics(data, defaults).buckets[0].key, '2026-10-19');
  const daily = selectAnalytics(data, { ...defaults, range: 'LAST_7_DAYS' });
  assert.equal(daily.buckets[0].key, '2026-10-19');
  assert.equal(daily.studyDays, 1);
  data.learning.push(structuredClone(data.learning[0]));
  assert.equal(selectAnalytics(data, defaults).vocabulary, 2);
});

test('empty data has null metrics and no prediction, score, accuracy or weak-area fallback', () => {
  const selected = selectAnalytics(createDemoAnalytics('empty'), defaults);
  assert.equal(selected.vocabulary, null);
  assert.equal(selected.grammar, null);
  assert.equal(selected.studyDays, null);
  assert.equal(selected.latestScore, null);
  assert.equal(selected.prediction, null);
  assert.deepEqual(selected.buckets, []);
  assert.deepEqual(selected.weakParts, []);
});

test('URL filters reject invalid, repeated and inherited values', () => {
  assert.deepEqual(
    parseAnalyticsFilters({ range: 'LAST_90_DAYS', mode: 'PRACTICE', scope: 'parts' }),
    { range: 'LAST_90_DAYS', mode: 'PRACTICE', scope: 'parts' },
  );
  assert.deepEqual(
    parseAnalyticsFilters({
      range: ['LAST_7_DAYS', 'ALL_TIME'],
      mode: 'constructor',
      scope: 'unknown',
    }),
    defaults,
  );
});

test('repository supports explicit demo error, retry, cancellation and fixed fixtures', async () => {
  await assert.rejects(
    analyticsRepository.load('error', new AbortController().signal),
    /Demo loading error/,
  );
  const loaded = await analyticsRepository.load('ready', new AbortController().signal);
  assert.equal(loaded.source, 'demo');
  assert.equal(selectAnalytics(loaded, defaults).prediction, 660);
  const controller = new AbortController();
  const pending = analyticsRepository.load('loading', controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(analyticsRepository.load('ready', controller.signal), {
    name: 'AbortError',
  });
});
