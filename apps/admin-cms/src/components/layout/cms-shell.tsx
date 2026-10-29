'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEMO_PERSONAS, demoHref, parseDemoRole, type DemoRole } from '@/lib/demo/cms-fixtures';
import { resolveCmsDestination } from '@/lib/demo/cms-destination';
import { Sidebar } from './sidebar';
import type { User } from '../../../../web/src/lib/integration/contracts';
import { LogoutButton } from '../../../../web/src/components/integration/shared';

export function CmsShell({ children, apiAccount }: { children: ReactNode; apiAccount?: User }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const role = apiAccount
    ? apiAccount.roles.includes('CONTENT_ADMIN')
      ? 'CONTENT_ADMIN'
      : 'SYSTEM_ADMIN'
    : parseDemoRole(search.get('demoRole'));
  const persona = DEMO_PERSONAS[role];
  const destination = resolveCmsDestination(pathname);
  const drawer = useRef<HTMLDialogElement>(null);
  const account = useRef<HTMLDetailsElement>(null);
  const main = useRef<HTMLElement>(null);
  const previousLocation = useRef(`${pathname}:${role}`);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady] = useState(false);

  function closeDrawer() {
    drawer.current?.close();
    setDrawerOpen(false);
  }

  useEffect(() => setReady(true), []);

  useEffect(() => {
    drawer.current?.close();
    setDrawerOpen(false);
    if (account.current) account.current.open = false;
    if (previousLocation.current !== `${pathname}:${role}`) {
      main.current?.focus();
      previousLocation.current = `${pathname}:${role}`;
    }
  }, [pathname, role]);

  useEffect(() => {
    if (!drawerOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (media.matches && drawer.current?.open) {
        closeDrawer();
        main.current?.focus();
      }
    };
    const outside = (event: Event) => {
      if (account.current && !account.current.contains(event.target as Node))
        account.current.open = false;
    };
    media.addEventListener('change', resize);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      media.removeEventListener('change', resize);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, []);

  function switchRole(next: DemoRole) {
    const target = destination?.role === next ? destination.href : DEMO_PERSONAS[next].home;
    router.push(demoHref(target, next));
  }

  return (
    <div className="cms-shell">
      <Link href="#cms-main" className="cms-skip">
        Đến nội dung chính
      </Link>
      <aside className="cms-desktop-sidebar">
        <Sidebar pathname={destination?.href ?? pathname} role={role} roles={apiAccount?.roles} />
      </aside>
      <dialog
        ref={drawer}
        id="cms-mobile-menu"
        className="cms-drawer"
        aria-label="Menu quản trị"
        onClose={() => setDrawerOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const targets = event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled)',
          );
          const first = targets[0];
          const last = targets[targets.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === drawer.current) closeDrawer();
        }}
      >
        <div className="cms-drawer-content">
          <button
            type="button"
            className="cms-icon-button cms-drawer-close"
            aria-label="Đóng menu"
            onClick={closeDrawer}
          >
            ×
          </button>
          <Sidebar
            pathname={destination?.href ?? pathname}
            role={role}
            roles={apiAccount?.roles}
            onNavigate={closeDrawer}
          />
        </div>
      </dialog>
      <div className="cms-workspace">
        <header className="cms-header">
          <div className="cms-header-start">
            <button
              type="button"
              className="cms-icon-button cms-menu-trigger"
              aria-label="Mở menu quản trị"
              aria-expanded={drawerOpen}
              aria-controls="cms-mobile-menu"
              disabled={!ready}
              onClick={() => {
                drawer.current?.showModal();
                setDrawerOpen(true);
              }}
            >
              ☰
            </button>
            <div>
              <span className="cms-eyebrow">KHÔNG GIAN QUẢN TRỊ</span>
              <p>{destination?.label ?? 'CMS demo'}</p>
            </div>
          </div>
          <details
            ref={account}
            className="cms-account"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && account.current?.open) {
                event.preventDefault();
                account.current.open = false;
                account.current.querySelector('summary')?.focus();
              }
            }}
          >
            <summary aria-label={apiAccount ? 'Tài khoản quản trị' : 'Tài khoản demo'}>
              <span className="cms-avatar" aria-hidden="true">
                {apiAccount ? apiAccount.fullName.slice(0, 2).toUpperCase() : persona.initials}
              </span>
              <span className="cms-account-text">
                {apiAccount?.fullName ?? 'Nhân vật demo'}
                <small>{apiAccount?.roles.join(', ') ?? persona.label}</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="cms-account-panel">
              <strong>{apiAccount?.email ?? persona.name}</strong>
              <p>{apiAccount?.roles.join(', ') ?? role}</p>
              {apiAccount ? (
                <LogoutButton />
              ) : (
                <>
                  <p>Nhân vật minh họa, chưa đăng nhập tài khoản.</p>
                  <Link href="/login">Thoát không gian xem thử</Link>
                </>
              )}
            </div>
          </details>
        </header>
        {apiAccount ? (
          <div className="cms-demo-toolbar">
            <span className="cms-badge">API · Local / test</span>
            <p>Quyền từ backend · Không dùng persona demo. Server kiểm tra từng yêu cầu.</p>
          </div>
        ) : (
          <div className="cms-demo-toolbar">
            <div>
              <span className="cms-badge">CMS DEMO</span>
              <p>Chưa xác thực tài khoản · Chưa kết nối API</p>
            </div>
            <div className="cms-role-control">
              <label htmlFor="cms-demo-role">Vai trò xem thử UI</label>
              <select
                id="cms-demo-role"
                value={role}
                disabled={!ready}
                onChange={(event) => switchRole(parseDemoRole(event.target.value))}
                aria-describedby="cms-role-note"
              >
                <option value="CONTENT_ADMIN">Quản trị nội dung</option>
                <option value="SYSTEM_ADMIN">Quản trị hệ thống</option>
              </select>
            </div>
            <p id="cms-role-note">
              Chỉ đổi cách hiển thị giao diện, không đổi quyền tài khoản. Quyền thật phải được
              backend kiểm tra.
            </p>
          </div>
        )}
        <main ref={main} id="cms-main" tabIndex={-1} className="cms-main">
          {apiAccount || destination?.role === role ? (
            children
          ) : (
            <section className="cms-route-intro">
              <span className="cms-eyebrow">PHẠM VI VAI TRÒ DEMO</span>
              <h1>{destination?.label ?? 'Không gian quản trị'}</h1>
              <p>
                Mục này thuộc menu{' '}
                {destination ? DEMO_PERSONAS[destination.role].label.toLowerCase() : 'khác'}. Vai
                trò xem thử hiện tại là {persona.label.toLowerCase()}.
              </p>
              <p>
                Đây chỉ là minh họa UI; trang chưa tải dữ liệu hoặc kiểm tra quyền truy cập thật.
              </p>
              <Link className="cms-link-button" href={demoHref(persona.home, role)}>
                Về không gian {persona.label.toLowerCase()}
              </Link>
            </section>
          )}
        </main>
        <footer className="cms-workspace-footer">
          {apiAccount
            ? 'Dữ liệu từ server qua Gateway · Không thay dữ liệu lỗi bằng bản mẫu'
            : 'Bản xem thử giao diện · Cập nhật chỉ trong RAM, reload khôi phục mẫu · Chưa lưu lên server'}
        </footer>
      </div>
    </div>
  );
}
