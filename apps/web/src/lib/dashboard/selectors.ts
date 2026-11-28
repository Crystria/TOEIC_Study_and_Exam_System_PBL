import type { ScoreAttempt, StudentDashboard, TimeRange } from './types';

export function isScoredMockTest(attempt: ScoreAttempt): boolean {
  const selected = new Set(attempt.selectedPartIds);
  const testParts = new Set(attempt.testPartIds);
  const validSection = (score: number | null) =>
    score !== null && Number.isInteger(score) && score >= 5 && score <= 495 && score % 5 === 0;
  return (
    attempt.mode === 'MOCK_TEST' &&
    selected.size > 0 &&
    selected.size === attempt.selectedPartIds.length &&
    selected.size === testParts.size &&
    [...testParts].every((id) => selected.has(id)) &&
    [...selected].every((id) => Number.isInteger(id) && id >= 1 && id <= 7) &&
    [...selected].some((id) => id <= 4) &&
    [...selected].some((id) => id >= 5) &&
    validSection(attempt.scoreListening) &&
    validSection(attempt.scoreReading) &&
    attempt.totalScore !== null &&
    attempt.totalScore === (attempt.scoreListening ?? 0) + (attempt.scoreReading ?? 0)
  );
}

export function selectScoreHistory(data: StudentDashboard, range: TimeRange): ScoreAttempt[] {
  const now = Date.parse(data.snapshotAt);
  const windowMs = (range === 'LAST_7_DAYS' ? 7 : 30) * 24 * 60 * 60 * 1000;
  return data.attempts
    .filter((attempt) => {
      const completed = Date.parse(attempt.completedAt);
      return (
        isScoredMockTest(attempt) &&
        Number.isFinite(completed) &&
        completed <= now &&
        (range === 'ALL_TIME' || completed >= now - windowMs)
      );
    })
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
}

export function selectPrediction(data: StudentDashboard): number | null {
  const score = data.predictedToeicScore;
  return selectScoreHistory(data, 'LAST_30_DAYS').length >= 3 &&
    score !== null &&
    Number.isInteger(score) &&
    score >= 10 &&
    score <= 990 &&
    score % 5 === 0
    ? score
    : null;
}
