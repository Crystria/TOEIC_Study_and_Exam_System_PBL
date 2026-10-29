import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import '@/styles/home.css';

export default function HomePage() {
  const api = process.env.NEXT_PUBLIC_DATA_MODE === 'api';
  const start = api ? '/login' : '/dashboard';
  return (
    <div className="home-page">
      <header className="home-header">
        <Link href="/" className="home-brand">
          <span>
            <Icon name="book" />
          </span>
          TOEIC<strong>Master</strong>
        </Link>
        <nav aria-label="Điều hướng trang chủ">
          <Link href="#learning">Khám phá cách học</Link>
          <Link href="/login">Đăng nhập</Link>
          <Link className="home-button home-button--small" href={api ? '/register' : '/dashboard'}>
            {api ? 'Bắt đầu học' : 'Mở bản demo'}
          </Link>
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
              <Link className="home-button" href={start}>
                {api ? 'Vào không gian học tập' : 'Khám phá bản demo'}
                <Icon name="arrow" width="18" />
              </Link>
              <Link className="home-text-link" href="#learning">
                Tìm nhịp học của bạn ↓
              </Link>
            </div>
            <p className="home-mode">
              {api
                ? 'API · Môi trường local / test. Một số chức năng đang chờ backend.'
                : 'DEMO · Dữ liệu minh họa và tiến độ học thử tách biệt với tài khoản thật.'}
            </p>
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
        <section id="learning" className="home-learning">
          <div className="home-section-heading">
            <p className="home-eyebrow">XÂY NỀN TẢNG, RỒI LUYỆN TẬP</p>
            <h2>Bắt đầu từ điều bạn cần.</h2>
            <p>Chọn một hoạt động phù hợp với thời gian và kỹ năng hôm nay.</p>
          </div>
          <div className="home-feature-grid">
            <Link href={api ? '/login' : '/study/vocabulary'} className="home-feature">
              <span className="home-feature-icon">
                <Icon name="layers" />
              </span>
              <small>01 / TỪ VỰNG</small>
              <h3>Nhớ từ trong ngữ cảnh</h3>
              <p>Học theo chủ đề, nghe phát âm và tự đánh giá khả năng ghi nhớ.</p>
              <span className="home-feature-link">
                Mở thư viện từ vựng <Icon name="arrow" width="18" />
              </span>
            </Link>
            <Link href={api ? '/login' : '/study/grammar'} className="home-feature">
              <span className="home-feature-icon home-feature-icon--green">
                <Icon name="book" />
              </span>
              <small>02 / NGỮ PHÁP</small>
              <h3>Hiểu rõ, dùng đúng</h3>
              <p>Đọc bài học có ví dụ, cấu trúc và bảng so sánh dễ theo dõi.</p>
              <span className="home-feature-link">
                Khám phá bài học <Icon name="arrow" width="18" />
              </span>
            </Link>
            <Link href={api ? '/login' : '/exam'} className="home-feature">
              <span className="home-feature-icon home-feature-icon--amber">
                <Icon name="clipboard" />
              </span>
              <small>03 / LUYỆN ĐỀ</small>
              <h3>Làm quen từng Part</h3>
              <p>
                {api
                  ? 'Xem đề và cấu trúc từ server. Luồng làm bài đang chờ hoàn thiện contract.'
                  : 'Trải nghiệm chọn Part, làm bài có đồng hồ và xem lại lựa chọn trong demo.'}
              </p>
              <span className="home-feature-link">
                Xem thư viện đề <Icon name="arrow" width="18" />
              </span>
            </Link>
          </div>
        </section>
        <section className="home-cta">
          <div>
            <p className="home-eyebrow">TIẾN BỘ THEO NHỊP CỦA BẠN</p>
            <h2>
              Một bước nhỏ hôm nay.
              <br />
              Một nền tảng vững ngày mai.
            </h2>
          </div>
          <Link className="home-button" href={start}>
            Bắt đầu khám phá <Icon name="arrow" width="18" />
          </Link>
        </section>
      </main>
      <footer className="home-footer">
        <span>TOEIC Master · Listening & Reading</span>
        <span>Nền tảng học và ôn luyện TOEIC</span>
        <Link href="/login">Tài khoản học viên</Link>
      </footer>
    </div>
  );
}
