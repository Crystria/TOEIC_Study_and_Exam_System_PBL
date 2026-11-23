'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  failureMessage,
  gateway,
  GatewayError,
  mutationOutcomeUnknown,
} from '../../lib/integration/client';
import { ContractError, record } from '../../lib/integration/contracts';
import { ProfileUpdateStatus } from '../profile/profile-update-status';

type Mode = 'forgot' | 'reset' | 'change';
const passwordFields = ['currentPassword', 'newPassword', 'confirmPassword'] as const;
type PasswordField = (typeof passwordFields)[number];
type FormErrors = Partial<Record<PasswordField | 'currentPasswordNotice' | 'form', string>>;
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
const unconfirmedUpdate =
  'Chưa xác nhận được kết quả. Hãy thử đăng nhập bằng mật khẩu mới trước khi gửi lại.';

const passwordBytes = (value: string) => new TextEncoder().encode(value).length;

function newPasswordIssue(value: string) {
  if ([...value].length < 8) return 'Mật khẩu mới cần ít nhất 8 ký tự';
  if (passwordBytes(value) > 72) return 'Mật khẩu mới quá dài.';
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value))
    return 'Mật khẩu mới cần có chữ hoa, chữ thường và số.';
  return null;
}

export function PasswordForm({
  mode,
  profileUpdateFeedback = false,
}: {
  mode: Mode;
  profileUpdateFeedback?: boolean;
}) {
  const router = useRouter();
  const Heading = mode === 'change' ? 'h2' : 'h1';
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string>();
  const [errors, setErrors] = useState<FormErrors | null>(null);
  const [focusField, setFocusField] = useState<PasswordField>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const currentPasswordInput = useRef<HTMLInputElement>(null);
  const newPasswordInput = useRef<HTMLInputElement>(null);
  const confirmPasswordInput = useRef<HTMLInputElement>(null);
  const currentPasswordErrorId = useId();
  const newPasswordErrorId = useId();
  const confirmPasswordErrorId = useId();
  const currentPasswordError = errors?.currentPassword;
  const currentPasswordFeedback = currentPasswordError ?? errors?.currentPasswordNotice;
  const newPasswordError = errors?.newPassword;
  const confirmPasswordError = errors?.confirmPassword;

  useEffect(() => {
    if (busy || !focusField) return;
    if (focusField === 'currentPassword') {
      currentPasswordInput.current?.focus();
      currentPasswordInput.current?.select();
    } else if (focusField === 'newPassword') {
      newPasswordInput.current?.focus();
    } else {
      confirmPasswordInput.current?.focus();
    }
    setFocusField(undefined);
  }, [busy, focusField]);

  function showErrors(next: FormErrors) {
    setErrors(next);
    setFocusField(passwordFields.find((field) => next[field]));
  }

  function clearFieldErrors(...fields: PasswordField[]) {
    if (!errors || !fields.some((field) => errors[field])) return;
    const remaining = { ...errors };
    for (const field of fields) delete remaining[field];
    setErrors(Object.keys(remaining).length ? remaining : null);
  }

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
      setErrors(null);
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
    setErrors(null);
    setSent(false);
    if (mode === 'reset' && !token) return;
    const localErrors: FormErrors = {};
    if (mode !== 'forgot') {
      const issue = newPasswordIssue(newPassword);
      if (issue) localErrors.newPassword = issue;
      else if (newPassword !== confirmPassword)
        localErrors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    }
    if (mode === 'change' && (!currentPassword || passwordBytes(currentPassword) > 72)) {
      showErrors({
        ...localErrors,
        currentPassword: currentPassword
          ? 'Mật khẩu hiện tại không hợp lệ.'
          : 'Nhập mật khẩu hiện tại.',
      });
      return;
    }
    const hasLocalErrors = Object.keys(localErrors).length > 0;
    if (mode === 'reset' && hasLocalErrors) {
      showErrors(localErrors);
      return;
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
          ? (cause.details as { code?: string; details?: { code?: string } } | undefined)
          : undefined;
      const code = payload?.details?.code ?? payload?.code;
      if (mode === 'change' && code === 'INCORRECT_CURRENT_PASSWORD') {
        showErrors({ ...localErrors, currentPassword: messages.INCORRECT_CURRENT_PASSWORD });
        return;
      }
      if (mode === 'change' && code === 'VALIDATION_ERROR' && hasLocalErrors) {
        showErrors(localErrors);
        return;
      }
      if (code === 'INVALID_PASSWORD_RESET_TOKEN') setToken('');
      const knownMessage = code && Object.hasOwn(messages, code) ? messages[code] : undefined;
      const outcomeUnknown = !knownMessage && mode !== 'forgot' && mutationOutcomeUnknown(cause);
      if (mode === 'change' && outcomeUnknown) {
        showErrors({ ...localErrors, currentPasswordNotice: unconfirmedUpdate });
        return;
      }
      showErrors({
        ...localErrors,
        form:
          knownMessage ??
          (outcomeUnknown ? unconfirmedUpdate : profileUpdateFeedback ? '' : failureMessage(cause)),
      });
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
          {!errors && <p>Liên kết đặt lại mật khẩu không hợp lệ.</p>}
          <p>
            <Link href="/forgot-password">Yêu cầu liên kết mới</Link>
          </p>
        </>
      )}
      {(mode !== 'reset' || token) && (
        <form
          method="post"
          noValidate={mode === 'change'}
          onSubmit={submit}
          aria-label={titles[mode]}
          aria-busy={busy || !ready}
        >
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
                      ref={currentPasswordInput}
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      aria-invalid={currentPasswordError ? true : undefined}
                      aria-describedby={
                        currentPasswordFeedback ? currentPasswordErrorId : undefined
                      }
                      onChange={() => clearFieldErrors('currentPassword')}
                    />
                    {currentPasswordFeedback && (
                      <span
                        id={currentPasswordErrorId}
                        className="api-error"
                        role={currentPasswordError ? undefined : 'status'}
                      >
                        {currentPasswordFeedback}
                      </span>
                    )}
                  </label>
                )}
                <label className="api-field">
                  Mật khẩu mới
                  <input
                    ref={newPasswordInput}
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-invalid={newPasswordError ? true : undefined}
                    aria-describedby={newPasswordError ? newPasswordErrorId : undefined}
                    onChange={() => clearFieldErrors('newPassword', 'confirmPassword')}
                  />
                  {newPasswordError && (
                    <span id={newPasswordErrorId} className="api-error">
                      {newPasswordError}
                    </span>
                  )}
                </label>
                <label className="api-field">
                  Xác nhận mật khẩu mới
                  <input
                    ref={confirmPasswordInput}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-invalid={confirmPasswordError ? true : undefined}
                    aria-describedby={confirmPasswordError ? confirmPasswordErrorId : undefined}
                    onChange={() => clearFieldErrors('confirmPassword')}
                  />
                  {confirmPasswordError && (
                    <span id={confirmPasswordErrorId} className="api-error">
                      {confirmPasswordError}
                    </span>
                  )}
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
      {errors &&
        (profileUpdateFeedback ? (
          <>
            <ProfileUpdateStatus status="error" />
            {errors.form && <p>{errors.form}</p>}
          </>
        ) : (
          errors.form && (
            <p role="alert" className="api-error">
              {errors.form}
            </p>
          )
        ))}
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
