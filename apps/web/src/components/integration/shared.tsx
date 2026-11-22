'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  gateway,
  failureMessage,
  GatewayError,
  validationFields,
} from '../../lib/integration/client';
import { parseSessionUser, record, type User } from '../../lib/integration/contracts';
import { Icon } from '../ui/icon';

export function useResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  refreshVersion = 0,
) {
  const ref = useRef(loader);
  ref.current = loader;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({
    key,
    loading: true,
  });
  useEffect(() => {
    const abort = new AbortController();
    setState((previous) =>
      previous.key === key && previous.data !== undefined ? previous : { key, loading: true },
    );
    Promise.resolve()
      .then(() => ref.current(abort.signal))
      .then((data) => {
        if (!abort.signal.aborted) setState({ key, data, loading: false });
      })
      .catch((error) => {
        if (!abort.signal.aborted) setState({ key, error: failureMessage(error), loading: false });
      });
    return () => abort.abort();
  }, [key, revision, refreshVersion]);
  const reload = useCallback(() => {
    setState({ key, loading: true });
    setRevision((n) => n + 1);
  }, [key]);
  return {
    loading: state.key === key ? state.loading : true,
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
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
  embedded = false,
  onSwitch,
  onBusyChange,
}: {
  cms?: boolean;
  register?: boolean;
  writes?: boolean;
  embedded?: boolean;
  onSwitch?: (intent: 'login' | 'register') => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inPanel = embedded;
  const Container = inPanel ? 'div' : 'main';
  const passwordUpdated = useSearchParams().get('password') === 'updated';
  const [ready, setReady] = useState(false);
  const [registered, setRegistered] = useState(false);
  useEffect(() => setReady(true), []);
  const router = useRouter(),
    busyRef = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => {
      if (busy) onBusyChange?.(false);
    };
  }, [busy, onBusyChange]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const update = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFields({});
    setError('');
  };
  return (
    <Container className={`api-login${cms ? ' api-auth-admin' : ' api-auth-student'}`}>
      {!inPanel && (
        <>
          <Link href="/">TOEIC Master</Link>
          <span className="api-label">API · Local / test</span>
        </>
      )}
      {cms && <span className="admin-auth-eyebrow">CHÀO MỪNG TRỞ LẠI</span>}
      <h1 id={inPanel && !cms ? 'student-auth-title' : undefined}>
        {register ? 'Tạo tài khoản' : cms ? 'Đăng nhập quản trị' : 'Chào mừng bạn trở lại'}
      </h1>
      <p className="api-auth-description">
        {cms
          ? 'Đăng nhập để quản lý nội dung và vận hành TOEIC Master.'
          : 'Dùng tài khoản của môi trường kiểm thử đã cấu hình.'}
      </p>
      {!register && passwordUpdated && (
        <p role="status">Mật khẩu đã được cập nhật. Hãy đăng nhập lại.</p>
      )}
      <form
        ref={form}
        noValidate
        aria-label={cms ? 'Đăng nhập quản trị' : register ? 'Tạo tài khoản' : 'Đăng nhập tài khoản'}
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
                  ...(register
                    ? { fullName: values.fullName.trim(), confirmPassword: values.confirm }
                    : { deviceId: cms ? 'toeic-cms-web' : 'toeic-student-web' }),
                },
              }),
            );
            setValues((v) => ({ ...v, password: '', confirm: '' }));
            setShowPassword(false);
            if (register) {
              if (result.activationRequired !== true)
                throw new Error('Phản hồi đăng ký không hợp lệ.');
              setRegistered(true);
              return;
            }
            const user = parseSessionUser(result.user);
            router.push(
              cms
                ? user.roles.includes('CONTENT_ADMIN')
                  ? '/tests'
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
        <fieldset disabled={!ready || busy || registered || (register && !writes)}>
          {(['fullName', 'email', 'password', 'confirm'] as const)
            .filter((key) => register || !['fullName', 'confirm'].includes(key))
            .map((key) => {
              const input = (
                <input
                  id={`api-${key}`}
                  name={key === 'confirm' ? 'confirmPassword' : key}
                  required
                  minLength={
                    key === 'fullName' ? 2 : register && key === 'password' ? 8 : undefined
                  }
                  type={
                    key === 'email'
                      ? 'email'
                      : ['password', 'confirm'].includes(key)
                        ? cms && showPassword
                          ? 'text'
                          : 'password'
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
                  placeholder={
                    cms
                      ? key === 'email'
                        ? 'quantri@example.com'
                        : key === 'password'
                          ? 'Nhập mật khẩu của bạn'
                          : undefined
                      : undefined
                  }
                  autoCapitalize={key === 'email' ? 'none' : undefined}
                  spellCheck={key === 'email' ? false : undefined}
                  value={values[key]}
                  onChange={(e) => update(key, e.target.value)}
                  aria-invalid={!!fields[key]}
                  aria-describedby={fields[key] ? `api-error-${key}` : undefined}
                />
              );
              return (
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
                  {cms ? (
                    <div className="admin-auth-input">
                      <Icon name={key === 'email' ? 'mail' : 'lock'} width="19" height="19" />
                      {input}
                      {key === 'password' && (
                        <button
                          type="button"
                          className="admin-auth-password-toggle"
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          aria-pressed={showPassword}
                          aria-controls="api-password"
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          <Icon name={showPassword ? 'eyeOff' : 'eye'} width="19" height="19" />
                        </button>
                      )}
                    </div>
                  ) : (
                    input
                  )}
                  {fields[key] && (
                    <p id={`api-error-${key}`} className="api-error">
                      {fields[key]}
                    </p>
                  )}
                </div>
              );
            })}
        </fieldset>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="api-primary api-auth-submit"
          disabled={!ready || busy || registered || (register && !writes)}
        >
          {busy ? 'Đang gửi…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
          {!busy && <Icon name="arrow" width="20" height="20" />}
        </button>
      </form>
      {cms && (
        <p className="admin-auth-account-note">
          <Icon name="lock" width="15" height="15" />
          Không gian làm việc sẽ mở theo quyền của tài khoản.
        </p>
      )}
      {registered && (
        <p role="status">
          Tài khoản đã được tạo và cần kích hoạt email. Kiểm tra hộp thư trước khi đăng nhập.
        </p>
      )}
      {!cms && (
        <p className="api-auth-switch">
          <Link
            href={register ? '/login' : '/register'}
            onClick={(event) => {
              if (
                !onSwitch ||
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              if (!busyRef.current) onSwitch(register ? 'login' : 'register');
            }}
          >
            {register ? 'Đã có tài khoản? Đăng nhập' : 'Tạo tài khoản'}
          </Link>
        </p>
      )}
      {!cms && (
        <p className="api-auth-support">
          <Link href="/verify-email">Kích hoạt email / gửi lại email</Link>
          {!register && (
            <>
              {' '}
              · <Link href="/forgot-password">Quên mật khẩu</Link>
            </>
          )}
        </p>
      )}
      {register && (
        <Blocked>
          {!writes && 'Đăng ký đang tắt cho đến khi xác nhận dữ liệu kiểm thử cô lập. '}
          Tài khoản mới ở trạng thái INACTIVE. Email kích hoạt được backend xử lý; chỉ đăng nhập sau
          khi xác minh thành công.
        </Blocked>
      )}
    </Container>
  );
}
