'use client';
import { useState } from 'react';
import type { ExamQuestionSet, LocalExamSession } from '@/lib/exams/session-types';

export function ExamQuestionMap({
  set,
  session,
  locked,
  onNavigate,
}: {
  set: ExamQuestionSet;
  session: LocalExamSession;
  locked: boolean;
  onNavigate: (questionId: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const answered = Object.keys(session.answers).length;
  const visible = set.questions.filter(
    (question) =>
      filter === 'all' ||
      (filter === 'unanswered'
        ? !session.answers[question.id]
        : session.flaggedIds.includes(question.id)),
  );
  return (
    <nav aria-label="Điều hướng câu hỏi">
      <p className="reference-exam-progress">
        Đã trả lời {answered}/{set.questions.length} câu
      </p>
      <label className="reference-exam-filter">
        <span className="sr-only">Lọc bảng câu hỏi</span>
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
      {visible.length ? (
        [...new Set(visible.map((question) => question.partId))].map((partId) => (
          <section key={partId} className="reference-exam-map-part">
            <h3>Part {partId}</h3>
            <div className="reference-exam-map-grid">
              {visible
                .filter((question) => question.partId === partId)
                .map((question) => (
                  <button
                    type="button"
                    key={question.id}
                    aria-label={`Câu ${question.number}, ${session.answers[question.id] ? 'đã trả lời' : 'chưa trả lời'}${session.flaggedIds.includes(question.id) ? ', đánh dấu xem lại' : ''}`}
                    aria-current={question.id === session.currentQuestionId ? 'step' : undefined}
                    className={`${session.answers[question.id] ? 'is-answered' : ''} ${session.flaggedIds.includes(question.id) ? 'is-flagged' : ''} ${question.id === session.currentQuestionId ? 'is-current' : ''}`}
                    onClick={() => onNavigate(question.id)}
                    disabled={locked}
                  >
                    {question.number}
                  </button>
                ))}
            </div>
          </section>
        ))
      ) : (
        <p role="status">Không có câu hỏi trong bộ lọc này.</p>
      )}
    </nav>
  );
}
