import { createDemoDashboard } from '../dashboard/mock-data';
import type { PartId } from '../exams/types';
import { demoAnalyticsPrediction } from './prediction-fixture';
import type { AnalyticsPreview, AnalyticsSnapshot, PartResult } from './types';

const totals = [6, 25, 39, 30, 30, 16, 54];
const correctCounts = [
  [4, 16, 23, 20, 16, 9, 33],
  [5, 18, 26, 22, 18, 10, 37],
  [5, 20, 29, 24, 20, 11, 40],
];

function fullPartResults(correct: number[]): PartResult[] {
  return totals.map((total, index) => ({
    partId: (index + 1) as PartId,
    total,
    correct: correct[index],
  }));
}

export function createDemoAnalytics(
  scenario: Exclude<AnalyticsPreview, 'error' | 'loading'>,
): AnalyticsSnapshot {
  const dashboard = createDemoDashboard('ready');
  const data: AnalyticsSnapshot = {
    source: 'demo',
    snapshotAt: dashboard.snapshotAt,
    timezone: dashboard.settings.timezone,
    targetScore: dashboard.settings.targetToeicScore,
    prediction: structuredClone(demoAnalyticsPrediction),
    attempts: dashboard.attempts.map((attempt, index) => ({
      ...attempt,
      scope: attempt.mode === 'PRACTICE' ? 'parts' : 'full',
      gradingStatus: 'GRADED',
      toeicEligibility: attempt.mode === 'PRACTICE' ? 'ineligible' : 'eligible',
      partResults:
        attempt.mode === 'PRACTICE'
          ? [{ partId: 5, correct: 12, total: 20 }]
          : fullPartResults(correctCounts[index]),
    })),
    learning: [
      ['2026-06-15T01:00:00Z', 33, 4],
      ['2026-08-15T01:00:00Z', 10, 1],
      ['2026-09-28T01:00:00Z', 10, 1],
      ['2026-10-02T01:00:00Z', 8, 0],
      ['2026-10-06T01:00:00Z', 12, 1],
      ['2026-10-10T01:00:00Z', 10, 1],
      ['2026-10-14T01:00:00Z', 10, 1],
      ['2026-10-17T01:00:00Z', 9, 1],
      ['2026-10-20T01:00:00Z', 10, 1],
      ['2026-10-22T13:20:00Z', 10, 1],
      ['2026-10-23T01:45:00Z', 6, 0],
    ].flatMap(([occurredAt, vocabulary, grammar], index) => [
      {
        id: `analytics-vocab-${index}`,
        kind: 'vocabulary' as const,
        occurredAt: String(occurredAt),
        quantity: Number(vocabulary),
      },
      ...(grammar
        ? [
            {
              id: `analytics-grammar-${index}`,
              kind: 'grammar' as const,
              occurredAt: String(occurredAt),
              quantity: Number(grammar),
            },
          ]
        : []),
    ]),
  };
  const full = data.attempts[0];
  data.attempts.push(
    {
      ...structuredClone(full),
      attemptId: 'analytics-august',
      completedAt: '2026-08-15T08:00:00Z',
      scoreListening: 280,
      scoreReading: 270,
      totalScore: 550,
    },
    {
      ...structuredClone(full),
      attemptId: 'analytics-june',
      completedAt: '2026-06-15T08:00:00Z',
      scoreListening: 250,
      scoreReading: 250,
      totalScore: 500,
    },
    {
      ...structuredClone(full),
      attemptId: 'analytics-partial',
      scope: 'parts',
      selectedPartIds: [2, 5],
      completedAt: '2026-10-21T08:00:00Z',
      toeicEligibility: 'ineligible',
      scoreListening: null,
      scoreReading: null,
      totalScore: null,
      partResults: [
        { partId: 2, correct: 16, total: 25 },
        { partId: 5, correct: 18, total: 30 },
      ],
    },
    {
      ...structuredClone(full),
      attemptId: 'analytics-reading',
      selectedPartIds: [5, 6, 7],
      testPartIds: [5, 6, 7],
      completedAt: '2026-10-19T08:00:00Z',
      toeicEligibility: 'ineligible',
      scoreListening: null,
      scoreReading: null,
      totalScore: null,
      partResults: [
        { partId: 5, correct: 12, total: 20 },
        { partId: 6, correct: 6, total: 8 },
        { partId: 7, correct: 15, total: 22 },
      ],
    },
    {
      ...structuredClone(full),
      attemptId: 'analytics-pending',
      gradingStatus: 'PENDING',
      completedAt: '2026-10-23T01:00:00Z',
      toeicEligibility: 'ineligible',
      scoreListening: null,
      scoreReading: null,
      totalScore: null,
      partResults: [],
    },
  );
  if (scenario === 'empty') {
    data.learning = [];
    data.attempts = [];
    data.prediction = null;
  }
  if (scenario === 'insufficient') {
    data.attempts = data.attempts.filter((attempt) => attempt.attemptId !== 'demo-full-01');
    // Retain the stale fixture deliberately: selector must hide it without enough supporting data.
  }
  if (scenario === 'ungraded') {
    data.attempts = data.attempts.filter((attempt) => attempt.gradingStatus === 'PENDING');
  }
  return data;
}
