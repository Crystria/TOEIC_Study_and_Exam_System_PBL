'use client';
import { useEffect, useRef } from 'react';
import type {
  ExamGroup,
  ExamQuestionSet,
  LocalExamSession,
  SessionAction,
} from '@/lib/exams/session-types';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Panel } from '../ui/panel';
import { ExamMedia } from './exam-media';
import type { QuestionReview } from '@/lib/exams/result-types';

export function ExamQuestionGroup({
  group,
  set,
  session,
  locked,
  dispatch,
  preview,
  readOnly = false,
  solutions,
  visibleQuestionIds,
}: {
  group: ExamGroup;
  set: ExamQuestionSet;
  session: Pick<
    LocalExamSession,
    'currentQuestionId' | 'answers' | 'flaggedIds' | 'highlightedIds'
  >;
  locked: boolean;
  dispatch: (action: SessionAction) => void;
  preview?: string;
  readOnly?: boolean;
  solutions?: Record<string, QuestionReview> | null;
  visibleQuestionIds?: string[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const previousGroup = useRef<string | null>(null);
  const previousQuestion = useRef<string | null>(null);
  useEffect(() => {
    if (readOnly) return;
    if (
      previousQuestion.current === session.currentQuestionId &&
      previousGroup.current === group.id
    )
      return;
    const selector =
      previousGroup.current !== group.id
        ? '[data-group-heading]'
        : '[data-current-question="true"] h2';
    container.current?.querySelector<HTMLElement>(selector)?.focus();
    previousGroup.current = group.id;
    previousQuestion.current = session.currentQuestionId;
  }, [session.currentQuestionId, group.id, readOnly]);
  const questions = set.questions.filter(
    (question) =>
      group.questionIds.includes(question.id) &&
      (!visibleQuestionIds || visibleQuestionIds.includes(question.id)),
  );
  return (
    <div ref={container} className="player-group">
      <Panel className="player-stimulus">
        <div className="player-group-title">
          <span className="eyebrow">NỘI DUNG NHÓM CÂU</span>
          <h2 data-group-heading tabIndex={-1}>
            {group.title}
          </h2>
          <p>
            {readOnly
              ? group.instruction.replace(' Bạn có thể tô sáng từng đoạn để xem lại.', '')
              : group.instruction}
          </p>
        </div>
        <ExamMedia
          key={group.id}
          group={group}
          locked={readOnly ? false : locked}
          preview={preview}
          stopKey={session.currentQuestionId}
        />
        {group.passages.map((passage) => (
          <article key={passage.id} className="player-passage">
            <h3>{passage.title}</h3>
            {passage.paragraphs.map((text, index) => {
              const id = `${passage.id}:${index}`;
              const highlighted = session.highlightedIds.includes(id);
              return (
                <div key={id} className={`player-paragraph ${highlighted ? 'is-highlighted' : ''}`}>
                  <p>{text}</p>
                  {!readOnly && (
                    <button
                      type="button"
                      className="player-highlight"
                      disabled={locked}
                      aria-pressed={highlighted}
                      aria-label={`${highlighted ? 'Bỏ tô sáng' : 'Tô sáng'} đoạn ${index + 1}: ${passage.title}`}
                      onClick={() => dispatch({ type: 'highlight', paragraphId: id })}
                    >
                      <Icon name="eye" width="15" />
                      {highlighted ? 'Bỏ tô sáng' : 'Tô sáng đoạn'}
                    </button>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </Panel>
      {questions.map((question) => (
        <Panel
          className={`player-question ${session.currentQuestionId === question.id ? 'is-current' : ''}`}
          key={question.id}
          data-current-question={session.currentQuestionId === question.id}
        >
          <div className="player-question-heading">
            <h2 tabIndex={-1}>Câu {question.number}</h2>
            {readOnly ? (
              <span className="review-flag">
                {session.flaggedIds.includes(question.id) ? 'Đã đánh dấu' : 'Không đánh dấu'}
              </span>
            ) : (
              <button
                type="button"
                className={`player-flag ${session.flaggedIds.includes(question.id) ? 'is-flagged' : ''}`}
                disabled={locked}
                aria-pressed={session.flaggedIds.includes(question.id)}
                aria-label={`${session.flaggedIds.includes(question.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'} câu ${question.number}`}
                onClick={() => dispatch({ type: 'flag', questionId: question.id })}
              >
                <Icon name="target" width="17" />
                {session.flaggedIds.includes(question.id) ? 'Đã đánh dấu' : 'Xem lại'}
              </button>
            )}
          </div>
          <p className="player-question-prompt">{question.prompt}</p>
          {readOnly ? (
            <>
              <p className="review-answer-summary">
                {session.answers[question.id]
                  ? `Lựa chọn đã lưu: ${session.answers[question.id]}`
                  : 'Bỏ trống'}
                {' · '}
                {solutions?.[question.id]
                  ? { correct: 'Đúng', incorrect: 'Sai', unanswered: 'Bỏ trống' }[
                      solutions[question.id].outcome
                    ]
                  : 'Chưa được chấm'}
              </p>
              <ul
                className="player-options review-options"
                aria-label={`Các phương án câu ${question.number}`}
              >
                {question.options.map((option) => (
                  <li
                    key={option.key}
                    className={`player-option ${session.answers[question.id] === option.key ? 'is-selected' : ''} ${solutions?.[question.id]?.correctOption === option.key ? 'review-correct' : ''}`}
                  >
                    <span className="player-option-key">{option.key}</span>
                    <span>{option.text}</span>
                    <span className="review-option-label">
                      {session.answers[question.id] === option.key && 'Đã chọn'}
                      {solutions?.[question.id]?.correctOption === option.key &&
                        `${session.answers[question.id] === option.key ? ' · ' : ''}Đáp án đúng (mẫu)`}
                    </span>
                  </li>
                ))}
              </ul>
              {solutions?.[question.id] && (
                <div className="review-solution">
                  <h3>Lời giải minh họa</h3>
                  <p>{solutions[question.id].explanation ?? 'Chưa có lời giải cho câu này.'}</p>
                  {solutions[question.id].transcript && (
                    <>
                      <h3>Transcript minh họa</h3>
                      <p>{solutions[question.id].transcript}</p>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <fieldset disabled={locked} className="player-options">
              <legend className="sr-only">Đáp án câu {question.number}</legend>
              {question.options.map((option) => (
                <label
                  className={`player-option ${session.answers[question.id] === option.key ? 'is-selected' : ''}`}
                  key={option.key}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.key}
                    checked={session.answers[question.id] === option.key}
                    onChange={() =>
                      dispatch({ type: 'answer', questionId: question.id, option: option.key })
                    }
                  />
                  <span className="player-option-key">{option.key}</span>
                  <span>{option.text}</span>
                </label>
              ))}
            </fieldset>
          )}
          {!readOnly && session.answers[question.id] && (
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => dispatch({ type: 'clear', questionId: question.id })}
              aria-label={`Xóa lựa chọn câu ${question.number}`}
            >
              Xóa lựa chọn
            </Button>
          )}
        </Panel>
      ))}
    </div>
  );
}
