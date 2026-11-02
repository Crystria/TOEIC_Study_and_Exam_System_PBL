import type { AuditLogSummary } from './types';

// Fictional, stable records, independent of user/student fixtures. No raw metadata
// or before/after payload: the source has no confirmed safe projection for them.
export const AUDIT_LOG_FIXTURES: readonly AuditLogSummary[] = Array.from(
  { length: 18 },
  (_, index) => {
    const n = index + 1;
    const userId = `demo-audit-user-${String((index % 4) + 1).padStart(3, '0')}`;
    return {
      id: `demo-audit-${String(n).padStart(3, '0')}`,
      userId,
      action: n % 3 === 0 ? 'USER_REGISTERED' : 'USER_LOGIN',
      targetType: 'user',
      targetId: userId,
      createdAt: `2026-10-28T${String(10 - Math.floor(index / 6)).padStart(2, '0')}:${String(50 - (index % 6) * 7).padStart(2, '0')}:00Z`,
      ...(n === 15 ? { userId: null } : {}),
      ...(n === 16 ? { targetType: null, targetId: null } : {}),
      ...(n === 17
        ? {
            action: 'DEMO_ACTION_CHUA_XAC_NHAN_DIEN_GIAI_KIEM_TRA_CHUOI_HANH_DONG_DAI',
            userId: 'demo-audit-user-ma-gia-dai-de-kiem-tra-hien-thi-tren-man-hinh-nho-017',
            targetType: 'demo_target_type_chua_xac_nhan_loai_doi_tuong',
            targetId: 'demo-target-ma-gia-rat-dai-chi-de-kiem-tra-xuong-dong-017',
          }
        : {}),
      ...(n === 18
        ? {
            userId: null,
            action: null,
            targetType: null,
            targetId: null,
            createdAt: null,
          }
        : {}),
    };
  },
);

// Values present in this fixture only; source action/targetType remain open strings.
export const DEMO_AUDIT_ACTIONS = [
  ...new Set(AUDIT_LOG_FIXTURES.flatMap((item) => (item.action ? [item.action] : []))),
];
