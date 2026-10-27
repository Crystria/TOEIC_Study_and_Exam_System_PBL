import Link from 'next/link';
import type { ReactNode } from 'react';

import { Brand } from '../layout/brand';
import { Icon } from '../ui/icon';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="auth-layout">
      <aside className="auth-story" aria-label="Giới thiệu TOEIC Master">
        <Brand light />
        <div className="auth-story-content">
          <span className="auth-eyebrow">
            <span /> LISTENING & READING
          </span>
          <h2>
            Chinh phục TOEIC.
            <br />
            Bắt đầu từ
            <br />
            <span>hôm nay.</span>
          </h2>
          <p>Học có định hướng, luyện tập đúng trọng tâm và nhìn thấy tiến bộ của bạn mỗi ngày.</p>
          <div className="auth-study-card" aria-hidden="true">
            <div className="auth-study-card-top">
              <span className="auth-study-icon">
                <Icon name="target" width="25" height="25" />
              </span>
              <span>
                MỤC TIÊU TIẾP THEO
                <strong>
                  750<span>+</span>
                </strong>
              </span>
              <span className="auth-card-spark">
                <Icon name="sparkles" />
              </span>
            </div>
            <div className="auth-card-progress">
              <span />
            </div>
            <div className="auth-study-card-bottom">
              <span>
                <Icon name="layers" width="16" />
                10 từ mới / ngày
              </span>
              <span>
                <Icon name="clock" width="16" />
                30 phút học / ngày
              </span>
            </div>
          </div>
          <div className="auth-benefits">
            <p>
              <Icon name="check" /> Luyện tập đầy đủ 7 Part TOEIC
            </p>
            <p>
              <Icon name="check" /> Ghi nhớ từ vựng với Flashcard thông minh
            </p>
            <p>
              <Icon name="check" /> Theo dõi tiến độ theo mục tiêu cá nhân
            </p>
          </div>
        </div>
        <p className="auth-story-footer">Mỗi buổi học là một bước tiến.</p>
      </aside>
      <div className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-top-link">
          <Link href="/dashboard">
            Xem thử giao diện <Icon name="arrow" width="16" />
          </Link>
        </div>
        {children}
        <p className="auth-footer">TOEIC Master · Nền tảng học và ôn luyện TOEIC 2 kỹ năng</p>
      </div>
    </main>
  );
}
