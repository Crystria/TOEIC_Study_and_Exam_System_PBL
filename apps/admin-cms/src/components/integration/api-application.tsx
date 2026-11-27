'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ApiAuth,
  Blocked,
  LogoutButton,
  ResourceState,
  SessionGate,
  useResource,
} from '../../../../web/src/components/integration/shared';
import {
  failureMessage,
  GatewayError,
  mutationOutcomeUnknown,
} from '../../../../web/src/lib/integration/client';
import { PasswordForm } from '../../../../web/src/components/integration/password-forms';
import type { User, Page } from '../../../../web/src/lib/integration/contracts';
import { cmsApi, userChangeMatches, type UserChange } from '../../lib/integration/repositories';
import { ACCOUNT_PAGE_SIZE } from '../../lib/users/types';
import { ContentManagement, QuestionManagement } from './content-management';
import { GroupManagement } from './group-management';
import { TopicManagement } from './topic-management';
import { TestManagement } from './test-management';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CmsShell } from '../layout/cms-shell';
import { AdminLoginLayout } from '../auth/admin-login-layout';
import {
  AccountRoles,
  AccountRoleSelect,
  AccountStatusSelect,
  canManageAccountRole,
  managedAccountRole,
  type ManagedAccountRole,
} from '../users/account-controls';
import { AccountPagination } from '../users/account-pagination';
import { UserAccountsTable } from '../users/user-accounts-table';

const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'] as const;
type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  SUSPENDED: 'Tạm khóa',
  INACTIVE: 'Vô hiệu',
};
const accountStatusLabel = (status: string) =>
  ACCOUNT_STATUS_LABELS[status as AccountStatus] ?? status;
type AccountChanges = { role?: ManagedAccountRole; status?: AccountStatus };
type AccountChangeKind = UserChange['kind'];
type AccountChangeFailure = { kind: AccountChangeKind; message: string; uncertain: boolean };

