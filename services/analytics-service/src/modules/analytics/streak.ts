/**
 * Logic tính chuỗi ngày học liên tục (streak), tách riêng để dễ unit-test.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StreakRow {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
}

/** Chuẩn hoá về đầu ngày theo UTC để so sánh theo "ngày". */
export function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/** Số ngày lệch nhau giữa 2 mốc thời gian (đã bỏ phần giờ/phút/giây). */
export function diffInDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/**
 * Áp dụng một hoạt động học tập vào streak hiện tại.
 * - Chưa từng có hoạt động: streak = 1.
 * - Cùng ngày / event đến trễ (ngày cũ hơn): giữ nguyên.
 * - Liền kề hôm trước (1 ngày): +1.
 * - Cách quãng (>= 2 ngày): reset về 1.
 * Luôn cập nhật longestStreak = max(longest, current).
 */
export function applyActivity(streakRow: StreakRow | null, activityDate: Date): StreakResult {
  const day = startOfDay(activityDate);

  if (!streakRow || !streakRow.lastActivityDate) {
    const currentStreak = 1;
    return {
      currentStreak,
      longestStreak: Math.max(streakRow?.longestStreak ?? 0, currentStreak),
      lastActivityDate: day,
    };
  }

  const delta = diffInDays(streakRow.lastActivityDate, day);

  if (delta <= 0) {
    return {
      currentStreak: streakRow.currentStreak,
      longestStreak: streakRow.longestStreak,
      lastActivityDate: streakRow.lastActivityDate,
    };
  }

  const currentStreak = delta === 1 ? streakRow.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(streakRow.longestStreak, currentStreak),
    lastActivityDate: day,
  };
}
