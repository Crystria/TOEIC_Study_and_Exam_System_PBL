import { calculateSm2 } from './sm2';

describe('calculateSm2', () => {
  it('increments repetition and sets interval to 1 on first successful review', () => {
    const result = calculateSm2({ easinessFactor: 2.5, repetition: 0, interval: 1 }, 4);
    expect(result.repetition).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easinessFactor).toBeCloseTo(2.5, 5);
  });

  it('sets interval to 6 on second successful review', () => {
    const result = calculateSm2({ easinessFactor: 2.5, repetition: 1, interval: 1 }, 5);
    expect(result.repetition).toBe(2);
    expect(result.interval).toBe(6);
  });

  it('resets repetition and interval when quality is below 3', () => {
    const result = calculateSm2({ easinessFactor: 2.5, repetition: 4, interval: 30 }, 2);
    expect(result.repetition).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('never lets the easiness factor drop below 1.3', () => {
    const result = calculateSm2({ easinessFactor: 1.3, repetition: 3, interval: 10 }, 0);
    expect(result.easinessFactor).toBe(1.3);
  });

  it('multiplies interval by EF for later repetitions', () => {
    const result = calculateSm2({ easinessFactor: 2.5, repetition: 2, interval: 6 }, 4);
    expect(result.repetition).toBe(3);
    expect(result.interval).toBe(Math.round(6 * result.easinessFactor));
  });

  it('returns a future nextReviewAt', () => {
    const result = calculateSm2({ easinessFactor: 2.5, repetition: 0, interval: 1 }, 5);
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
  });
});
