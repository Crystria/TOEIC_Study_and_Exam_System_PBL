'use client';
/* eslint-disable @next/next/no-img-element -- Snapshot media URLs are validated by the API adapter. */
import { useEffect, useRef, useState } from 'react';
import type { AttemptChoices, ServerAttempt } from '../../lib/integration/attempt-contract';
import { formatPassageBlanks } from '../../lib/exams/passage';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { ExamToolbar, useExamHighlights } from '../exams/exam-toolbar';
import { ExamMobileBar } from '../exams/exam-mobile-bar';

type Question = ServerAttempt['questions'][number];

export function ServerExamTaking({
  attempt: a,
  choices,
  flagged,
  seconds,
  editable,
  writes,
  busy,
  dirty,
  uncertain,
  message,
  error,
  onAnswer,
  onFlag,
  onSave,
  onReload,
  onSubmit,
  onExit,
}: {
  attempt: ServerAttempt;
  choices: AttemptChoices;
  flagged: string[];
  seconds: number;
  editable: boolean;
  writes: boolean;
  busy: boolean;
  dirty: boolean;
  uncertain: boolean;
  message: string;
  error: string;
  onAnswer: (id: string, option: string | null) => void;
  onFlag: (id: string) => void;
  onSave: () => void;
  onReload: () => void;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const parts = [...new Set(a.questions.map((q) => q.part))].sort((x, y) => x - y);
  const [part, setPart] = useState(parts[0] ?? 1);
  const [currentId, setCurrentId] = useState(a.questions[0]?.id);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const content = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<string | null>(null);
  const { onMouseUp } = useExamHighlights(highlightEnabled);
  const partQuestions = a.questions.filter((q) => q.part === part);
  const current = partQuestions.find((q) => q.id === currentId) ?? partQuestions[0];
  const audioGroup = a.groups.find((g) => g.id === current?.groupId);
  const audioSource =
    current?.audioUrl ??
    audioGroup?.audioUrl ??
    audioGroup?.assets.find((asset) => asset.kind === 'AUDIO')?.url;
  const audioQuestions = audioGroup
    ? partQuestions.filter((q) => q.groupId === audioGroup.id)
    : current
      ? [current]
      : [];
  const audioLabel = audioQuestions.length
    ? `Audio câu ${audioQuestions[0].orderNo}${audioQuestions.length > 1 ? `–${audioQuestions[audioQuestions.length - 1].orderNo}` : ''}`
    : 'Audio bài nghe';
  const groups = [...new Set(partQuestions.map((q) => q.groupId ?? q.id))].map((key) => ({
    key,
    group: a.groups.find((g) => g.id === key),
    questions: partQuestions.filter((q) => (q.groupId ?? q.id) === key),
  }));
  const answered = Object.values(choices).filter(Boolean).length;
  const partIndex = parts.indexOf(part);

  useEffect(() => {
    if (!pendingScroll.current) return;
    const node = document.getElementById(`exam-question-${pendingScroll.current}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node?.focus({ preventScroll: true });
    pendingScroll.current = null;
  }, [part, currentId]);

  const navigate = (q: Question) => {
    if (q.id === currentId && q.part === part) {
      const node = document.getElementById(`exam-question-${q.id}`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node?.focus({ preventScroll: true });
    } else pendingScroll.current = q.id;
    setPart(q.part);
    setCurrentId(q.id);
  };
  const changePart = (next: number) => {
    const first = a.questions.find((q) => q.part === next);
    if (!first) return;
    setPart(next);
    setCurrentId(first.id);
    content.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const renderQuestion = (q: Question) => (
    <article
      key={q.id}
      id={`exam-question-${q.id}`}
      className={`reference-exam-question ${q.id === currentId ? 'is-current' : ''} ${q.part <= 2 || q.part === 6 ? 'is-options-only' : ''}`}
      tabIndex={-1}
      onFocus={() => setCurrentId(q.id)}
    >
      {q.imageUrl && (
        <img className="reference-exam-image" src={q.imageUrl} alt={`Hình câu ${q.orderNo}`} />
      )}
      <div className="reference-exam-question-heading">
        <button
          type="button"
          className={`reference-exam-number ${flagged.includes(q.id) ? 'is-flagged' : ''}`}
          aria-pressed={flagged.includes(q.id)}
          aria-label={`${flagged.includes(q.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'} câu ${q.orderNo}`}
          onClick={() => onFlag(q.id)}
        >
          {q.orderNo}
        </button>
        {q.part > 2 && q.part !== 6 && (
          <div className="reference-exam-prompt" data-highlightable>
            <LessonMarkdown content={q.text} idPrefix={`question-${q.id}-`} />
          </div>
        )}
      </div>
      <fieldset className="reference-exam-options" disabled={!editable}>
        <legend className="sr-only">Đáp án câu {q.orderNo}</legend>
        {q.options.map((option) => (
          <label key={option.code} className={choices[q.id] === option.code ? 'is-selected' : ''}>
            <input
              type="radio"
              name={`answer-${q.id}`}
              value={option.code}
              checked={choices[q.id] === option.code}
              onChange={() => {
                setCurrentId(q.id);
                onAnswer(q.id, option.code);
              }}
            />
            <span data-highlightable>
              {option.code}.{q.part > 2 && ` ${option.text}`}
            </span>
          </label>
        ))}
      </fieldset>
      {choices[q.id] && (
        <button
          type="button"
          className="reference-exam-clear"
          disabled={!editable}
          aria-label={`Xóa lựa chọn câu ${q.orderNo}`}
          onClick={() => onAnswer(q.id, null)}
        >
          Xóa lựa chọn
        </button>
      )}
    </article>
  );

  return (
    <div className="reference-exam">
      <header className="reference-exam-header">
        <h1 className="reference-exam-title">{a.title}</h1>
        <button type="button" className="reference-exam-exit" disabled={busy} onClick={onExit}>
          Thoát
        </button>
      </header>
      <div className="reference-exam-layout">
        <section className="reference-exam-main" aria-label={`Nội dung Part ${part}`}>
          <ExamToolbar
            audioSource={part <= 4 ? audioSource : undefined}
            audioLabel={audioLabel}
            highlightEnabled={highlightEnabled}
            onHighlightChange={() => setHighlightEnabled((v) => !v)}
            locked={seconds === 0}
          />
          <nav className="reference-exam-tabs" aria-label="Các phần của đề thi">
            {parts.map((value) => (
              <button
                key={value}
                type="button"
                className={part === value ? 'is-active' : ''}
                aria-current={part === value ? 'page' : undefined}
                onClick={() => changePart(value)}
              >
                Part {value}
              </button>
            ))}
          </nav>
          <div className="reference-exam-content" ref={content} onMouseUp={onMouseUp}>
            {!writes && (
              <p className="api-error">Chế độ chỉ đọc. Không thể lưu đáp án hoặc nộp bài.</p>
            )}
            {groups.map(({ key, group, questions }) => {
              const hasPassage = Boolean(
                group?.passage ||
                group?.assets.some((asset) => asset.content || asset.kind === 'IMAGE'),
              );
              const reading = part >= 6 && hasPassage;
              const assets = group?.assets.filter((asset) => asset.kind !== 'AUDIO') ?? [];
              return (
                <section
                  className={`reference-exam-group ${reading ? 'reference-exam-reading' : ''}`}
                  data-part={part}
                  key={key}
                  aria-label={`Nhóm câu ${questions[0].orderNo}${questions.length > 1 ? `–${questions[questions.length - 1].orderNo}` : ''}`}
                >
                  {hasPassage && (
                    <div className="reference-exam-passage" data-highlightable>
                      {group?.passage && (
                        <LessonMarkdown
                          content={
                            part === 6
                              ? formatPassageBlanks(group.passage, group.instruction)
                              : group.passage
                          }
                          idPrefix={`passage-${key}-`}
                        />
                      )}
                      {assets.map((asset) => (
                        <div key={asset.id}>
                          {asset.content && (
                            <LessonMarkdown
                              content={asset.content}
                              idPrefix={`asset-${asset.id}-`}
                            />
                          )}
                          {asset.kind === 'IMAGE' && asset.url && (
                            <img
                              className="reference-exam-image"
                              src={asset.url}
                              alt="Tài liệu nhóm câu hỏi"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="reference-exam-questions">{questions.map(renderQuestion)}</div>
                </section>
              );
            })}
          </div>
          <nav className="reference-exam-footer" aria-label="Chuyển phần thi">
            <button disabled={partIndex <= 0} onClick={() => changePart(parts[partIndex - 1])}>
              ‹ TRƯỚC ĐÓ
            </button>
            <button
              disabled={partIndex >= parts.length - 1}
              onClick={() => changePart(parts[partIndex + 1])}
            >
              TIẾP THEO ›
            </button>
          </nav>
        </section>
        <aside
          className="reference-exam-aside"
          id="exam-question-sidebar"
          tabIndex={-1}
          aria-label="Thời gian và bảng câu hỏi"
        >
          <div className={`reference-exam-timer ${seconds <= 60 ? 'is-urgent' : ''}`}>
            <span>Thời gian còn lại:</span>
            <strong role="timer" aria-label="Thời gian còn lại" aria-live="off">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </strong>
          </div>
          <button className="reference-exam-submit" disabled={busy || !writes} onClick={onSubmit}>
            {busy ? 'ĐANG XỬ LÝ…' : uncertain ? 'THỬ NỘP LẠI' : 'NỘP BÀI'}
          </button>
          <details className="reference-exam-save">
            <summary>Khôi phục/lưu bài làm</summary>
            <p>Đáp án tự động lưu theo tài khoản. Có thể tiếp tục từ lịch sử làm bài.</p>
            <button disabled={!editable || !dirty} onClick={onSave}>
              Lưu nháp
            </button>
            <button disabled={busy || dirty} onClick={onReload}>
              Khôi phục bản đã lưu
            </button>
            {dirty && <p>Lưu thay đổi trước khi khôi phục để giữ lựa chọn.</p>}
          </details>
          <p className="reference-exam-review-note">
            Chú ý: bạn có thể click vào số thứ tự câu hỏi trong bài để đánh dấu review
          </p>
          <p className="reference-exam-progress">
            Đã trả lời {answered}/{a.totalQuestions} câu
          </p>
          <div className="reference-exam-status" role="status">
            {message || 'Đáp án được tự động lưu trong khi làm bài.'}
          </div>
          {error && (
            <p role="alert" className="api-error">
              {error}
            </p>
          )}
          {uncertain && (
            <p>Đang giữ lựa chọn. Thử nộp lại để kiểm tra kết quả trước khi chỉnh sửa.</p>
          )}
          <label className="reference-exam-filter">
            Hiển thị câu hỏi
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">Tất cả</option>
              <option value="BLANK">Chưa trả lời</option>
              <option value="FLAGGED">Đánh dấu xem lại</option>
            </select>
          </label>
          <nav aria-label="Điều hướng câu hỏi">
            {parts.map((value) => (
              <section className="reference-exam-map-part" key={value}>
                <h2>Part {value}</h2>
                <div className="reference-exam-map-grid">
                  {a.questions
                    .filter(
                      (q) =>
                        q.part === value &&
                        (filter === 'ALL' ||
                          (filter === 'BLANK' ? !choices[q.id] : flagged.includes(q.id))),
                    )
                    .map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className={`${choices[q.id] ? 'is-answered' : ''} ${flagged.includes(q.id) ? 'is-flagged' : ''} ${q.id === currentId ? 'is-current' : ''}`}
                        aria-current={q.id === currentId ? 'step' : undefined}
                        aria-label={`Câu ${q.orderNo}, ${choices[q.id] ? 'đã trả lời' : 'chưa trả lời'}${flagged.includes(q.id) ? ', đánh dấu xem lại' : ''}`}
                        onClick={() => navigate(q)}
                      >
                        {q.orderNo}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>
      </div>
      <ExamMobileBar
        seconds={seconds}
        disabled={busy || !writes}
        submitLabel={busy ? 'Đang xử lý…' : uncertain ? 'Thử nộp lại' : 'Nộp bài'}
        onSubmit={onSubmit}
      />
    </div>
  );
}
