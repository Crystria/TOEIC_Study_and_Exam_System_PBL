// Minimal demo read model; neither AdminAuditLog from Word nor an API response.
// Nullable fields also exercise incomplete display; they do not relax Prisma constraints.
export interface AuditLogSummary {
  id: string;
  userId: string | null;
  action: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string | null;
}
export type AuditPreview = 'normal' | 'slow' | 'empty' | 'error';
export interface AuditQuery {
  keyword: string;
  action: string;
  page: number;
  size: number;
}
export interface AuditPage {
  items: AuditLogSummary[];
  total: number;
  catalogTotal: number;
  page: number;
  size: number;
  totalPages: number;
}
// Local UI choices only. The audit endpoint defaults to 1/20 and has no DTO bounds.
export const AUDIT_DEMO_PAGE_SIZES = [6, 12, 24] as const;
export const DEFAULT_AUDIT_QUERY: AuditQuery = { keyword: '', action: '', page: 1, size: 6 };

// Labels only for the two call sites verified in AuthService; not a business enum.
export function describeAuditAction(action: string | null): string {
  if (action === 'USER_LOGIN') return 'Sự kiện xác thực được ghi trong luồng đăng nhập.';
  if (action === 'USER_REGISTERED') return 'Sự kiện tài khoản được ghi trong luồng đăng ký.';
  return 'Chưa có diễn giải hành động được xác nhận.';
}
export function formatAuditTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}
