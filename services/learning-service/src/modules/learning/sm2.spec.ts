import { calculateSm2, vietnamDate } from './sm2';
import fixture from '../../../../../packages/contracts/p0/fixtures/algorithms.json';
describe('P3 SM-2 golden contracts', () => {
  for (const row of fixture.sm2)
    it(row.name, () =>
      expect(calculateSm2(row.state, row.quality, new Date(row.activityAt))).toEqual(row.expected),
    );
  it.each([-1, 6, 2.5, NaN])('rejects invalid quality %s', (q) =>
    expect(() =>
      calculateSm2({ easinessFactor: 2.5, repetitionNumber: 0, intervalDays: 0 }, q, new Date()),
    ).toThrow('INVALID_QUALITY'),
  );
  it('switches activity date precisely at Vietnam midnight', () => {
    expect(vietnamDate(new Date('2026-10-31T16:59:59.999Z'))).toBe('2026-10-31');
    expect(vietnamDate(new Date('2026-10-31T17:00:00.000Z'))).toBe('2026-11-01');
  });
  it('bounds finite SQL/date domains', () =>
    expect(() =>
      calculateSm2(
        { easinessFactor: 99.99, repetitionNumber: 3, intervalDays: 2147483647 },
        5,
        new Date(),
      ),
    ).toThrow('SM2_DOMAIN_EXHAUSTED'));
});
