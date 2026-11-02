'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  submitAuthPreview,
  validateAuth,
  type AuthErrors,
  type AuthFormValues,
  type AuthIntent,
} from '@/lib/auth-preview';

import { Button, buttonStyles } from '../ui/button';
import { Alert, Badge } from '../ui/feedback';
import { Field, PasswordField } from '../ui/field';
import { Icon } from '../ui/icon';

export function AuthForm({ intent }: { intent: AuthIntent }) {
  const registering = intent === 'register';
  const form = useRef<HTMLFormElement>(null);
  const submittedFocus = useRef<HTMLElement | null>(null);
  const [values, setValues] = useState<AuthFormValues>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (loading || !submittedFocus.current) return;
    const target = submittedFocus.current;
    submittedFocus.current = null;
    // Disabling the form drops focus to body. Preserve any focus the user moved meanwhile.
    if (document.activeElement === document.body && target.isConnected) {
      target.focus({ preventScroll: true });
    }
  }, [loading]);

  function change(field: keyof AuthFormValues, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setMessage('');
    if (attempted) setErrors(validateAuth(next, intent));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setMessage('');
    setAttempted(true);
    const nextErrors = validateAuth(values, intent);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    submittedFocus.current = form.current?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null;
    setLoading(true);
    try {
      setMessage(await submitAuthPreview(intent));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form-container">
      <Badge tone="blue">Bản xem trước giao diện</Badge>
      <h1>{registering ? 'Bắt đầu hành trình của bạn' : 'Chào mừng bạn trở lại'}</h1>
      <p className="auth-description">
        {registering
          ? 'Tạo tài khoản để xây dựng thói quen học và tiến gần hơn đến mục tiêu TOEIC.'
          : 'Tiếp tục học tập, luyện đề và chinh phục mục tiêu TOEIC của riêng bạn.'}
      </p>
      <form
        ref={form}
        className="auth-form"
        onSubmit={submit}
        aria-busy={!ready || loading}
        noValidate
        aria-label={registering ? 'Đăng ký tài khoản' : 'Đăng nhập tài khoản'}
      >
        {attempted && Object.keys(errors).length > 0 && (
          <Alert tone="error">Vui lòng kiểm tra các trường được đánh dấu bên dưới.</Alert>
        )}
        {message && <Alert>{message}</Alert>}
        <fieldset disabled={!ready || loading}>
          {registering && (
            <Field
              id="fullName"
              name="fullName"
              label="Họ và tên"
              icon="user"
              autoComplete="name"
              placeholder="Nguyễn Minh Anh"
              required
              minLength={2}
              value={values.fullName}
              error={errors.fullName}
              onChange={(event) => change('fullName', event.target.value)}
            />
          )}
          <Field
            id="email"
            name="email"
            label="Địa chỉ email"
            type="email"
            icon="mail"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={320}
            placeholder="ban@example.com"
            required
            value={values.email}
            error={errors.email}
            onChange={(event) => change('email', event.target.value)}
          />
          <PasswordField
            id="password"
            name="password"
            label="Mật khẩu"
            autoComplete={registering ? 'new-password' : 'current-password'}
            placeholder={registering ? 'Tạo mật khẩu của bạn' : 'Nhập mật khẩu'}
            required
            minLength={registering ? 8 : undefined}
            value={values.password}
            error={errors.password}
            hint={registering ? 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.' : undefined}
            onChange={(event) => change('password', event.target.value)}
          />
          {registering && (
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              required
              value={values.confirmPassword}
              error={errors.confirmPassword}
              onChange={(event) => change('confirmPassword', event.target.value)}
            />
          )}
        </fieldset>
        <Button type="submit" className="auth-submit" loading={loading} disabled={!ready}>
          {loading ? 'Đang kiểm tra…' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}
          {!loading && <Icon name="arrow" width="18" />}
        </Button>
        <p className="preview-form-note">
          <Icon name="info" width="15" /> Xác thực tài khoản chưa được bật trong bản xem trước.
        </p>
      </form>
      <p className="auth-switch">
        {registering ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'}{' '}
        <Link href={registering ? '/login' : '/register'}>
          {registering ? 'Đăng nhập' : 'Đăng ký miễn phí'}
        </Link>
      </p>
      <div className="auth-separator">
        <span>hoặc khám phá trước</span>
      </div>
      <Link href="/dashboard" className={buttonStyles('secondary', 'auth-demo-link')}>
        Xem thử không gian học tập <Icon name="arrow" width="17" />
      </Link>
      <p className="auth-demo-note">Dữ liệu minh họa · Không cần tài khoản</p>
    </div>
  );
}
