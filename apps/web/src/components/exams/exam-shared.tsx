import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDuration, summarizeSelection } from '@/lib/exams/selection';
import type { ExamSelection, ExamTest } from '@/lib/exams/types';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';

export function ExamHeading({
  title,
  description,
  eyebrow = 'LUYỆN ĐỀ · VỮNG TÂM BƯỚC TIẾP',
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading exam-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 tabIndex={-1} data-exam-heading>
          {title}
        </h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
export function ExamBackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="exam-back" href={href}>
      <Icon name="arrow" width="16" />
      {children}
    </Link>
  );
}
export function ExamSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="exam-steps" aria-label="Các bước chuẩn bị">
      {['Chọn đề', 'Chọn chế độ & Part', 'Chuẩn bị'].map((label, index) => (
        <li
          key={label}
          aria-current={current === index + 1 ? 'step' : undefined}
          className={current > index ? 'exam-step-active' : ''}
        >
          <span>{current > index + 1 ? <Icon name="check" width="14" /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function SelectionSummary({
  test,
  selection,
  children,
}: {
  test: ExamTest;
  selection: ExamSelection;
  children?: ReactNode;
}) {
  const summary = summarizeSelection(test, selection);
  return (
    <Panel className="exam-summary" aria-label="Tổng quan lựa chọn">
      <div className="eyebrow">PHIÊN CỦA BẠN</div>
      <h2>
        {selection.mode === 'PRACTICE'
          ? 'Luyện tập theo nhịp riêng'
          : selection.scope === 'full'
            ? 'Thi thử toàn bộ đề'
            : 'Thi thử theo Part'}
      </h2>
      <p>{summary.selected.map((part) => `Part ${part.id}`).join(' · ')}</p>
      <dl className="exam-summary-metrics">
        <div>
          <dt>Số câu</dt>
          <dd>{summary.questionCount}</dd>
        </div>
        <div>
          <dt>Thời lượng demo</dt>
          <dd>{formatDuration(summary.durationSeconds)}</dd>
        </div>
      </dl>
      <div className="exam-skill-counts">
        <span>
          <Icon name="headphones" width="16" />
          {summary.listeningCount} câu nghe
        </span>
        <span>
          <Icon name="book" width="16" />
          {summary.readingCount} câu đọc
        </span>
      </div>
      <p className="exam-duration-note">
        {summary.durationSource === 'test'
          ? 'Dùng thời lượng của toàn bộ đề.'
          : summary.durationSource === 'parts'
            ? 'Cộng thời lượng đã cấu hình của các Part được chọn.'
            : 'Thời lượng theo tỷ lệ số câu đã chọn, làm tròn lên đến giây do chưa cấu hình đủ thời lượng từng Part.'}{' '}
        Thời lượng chính thức sẽ được server chốt khi bắt đầu.
      </p>
      <div className="exam-scoring-note">
        <Icon name="info" width="18" />
        <p>
          {summary.toeicEligible
            ? 'Theo đặc tả, thi thử toàn đề có đủ Nghe và Đọc mới đủ điều kiện quy đổi điểm TOEIC. Bản demo chưa chấm điểm.'
            : 'Phiên này chỉ áp dụng số câu đúng/tổng câu và tỷ lệ đúng theo Part; không quy đổi điểm TOEIC.'}
        </p>
      </div>
      {children}
    </Panel>
  );
}
