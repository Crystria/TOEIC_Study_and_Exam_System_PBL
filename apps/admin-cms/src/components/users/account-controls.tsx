import { USER_ROLE_LABELS, type UserRoleCode } from '@/lib/users/types';

const ACCOUNT_ROLE_OPTIONS = ['USER', 'CONTENT_ADMIN'] as const;
export type ManagedAccountRole = (typeof ACCOUNT_ROLE_OPTIONS)[number];

export function managedAccountRoleLabel(role: ManagedAccountRole) {
  return role === 'USER' ? USER_ROLE_LABELS.USER : 'Content Admin';
}

export function managedAccountRole(roles: readonly string[]): ManagedAccountRole | '' {
  if (roles.includes('CONTENT_ADMIN')) return 'CONTENT_ADMIN';
  return roles.includes('USER') ? 'USER' : '';
}

export function canManageAccountRole(roles: readonly string[]) {
  return !roles.includes('SYSTEM_ADMIN');
}

export function AccountRoleSelect({
  name,
  value,
  disabled,
  onChange,
  id,
  emptyLabel,
}: {
  name: string;
  value: ManagedAccountRole | '';
  disabled?: boolean;
  onChange: (value: ManagedAccountRole | '') => void;
  id?: string;
  emptyLabel?: string;
}) {
  return (
    <select
      id={id}
      className="account-select account-role-select"
      data-role={value}
      aria-label={name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ManagedAccountRole | '')}
    >
      {(emptyLabel || !value) && (
        <option value="" disabled={!emptyLabel}>
          {emptyLabel ?? 'Chọn vai trò'}
        </option>
      )}
      {ACCOUNT_ROLE_OPTIONS.map((role) => (
        <option key={role} value={role}>
          {managedAccountRoleLabel(role)}
        </option>
      ))}
    </select>
  );
}

export function AccountStatusSelect<Status extends string>({
  name,
  value,
  statuses,
  statusLabels,
  disabled,
  onChange,
  id,
  emptyLabel,
}: {
  name: string;
  value: string;
  statuses: readonly Status[];
  statusLabels: Readonly<Record<string, string>>;
  disabled?: boolean;
  onChange: (value: Status | '') => void;
  id?: string;
  emptyLabel?: string;
}) {
  return (
    <select
      id={id}
      className="account-select account-status-select"
      data-status={value}
      aria-label={name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Status | '')}
    >
      {(emptyLabel || !value) && (
        <option value="" disabled={!emptyLabel}>
          {emptyLabel ?? 'Chọn trạng thái'}
        </option>
      )}
      {value && !statuses.some((status) => status === value) && (
        <option value={value} disabled>
          {statusLabels[value] ?? value}
        </option>
      )}
      {statuses.map((status) => (
        <option value={status} key={status}>
          {statusLabels[status]}
        </option>
      ))}
    </select>
  );
}

function roleLabel(role: string) {
  return USER_ROLE_LABELS[role as UserRoleCode] ?? role;
}

export function AccountRoles({ roles }: { roles: readonly string[] }) {
  return roles.length ? (
    <ul className="account-role-boxes" aria-label="Vai trò của tài khoản">
      {roles.map((role) => (
        <li key={role} className="account-role-box" data-role={role}>
          {roleLabel(role)}
        </li>
      ))}
    </ul>
  ) : (
    <span>Chưa có vai trò</span>
  );
}
