'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DEMO_PERSONAS, demoHref, type DemoRole } from '@/lib/demo/cms-fixtures';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = 'Vui lòng nhập địa chỉ email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = 'Địa chỉ email chưa đúng định dạng.';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu.';
  return errors;
}

export function LoginPreview() {
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const restoreFocus = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setReady(true);
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!loading && restoreFocus.current) {
      const target = restoreFocus.current;
      restoreFocus.current = null;
      if (document.activeElement === document.body && target.isConnected) target.focus();
    }
  }, [loading]);

  function change(field: 'email' | 'password', value: string) {
    const nextEmail = field === 'email' ? value : email;
    const nextPassword = field === 'password' ? value : password;
    if (field === 'email') setEmail(value);
    else setPassword(value);
    if (attempted) setErrors(validate(nextEmail, nextPassword));
    setMessage('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || loading) return;
    const next = validate(email, password);
    setErrors(next);
    setAttempted(true);
    setMessage('');
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    restoreFocus.current = form.current?.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : null;
    setLoading(true);
    // Local UI timing only; no request, account lookup, token or persistence.
    timer.current = setTimeout(() => {
      setLoading(false);
      setPassword('');
      setVisible(false);
      setAttempted(false);
      setMessage(
        'Biểu mẫu hợp lệ. Bản xem thử chưa xác thực tài khoản. Hãy chọn lối vào CMS demo bên dưới để khám phá giao diện.',
      );
    }, 500);
  }

  return (
    <main className="cms-login">
      <section className="cms-login-story" aria-labelledby="cms-story-title">
        <div className="cms-brand">
          <span className="cms-brand-mark" aria-hidden="true">
            T
          </span>
          <span>
            TOEIC <strong>Master</strong>
            <small>KHÔNG GIAN QUẢN TRỊ</small>
          </span>
        </div>
        <div>
          <span className="cms-badge">ADMIN CMS</span>
          <h2 id="cms-story-title">
            Nội dung chỉn chu.
            <br />
            Trải nghiệm học tốt hơn.
          </h2>
          <p>Một không gian để tổ chức nội dung TOEIC và quản trị nền tảng học tập.</p>
        </div>
        <div className="cms-story-note">
          <strong>Hai vai trò, hai không gian</strong>
          <p>Quản trị nội dung · Quản trị hệ thống</p>
          <small>Đang xem thử giao diện · Không cần tài khoản</small>
        </div>
      </section>
      <div className="cms-login-form-area">
        <Card className="cms-login-card">
          <CardContent>
            <span className="cms-badge">BẢN XEM THỬ GIAO DIỆN</span>
            <h1>Đăng nhập quản trị</h1>
            <p className="cms-muted">Kiểm tra biểu mẫu đăng nhập hoặc vào thẳng không gian demo.</p>
            <p className="cms-preview-notice" id="cms-login-note">
              Chưa xác thực tài khoản. Không gửi hoặc lưu thông tin đăng nhập. Hãy dùng thông tin
              minh họa.
            </p>
            <form
              ref={form}
              onSubmit={submit}
              noValidate
              autoComplete="off"
              aria-label="Đăng nhập quản trị xem thử"
              aria-describedby="cms-login-note"
              aria-busy={!ready || loading}
            >
              <fieldset disabled={!ready || loading}>
                <div className="cms-field">
                  <label htmlFor="cms-email">
                    Địa chỉ email <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cms-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(event) => change('email', event.target.value)}
                    placeholder="quantri@example.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'cms-email-error' : undefined}
                  />
                  {errors.email && (
                    <p className="cms-field-error" id="cms-email-error">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div className="cms-field">
                  <label htmlFor="cms-password">
                    Mật khẩu <span aria-hidden="true">*</span>
                  </label>
                  <div className="cms-password">
                    <input
                      id="cms-password"
                      name="password"
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(event) => change('password', event.target.value)}
                      placeholder="Nhập mật khẩu minh họa"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'cms-password-error' : undefined}
                    />
                    <button
                      type="button"
                      aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="cms-field-error" id="cms-password-error">
                      {errors.password}
                    </p>
                  )}
                </div>
              </fieldset>
              {Object.keys(errors).length > 0 && (
                <p role="alert" className="cms-field-error">
                  Vui lòng kiểm tra các trường được đánh dấu.
                </p>
              )}
              <Button type="submit" className="cms-submit" disabled={!ready || loading}>
                {loading ? 'Đang kiểm tra biểu mẫu…' : 'Kiểm tra đăng nhập (xem thử)'}
              </Button>
              <p role="status" className={message ? 'cms-form-message' : 'cms-sr-only'}>
                {message || (loading ? 'Đang kiểm tra biểu mẫu trên trình duyệt.' : '')}
              </p>
            </form>
            <div className="cms-demo-entry">
              <h2>Khám phá CMS demo</h2>
              <p>Không cần nhập email hoặc mật khẩu. Chọn vai trò chỉ để xem thử UI.</p>
              {(Object.keys(DEMO_PERSONAS) as DemoRole[]).map((role) => (
                <Link
                  className="cms-demo-entry-link"
                  key={role}
                  href={demoHref(DEMO_PERSONAS[role].home, role)}
                >
                  <strong>
                    Xem thử {DEMO_PERSONAS[role].label.toLowerCase()}{' '}
                    <span aria-hidden="true">→</span>
                  </strong>
                  <span>{DEMO_PERSONAS[role].description}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <p className="cms-login-footer">TOEIC Master · Quản trị nội dung & nền tảng</p>
      </div>
    </main>
  );
}
