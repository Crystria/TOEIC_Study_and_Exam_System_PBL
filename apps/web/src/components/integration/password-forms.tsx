'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  failureMessage,
  gateway,
  GatewayError,
  mutationOutcomeUnknown,
} from '../../lib/integration/client';
import { ContractError, record } from '../../lib/integration/contracts';

type Mode = 'forgot' | 'reset' | 'change';
const titles = {
  forgot: 'Quên mật khẩu',
  reset: 'Đặt lại mật khẩu',
  change: 'Đổi mật khẩu',
};
const messages: Record<string, string> = {
  INVALID_PASSWORD_RESET_TOKEN: 'Liên kết hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới.',
  INCORRECT_CURRENT_PASSWORD: 'Mật khẩu hiện tại không đúng.',
  PASSWORD_UNCHANGED: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
};

export function PasswordForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const Heading = mode === 'change' ? 'h2' : 'h1';
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    setReady(true);
    if (mode !== 'reset') return;
    const readToken = () => {
      const fragment = window.location.hash;
      if (!fragment) {
        setToken((current) => current ?? '');
        return;
      }
      setToken(new URLSearchParams(fragment.slice(1)).get('token') ?? '');
      setError('');
      window.history.replaceState(window.history.state, '', window.location.pathname);
    };
    readToken();
    window.addEventListener('hashchange', readToken);
    return () => window.removeEventListener('hashchange', readToken);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || lock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const currentPassword = String(data.get('currentPassword') ?? '');
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');
    const bytes = (value: string) => new TextEncoder().encode(value).length;
    setError('');
    setSent(false);
    if (mode === 'reset' && !token) return;
    if (mode !== 'forgot') {
      if (
        [...newPassword].length < 8 ||
        bytes(newPassword) > 72 ||
        !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) ||
        !/[0-9]/.test(newPassword)
      ) {
        setError('Mật khẩu mới cần ít nhất 8 ký tự, tối đa 72 byte và có chữ hoa, chữ thường, số.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận chưa khớp.');
        return;
      }
      if (mode === 'change' && bytes(currentPassword) > 72) {
        setError('Mật khẩu hiện tại không hợp lệ.');
        return;
      }
      if (mode === 'change' && newPassword === currentPassword) {
        setError(messages.PASSWORD_UNCHANGED);
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    try {
      const body =
        mode === 'forgot'
          ? { email }
          : {
              newPassword,
              confirmPassword,
              ...(mode === 'reset' ? { token } : { currentPassword }),
            };
      const result = record(await gateway(`auth/${mode}-password`, { method: 'POST', body }));
      if (mode === 'forgot') {
        if (typeof result.message !== 'string') throw new ContractError('forgotPassword.message');
        setSent(true);
      } else {
        if (result.success !== true) throw new ContractError('passwordUpdate.success');
        form.reset();
        setToken('');
        router.replace('/login?password=updated');
      }
    } catch (cause) {
      const payload =
        cause instanceof GatewayError
          ? (cause.details as { details?: { code?: string } } | undefined)
          : undefined;
      const code = payload?.details?.code;
      if (code === 'INVALID_PASSWORD_RESET_TOKEN') setToken('');
      setError(
        (code && messages[code]) ||
          (mode !== 'forgot' && mutationOutcomeUnknown(cause)
            ? 'Chưa xác nhận được kết quả. Hãy thử đăng nhập bằng mật khẩu mới trước khi gửi lại.'
            : failureMessage(cause)),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Heading>{titles[mode]}</Heading>
      {mode === 'reset' && token === undefined && <p role="status">Đang đọc liên kết…</p>}
      {mode === 'reset' && token === '' && (
        <>
          {!error && <p>Liên kết đặt lại mật khẩu không hợp lệ.</p>}
          <p>
            <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
          </p>
        </>
      )}
      {(mode !== 'reset' || token) && (
        <form method="post" onSubmit={submit} aria-label={titles[mode]} aria-busy={busy || !ready}>
          <fieldset disabled={busy || !ready}>
            {mode === 'forgot' ? (
              <label className="api-field">
                Email
                <input name="email" type="email" autoComplete="email" maxLength={320} required />
              </label>
            ) : (
              <>
                {mode === 'change' && (
                  <label className="api-field">
                    Mật khẩu hiện tại
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                )}
                <label className="api-field">
                  Mật khẩu mới
                  <input name="newPassword" type="password" autoComplete="new-password" required />
                </label>
                <label className="api-field">
                  Xác nhận mật khẩu mới
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </>
            )}
          </fieldset>
          <button disabled={busy || !ready}>
            {busy ? 'Đang gửi…' : mode === 'forgot' ? 'Gửi liên kết đặt lại' : titles[mode]}
          </button>
        </form>
      )}
      {sent && (
        <p role="status">Nếu tài khoản đủ điều kiện, bạn sẽ nhận được email đặt lại mật khẩu.</p>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </>
  );
}

export function PasswordRecovery({ mode }: { mode: 'forgot' | 'reset' }) {
  return (
    <main className="api-login">
      <PasswordForm mode={mode} />
      <p>
        <Link href="/login">Quay lại đăng nhập</Link>
      </p>
    </main>
  );
}
