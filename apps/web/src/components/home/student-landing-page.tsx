import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { StudentAuthLink, StudentAuthProvider } from '@/components/auth/student-auth-panel';
import '@/styles/home.css';

export function StudentLandingPage({ initialAuth }: { initialAuth?: 'login' | 'register' }) {
  const api = process.env.NEXT_PUBLIC_DATA_MODE === 'api';
  const start = api ? '/login' : '/dashboard';
  return (
    <StudentAuthProvider
      api={api}
      writes={process.env.FRONTEND_TEST_WRITES === 'enabled'}
      initialIntent={initialAuth}
    >
      <div className="home-page">
        <header className="home-header">
          <Link href="/" className="home-brand">
            <span>
              <Icon name="book" />
            </span>
            TOEIC<strong>Master</strong>
          </Link>
          <nav aria-label="Điều hướng trang chủ">
            <StudentAuthLink href="/login">Đăng nhập</StudentAuthLink>
            <StudentAuthLink
              className="home-button home-button--small"
              href={api ? '/register' : '/dashboard'}
            >
              {api ? 'Bắt đầu học' : 'Mở bản demo'}
            </StudentAuthLink>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className="home-hero">
            <div>
              <p className="home-eyebrow">
                <span /> MỖI NGÀY MỘT BƯỚC TIẾN
              </p>
              <h1>
                Học vững từng phần.
                <br />
                <em>Tự tin</em> vào phòng thi.
              </h1>
              <p className="home-lead">
                Từ vựng, ngữ pháp và luyện đề TOEIC Listening & Reading trong một không gian học tập
                rõ ràng. Bắt đầu từ phần bạn muốn cải thiện hôm nay.
              </p>
              <div className="home-actions">
                <StudentAuthLink className="home-button" href={start}>
                  {api ? 'Vào không gian học tập' : 'Khám phá bản demo'}
                  <Icon name="arrow" width="18" />
                </StudentAuthLink>
              </div>
              {!api && (
                <p className="home-mode">
                  DEMO · Dữ liệu minh họa và tiến độ học thử tách biệt với tài khoản thật.
                </p>
              )}
            </div>
            <div className="home-study-board" aria-label="Các bước học tập">
              <div className="home-board-top">
                <span className="home-board-icon">
                  <Icon name="sparkles" />
                </span>
                <div>
                  <small>GỢI Ý NHỊP HỌC</small>
                  <strong>Một buổi học, ba bước nhỏ</strong>
                </div>
              </div>
              <ol>
                {[
                  ['01', 'Làm quen từ mới', 'Đọc, nghe phát âm và lật Flashcard.'],
                  ['02', 'Hiểu cách sử dụng', 'Đọc ngữ pháp trong ngữ cảnh công việc.'],
                  ['03', 'Luyện kỹ năng', 'Khám phá cấu trúc đề và các Part TOEIC.'],
                ].map(([n, title, description]) => (
                  <li key={n}>
                    <span className="home-step">{n}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                    <span aria-hidden="true">↗</span>
                  </li>
                ))}
              </ol>
              <div className="home-board-bottom">
                <span>Listening</span>
                <span>Reading</span>
                <strong>7 Part để khám phá</strong>
              </div>
            </div>
          </section>
        </main>
        <footer className="home-footer">
          <span>TOEIC Master · Listening & Reading</span>
          <span>Nền tảng học và ôn luyện TOEIC</span>
          <StudentAuthLink href="/login">Tài khoản học viên</StudentAuthLink>
        </footer>
      </div>
    </StudentAuthProvider>
  );
}
