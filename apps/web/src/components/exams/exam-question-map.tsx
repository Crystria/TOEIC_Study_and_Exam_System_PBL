'use client';
import { useEffect, useState } from 'react';
import type { ExamQuestionSet, LocalExamSession, SessionAction } from '@/lib/exams/session-types';
import { Button } from '../ui/button';
import { Progress } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';

export function ExamQuestionMap({
  set,
  session,
  dispatch,
  locked,
  onEnd,
}: {
  set: ExamQuestionSet;
  session: LocalExamSession;
  dispatch: (action: SessionAction) => void;
  locked: boolean;
  onEnd: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setOpen(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const answered = Object.keys(session.answers).length;
  const visible = set.questions.filter(
    (question) =>
      filter === 'all' ||
      (filter === 'unanswered'
        ? !session.answers[question.id]
        : session.flaggedIds.includes(question.id)),
  );
  return (
    <Panel className="player-map">
      <h2>Tiến độ làm bài</h2>
      <div className="player-progress-count">
        <strong>
          {answered}
          <small> / {set.questions.length}</small>
        </strong>
        <span>câu đã trả lời</span>
      </div>
      <Progress value={answered} max={set.questions.length} label="Tiến độ trả lời" />
      <div className="player-map-stats">
        <span>{set.questions.length - answered} chưa trả lời</span>
        <span>{session.flaggedIds.length} đánh dấu</span>
      </div>
      <Button onClick={onEnd} disabled={locked} className="player-end-button">
        Kết thúc phiên demo
      </Button>
      <p className="player-local-note">Đáp án chỉ lưu trên trình duyệt. Chưa gửi lên server.</p>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          Bảng câu hỏi <Icon name="down" width="16" />
        </summary>
        <label className="player-map-filter">
          Hiển thị
          <select
            aria-label="Lọc bảng câu hỏi"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Tất cả câu hỏi</option>
            <option value="unanswered">Chưa trả lời</option>
            <option value="flagged">Đã đánh dấu xem lại</option>
          </select>
        </label>
        <div className="player-map-legend">
          <span>
            <i className="is-answered" />
            Đã trả lời
          </span>
          <span>
            <i className="is-flagged" />
            Xem lại
          </span>
          <span>
            <i className="is-current" />
            Đang xem
          </span>
        </div>
        {visible.length ? (
          [...new Set(visible.map((question) => question.partId))].map((partId) => (
            <div key={partId} className="player-map-part">
              <h3>Part {partId}</h3>
              <div className="player-map-grid">
                {visible
                  .filter((question) => question.partId === partId)
                  .map((question) => (
                    <button
                      type="button"
                      key={question.id}
                      aria-label={`Câu ${question.number}, ${session.answers[question.id] ? 'đã trả lời' : 'chưa trả lời'}${session.flaggedIds.includes(question.id) ? ', đánh dấu xem lại' : ''}`}
                      aria-current={question.id === session.currentQuestionId ? 'step' : undefined}
                      className={`${session.answers[question.id] ? 'is-answered' : ''} ${session.flaggedIds.includes(question.id) ? 'is-flagged' : ''} ${question.id === session.currentQuestionId ? 'is-current' : ''}`}
                      onClick={() => dispatch({ type: 'navigate', questionId: question.id })}
                      disabled={locked}
                    >
                      {question.number}
                      {session.flaggedIds.includes(question.id) && (
                        <span aria-hidden="true">•</span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p role="status" className="player-map-empty">
            Không có câu hỏi trong bộ lọc này.
          </p>
        )}
      </details>
    </Panel>
  );
}
