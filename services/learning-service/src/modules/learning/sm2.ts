/**
 * SM-2 (SuperMemo-2) spaced repetition algorithm.
 *
 * Tham chiếu: https://super-memory.com/english/ol/sm2.htm
 */

export interface Sm2State {
  easinessFactor: number;
  repetition: number;
  interval: number;
}

export interface Sm2Result extends Sm2State {
  nextReviewAt: Date;
}

const MIN_EASINESS_FACTOR = 1.3;

const clampQuality = (quality: number): number => {
  if (!Number.isFinite(quality)) return 0;
  return Math.min(5, Math.max(0, Math.round(quality)));
};

/**
 * Tính trạng thái SM-2 kế tiếp từ `state` với chất lượng trả lời `quality` (0..5).
 *
 * - EF_new = EF_old + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), tối thiểu 1.3.
 * - q < 3: reset repetition = 0, interval = 1.
 * - q >= 3: repetition++ và interval = 1 (lần 1), 6 (lần 2), round(interval * EF).
 */
export function calculateSm2(state: Sm2State, quality: number): Sm2Result {
  const q = clampQuality(quality);

  let easinessFactor = state.easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easinessFactor < MIN_EASINESS_FACTOR) {
    easinessFactor = MIN_EASINESS_FACTOR;
  }

  let repetition: number;
  let interval: number;

  if (q < 3) {
    repetition = 0;
    interval = 1;
  } else {
    repetition = state.repetition + 1;
    if (repetition === 1) {
      interval = 1;
    } else if (repetition === 2) {
      interval = 6;
    } else {
      interval = Math.round(state.interval * easinessFactor);
    }
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { easinessFactor, repetition, interval, nextReviewAt };
}
