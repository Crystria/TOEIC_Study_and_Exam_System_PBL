import { loadEtsScoreTable, lookupEtsScore, validateEtsScoreTable } from './ets-score-table';

const anchors: Array<[number, number, number]> = [
  [0, 5, 5],
  [5, 5, 5],
  [10, 5, 5],
  [15, 5, 5],
  [20, 25, 5],
  [25, 50, 30],
  [30, 85, 60],
  [35, 115, 85],
  [40, 160, 120],
  [45, 200, 145],
  [50, 230, 185],
  [55, 265, 220],
  [60, 300, 255],
  [65, 335, 285],
  [70, 360, 310],
  [75, 395, 335],
  [80, 425, 370],
  [85, 450, 400],
  [90, 480, 435],
  [95, 495, 470],
  [100, 495, 495],
];

describe('ETS score tables', () => {
  const listening = loadEtsScoreTable('listening');
  const reading = loadEtsScoreTable('reading');

  it('loads 101 rows for both skills', () => {
    expect(listening.table).toHaveLength(101);
    expect(reading.table).toHaveLength(101);
    expect(listening.official).toBe(false);
    expect(reading.official).toBe(false);
  });

  it.each(anchors)('matches anchor raw %i', (raw, listeningScore, readingScore) => {
    expect(lookupEtsScore(listening, raw)).toBe(listeningScore);
    expect(lookupEtsScore(reading, raw)).toBe(readingScore);
  });

  it('rejects raw scores outside 0-100', () => {
    expect(() => lookupEtsScore(listening, -1)).toThrow();
    expect(() => lookupEtsScore(listening, 101)).toThrow();
    expect(() => lookupEtsScore(listening, 1.5)).toThrow();
  });

  it('rejects malformed tables', () => {
    expect(() =>
      validateEtsScoreTable({ version: 'v', official: false, source: 's', table: [5] }),
    ).toThrow(/expected 101 rows/);

    expect(() =>
      validateEtsScoreTable({
        version: 'v',
        official: false,
        source: 's',
        table: Array.from({ length: 101 }, () => 500),
      }),
    ).toThrow(/out of range/);

    expect(() =>
      validateEtsScoreTable({
        version: 'v',
        official: false,
        source: 's',
        table: Array.from({ length: 101 }, () => 7),
      }),
    ).toThrow(/multiple/);

    const decreasing = Array.from({ length: 101 }, (_, index) => 5 + index * 5);
    decreasing[10] = 5;
    expect(() =>
      validateEtsScoreTable({
        version: 'v',
        official: false,
        source: 's',
        table: decreasing,
      }),
    ).toThrow(/decreases/);
  });
});
