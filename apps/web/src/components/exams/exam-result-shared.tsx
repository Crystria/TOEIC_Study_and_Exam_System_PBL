'use client';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { buttonStyles, Button } from '../ui/button';
import { Alert, Badge } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { useExamHistory } from './exam-history-provider';

export function ResultHeading({ title, description }: { title: string; description: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <header className="exam-heading result-heading">
      <Badge tone="amber">Demo · chưa tích hợp chấm điểm server</Badge>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p>{description}</p>
    </header>
  );
}
export function ResultLoading({ children }: { children?: ReactNode }) {
  return (
    <div className="exam-page" role="status">
      <p>Đang đọc dữ liệu demo…</p>
      <div className="skeleton skeleton-hero" />
      {children}
    </div>
  );
}
export function ResultBoundary({
  title,
  children,
  href,
  label,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className="exam-page">
      <ResultHeading
        title={title}
        description="Dữ liệu cục bộ không phải kết quả đã được server chấm."
      />
      <Panel className="result-panel">
        <p>{children}</p>
        <div className="result-actions">
          {href && (
            <Link href={href} className={buttonStyles('primary')}>
              {label ?? 'Tiếp tục phiên demo'}
            </Link>
          )}
          <Link href="/history" className={buttonStyles('secondary')}>
            Lịch sử demo
          </Link>
          <Link href="/exam" className={buttonStyles('secondary')}>
            Thư viện đề
          </Link>
        </div>
      </Panel>
    </div>
  );
}
export function HistoryNotice() {
  const { issue, reload } = useExamHistory();
  if (!issue) return null;
  return (
    <Alert tone="error">
      <strong>
        {issue === 'corrupt'
          ? 'Lịch sử demo không thể khôi phục.'
          : issue === 'conflict'
            ? 'Lịch sử vừa thay đổi ở tab khác.'
            : 'Chưa đọc hoặc lưu được lịch sử demo.'}
      </strong>
      <p>
        {issue === 'corrupt'
          ? 'Dữ liệu hỏng hoặc không tương thích được giữ nguyên, không ghi đè. Bản nháp hiện tại vẫn độc lập.'
          : 'Kiểm tra quyền lưu trữ của trình duyệt rồi thử lại. Phiên hiện tại vẫn có thể được giữ trong tab; chưa xác nhận lưu lịch sử.'}
      </p>
      <Button variant="secondary" onClick={reload}>
        Đọc lại lịch sử demo
      </Button>
    </Alert>
  );
}