export function ApiCmsApplication({
  writes,
  systemWrites,
}: {
  writes: boolean;
  systemWrites: boolean;
}) {
  const path = usePathname();
  const system = path.startsWith('/users') || path.startsWith('/audit-logs');
  if (path === '/login' || path === '/')
    return (
      <AdminLoginLayout>
        <ApiAuth cms embedded />
      </AdminLoginLayout>
    );
  return (
    <SessionGate key={path}>
      {(user) => {
        if (!user.roles.some((role) => ['CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(role)))
          return (
            <main className="api-login">
              <h1>Không có quyền quản trị</h1>
              <p>Quyền tài khoản từ backend: {user.roles.join(', ') || 'chưa có'}.</p>
              <LogoutButton />
            </main>
          );
        return (
          <CmsShell apiAccount={user}>
            <div className="api-root">
              {!(system ? systemWrites : writes) &&
                path !== '/audit-logs' &&
                path !== '/account/password' && (
                  <Blocked>
                    Chức năng chỉnh sửa đang tắt trong cấu hình. Bạn vẫn có thể xem và tìm kiếm dữ
                    liệu.
                  </Blocked>
                )}
              <CmsDomain key={path} user={user} writes={system ? systemWrites : writes} />
            </div>
          </CmsShell>
        );
      }}
    </SessionGate>
  );
}
function useLocation() {
  const path = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const params = new URLSearchParams(search.toString());
  let id = path.split('/')[2];
  try {
    if (id) id = decodeURIComponent(id);
  } catch {
    /* invalid ID is rejected by transport */
  }
  const section = path.split('/')[1];
  return {
    path,
    id,
    section,
    params,
    href: (nextId?: string, edit = false) =>
      `/${section}${nextId ? `/${encodeURIComponent(nextId)}${edit ? '/edit' : ''}` : ''}?${params}`,
    update: (values: Record<string, string>) => {
      for (const [k, v] of Object.entries(values)) v ? params.set(k, v) : params.delete(k);
      router.push(`/${section}?${params}`);
    },
  };
}
function CmsDomain({ user, writes }: { user: User; writes: boolean }) {
  const { section, path, id } = useLocation();
  if (path === '/account/password')
    return (
      <Panel>
        <PasswordForm mode="change" />
      </Panel>
    );
  const system = ['users', 'audit-logs'].includes(section),
    content = user.roles.includes('CONTENT_ADMIN'),
    admin = user.roles.includes('SYSTEM_ADMIN');
  const allowed = system
    ? admin
    : ['questions', 'groups', 'tests', 'media'].includes(section)
      ? content || admin
      : content;
  if (!allowed)
    return (
      <>
        <h1>Không có quyền truy cập</h1>
        <p>403 · Mục này yêu cầu vai trò {system ? 'SYSTEM_ADMIN' : 'CONTENT_ADMIN'} từ backend.</p>
      </>
    );
  if (section === 'questions') return <QuestionManagement writes={writes && content} />;
  if (section === 'tests')
    return (
      <>
        {!content && (
          <p role="status">
            Bạn chỉ có quyền xem nội dung đề thi. Quyền tạo, chỉnh sửa và xóa đề thi thuộc Quản trị
            nội dung.
          </p>
        )}
        <TestManagement writes={writes && content} />
      </>
    );
  if (section === 'groups') return <GroupManagement writes={writes && content} />;
  if (section === 'topics') return <TopicManagement writes={writes} />;
  if (section === 'users')
    return id ? (
      <UserDetail id={id} writes={writes} currentId={user.id} />
    ) : (
      <Users writes={writes} currentId={user.id} />
    );
  if (section === 'audit-logs') return <Audit />;
  if (['lessons', 'vocabulary'].includes(section))
    return <ContentManagement kind={section as 'lessons' | 'vocabulary'} writes={writes} />;
  if (section === 'media')
    return (
      <>
        <h1>Media quản trị</h1>
        <p>
          Gắn media tại chi tiết câu hỏi hoặc nhóm. Backend quản lý URL upload và tham chiếu theo
          từng bản ghi.
        </p>
      </>
    );

  return (
    <>
      <h1>Không tìm thấy trang</h1>
      <Link href={content ? '/tests' : '/users'}>Về danh sách</Link>
    </>
  );
}
function Pagination({
  result,
  onPage,
}: {
  result: Pick<Page<unknown>, 'page' | 'size' | 'total'>;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="api-actions" aria-label="Phân trang">
      <Button
        disabled={result.page <= 1}
        variant="secondary"
        onClick={() => onPage(result.page - 1)}
      >
        Trang trước
      </Button>
      <span>
        Trang {result.page} · {result.total} bản ghi
      </span>
      <Button
        variant="secondary"
        disabled={result.page * result.size >= result.total}
        onClick={() => onPage(result.page + 1)}
      >
        Trang sau
      </Button>
    </nav>
  );
}
function Filters({
  fields,
}: {
  fields: Array<{ name: string; label: string; options?: readonly string[] }>;
}) {
  const { params, update } = useLocation();
  return (
    <form
      className="api-search-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update({
          ...Object.fromEntries(
            fields.map((field) => [field.name, String(data.get(field.name) ?? '')]),
          ),
          page: '1',
        });
      }}
    >
      {fields.map((field) => (
        <label key={`${field.name}:${params.get(field.name)}`} className="api-field">
          {field.label}
          {field.options ? (
            <select name={field.name} defaultValue={params.get(field.name) ?? ''}>
              <option value="">Tất cả</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {accountStatusLabel(option)}
                </option>
              ))}
            </select>
          ) : (
            <input name={field.name} defaultValue={params.get(field.name) ?? ''} />
          )}
        </label>
      ))}
      <Button type="submit">Áp dụng</Button>
    </form>
  );
}
function Panel({ children }: { children: ReactNode }) {
  return <Card className="ws-panel api-card">{children}</Card>;
}
function Users({ writes, currentId }: { writes: boolean; currentId: string }) {
  const { params, path, update } = useLocation();
  const router = useRouter();
  const search = params.toString();
  const requestParams = new URLSearchParams(search);
  const page = Number(params.get('page') ?? 1);
  const validPage = Number.isSafeInteger(page) && page >= 1 && page <= 2_147_483_647;
  requestParams.set('page', String(validPage ? page : 1));
  requestParams.set('size', String(ACCOUNT_PAGE_SIZE));
  const state = useResource(`users:${requestParams}`, (signal) =>
    cmsApi.users(requestParams, signal),
  );
  const data = state.data;
  const lastPage = Math.max(1, Math.ceil((data?.total ?? 0) / ACCOUNT_PAGE_SIZE));
  const pageOutOfRange = !!data && data.page > lastPage;
  useEffect(() => {
    if (!pageOutOfRange) return;
    const next = new URLSearchParams(search);
    next.set('page', String(lastPage));
    router.replace(`${path}?${next}`, { scroll: false });
  }, [lastPage, pageOutOfRange, path, router, search]);
  const uncertainByUser = useRef(new Map<string, AccountChangeKind[]>());
  const resourceState = (
    <ResourceState
      {...state}
      loading={state.loading || pageOutOfRange}
      retry={state.reload}
      empty={data?.items.length === 0}
    />
  );

  async function applyChanges(account: User, changes: AccountChanges) {
    if (!writes || account.id === currentId) {
      throw new Error('Phiên này không có quyền cập nhật tài khoản đã chọn.');
    }
    const previous = uncertainByUser.current.get(account.id) ?? [];
    const result = await applyAccountChanges(account, changes, previous);
    const uncertain = previous.filter((kind) =>
      kind === 'roles' ? !changes.role : !changes.status,
    );
    uncertain.push(...uncertainChanges(result.failures));
    if (uncertain.length) uncertainByUser.current.set(account.id, uncertain);
    else uncertainByUser.current.delete(account.id);
    if (result.failures.length) throw new Error(accountChangeError(result.failures));
  }

  return (
    <>
      <h1>Người dùng & vai trò</h1>
      <UserAccountsTable
        key={search}
        items={data?.items}
        href={(accountId) => `/users/${encodeURIComponent(accountId)}?${requestParams}`}
        statuses={ACCOUNT_STATUSES}
        statusLabels={ACCOUNT_STATUS_LABELS}
        writes={writes}
        editable={(account) => account.id !== currentId}
        applyChanges={applyChanges}
        onUpdated={state.reload}
      >
        <Filters
          fields={[
            { name: 'keyword', label: 'Tên / email' },
            { name: 'status', label: 'Trạng thái', options: ACCOUNT_STATUSES },
          ]}
        />
        {resourceState}
      </UserAccountsTable>
      {data && !pageOutOfRange && (
        <AccountPagination
          page={data.page}
          total={data.total}
          onPage={(page) => update({ page: String(page) })}
        />
      )}
    </>
  );
}
function UserDetail({ id, currentId, writes }: { id: string; currentId: string; writes: boolean }) {
  const { path, href } = useLocation();
  const edit = path.endsWith('/edit');
  const editable = writes && id !== currentId;
  const state = useResource(`user:${id}`, async (signal) => {
    try {
      return await cmsApi.user(id, signal);
    } catch (error) {
      if (error instanceof GatewayError) {
        if (error.status === 400) throw new Error('ID tài khoản không hợp lệ.');
        if (error.status === 403) throw new Error('Bạn không có quyền xem tài khoản này.');
        if (error.status === 404) throw new Error('Không tìm thấy tài khoản.');
      }
      throw error;
    }
  });
  const user = state.data;
  const formatDate = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <>
      <h1>Chi tiết người dùng</h1>
      <Link href={href()}>← Danh sách</Link>
      <ResourceState {...state} retry={state.reload} />
      {user && (
        <>
          <Panel>
            {user.avatarUrl && (
              // Private presigned URLs are fetched directly from storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="Ảnh đại diện" width={80} height={80} />
            )}
            <dl>
              <dt>Số điện thoại</dt>
              <dd>{user.phoneNumber ?? 'Chưa cập nhật'}</dd>
              <dt>Ngày tạo</dt>
              <dd>{formatDate.format(new Date(user.createdAt))}</dd>
              <dt>Cập nhật gần nhất</dt>
              <dd>{formatDate.format(new Date(user.updatedAt))}</dd>
            </dl>
            {editable && !edit && (
              <Link href={href(id, true)}>Chỉnh sửa vai trò và trạng thái</Link>
            )}
            {edit && <Link href={href(id)}>Về chi tiết</Link>}
          </Panel>
          <UserEditor key={user.id} user={user} writes={editable && edit} />
        </>
      )}
    </>
  );
}
async function applyAccountChanges(
  user: User,
  changes: AccountChanges,
  uncertain: readonly AccountChangeKind[],
) {
  const updates: UserChange[] = [];
  if (changes.role) updates.push({ kind: 'roles', roles: [changes.role] });
  if (changes.status) updates.push({ kind: 'status', status: changes.status });
  const failures: AccountChangeFailure[] = [];
  let current = user;
  const readCurrent = () => cmsApi.user(user.id);

  for (const change of updates) {
    const retry = uncertain.includes(change.kind);
    // A role PATCH replaces the entire list, so read current roles before replacing it.
    if (change.kind === 'roles' || retry) {
      try {
        current = await readCurrent();
      } catch (error) {
        failures.push({ kind: change.kind, message: failureMessage(error), uncertain: retry });
        continue;
      }
      if (change.kind === 'roles' && !canManageAccountRole(current.roles)) {
        failures.push({
          kind: change.kind,
          message: 'Không thể đổi vai trò của tài khoản Quản trị hệ thống.',
          uncertain: false,
        });
        continue;
      }
      if (userChangeMatches(current, change)) continue;
    }

    try {
      current =
        change.kind === 'roles'
          ? await cmsApi.updateRoles(user.id, change.roles)
          : await cmsApi.updateStatus(user.id, change.status);
    } catch (error) {
      if (!mutationOutcomeUnknown(error)) {
        failures.push({ kind: change.kind, message: failureMessage(error), uncertain: false });
        continue;
      }
      const readBack = await readCurrent().catch(() => undefined);
      if (readBack) current = readBack;
      if (readBack && userChangeMatches(readBack, change)) continue;
      failures.push({
        kind: change.kind,
        message: 'Chưa xác nhận được thay đổi. Cần đọc lại dữ liệu trước khi thử lại.',
        uncertain: true,
      });
    }
  }
  return { user: current, failures };
}

