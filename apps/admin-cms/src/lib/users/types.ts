// Minimal CMS read model, not an auth entity, authoring DTO or server response.
export const USER_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserRoleCode = 'SYSTEM_ADMIN' | 'CONTENT_ADMIN' | 'USER';
export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Bị khóa',
  DISABLED: 'Vô hiệu hóa',
  PENDING: 'Chờ xử lý',
};
export const USER_ROLE_LABELS: Record<UserRoleCode, string> = {
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  CONTENT_ADMIN: 'Quản trị nội dung',
  USER: 'Học viên',
};
export interface UserSummary {
  id: string;
  fullName: string | null;
  email: string | null;
  roles: readonly UserRoleCode[] | null;
  status: UserStatus | null;
}
export type UserPreview = 'normal' | 'slow' | 'empty' | 'error';
export interface UserQuery {
  keyword: string;
  status: UserStatus | '';
  page: number;
  size: number;
}
export interface UserPage {
  items: UserSummary[];
  total: number;
  catalogTotal: number;
  page: number;
  size: number;
  totalPages: number;
}
// Independently verified in Auth/User ListUsersQueryDto: page>=1, size 1..50.
export const DEFAULT_USER_QUERY: UserQuery = { keyword: '', status: '', page: 1, size: 20 };
