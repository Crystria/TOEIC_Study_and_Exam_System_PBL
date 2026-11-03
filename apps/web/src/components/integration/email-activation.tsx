'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { gateway, failureMessage } from '../../lib/integration/client';
export function EmailActivation({ writes }: { writes: boolean }) {
  const search = useSearchParams(),
    [token, setToken] = useState(''),
    [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const value = search.get('token');
    if (value) {
      setToken(value);
      window.history.replaceState(null, '', '/verify-email');
    }
  }, [search]);
  const send = async (resend: boolean) => {
    if (lock.current || !writes) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await gateway(resend ? 'auth/resend-verification' : 'auth/verify-email', {
        method: 'POST',
        body: resend ? { email: email.trim() } : { token },
      });
      setMessage(
        resend
          ? 'Nếu tài khoản đủ điều kiện, backend sẽ gửi email kích hoạt.'
          : 'Backend đã xác nhận email. Bạn có thể đăng nhập.',
      );
      if (!resend) setToken('');
    } catch (e) {
      setError(failureMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="api-login">
      <h1>Kích hoạt email</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(false);
        }}
      >
        <label className="api-field">
          Mã kích hoạt
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button disabled={busy || !writes}>Xác minh email</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(true);
        }}
      >
        <label className="api-field">
          Email cần gửi lại
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button disabled={busy || !writes}>Gửi lại email kích hoạt</button>
      </form>
      {!writes && <p>Thao tác ghi đang tắt trong cấu hình local/test.</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <Link href="/login">Đăng nhập</Link>
    </main>
  );
}
