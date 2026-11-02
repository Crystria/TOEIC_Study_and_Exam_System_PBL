'use client';
import Link from 'next/link';
import { CMS_DESTINATIONS, DEMO_PERSONAS, demoHref, type DemoRole } from '@/lib/demo/cms-fixtures';

export function Sidebar({
  pathname,
  role,
  onNavigate,
  roles,
}: {
  pathname: string;
  role: DemoRole;
  onNavigate?: () => void;
  roles?: readonly string[];
}) {
  const destinations = CMS_DESTINATIONS.filter((item) =>
    roles
      ? roles.includes(item.role) ||
        (roles.includes('SYSTEM_ADMIN') && ['/questions', '/media'].includes(item.href))
      : item.role === role,
  );
  const link = (path: Parameters<typeof demoHref>[0]) => (roles ? path : demoHref(path, role));
  return (
    <>
      <Link className="cms-brand" href={link(DEMO_PERSONAS[role].home)} onClick={onNavigate}>
        <span className="cms-brand-mark" aria-hidden="true">
          T
        </span>
        <span>
          TOEIC <strong>Master</strong>
          <small>KHÔNG GIAN QUẢN TRỊ</small>
        </span>
      </Link>
      <nav aria-label="Điều hướng CMS" className="cms-navigation">
        <p className="cms-nav-label">{roles ? 'Quyền tài khoản' : destinations[0]?.group}</p>
        <ul>
          {destinations.map((item) => (
            <li key={item.href}>
              <Link
                href={link(item.href)}
                onClick={onNavigate}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <span className="cms-nav-icon" aria-hidden="true">
                  {item.shortLabel}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
          {roles?.includes('CONTENT_ADMIN') && (
            <>
              <li>
                <Link
                  href="/groups"
                  onClick={onNavigate}
                  aria-current={pathname === '/groups' ? 'page' : undefined}
                >
                  Nhóm câu hỏi
                </Link>
              </li>
              <li>
                <Link
                  href="/topics"
                  onClick={onNavigate}
                  aria-current={pathname === '/topics' ? 'page' : undefined}
                >
                  Chủ đề từ vựng
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      <div className="cms-sidebar-note">
        <span className="cms-badge">{roles ? 'API · Local / test' : 'BẢN XEM THỬ'}</span>
        <p>
          {roles
            ? 'Menu theo các vai trò backend trả về. Mỗi yêu cầu vẫn phải được server kiểm tra quyền.'
            : 'Khám phá giao diện theo vai trò minh họa. Chưa kết nối dữ liệu quản trị.'}
        </p>
        <Link href="/login" onClick={onNavigate}>
          Về trang đăng nhập <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <p className="cms-sidebar-footer">TOEIC Master · Admin CMS</p>
    </>
  );
}
