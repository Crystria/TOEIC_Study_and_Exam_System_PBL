'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  gateway,
  failureMessage,
  GatewayError,
  validationFields,
} from '../../lib/integration/client';
import { parseSessionUser, record, type User } from '../../lib/integration/contracts';

export function useResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
  const ref = useRef(loader);
  ref.current = loader;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({
    key,
    loading: true,
  });
  useEffect(() => {
    const abort = new AbortController();
    setState({ key, loading: true });
    Promise.resolve()
      .then(() => ref.current(abort.signal))
      .then((data) => {
        if (!abort.signal.aborted) setState({ key, data, loading: false });
      })
      .catch((error) => {
        if (!abort.signal.aborted) setState({ key, error: failureMessage(error), loading: false });
      });
    return () => abort.abort();
  }, [key, revision]);
  const reload = useCallback(() => {
    setState({ key, loading: true });
    setRevision((n) => n + 1);
  }, [key]);
  return {
    ...(state.key === key ? state : { loading: true, data: undefined, error: undefined }),
    reload,
  };
}
export function Blocked({ children }: { children: ReactNode }) {
  return (
    <aside className="api-blocked" role="status">
      <strong>Chưa khả dụng</strong>
      <div>{children}</div>
    </aside>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
  empty,
}: {
  loading?: boolean;
  error?: string;
  retry: () => void;
  empty?: boolean;
}) {
  if (loading)
    return (
      <p role="status" className="api-state">
        Đang tải dữ liệu server…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="api-error">
        <p>{error}</p>
        <button onClick={retry}>Thử lại</button>
      </div>
    );
  return empty ? (
    <p role="status" className="api-state">
      Chưa có dữ liệu phù hợp.
    </p>
  ) : null;
}
export function useSession() {
  const session = useResource('session', (signal) =>
    gateway('auth/session', { signal }).then((v) => parseSessionUser(record(v).user)),
  );
  const [expired, setExpired] = useState('');
  useEffect(() => {
    const onExpired = (event: Event) =>
      setExpired(
        event instanceof CustomEvent && typeof event.detail === 'string'
          ? event.detail
          : 'Phiên đã hết hạn. Vui lòng đăng nhập lại.',
      );
    window.addEventListener('toeic-session-expired', onExpired);
    return () => window.removeEventListener('toeic-session-expired', onExpired);
  }, []);
  return {
    ...session,
    data: expired ? undefined : session.data,
    error: expired || session.error,
    reload: () => {
      session.reload();
      setExpired('');
    },
  };
}
export function SessionGate({ children }: { children: (user: User) => ReactNode }) {
  const session = useSession();
  if (!session.data)
    return (
      <main className="api-login">
        <h1>Tài khoản của bạn</h1>
        <ResourceState loading={session.loading} error={session.error} retry={session.reload} />
        {!session.loading && <Link href="/login">Đăng nhập để tiếp tục</Link>}
      </main>
    );
  return <>{children(session.data)}</>;
}
export function LogoutButton() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await gateway('auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
          } catch (e) {
            setError(`${failureMessage(e)} Chưa xác nhận thu hồi phiên trên server.`);
            setBusy(false);
          }
        }}
      >
        Đăng xuất
      </button>
      {error && (
        <p role="alert">
          {error} <Link href="/login">Về đăng nhập</Link>
        </p>
      )}
    </>
  );
}
export function ApiAuth({
  cms = false,
  register = false,
  writes = false,
}: {
  cms?: boolean;
  register?: boolean;
  writes?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const router = useRouter(),
    busyRef = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const update = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFields({});
    setError('');
  };
  return (
    <main className="api-login">
      <Link href="/">TOEIC Master</Link>
      <span className="api-label">API · Local / test</span>
      <h1>{register ? 'Tạo tài khoản' : cms ? 'Đăng nhập quản trị' : 'Chào mừng bạn trở lại'}</h1>
      <p>Dùng tài khoản của môi trường kiểm thử đã cấu hình.</p>
      <form
        ref={form}
        noValidate
        aria-busy={!ready || busy}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!ready || busyRef.current || (register && !writes)) return;
          const next: Record<string, string> = {};
          if (register && values.fullName.trim().length < 2)
            next.fullName = 'Nhập họ tên ít nhất hai ký tự.';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
            next.email = 'Nhập email hợp lệ.';
          if (!values.password) next.password = 'Nhập mật khẩu.';
          if (register && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(values.password))
            next.password = 'Ít nhất 8 ký tự, có chữ hoa, chữ thường và số.';
          if (register && values.confirm !== values.password)
            next.confirm = 'Mật khẩu xác nhận chưa khớp.';
          setFields(next);
          setError('');
          if (Object.keys(next).length) {
            requestAnimationFrame(() =>
              form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
            );
            return;
          }
          busyRef.current = true;
          setBusy(true);
          try {
            const result = record(
              await gateway(register ? 'auth/register' : 'auth/login', {
                method: 'POST',
                body: {
                  email: values.email.trim(),
                  password: values.password,
                  ...(register ? { fullName: values.fullName.trim() } : {}),
                },
              }),
            );
            const user = parseSessionUser(result.user);
            setValues((v) => ({ ...v, password: '', confirm: '' }));
            router.push(
              cms
                ? user.roles.includes('CONTENT_ADMIN')
                  ? '/questions'
                  : user.roles.includes('SYSTEM_ADMIN')
                    ? '/users'
                    : '/login?denied=1'
                : '/dashboard',
            );
            router.refresh();
            if (cms && !user.roles.some((r) => ['CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(r)))
              setError('Tài khoản này không có quyền quản trị.');
          } catch (e) {
            setError(
              e instanceof GatewayError && e.status === 401
                ? 'Email hoặc mật khẩu chưa đúng.'
                : failureMessage(e),
            );
            setFields(validationFields(e, ['fullName', 'email', 'password']));
            requestAnimationFrame(() =>
              form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
            );
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={!ready || busy || (register && !writes)}>
          {(['fullName', 'email', 'password', 'confirm'] as const)
            .filter((key) => register || !['fullName', 'confirm'].includes(key))
            .map((key) => (
              <div className="api-field" key={key}>
                <label htmlFor={`api-${key}`}>
                  {
                    {
                      fullName: 'Họ và tên',
                      email: 'Email',
                      password: 'Mật khẩu',
                      confirm: 'Xác nhận mật khẩu',
                    }[key]
                  }
                </label>
                <input
                  id={`api-${key}`}
                  type={
                    key === 'email'
                      ? 'email'
                      : ['password', 'confirm'].includes(key)
                        ? 'password'
                        : 'text'
                  }
                  autoComplete={
                    key === 'email'
                      ? 'username'
                      : key === 'fullName'
                        ? 'name'
                        : register
                          ? 'new-password'
                          : 'current-password'
                  }
                  value={values[key]}
                  onChange={(e) => update(key, e.target.value)}
                  aria-invalid={!!fields[key]}
                  aria-describedby={fields[key] ? `api-error-${key}` : undefined}
                />
                {fields[key] && (
                  <p id={`api-error-${key}`} className="api-error">
                    {fields[key]}
                  </p>
                )}
              </div>
            ))}
        </fieldset>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        <button className="api-primary" disabled={!ready || busy || (register && !writes)}>
          {busy ? 'Đang gửi…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </form>
      {!cms && (
        <p>
          <Link href={register ? '/login' : '/register'}>
            {register ? 'Đã có tài khoản? Đăng nhập' : 'Tạo tài khoản'}
          </Link>
        </p>
      )}
      {register && (
        <Blocked>
          {!writes && 'Đăng ký đang tắt cho đến khi xác nhận dữ liệu kiểm thử cô lập. '}
          Backend hiện chưa có luồng email kích hoạt. Phản hồi đăng ký không xác nhận đã gửi email;
          trạng thái tài khoản theo server.
        </Blocked>
      )}
    </main>
  );
}
