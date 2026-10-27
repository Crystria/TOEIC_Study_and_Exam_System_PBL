'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import {
  formatDuration,
  parseSelection,
  selectionQuery,
  summarizeSelection,
} from '@/lib/exams/selection';
import type { ExamQuery, ExamTest } from '@/lib/exams/types';
import { Button, buttonStyles } from '../ui/button';
import { Alert } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { ExamBackLink, ExamHeading, ExamSteps, SelectionSummary } from './exam-shared';
import { ExamStart } from './exam-start';

export function ExamPrepare({ test, query }: { test: ExamTest; query: ExamQuery }) {
  const parsed = parseSelection(query, test, true);
  const [checks, setChecks] = useState({ scope: false, time: false, audio: false });
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const scopeCheck = useRef<HTMLInputElement>(null);
  const timeCheck = useRef<HTMLInputElement>(null);
  const audioCheck = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const detailHref = `/exam/${test.id}${query.preview === 'unavailable' ? '?preview=unavailable' : ''}`;
  if (!parsed.ok)
    return (
      <>
        <ExamBackLink href={detailHref}>Chọn lại chế độ và Part</ExamBackLink>
        <ExamHeading
          title="Chưa thể chuẩn bị làm bài"
          description="Lựa chọn phải được kiểm tra trước khi đi tiếp."
        />
        <Alert tone="error">{parsed.message}</Alert>
        <Link href={detailHref} className={buttonStyles('primary')}>
          Về chi tiết đề thi
        </Link>
      </>
    );
  const { selection } = parsed;
  const summary = summarizeSelection(test, selection);
  const editHref = `/exam/${test.id}?${selectionQuery(selection)}${query.preview === 'unavailable' ? '&preview=unavailable' : ''}`;
  const toggle = (key: keyof typeof checks, checked: boolean) => {
    setChecks({ ...checks, [key]: checked });
    setError(null);
    setConfirmed(false);
  };
  const verify = (event: FormEvent) => {
    event.preventDefault();
    const missing = !checks.scope
      ? scopeCheck
      : !checks.time
        ? timeCheck
        : summary.listeningCount > 0 && !checks.audio
          ? audioCheck
          : null;
    if (missing) {
      setError('Hãy xác nhận các mục chuẩn bị trước khi kiểm tra.');
      setConfirmed(false);
      missing.current?.focus();
      return;
    }
    setError(null);
    setConfirmed(true);
    requestAnimationFrame(() => confirmation.current?.focus());
  };
  return (
    <>
      <ExamBackLink href={editHref}>Điều chỉnh lựa chọn</ExamBackLink>
      <ExamHeading
        title="Chuẩn bị làm bài"
        description={test.title}
        eyebrow="MỘT CHÚT CHUẨN BỊ · THÊM PHẦN TỰ TIN"
      />
      <ExamSteps current={3} />
      <div className="exam-detail-grid">
        <div className="exam-main-column">
          <Panel className="exam-prepare-parts">
            <SectionHeading
              title="Kiểm tra phạm vi của bạn"
              description={`${selection.mode === 'PRACTICE' ? 'Luyện tập' : 'Thi thử'} · ${summary.selected.length} / ${test.parts.length} Part trong đề`}
            />
            <p className="exam-prepare-total">
              <strong>{summary.questionCount} câu</strong>
              <span>{formatDuration(summary.durationSeconds)} · thời lượng demo</span>
            </p>
            <ul>
              {summary.selected.map((part) => (
                <li key={part.id}>
                  <span>
                    <strong>Part {part.id}</strong> · {part.name}
                  </span>
                  <span>{part.questionCount} câu</span>
                </li>
              ))}
            </ul>
            <Link href={editHref} className={buttonStyles('ghost')}>
              Đổi chế độ hoặc Part <Icon name="arrow" width="16" />
            </Link>
          </Panel>
          <Panel className="exam-readiness">
            <form onSubmit={verify} noValidate>
              <fieldset>
                <legend>Danh sách chuẩn bị</legend>
                <p>Kiểm tra tại trình duyệt. Chưa bắt đầu tính giờ.</p>
                <label className="exam-check">
                  <input
                    ref={scopeCheck}
                    type="checkbox"
                    checked={checks.scope}
                    onChange={(event) => toggle('scope', event.target.checked)}
                    aria-describedby={error && !checks.scope ? 'readiness-error' : undefined}
                    aria-invalid={Boolean(error && !checks.scope)}
                  />
                  <span>
                    <strong>Tôi đã kiểm tra chế độ và các Part</strong>
                    <small>Số câu và thời lượng ở phần tổng quan đúng với lựa chọn của tôi.</small>
                  </span>
                </label>
                <label className="exam-check">
                  <input
                    ref={timeCheck}
                    type="checkbox"
                    checked={checks.time}
                    onChange={(event) => toggle('time', event.target.checked)}
                    aria-describedby={error && !checks.time ? 'readiness-error' : undefined}
                    aria-invalid={Boolean(error && !checks.time)}
                  />
                  <span>
                    <strong>Tôi đã dành đủ thời gian và không gian yên tĩnh</strong>
                    <small>Phiên thật sẽ có giới hạn thời gian, kể cả chế độ luyện tập.</small>
                  </span>
                </label>
                {summary.listeningCount > 0 && (
                  <label className="exam-check">
                    <input
                      ref={audioCheck}
                      type="checkbox"
                      checked={checks.audio}
                      onChange={(event) => toggle('audio', event.target.checked)}
                      aria-describedby={error && !checks.audio ? 'readiness-error' : undefined}
                      aria-invalid={Boolean(error && !checks.audio)}
                    />
                    <span>
                      <strong>Tôi đã chuẩn bị tai nghe hoặc loa</strong>
                      <small>
                        Bản demo dùng giọng tổng hợp minh họa, không phải audio ETS chính thức. Hãy
                        kiểm tra âm lượng thiết bị trước khi làm bài.
                      </small>
                    </span>
                  </label>
                )}
              </fieldset>
              {error && (
                <div id="readiness-error">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}
              <Button type="submit">
                Kiểm tra chuẩn bị <Icon name="check" width="17" />
              </Button>
              {confirmed && (
                <div ref={confirmation} tabIndex={-1} className="exam-verified">
                  <Alert>
                    <strong>Lựa chọn hợp lệ trong bản demo.</strong>
                    <p>
                      Bạn đã hoàn tất bước chuẩn bị tại trình duyệt. Chưa tạo phiên làm bài hoặc lưu
                      dữ liệu lên server.
                    </p>
                  </Alert>
                </div>
              )}
            </form>
          </Panel>
          <Panel className="exam-instructions">
            <SectionHeading title="Lưu ý cho phiên thi thật" />
            <ul>
              <li>Cần đăng nhập bằng tài khoản học viên trước khi tạo phiên.</li>
              <li>
                Phạm vi và thời lượng sẽ được server xác nhận khi bắt đầu. Sau đó, không thể đổi
                Part trong phiên.
              </li>
              <li>
                {summary.toeicEligible
                  ? 'Phiên thi thử này có đủ hai kỹ năng và toàn bộ đề theo điều kiện quy đổi điểm trong đặc tả.'
                  : 'Lựa chọn này không quy đổi điểm TOEIC; chỉ báo số câu đúng và tỷ lệ đúng theo Part.'}
              </li>
            </ul>
          </Panel>
        </div>
        <aside className="exam-side-column">
          <SelectionSummary test={test} selection={selection}>
            <ExamStart test={test} selection={selection} query={query} confirmed={confirmed} />
          </SelectionSummary>
        </aside>
      </div>
    </>
  );
}
