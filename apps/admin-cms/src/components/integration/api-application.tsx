'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import {
  ApiAuth,
  Blocked,
  LogoutButton,
  ResourceState,
  SessionGate,
  useResource,
} from '../../../../web/src/components/integration/shared';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import type { User, Page } from '../../../../web/src/lib/integration/contracts';
import { cmsApi, userChangeMatches, type UserChange } from '../../lib/integration/repositories';
import { ContentManagement, QuestionManagement, GroupManagement } from './content-management';
import { TestManagement } from './test-management';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CmsShell } from '../layout/cms-shell';
import { Field } from '../demo/workspace-primitives';

export function ApiCmsApplication({ writes }: { writes: boolean; metadataVerified: boolean }) {
  const path = usePathname();
  if (path === '/login' || path === '/') return <ApiAuth cms />;
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
              {!writes && (
                <Blocked>
                  Chế độ đọc dữ liệu server. Chỉ bật ghi sau khi xác nhận dữ liệu kiểm thử cô lập.
                </Blocked>
              )}
              <CmsDomain key={path} user={user} writes={writes} />
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
  const { section } = useLocation();
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
  if (section === 'questions') return <QuestionManagement writes={writes} />;
  if (section === 'tests') return <TestManagement writes={writes} />;
  if (section === 'groups') return <GroupManagement writes={writes} />;
  if (section === 'users') return <Users writes={writes} currentId={user.id} />;
  if (section === 'audit-logs') return <Audit />;
  if (['lessons', 'vocabulary', 'topics'].includes(section))
    return (
      <ContentManagement kind={section as 'lessons' | 'vocabulary' | 'topics'} writes={writes} />
    );
  if (section === 'media')
    return (
      <>
        <h1>Media quản trị</h1>
        <p>
          Gắn media tại chi tiết câu hỏi, nhóm hoặc từ vựng. Backend quản lý URL upload và tham
          chiếu theo từng bản ghi.
        </p>
      </>
    );

  return (
    <>
      <h1>Không tìm thấy trang</h1>
      <Link href={content ? '/questions' : '/users'}>Về danh sách</Link>
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
      className="api-actions"
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
                <option key={option}>{option}</option>
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
  const { id, params, href, update } = useLocation();
  const state = useResource(`users:${params}`, (signal) => cmsApi.users(params, signal));
  const user = state.data?.items.find((user) => user.id === id);
  return (
    <>
      <h1>Người dùng & vai trò</h1>
      {id ? (
        <Link href={href()}>← Danh sách</Link>
      ) : (
        <Filters
          fields={[
            { name: 'keyword', label: 'Tên / email' },
            {
              name: 'status',
              label: 'Trạng thái',
              options: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
            },
          ]}
        />
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data && !id && (
        <>
          <div className="api-scroll" role="region" aria-label="Danh sách người dùng" tabIndex={0}>
            <table className="api-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={href(user.id)}>{user.fullName}</Link>
                      <p>{user.email}</p>
                    </td>
                    <td>{user.roles.join(', ')}</td>
                    <td>{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
      {user && <UserEditor key={user.id} user={user} writes={writes && user.id !== currentId} />}
      {id === currentId && (
        <Blocked>
          Phiên này không tự đổi vai trò hoặc trạng thái của chính tài khoản đang đăng nhập.
        </Blocked>
      )}
      {id && state.data && !user && (
        <Blocked>
          Không có tài khoản này trong trang kết quả hiện tại. Backend chưa có GET chi tiết admin
          theo ID. Hãy mở từ đúng trang danh sách; không suy ra rằng tài khoản đã bị xóa.
        </Blocked>
      )}
    </>
  );
}
function UserEditor({ user: initial, writes }: { user: User; writes: boolean }) {
  const [user, setUser] = useState(initial),
    [roles, setRoles] = useState(initial.roles),
    [status, setStatus] = useState(initial.status);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [uncertain, setUncertain] = useState(false),
    lock = useRef(false),
    pending = useRef<UserChange>();
  function confirmed(result: User) {
    setUser(result);
    setRoles(result.roles);
    setStatus(result.status);
    pending.current = undefined;
    setUncertain(false);
    setNotice('Server đã xác nhận thay đổi. Danh sách và nhật ký đọc lại từ server khi mở.');
  }
  async function save(kind: 'roles' | 'status', retry = false) {
    if (
      lock.current ||
      !writes ||
      (!retry &&
        !window.confirm(
          `Cập nhật ${kind === 'roles' ? 'vai trò' : 'trạng thái'} của ${user.email} trên server?`,
        ))
    )
      return;
    if (!retry) pending.current = kind === 'roles' ? { kind, roles: [...roles] } : { kind, status };
    const change = pending.current;
    if (!change) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    let reconciled = !retry;
    try {
      if (retry) {
        const current = await cmsApi.userForReconciliation(user.id, user.email);
        reconciled = true;
        if (userChangeMatches(current, change)) {
          confirmed(current);
          return;
        }
      }
      const result =
        change.kind === 'roles'
          ? await cmsApi.updateRoles(user.id, change.roles)
          : await cmsApi.updateStatus(user.id, change.status);
      confirmed(result);
    } catch (e) {
      setError(failureMessage(e));
      if (mutationOutcomeUnknown(e) || !reconciled) setUncertain(true);
      else {
        pending.current = undefined;
        setUncertain(false);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    if (lock.current || !pending.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const current = await cmsApi.userForReconciliation(user.id, user.email);
      if (userChangeMatches(current, pending.current)) confirmed(current);
      else setError('Trạng thái server chưa khớp yêu cầu đã gửi. Có thể thử lại cùng thay đổi.');
    } catch (e) {
      setError(failureMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Panel>
      <h2>{user.fullName}</h2>
      <p>
        {user.email} · {user.id}
      </p>
      <fieldset disabled={!writes || busy || uncertain}>
        <legend>Vai trò từ backend</legend>
        {['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'].map((role) => (
          <label key={role} className="api-actions">
            <input
              style={{ width: 'auto' }}
              type="checkbox"
              checked={roles.includes(role)}
              onChange={(e) => {
                setNotice('');
                setError('');
                setRoles((value) =>
                  e.target.checked ? [...value, role] : value.filter((r) => r !== role),
                );
              }}
            />
            {role}
          </label>
        ))}
        <Button disabled={!roles.length || !writes || busy} onClick={() => save('roles')}>
          Lưu vai trò
        </Button>
        <Field
          name="status"
          label="Trạng thái tài khoản"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setNotice('');
            setError('');
          }}
        >
          {!['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status) && (
            <option value={status}>{status} (chưa nhận diện)</option>
          )}
          {['ACTIVE', 'SUSPENDED', 'INACTIVE'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Field>
        <Button disabled={!writes || busy} onClick={() => save('status')}>
          Lưu trạng thái
        </Button>
      </fieldset>
      {uncertain && (
        <div>
          <p>
            Chưa xác định kết quả. Các lựa chọn đã gửi được giữ nguyên; kiểm tra server trước khi
            thử lại.
          </p>
          <Button disabled={busy} onClick={reconcile}>
            Kiểm tra trạng thái từ server
          </Button>
          <Button
            disabled={busy || !writes}
            onClick={() => pending.current && save(pending.current.kind, true)}
          >
            Thử lại cùng thay đổi
          </Button>
        </div>
      )}
      <p>
        Vai trò và trạng thái được lưu riêng. Thay đổi có thể đăng xuất các phiên của tài khoản.
      </p>
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
