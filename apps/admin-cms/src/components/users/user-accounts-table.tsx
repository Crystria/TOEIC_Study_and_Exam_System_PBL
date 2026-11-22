'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  AccountRoles,
  AccountRoleSelect,
  AccountStatusSelect,
  canManageAccountRole,
  managedAccountRole,
  managedAccountRoleLabel,
  type ManagedAccountRole,
} from './account-controls';

type Account = {
  id: string;
  fullName: string;
  email: string;
  roles: readonly string[];
  status: string;
};

type AccountChanges<Status extends string> = { role?: ManagedAccountRole; status?: Status };
type ApplyScope = 'bulk' | 'row';
type UpdateReport = {
  scope: ApplyScope;
  succeeded: number;
  failures: { id: string; name: string; message: string }[];
};

export function UserAccountsTable<User extends Account, Status extends string>({
  items,
  href,
  statuses,
  statusLabels,
  writes,
  editable,
  applyChanges,
  onUpdated,
  children,
}: {
  items?: readonly User[];
  href: (id: string) => string;
  statuses: readonly Status[];
  statusLabels: Readonly<Record<string, string>>;
  writes: boolean;
  editable?: (user: User) => boolean;
  applyChanges: (user: User, changes: AccountChanges<Status>) => Promise<void> | void;
  onUpdated?: () => void;
  children?: ReactNode;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [bulk, setBulk] = useState<AccountChanges<Status>>({});
  const [drafts, setDrafts] = useState<Record<string, AccountChanges<Status>>>({});
  const [busy, setBusy] = useState<ApplyScope>();
  const [report, setReport] = useState<UpdateReport>();
  const updating = useRef(false);
  const canEdit = (user: User) => writes && (editable?.(user) ?? true);
  const editableUsers = (items ?? []).filter(canEdit);
  const roleEditableUsers = editableUsers.filter((user) => canManageAccountRole(user.roles));
  const eligible = bulk.role ? roleEditableUsers : editableUsers;
  const eligibleIds = new Set(eligible.map((user) => user.id));
  const selected = eligible.filter((user) => selection.includes(user.id));
  const statusLabel = (status: string) => statusLabels[status] ?? (status || 'Chưa có trạng thái');

  function changeDraft(id: string, changes: AccountChanges<Status>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
  }

  async function apply(scope: ApplyScope, users: readonly User[], changes: AccountChanges<Status>) {
    const subject =
      scope === 'row' && users[0] ? accountName(users[0]) : `${users.length} tài khoản`;
    const values = [
      changes.role && managedAccountRoleLabel(changes.role),
      changes.status && statusLabel(changes.status),
    ].filter(Boolean);
    if (
      !writes ||
      !users.length ||
      !values.length ||
      updating.current ||
      !window.confirm(`Áp dụng ${values.join(' và ')} cho ${subject}?`)
    )
      return;

    updating.current = true;
    setBusy(scope);
    setReport(undefined);
    const succeeded = new Set<string>();
    const failures: UpdateReport['failures'] = [];
    try {
      for (const user of users) {
        try {
          await applyChanges(user, changes);
          succeeded.add(user.id);
        } catch (error) {
          failures.push({
            id: user.id,
            name: accountName(user),
            message: error instanceof Error ? error.message : 'Không thể cập nhật tài khoản.',
          });
        }
      }
      if (scope === 'bulk') setSelection((current) => current.filter((id) => !succeeded.has(id)));
      setDrafts((current) => {
        const next = { ...current };
        for (const id of succeeded) {
          if (!next[id]) continue;
          const remaining = {
            role: changes.role ? undefined : next[id].role,
            status: changes.status ? undefined : next[id].status,
          };
          if (remaining.role || remaining.status) next[id] = remaining;
          else delete next[id];
        }
        return next;
      });
      setReport({ scope, succeeded: succeeded.size, failures });
      onUpdated?.();
    } finally {
      updating.current = false;
      setBusy(undefined);
    }
  }

  return (
    <div className="account-management">
      <section
        aria-labelledby="account-bulk-heading"
        className="account-bulk"
        aria-busy={busy === 'bulk'}
      >
        <h2 id="account-bulk-heading">Cập nhật hàng loạt</h2>
        <form
          aria-label="Thao tác hàng loạt"
          className="account-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void apply('bulk', selected, bulk);
          }}
        >
          <p aria-live="polite">
            <strong>{selected.length}</strong> tài khoản được chọn
          </p>
          <div className="account-toolbar-actions">
            <AccountRoleSelect
              name="Vai trò áp dụng hàng loạt"
              emptyLabel="Giữ nguyên vai trò"
              value={bulk.role ?? ''}
              disabled={!!busy || !roleEditableUsers.length}
              onChange={(role) => {
                setBulk((current) => ({ ...current, role: role || undefined }));
                if (role) {
                  const roleEditableIds = new Set(roleEditableUsers.map((user) => user.id));
                  setSelection((current) => current.filter((id) => roleEditableIds.has(id)));
                }
              }}
            />
            <AccountStatusSelect
              name="Trạng thái áp dụng hàng loạt"
              emptyLabel="Giữ nguyên trạng thái"
              value={bulk.status ?? ''}
              statuses={statuses}
              statusLabels={statusLabels}
              disabled={!!busy || !eligible.length}
              onChange={(status) =>
                setBulk((current) => ({ ...current, status: status || undefined }))
              }
            />
            <Button
              type="submit"
              className="disabled:hover:bg-brand disabled:hover:opacity-100"
              disabled={!!busy || !selected.length || (!bulk.role && !bulk.status)}
            >
              Áp dụng
            </Button>
            {selected.length > 0 && (
              <Button variant="ghost" disabled={!!busy} onClick={() => setSelection([])}>
                Bỏ chọn
              </Button>
            )}
          </div>
        </form>
        {bulk.role && roleEditableUsers.length < editableUsers.length && (
          <p className="account-bulk-note">
            Chọn “Giữ nguyên vai trò” để cập nhật trạng thái cho tài khoản quản trị hệ thống.
          </p>
        )}
        <AccountUpdateReport
          busy={busy === 'bulk'}
          report={report?.scope === 'bulk' ? report : undefined}
        />
        {!!items?.length && (
          <div
            className="api-scroll account-table-scroll account-bulk-scroll"
            role="region"
            aria-label="Tài khoản cập nhật hàng loạt"
            tabIndex={0}
          >
            <table className="api-table account-table" aria-label="Bảng cập nhật hàng loạt">
              <thead>
                <tr>
                  <th scope="col" className="account-select-cell" aria-label="Chọn tài khoản" />
                  <th scope="col">Tài khoản</th>
                  <th scope="col">Vai trò hiện tại</th>
                  <th scope="col">Trạng thái hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => {
                  const name = accountName(user);
                  const checked = eligibleIds.has(user.id) && selection.includes(user.id);
                  return (
                    <tr key={user.id} data-selected={checked}>
                      <td className="account-select-cell">
                        <input
                          type="checkbox"
                          aria-label={`Chọn tài khoản ${name}`}
                          checked={checked}
                          disabled={!!busy || !eligibleIds.has(user.id)}
                          onChange={(event) => {
                            const isChecked = event.target.checked;
                            setSelection((current) =>
                              isChecked
                                ? [...current, user.id]
                                : current.filter((id) => id !== user.id),
                            );
                          }}
                        />
                      </td>
                      <td>
                        <AccountIdentity user={user} />
                      </td>
                      <td>
                        <AccountRoles roles={user.roles} />
                      </td>
                      <td>
                        <span className="account-current-status" data-status={user.status}>
                          {statusLabel(user.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {children}

      <section aria-busy={busy === 'row'}>
        <AccountUpdateReport
          busy={busy === 'row'}
          report={report?.scope === 'row' ? report : undefined}
        />
        {!!items?.length && (
          <div
            className="api-scroll account-table-scroll"
            role="region"
            aria-label="Danh sách người dùng"
            tabIndex={0}
          >
            <table className="api-table account-table" aria-label="Bảng người dùng">
              <thead>
                <tr>
                  <th scope="col">Tài khoản</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="account-apply-cell">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => {
                  const name = accountName(user);
                  const role = managedAccountRole(user.roles);
                  const roleEditable = canManageAccountRole(user.roles);
                  const draft = drafts[user.id] ?? {};
                  const changes = {
                    role: roleEditable && draft.role !== role ? draft.role : undefined,
                    status: draft.status !== user.status ? draft.status : undefined,
                  };
                  const disabled = !!busy || !canEdit(user);
                  return (
                    <tr key={user.id}>
                      <td>
                        <AccountIdentity user={user} href={href(user.id)} />
                      </td>
                      <td>
                        {roleEditable ? (
                          <AccountRoleSelect
                            name={`Vai trò của ${name}`}
                            value={draft.role ?? role}
                            disabled={disabled}
                            onChange={(value) =>
                              changeDraft(user.id, {
                                role: value && value !== role ? value : undefined,
                              })
                            }
                          />
                        ) : (
                          <AccountRoles roles={user.roles} />
                        )}
                      </td>
                      <td>
                        <AccountStatusSelect
                          name={`Trạng thái của ${name}`}
                          value={draft.status ?? user.status}
                          statuses={statuses}
                          statusLabels={statusLabels}
                          disabled={disabled}
                          onChange={(value) =>
                            changeDraft(user.id, {
                              status: value && value !== user.status ? value : undefined,
                            })
                          }
                        />
                      </td>
                      <td className="account-apply-cell">
                        <Button
                          size="sm"
                          className="disabled:hover:bg-brand disabled:hover:opacity-100"
                          aria-label={`Áp dụng cho ${name}`}
                          disabled={disabled || (!changes.role && !changes.status)}
                          onClick={() => void apply('row', [user], changes)}
                        >
                          Áp dụng
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountUpdateReport({ report, busy }: { report?: UpdateReport; busy: boolean }) {
  return (
    <>
      {busy && <p role="status">Đang cập nhật tài khoản…</p>}
      {report && report.succeeded > 0 && (
        <p className="account-success" role="status">
          Đã cập nhật {report.succeeded} tài khoản.
        </p>
      )}
      {report && report.failures.length > 0 && (
        <div className="api-error ws-error" role="alert">
          <p>Chưa hoàn tất cập nhật cho {report.failures.length} tài khoản.</p>
          <ul>
            {report.failures.map(({ id, name, message }) => (
              <li key={id}>
                <strong>{name}</strong> · {message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

const accountName = (user: Account) => user.fullName || user.email || 'Chưa có tên';

function AccountIdentity({ user, href }: { user: Account; href?: string }) {
  const name = accountName(user);
  return (
    <>
      {href ? (
        <Link className="account-name" href={href}>
          {name}
        </Link>
      ) : (
        <strong>{name}</strong>
      )}
      {user.email && user.email !== name && <p className="account-email">{user.email}</p>}
    </>
  );
}
