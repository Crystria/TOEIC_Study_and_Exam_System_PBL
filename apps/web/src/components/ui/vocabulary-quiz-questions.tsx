'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';
import { Panel } from './panel';

type QuizQuestion = {
  id: string;
  prompt: string;
  confirmation?: boolean;
  pronunciation?: string | null;
  partOfSpeech?: string | null;
  options: readonly { id: string; label: string }[];
};

export function VocabularyQuizQuestions({
  questions,
  answers,
  onAnswer,
  onSubmit,
  disabled = false,
  busy = false,
  answersLocked = false,
  submitLabel = 'Nộp quiz',
}: {
  questions: readonly QuizQuestion[];
  answers: Readonly<Record<string, string | undefined>>;
  onAnswer: (questionId: string, optionId: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  answersLocked?: boolean;
  submitLabel?: string;
}) {
  const [position, setPosition] = useState(0);
  const question = questions[position];
  const heading = useRef<HTMLHeadingElement>(null);
  const positionId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, [question?.id]);

  if (!question) return <p role="status">Quiz này chưa có câu hỏi.</p>;

  const answered = questions.filter((item) =>
    item.options.some((option) => option.id === answers[item.id]),
  ).length;
  const last = position === questions.length - 1;
  const canSubmit = last && answered === questions.length && !busy && !disabled;
  const hasAnswer = question.options.some((option) => option.id === answers[question.id]);
  const wordDetails = !question.confirmation
    ? [question.partOfSpeech, question.pronunciation].filter(Boolean).join(' ')
    : '';

  return (
    <form
      aria-label="Quiz từ vựng"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <div className="quiz-progress">
        <span id={positionId}>
          Câu {position + 1}/{questions.length}
        </span>
        <span aria-live="polite">
          {answered}/{questions.length} câu đã trả lời
        </span>
      </div>
      <Panel className="quiz-question">
        <h3
          ref={heading}
          tabIndex={-1}
          lang={question.confirmation ? undefined : 'en'}
          aria-describedby={positionId}
        >
          {question.prompt}
        </h3>
        {wordDetails && <p className="quiz-word-details">{wordDetails}</p>}
        <fieldset
          className="quiz-fieldset"
          disabled={disabled || busy || answersLocked}
          key={question.id}
        >
          <legend className="sr-only">
            {question.confirmation ? 'Chọn đáp án' : 'Chọn nghĩa tiếng Việt'}
          </legend>
          <div className="quiz-options">
            {question.options.map((option, index) => {
              const selected = answers[question.id] === option.id;
              return (
                <label
                  className={selected ? 'quiz-option quiz-option--selected' : 'quiz-option'}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={selected}
                    onChange={() => onAnswer(question.id, option.id)}
                  />
                  <span className="quiz-option-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Panel>
      <div className="quiz-submit">
        <Button
          variant="secondary"
          disabled={position === 0 || busy}
          onClick={() => setPosition(position - 1)}
        >
          Câu trước
        </Button>
        {last ? (
          <Button key="submit" type="submit" loading={busy} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        ) : (
          <Button
            key="next"
            disabled={!hasAnswer || busy}
            onClick={() => setPosition(position + 1)}
          >
            Tiếp theo
          </Button>
        )}
      </div>
    </form>
  );
}