const accountChangeError = (failures: readonly AccountChangeFailure[]) =>
  failures
    .map(({ kind, message }) => `${kind === 'roles' ? 'Vai trò' : 'Trạng thái'}. ${message}`)
    .join(' ');

const uncertainChanges = (failures: readonly AccountChangeFailure[]) =>
  failures.filter(({ uncertain }) => uncertain).map(({ kind }) => kind);

function UserEditor({ user: initial, writes }: { user: User; writes: boolean }) {
  const [user, setUser] = useState(initial);
  const [changes, setChanges] = useState<AccountChanges>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState<AccountChangeKind[]>([]);
  const lock = useRef(false);

  const currentRole = managedAccountRole(user.roles);
  const canEditRole = writes && canManageAccountRole(user.roles);
  const requested = { role: canEditRole ? changes.role : undefined, status: changes.status };
  const hasChanges = Boolean(requested.role || requested.status);
  const hasUncertain = uncertain.length > 0;

  function updateDraft(draft: AccountChanges) {
    setChanges(draft);
    setNotice('');
    setError('');
  }

  async function save(retry = false) {
    if (
      lock.current ||
      !writes ||
      !hasChanges ||
      (!retry && !window.confirm(`Áp dụng thay đổi cho ${user.email}?`))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await applyAccountChanges(user, requested, uncertain);
      setUser(result.user);
      const roleEditable = canManageAccountRole(result.user.roles);
      setChanges({
        role:
          roleEditable && result.failures.some(({ kind }) => kind === 'roles')
            ? requested.role
            : undefined,
        status: result.failures.some(({ kind }) => kind === 'status')
          ? requested.status
          : undefined,
      });
      setUncertain(
        uncertainChanges(result.failures).filter((kind) => kind !== 'roles' || roleEditable),
      );
      if (result.failures.length) setError(accountChangeError(result.failures));
      else setNotice('Server đã xác nhận thay đổi.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function reconcile() {
    if (lock.current || !hasUncertain) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const current = await cmsApi.user(user.id);
      setUser(current);
      const role =
        changes.role &&
        canManageAccountRole(current.roles) &&
        !userChangeMatches(current, { kind: 'roles', roles: [changes.role] })
          ? changes.role
          : undefined;
      const status = changes.status === current.status ? undefined : changes.status;
      const unresolved = uncertain.filter((kind) => (kind === 'roles' ? role : status));
      setChanges({ role, status });
      setUncertain(unresolved);
      if (unresolved.length) setError('Dữ liệu server chưa khớp yêu cầu đã gửi. Có thể thử lại.');
      else setNotice('Đã kiểm tra dữ liệu từ server.');
    } catch (error) {
      setError(failureMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2>{user.fullName}</h2>
      <p>{user.email}</p>
      <fieldset className="account-editor-field" disabled={busy || hasUncertain}>
        <legend>Vai trò</legend>
        {canEditRole ? (
          <AccountRoleSelect
            name="Vai trò tài khoản"
            value={changes.role ?? currentRole}
            onChange={(role) =>
              updateDraft({ ...changes, role: role && role !== currentRole ? role : undefined })
            }
          />
        ) : (
          <AccountRoles roles={user.roles} />
        )}
      </fieldset>
      <fieldset className="account-editor-field" disabled={busy || hasUncertain}>
        <legend>Trạng thái tài khoản</legend>
        {writes ? (
          <AccountStatusSelect
            name="Trạng thái tài khoản"
            value={changes.status ?? user.status}
            statuses={ACCOUNT_STATUSES}
            statusLabels={ACCOUNT_STATUS_LABELS}
            onChange={(status) =>
              updateDraft({
                ...changes,
                status: status && status !== user.status ? status : undefined,
              })
            }
          />
        ) : (
          <p>{accountStatusLabel(user.status)}</p>
        )}
      </fieldset>
      {writes && (
        <Button disabled={busy || hasUncertain || !hasChanges} onClick={() => void save()}>
          Áp dụng
        </Button>
      )}
      {hasUncertain && (
        <div>
          <p>Các thay đổi đang chờ xác nhận được giữ lại.</p>
          <Button disabled={busy} onClick={reconcile}>
            Kiểm tra trạng thái từ server
          </Button>
          <Button disabled={busy || !hasChanges} onClick={() => void save(true)}>
            Thử lại cùng thay đổi
          </Button>
        </div>
      )}
      <p>Thay đổi vai trò hoặc trạng thái có thể đăng xuất các phiên của tài khoản.</p>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </Panel>
  );
}

function Audit() {
  const { params, update } = useLocation();
  const state = useResource(`audit:${params}`, (signal) => cmsApi.audit(params, signal));
  return (
    <>
      <h1>Nhật ký quản trị</h1>
      <p>Chỉ đọc bản ghi từ server. Frontend không tạo audit.</p>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data?.items.map((item) => (
        <Panel key={item.id}>
          <h2>{item.action}</h2>
          <p>{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
          <p>Người thực hiện: {item.actorId ?? 'Không được server cung cấp'}</p>
          <p>
            Đối tượng: {item.resourceType ?? 'Chưa có loại'} · {item.resourceId ?? 'Chưa có ID'}
          </p>
          {item.metadata != null && (
            <details>
              <summary>Metadata</summary>
              <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
            </details>
          )}
        </Panel>
      ))}
      {state.data && (
        <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
      )}
    </>
  );
}
