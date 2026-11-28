export interface Sm2State {
  easinessFactor: number;
  repetitionNumber: number;
  intervalDays: number;
}
export function vietnamDate(at: Date): string {
  if (!Number.isFinite(at.getTime())) throw new Error('INVALID_ACTIVITY_TIME');
  return new Date(at.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function calculateSm2(
  state: Sm2State,
  quality: number,
  activityAt: Date,
): Sm2State & { nextReviewDate: string } {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error('INVALID_QUALITY');
  const oldCents = Math.round(state.easinessFactor * 100);
  const cents = Math.max(130, oldCents + 10 - (5 - quality) * (8 + (5 - quality) * 2));
  const repetitionNumber = quality < 3 ? 0 : state.repetitionNumber + 1;
  const intervalDays =
    quality < 3 || repetitionNumber === 1
      ? 1
      : repetitionNumber === 2
        ? 6
        : Math.max(1, Math.floor((state.intervalDays * cents + 50) / 100));
  if (cents > 9999 || intervalDays > 2147483647 || repetitionNumber > 2147483647)
    throw new Error('SM2_DOMAIN_EXHAUSTED');
  const next = new Date(vietnamDate(activityAt) + 'T00:00:00.000Z');
  next.setUTCDate(next.getUTCDate() + intervalDays);
  if (next.getUTCFullYear() > 9999) throw new Error('SM2_DOMAIN_EXHAUSTED');
  return {
    easinessFactor: cents / 100,
    repetitionNumber,
    intervalDays,
    nextReviewDate: next.toISOString().slice(0, 10),
  };
}
