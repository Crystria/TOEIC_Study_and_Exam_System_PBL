import Link from 'next/link';
import type { ReactNode } from 'react';

import { Icon } from '../../../../web/src/components/ui/icon';

export function AdminLoginLayout({
  children,
  preview = false,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  return (
    <main className="admin-auth-page" data-preview={preview || undefined}>
      <header className="admin-auth-header">
        <Link
          href="/login"
          className="admin-auth-brand"
          aria-label="TOEIC Master · Đăng nhập quản trị"
        >
          <span className="admin-auth-brand-icon">
            <Icon name="book" width="23" height="23" />
          </span>
          <span>
            TOEIC <strong>Master</strong>
          </span>
        </Link>
        <span className="admin-auth-header-label">
          {preview ? 'Bản xem thử giao diện' : 'Không gian quản trị'}
        </span>
      </header>

      <div className="admin-auth-content">
        <div className="admin-auth-card">
          <div className="admin-auth-form-panel">{children}</div>
          <aside className="admin-auth-welcome" aria-labelledby="admin-auth-welcome-title">
            <div className="admin-auth-welcome-content">
              <span className="admin-auth-welcome-icon" aria-hidden="true">
                <Icon name="book" width="29" height="29" />
              </span>
              <span className="admin-auth-welcome-brand">TOEIC Master</span>
              <h2 id="admin-auth-welcome-title">
                Nội dung chỉn chu.
                <br />
                Trải nghiệm học tốt hơn.
              </h2>
              <p className="admin-auth-welcome-description">
                Cùng xây dựng một không gian học tập chất lượng, mỗi ngày.
              </p>
              <div className="admin-auth-roles">
                <div className="admin-auth-role">
                  <span className="admin-auth-role-icon" aria-hidden="true">
                    <Icon name="layers" width="20" height="20" />
                  </span>
                  <div>
                    <strong>Quản trị nội dung</strong>
                    <p>Biên soạn bài học, câu hỏi và đề thi.</p>
                  </div>
                </div>
                <div className="admin-auth-role">
                  <span className="admin-auth-role-icon" aria-hidden="true">
                    <Icon name="lock" width="20" height="20" />
                  </span>
                  <div>
                    <strong>Quản trị hệ thống</strong>
                    <p>Quản lý tài khoản và vận hành nền tảng.</p>
                  </div>
                </div>
              </div>
              <span className="admin-auth-welcome-caption">MỘT NỀN TẢNG · CÙNG MỤC TIÊU</span>
            </div>
          </aside>
        </div>
      </div>

      <footer className="admin-auth-footer">
        TOEIC Master · Quản trị nội dung & nền tảng học tập
      </footer>
    </main>
  );
}
