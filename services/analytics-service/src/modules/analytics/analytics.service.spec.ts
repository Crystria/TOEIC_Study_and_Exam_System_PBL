import type { ScoreHistory } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService score prediction', () => {
  const findMany = jest.fn();
  const service = new AnalyticsService({
    scoreHistory: { findMany },
  } as unknown as PrismaService);

  function mockScores(scores: Array<number | null>) {
    const attempts: ScoreHistory[] = scores.map((score, index) => ({
      id: `score-${index}`,
      userId: 'user-1',
      attemptId: `attempt-${index}`,
      testType: null,
      mode: score === null ? 'PART' : 'FULL',
      score,
      accuracy: score === null ? 0.8 : null,
      parts: null,
      takenAt: new Date(Date.now() - (scores.length - index) * 24 * 60 * 60 * 1000),
    }));
    findMany.mockResolvedValue(attempts);
  }

  beforeEach(() => findMany.mockReset());

  it.each([
    { scores: [], count: 0 },
    { scores: [null, null, null], count: 0 },
    { scores: [100, null, 200, null], count: 2 },
  ])('requires three scored attempts for $scores', async ({ scores, count }) => {
    mockScores(scores);

    expect(await service.getPrediction('user-1')).toMatchObject({
      available: false,
      recentAttempts: count,
      windowDays: 30,
    });
  });

  it('preserves weighted prediction for scored attempts', async () => {
    mockScores([100, 200, 300]);

    expect(await service.getPrediction('user-1')).toEqual({
      available: true,
      predictedScore: 283,
      recentAttempts: 3,
      windowDays: 30,
      method: 'WEIGHTED_RECENT_TREND',
      stats: { averageScore: 200, latestScore: 300, trend: 200 },
    });
  });

  it('ignores null scores throughout the prediction while retaining zero scores', async () => {
    mockScores([null, 0, null, 200, null, 400, null]);

    expect(await service.getPrediction('user-1')).toMatchObject({
      available: true,
      predictedScore: 367,
      recentAttempts: 3,
      stats: { averageScore: 200, latestScore: 400, trend: 400 },
    });
  });

  it.each([
    { scores: [0, 990, 990], predictedScore: 990 },
    { scores: [990, 0, 0], predictedScore: 0 },
  ])('bounds the prediction to $predictedScore for $scores', async ({ scores, predictedScore }) => {
    mockScores(scores);

    expect(await service.getPrediction('user-1')).toMatchObject({
      available: true,
      predictedScore,
    });
  });
});
