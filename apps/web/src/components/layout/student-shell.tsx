'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Badge } from '../ui/feedback';
import { Icon, type IconName } from '../ui/icon';
import { Brand } from './brand';

const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/dashboard', label: 'Tổng quan', icon: 'grid' },
  { href: '/study/vocabulary', label: 'Từ vựng & Flashcard', icon: 'layers' },
  { href: '/study/grammar', label: 'Ngữ pháp', icon: 'book' },
  { href: '/practice', label: 'Luyện tập theo Part', icon: 'headphones' },
  { href: '/exam', label: 'Thi thử TOEIC', icon: 'clipboard' },
  { href: '/history', label: 'Lịch sử làm bài', icon: 'clock' },
  { href: '/analytics', label: 'Thống kê tiến độ', icon: 'chart' },
  { href: '/ai-chat', label: 'Trợ lý học tập AI', icon: 'sparkles' },
  { href: '/settings', label: 'Cài đặt học tập', icon: 'user' },
  { href: '/profile', label: 'Hồ sơ học viên', icon: 'user' },
];

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <div className="sidebar-label">KHÔNG GIAN HỌC TẬP</div>
      <nav aria-label="Điều hướng học viên" className="student-nav">
        {navigation.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn('nav-link', active && 'nav-link--active')}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {active && <span className="nav-active-dot" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip">
          <span className="sidebar-tip-icon">
            <Icon name="sparkles" />
          </span>
          <strong>Đều đặn mỗi ngày</strong>
          <p>
            10 từ mới, 30 phút học.
            <br />
            Từng bước tiến gần mục tiêu.
          </p>
          <Link href="/study/vocabulary" onClick={onNavigate}>
            Bắt đầu học <Icon name="arrow" width="16" />
          </Link>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Listening & Reading
        </div>
      </div>
    </>
  );
}

export function StudentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const isStandalone =
    pathname === '/login' || pathname === '/register' || /^\/exam\/[^/]+\/take$/.test(pathname);
  const title =
    navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ?.label ?? 'Trang chủ';

  useEffect(() => {
    drawer.current?.close();
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  if (isStandalone)
    return (
      <>
        <Link className="skip-link" href="#main-content">
          Đến nội dung chính
        </Link>
        {pathname.startsWith('/exam/') ? (
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        ) : (
          children
        )}
      </>
    );

  return (
    <div className="student-shell">
      <Link className="skip-link" href="#main-content">
        Đến nội dung chính
      </Link>
      <aside className="desktop-sidebar">
        <SidebarContent pathname={pathname} />
      </aside>
      <dialog
        ref={drawer}
        className="mobile-drawer"
        aria-label="Menu học tập"
        onClick={(event) => {
          if (event.target === drawer.current) drawer.current?.close();
        }}
      >
        <div className="mobile-drawer-content">
          <button
            type="button"
            className="icon-button drawer-close"
            onClick={() => drawer.current?.close()}
            aria-label="Đóng menu"
          >
            <Icon name="close" />
          </button>
          <SidebarContent pathname={pathname} onNavigate={() => drawer.current?.close()} />
        </div>
      </dialog>
      <div className="student-workspace">
        <header className="student-header">
          <div className="header-location">
            <button
              className="icon-button mobile-menu-button"
              type="button"
              onClick={() => drawer.current?.showModal()}
              aria-label="Mở menu học tập"
              aria-haspopup="dialog"
            >
              <Icon name="menu" />
            </button>
            <span className="header-breadcrumb">
              Không gian học tập <span>/</span>
            </span>
            <strong>{title}</strong>
          </div>
          <div className="header-actions">
            <Badge tone="amber">Bản xem thử</Badge>
            <span className="header-divider" />
            <details
              className="profile-menu"
              ref={menu}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && menu.current) {
                  menu.current.open = false;
                  menu.current.querySelector('summary')?.focus();
                }
              }}
            >
              <summary aria-label="Menu tài khoản — Khách xem thử">
                <span className="avatar">HV</span>
                <span className="profile-label">
                  Khách xem thử<small>Học viên · USER</small>
                </span>
                <Icon name="down" width="16" />
              </summary>
              <div className="profile-dropdown">
                <p>Chưa đăng nhập tài khoản</p>
                <Link href="/profile">
                  <Icon name="user" width="17" /> Hồ sơ học viên demo
                </Link>
                <Link href="/settings">
                  <Icon name="book" width="17" /> Cài đặt học tập demo
                </Link>
                <Link href="/login">
                  <Icon name="logout" width="17" /> Đăng nhập
                </Link>
                <Link href="/register">
                  <Icon name="user" width="17" /> Tạo tài khoản
                </Link>
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="student-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>TOEIC Master · Học tập theo nhịp của bạn</span>
          <span>Nền tảng ôn luyện Listening & Reading</span>
        </footer>
      </div>
    </div>
  );
}
