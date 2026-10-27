'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { filterReview } from '@/lib/exams/results';
import type { ReviewDocument, ReviewFilter } from '@/lib/exams/result-types';
import { Button, buttonStyles } from '../ui/button';
import { Alert, EmptyState } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { ExamQuestionGroup } from './exam-question-group';
import { ResultHeading } from './exam-result-shared';

const labels: Record<ReviewFilter, string> = {
  all: 'Tất cả',
  correct: 'Đúng',
  incorrect: 'Sai',
  unanswered: 'Bỏ trống',
  flagged: 'Đã đánh dấu',
};
const doNothing = () => {};
export function ExamReview({
  document,
  title,
  resultHref,
  preview,
}: {
  document: ReviewDocument;
  title: string;
  resultHref: string;
  preview?: string;
}) {
  const [part, setPart] = useState('all');
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedId, setSelectedId] = useState(document.set.questions[0]?.id);
  const moveFocus = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const filtered = filterReview(document, part, filter);
  const question = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const index = filtered.findIndex((item) => item.id === question?.id);
  const group = document.set.groups.find((item) => item.id === question?.groupId);
  const parts = [...new Set(document.set.questions.map((item) => item.partId))];
  useEffect(() => {
    if (moveFocus.current) {
      content.current?.querySelector<HTMLElement>('[data-current-question="true"] h2')?.focus();
      moveFocus.current = false;
    }
  }, [question?.id]);
  const navigate = (id: string) => {
    moveFocus.current = true;
    if (id === question?.id) {
      content.current?.querySelector<HTMLElement>('[data-current-question="true"] h2')?.focus();
      moveFocus.current = false;
    }
    setSelectedId(id);
  };
  const clear = () => {
    setPart('all');
    setFilter('all');
  };
  return (
    <div className="exam-page exam-outcome exam-review">
      <Link href={resultHref} className="exam-back">
        ← Về thông tin kết quả
      </Link>
      <ResultHeading
        title={document.source === 'example' ? 'Xem lại ví dụ Reading' : 'Xem lại lựa chọn đã lưu'}
        description={title}
      />
      <Alert>
        <strong>
          {document.source === 'example'
            ? 'Lựa chọn, đáp án và lời giải bên dưới đều là mẫu riêng.'
            : 'Phiên này chưa được server chấm.'}
        </strong>
        <p>
          {document.source === 'example'
            ? 'Đây là ví dụ 10 câu Reading để xem giao diện đúng/sai/bỏ trống. Không gắn với phiên của bạn, không lưu vào lịch sử và không có điểm TOEIC.'
            : 'Chỉ hiển thị lựa chọn và đánh dấu đã lưu. Chưa có đáp án đúng, transcript hoặc lời giải; bộ lọc đúng/sai chưa khả dụng.'}
        </p>
      </Alert>
      <Panel className="result-panel review-filter-panel">
        <div className="result-filters review-filters">
          <label>
            Part
            <select
              aria-label="Part"
              value={part}
              onChange={(event) => setPart(event.target.value)}
            >
              <option value="all">Tất cả Part</option>
              {parts.map((id) => (
                <option key={id} value={id}>
                  Part {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trạng thái câu
            <select
              aria-label="Trạng thái câu"
              value={filter}
              onChange={(event) => setFilter(event.target.value as ReviewFilter)}
            >
              {Object.entries(labels).map(([key, label]) => (
                <option
                  key={key}
                  value={key}
                  disabled={!document.solutions && (key === 'correct' || key === 'incorrect')}
                >
                  {label}
                  {!document.solutions && (key === 'correct' || key === 'incorrect')
                    ? ' · chưa chấm'
                    : ''}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" onClick={clear}>
            Xóa bộ lọc
          </Button>
        </div>
        <p role="status" className="result-muted">
          {filtered.length} / {document.set.questions.length} câu phù hợp · Chỉ đọc
        </p>
      </Panel>
      {!question || !group ? (
        <Panel>
          <EmptyState
            title="Không có câu phù hợp"
            description="Thử Part hoặc trạng thái khác để xem lại câu hỏi."
          >
            <Button onClick={clear}>Hiện tất cả câu</Button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="review-grid">
          <div ref={content}>
            <ExamQuestionGroup
              group={group}
              set={document.set}
              session={{
                currentQuestionId: question.id,
                answers: document.answers,
                flaggedIds: document.flaggedIds,
                highlightedIds: document.highlightedIds,
              }}
              locked
              readOnly
              dispatch={doNothing}
              solutions={document.solutions}
              visibleQuestionIds={filtered.map((item) => item.id)}
              preview={preview}
            />
            <nav className="player-question-nav" aria-label="Chuyển câu xem lại">
              <Button
                variant="secondary"
                disabled={index <= 0}
                onClick={() => navigate(filtered[index - 1].id)}
              >
                Câu trước
              </Button>
              <span>
                {index + 1} / {filtered.length}
              </span>
              <Button
                disabled={index === filtered.length - 1}
                onClick={() => navigate(filtered[index + 1].id)}
              >
                Câu tiếp
              </Button>
            </nav>
          </div>
          <Panel className="result-panel review-map">
            <h2>Đi đến câu</h2>
            <p className="result-muted">
              Số câu giữ theo đề gốc. Bộ lọc áp dụng cả nhóm câu và bảng này.
            </p>
            <nav className="review-map-grid" aria-label="Câu hỏi xem lại">
              {filtered.map((item) => {
                const state = document.solutions?.[item.id]?.outcome;
                const label = state
                  ? labels[state]
                  : document.answers[item.id]
                    ? 'Đã trả lời · chưa chấm'
                    : 'Bỏ trống · chưa chấm';
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`review-map-button ${state ? `review-${state}` : ''}`}
                    aria-current={question.id === item.id ? 'step' : undefined}
                    aria-label={`Câu ${item.number}, Part ${item.partId}, ${label}${document.flaggedIds.includes(item.id) ? ', đã đánh dấu' : ''}`}
                    onClick={() => navigate(item.id)}
                  >
                    {item.number}
                    {document.flaggedIds.includes(item.id) && <span aria-hidden="true">*</span>}
                  </button>
                );
              })}
            </nav>
          </Panel>
        </div>
      )}
      <div className="result-actions">
        <Link href={resultHref} className={buttonStyles('secondary')}>
          Về thông tin kết quả
        </Link>
        <Link href="/history" className={buttonStyles('ghost')}>
          Lịch sử demo
        </Link>
      </div>
    </div>
  );
}
