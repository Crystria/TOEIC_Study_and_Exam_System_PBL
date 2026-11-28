'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { attemptElapsedSeconds, type ServerAttempt } from '../../lib/integration/attempt-contract';
import { failureMessage, mutationOutcomeUnknown } from '../../lib/integration/client';
import { examApi } from '../../lib/integration/repositories';
import { Icon } from '../ui/icon';
import { AttemptReviewDialog } from './attempt-review-dialog';

function elapsedLabel(seconds: number | null) {
  if (seconds === null) return 'Chưa có dữ liệu';
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export function ServerAttemptResult({
  attempt: a,
  writes,
  review = false,
}: {
  attempt: ServerAttempt;
  writes: boolean;
  review?: boolean;
}) {
  const router = useRouter();
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [retakeError, setRetakeError] = useState('');
  const [retakeUncertain, setRetakeUncertain] = useState(false);
  const retakeLock = useRef(false);
  const retakeKey = useRef<string>();
  const retake = async () => {
    if (retakeLock.current || !writes) return;
    retakeLock.current = true;
    setRetaking(true);
    setRetakeError('');
    retakeKey.current ??= crypto.randomUUID();
    try {
      const next = await examApi.start(
        a.testId,
        a.mode,
        [...a.parts],
        a.durationSeconds,
        retakeKey.current,
      );
      router.push(
        `/exam/server/${next.status === 'IN_PROGRESS' ? 'take' : 'result'}?attempt=${encodeURIComponent(next.attemptId)}`,
      );
    } catch (caught) {
      setRetakeError(failureMessage(caught));
      const uncertain = mutationOutcomeUnknown(caught);
      setRetakeUncertain(uncertain);
      if (!uncertain) retakeKey.current = undefined;
      retakeLock.current = false;
      setRetaking(false);
    }
  };
  useEffect(() => {
    if (review) document.getElementById('attempt-answers')?.scrollIntoView();
  }, [review]);
  const answers = new Map(a.answers.map((answer) => [answer.questionId, answer]));
  const questions = [...a.questions].sort((left, right) => left.orderNo - right.orderNo);
  const parts = [...new Set(questions.map((q) => q.part))].sort((left, right) => left - right);
  const completeSnapshot = questions.length === a.totalQuestions && a.totalQuestions > 0;
  const blank = completeSnapshot
    ? questions.filter((q) => !answers.get(q.id)?.selectedOption).length
    : null;
  const hasUnknownGrade = questions.some(
    (q) => answers.get(q.id)?.isCorrect == null && !q.correctOption,
  );
  const wrong =
    a.totalCorrect !== null && blank !== null && !hasUnknownGrade
      ? Math.max(0, a.totalQuestions - a.totalCorrect - blank)
      : null;
  const started = new Date(a.startedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  return (
    <div className="attempt-result">
      <header className="attempt-result-heading">
        <p className="attempt-result-eyebrow">KẾT QUẢ BÀI LÀM</p>
        <h1>{a.title}</h1>
        <p className="attempt-result-meta">
          <span>
            {a.mode === 'FULL' ? 'Thi thử Full Test' : `Luyện Part ${a.parts.join(', ')}`}
          </span>
          <span>
            {a.status === 'EXPIRED'
              ? 'Đã hết giờ'
              : a.status === 'IN_PROGRESS'
                ? 'Lượt chỉ đọc'
                : 'Đã nộp bài'}
          </span>
          <span>{started} (GMT+7)</span>
        </p>
        <div className="attempt-result-actions">
          <Link className="attempt-result-button is-primary" href="#attempt-answers">
            <Icon name="eye" width={17} /> Xem đáp án
          </Link>
          <button
            type="button"
            className="attempt-result-button"
            disabled={!writes || retaking}
            aria-busy={retaking || undefined}
            onClick={() => void retake()}
          >
            <Icon name="refresh" width={17} />{' '}
            {retaking
              ? 'Đang mở bài làm…'
              : retakeUncertain
                ? 'Thử mở lại bài làm'
                : 'Làm lại đề này'}
          </button>
        </div>
        {retakeError && (
          <p className="api-error" role="alert">
            {retakeError}
            {retakeUncertain && ' Bấm thử lại để tiếp tục cùng yêu cầu làm lại.'}
          </p>
        )}
        {!writes && <p>Chức năng tạo bài làm mới đang tạm tắt.</p>}
      </header>

      <section className="attempt-result-overview" aria-label="Tổng quan kết quả">
        <div className="attempt-result-stats">
          <div className="attempt-result-stat is-correct">
            <span>
              <Icon name="check" width={18} /> Trả lời đúng
            </span>
            <strong>
              {a.totalCorrect ?? '—'}
              <small>/{a.totalQuestions}</small>
            </strong>
          </div>
          <div className="attempt-result-stat is-wrong">
            <span>
              <Icon name="close" width={18} /> Trả lời sai
            </span>
            <strong>{wrong ?? '—'}</strong>
          </div>
          <div className="attempt-result-stat">
            <span>
              <Icon name="clipboard" width={18} /> Bỏ trống
            </span>
            <strong>{blank ?? '—'}</strong>
          </div>
          <div className="attempt-result-stat is-accuracy">
            <span>
              <Icon name="target" width={18} /> Độ chính xác
            </span>
            <strong>{a.accuracy === null ? '—' : `${(a.accuracy * 100).toFixed(1)}%`}</strong>
          </div>
        </div>
        <div className="attempt-result-facts">
          <span>
            <Icon name="clock" width={18} /> Thời gian làm bài:{' '}
            <strong>{elapsedLabel(attemptElapsedSeconds(a))}</strong>
          </span>
          {a.mode === 'FULL' ? (
            <div className="attempt-result-scores">
              <span>
                Listening <strong>{a.scoreListening ?? '—'}</strong>
              </span>
              <span>
                Reading <strong>{a.scoreReading ?? '—'}</strong>
              </span>
              <span>
                Tổng điểm{' '}
                <strong>
                  {a.score ?? '—'}
                  <small>/990</small>
                </strong>
              </span>
            </div>
          ) : (
            <span>Luyện Part không quy đổi điểm TOEIC.</span>
          )}
        </div>
        {a.mode === 'FULL' && a.scoreDisclaimer && (
          <p className="attempt-result-disclaimer">{a.scoreDisclaimer}</p>
        )}
      </section>

      <section
        className="attempt-result-answers"
        id="attempt-answers"
        aria-labelledby="attempt-answers-title"
      >
        <div className="attempt-result-answer-heading">
          <h2 id="attempt-answers-title">Đáp án bài làm</h2>
          <div className="attempt-result-legend" aria-label="Ký hiệu kết quả">
            <span className="is-correct">
              <Icon name="check" width={15} /> Đúng
            </span>
            <span className="is-wrong">
              <Icon name="close" width={15} /> Sai
            </span>
            <span>— Bỏ trống</span>
            {hasUnknownGrade && <span>? Chưa chấm</span>}
          </div>
        </div>
        <div className="attempt-result-tip">
          <Icon name="info" width={20} />
          <p>
            Bấm <strong>[Chi tiết]</strong> để xem câu hỏi, đáp án đúng và giải thích. Đáp án đúng
            được in đậm; lựa chọn sai của bạn được gạch ngang.
          </p>
        </div>
        {a.readOnly && (
          <p className="attempt-result-notice">
            Lượt làm bài cũ chỉ hiển thị dữ liệu còn lưu. Một số câu hỏi hoặc đáp án có thể không có
            sẵn.
          </p>
        )}
        {!questions.length ? (
          <p className="attempt-result-empty">
            Chưa có nội dung câu hỏi để xem lại cho lượt làm bài này.
          </p>
        ) : (
          parts.map((part) => {
            const partQuestions = questions.filter((q) => q.part === part);
            const midpoint = Math.ceil(partQuestions.length / 2);
            return (
              <section
                className="attempt-result-part"
                key={part}
                aria-labelledby={`attempt-part-${part}`}
              >
                <h3 id={`attempt-part-${part}`}>Part {part}</h3>
                <div className="attempt-answer-columns">
                  {[partQuestions.slice(0, midpoint), partQuestions.slice(midpoint)].map(
                    (column, columnIndex) => (
                      <ol
                        className="attempt-answer-list"
                        key={columnIndex}
                        aria-label={`Đáp án Part ${part}, cột ${columnIndex + 1}`}
                      >
                        {column.map((q) => {
                          const answer = answers.get(q.id);
                          const selected = answer?.selectedOption;
                          const correct =
                            answer?.isCorrect ??
                            (q.correctOption ? selected === q.correctOption : null);
                          const outcome =
                            correct === null
                              ? 'Chưa có kết quả chấm'
                              : !selected
                                ? 'Bỏ trống'
                                : correct
                                  ? 'Trả lời đúng'
                                  : 'Trả lời sai';
                          return (
                            <li className="attempt-answer-row" key={q.id}>
                              <span className="attempt-answer-number">{q.orderNo}</span>
                              <span className="attempt-answer-pair">
                                <strong aria-label={`Đáp án đúng: ${q.correctOption ?? 'chưa có'}`}>
                                  {q.correctOption ?? '?'}
                                </strong>
                                <span aria-hidden="true">: </span>
                                <span aria-label={`Bạn chọn: ${selected ?? 'bỏ trống'}`}>
                                  {selected && correct === false ? (
                                    <s>{selected}</s>
                                  ) : (
                                    <em>{selected ?? '—'}</em>
                                  )}
                                </span>
                              </span>
                              <span
                                className={`attempt-answer-outcome ${correct === null ? 'is-unknown' : correct ? 'is-correct' : 'is-wrong'}`}
                                role="img"
                                aria-label={outcome}
                              >
                                {correct === null ? (
                                  '?'
                                ) : (
                                  <Icon name={correct ? 'check' : 'close'} width={17} />
                                )}
                              </span>
                              <button
                                className="attempt-answer-detail"
                                aria-label={`Xem chi tiết câu ${q.orderNo}`}
                                onClick={() => setQuestionId(q.id)}
                              >
                                [Chi tiết]
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    ),
                  )}
                </div>
              </section>
            );
          })
        )}
      </section>
      <AttemptReviewDialog
        attempt={a}
        questionId={questionId}
        onClose={() => setQuestionId(null)}
        onNavigate={setQuestionId}
      />
    </div>
  );
}
