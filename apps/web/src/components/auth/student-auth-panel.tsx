'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

import type { AuthIntent } from '@/lib/auth-preview';
import '@/styles/student-auth-panel.css';

import { ApiAuth } from '../integration/shared';
import { Icon } from '../ui/icon';
import { AuthForm } from './auth-form';

const StudentAuthContext = createContext<{
  open: (intent: AuthIntent, trigger: HTMLElement) => void;
} | null>(null);

export function StudentAuthLink({
  href,
  intent,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { intent?: AuthIntent }) {
  const auth = useContext(StudentAuthContext);
  const path = typeof href === 'string' ? href : href.pathname;
  const destination = intent ?? (path === '/register' ? 'register' : 'login');

  return (
    <Link
      {...props}
      href={href}
      aria-haspopup={auth && (path === '/login' || path === '/register') ? 'dialog' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (
          !auth ||
          (path !== '/login' && path !== '/register') ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== '_self') ||
          props.download
        )
          return;
        event.preventDefault();
        auth.open(destination, event.currentTarget);
      }}
    />
  );
}

export function StudentAuthProvider({
  api,
  writes,
  initialIntent,
  children,
}: {
  api: boolean;
  writes: boolean;
  initialIntent?: AuthIntent;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const formSlot = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const busyRef = useRef(false);
  const [intent, setIntent] = useState<AuthIntent | null>(initialIntent ?? null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const opened = intent !== null;

  const handleBusy = useCallback((value: boolean) => {
    busyRef.current = value;
    setBusy(value);
    if (value) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setClosing(false);
    }
  }, []);

  const finishClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (busyRef.current) {
      setClosing(false);
      return;
    }
    dialog.current?.close();
    setIntent(null);
    setClosing(false);
    if (pathname === '/login' || pathname === '/register') {
      router.replace('/', { scroll: false });
    } else if (trigger.current?.isConnected) {
      trigger.current.focus({ preventScroll: true });
    }
  }, [pathname, router]);

  const requestClose = useCallback(() => {
    if (busyRef.current) return;
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(
      finishClose,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220,
    );
  }, [finishClose]);

  const open = useCallback((next: AuthIntent, source: HTMLElement) => {
    if (busyRef.current) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    trigger.current = source;
    setClosing(false);
    setIntent(next);
  }, []);

  const switchIntent = useCallback((next: AuthIntent) => {
    if (!busyRef.current) setIntent(next);
  }, []);

  useEffect(() => {
    if (initialIntent) {
      setClosing(false);
      setIntent(initialIntent);
    }
  }, [initialIntent]);

  useEffect(() => {
    const element = dialog.current;
    if (!opened || !element) return;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) {
      const padding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${padding + scrollbar}px`;
    }
    document.body.style.overflow = 'hidden';
    if (!element.open) element.showModal();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      element.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [opened]);

  useEffect(() => {
    if (!intent) return;
    formSlot.current?.scrollTo({ top: 0 });
    const frame = requestAnimationFrame(() => {
      const input = formSlot.current?.querySelector<HTMLInputElement>('input:not(:disabled)');
      (input ?? dialog.current?.querySelector<HTMLButtonElement>('.student-auth-close'))?.focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [intent]);

  return (
    <StudentAuthContext.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialog}
        className="student-auth-dialog"
        aria-labelledby="student-auth-title"
        data-closing={closing || undefined}
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        {intent && (
          <div className="student-auth-card" data-intent={intent} data-mode={api ? 'api' : 'demo'}>
            <button
              type="button"
              className="student-auth-close"
              aria-label="Đóng đăng nhập / đăng ký"
              onClick={requestClose}
              disabled={busy}
            >
              <Icon name="close" width="22" height="22" />
            </button>
            <div className="student-auth-form-slot" ref={formSlot}>
              <div className="student-auth-form-view" key={intent}>
                {api ? (
                  <ApiAuth
                    register={intent === 'register'}
                    writes={writes}
                    embedded
                    onSwitch={switchIntent}
                    onBusyChange={handleBusy}
                  />
                ) : (
                  <AuthForm
                    intent={intent}
                    embedded
                    onSwitch={switchIntent}
                    onBusyChange={handleBusy}
                  />
                )}
              </div>
            </div>
            <aside className="student-auth-welcome" aria-label="Không gian học tập TOEIC Master">
              <div className="student-auth-welcome-content" key={intent}>
                <span className="student-auth-mark" aria-hidden="true">
                  <Icon name="book" width="30" height="30" />
                </span>
                <span className="student-auth-brand">TOEIC Master</span>
                <h2>
                  {intent === 'login' ? 'Bắt đầu hành trình của bạn' : 'Chào mừng bạn trở lại'}
                </h2>
                <p>
                  {intent === 'login'
                    ? 'Tạo tài khoản để xây dựng thói quen học và tiến gần hơn đến mục tiêu TOEIC.'
                    : 'Tiếp tục học tập, luyện đề và chinh phục mục tiêu TOEIC của riêng bạn.'}
                </p>
                <button
                  type="button"
                  className="student-auth-toggle"
                  disabled={busy}
                  onClick={() => switchIntent(intent === 'login' ? 'register' : 'login')}
                >
                  {intent === 'login' && (
                    <Icon
                      name="arrow"
                      width="18"
                      height="18"
                      style={{ transform: 'rotate(180deg)' }}
                    />
                  )}
                  {intent === 'login' ? 'Tạo tài khoản' : 'Đăng nhập'}
                  {intent === 'register' && <Icon name="arrow" width="18" height="18" />}
                </button>
                <span className="student-auth-skills">LISTENING & READING</span>
              </div>
            </aside>
          </div>
        )}
      </dialog>
    </StudentAuthContext.Provider>
  );
}
