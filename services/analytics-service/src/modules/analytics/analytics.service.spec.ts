import { calendarStart, prediction, streak, weakAreas } from './calculations';
import golden from '../../../../../packages/contracts/p0/fixtures/algorithms.json';
describe('P5 calculations against P0 golden fixtures', () => {
  for (const f of golden.prediction)
    it('prediction ' + f.name, () =>
      expect(
        prediction(
          f.attempts
            .filter((r: any) => r.mode === 'FULL' && r.validScore)
            .map((r: any) => ({ ...r, completedAt: new Date(r.completedAt) })),
          new Date(f.asOf),
        ).predictedToeicScore,
      ).toBe(f.expected),
    );
  it('uses calendar midnight in Vietnam across the UTC boundary', () =>
    expect(calendarStart(new Date('2026-10-31T17:00:00Z'), 7).toISOString()).toBe(
      '2026-10-25T17:00:00.000Z',
    ));
  it('late days bridge streaks and current expires without a new event', () => {
    expect(
      streak(
        ['2026-10-29', '2026-10-31', '2026-10-30', '2026-10-30'],
        new Date('2026-10-31T05:00Z'),
      ),
    ).toMatchObject({ learningStreakDays: 3, longestStreak: 3 });
    expect(
      streak(['2026-10-29', '2026-10-30', '2026-10-31'], new Date('2026-11-03T05:00Z')),
    ).toMatchObject({ learningStreakDays: 0, longestStreak: 3 });
  });
  it('weak areas use weighted totals, exact threshold and null for insufficient samples', () => {
    const items = weakAreas(
      [
        { part: 1, total: 6, correct: 6 },
        { part: 1, total: 18, correct: 6 },
        { part: 2, total: 20, correct: 14 },
        { part: 3, total: 19, correct: 0 },
      ],
      new Date(),
    );
    expect(items[0]).toMatchObject({ correct: 12, total: 24, weaknessScore: 0.5, isWeak: true });
    expect(items[1]).toMatchObject({ weaknessScore: 0.3, isWeak: true });
    expect(items[2]).toMatchObject({
      status: 'INSUFFICIENT_DATA',
      weaknessScore: null,
      isWeak: null,
    });
  });
});
