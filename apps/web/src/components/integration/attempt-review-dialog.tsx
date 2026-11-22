'use client';
/* eslint-disable @next/next/no-img-element -- Complete media URLs are supplied by the backend. */

import { useEffect, useId, useRef } from 'react';
import type { ServerAttempt } from '../../lib/integration/attempt-contract';
import { formatPassageBlanks } from '../../lib/exams/passage';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { AudioPlayer } from '../ui/audio-player';
import { Icon } from '../ui/icon';
import { useDialogBackdropDismiss } from '../ui/use-dialog-backdrop-dismiss';

type ReviewProps = {
  attempt: ServerAttempt;
  questionId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
};

export function AttemptReviewDialog(props: ReviewProps) {
  const question = props.attempt.questions.find((q) => q.id === props.questionId);
  if (!question) return null;
  return <OpenReviewDialog {...props} question={question} />;
}

function OpenReviewDialog({
  attempt,
  question,
  onClose,
  onNavigate,
}: ReviewProps & { question: ServerAttempt['questions'][number] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backdropDismiss = useDialogBackdropDismiss(onClose);
  const titleId = useId();
  const questions = [...attempt.questions].sort((a, b) => a.orderNo - b.orderNo);
  const index = questions.findIndex((q) => q.id === question.id);
  const group = attempt.groups.find((g) => g.id === question.groupId);
  const answer = attempt.answers.find((a) => a.questionId === question.id);
  const selected = answer?.selectedOption ?? null;
  const normalized = (value: string) => value.trim().replace(/\s+/g, ' ');
  const textSources = new Set(
    [group?.passage, group?.instruction, question.text]
      .filter((value): value is string => !!value)
      .map(normalized),
  );
  const assetTexts = (group?.assets ?? []).flatMap((asset) => {
    if (!asset.content || textSources.has(normalized(asset.content))) return [];
    textSources.add(normalized(asset.content));
    return [{ id: asset.id, content: asset.content }];
  });
  const audioSources = [
    group?.audioUrl,
    ...(group?.assets.filter((asset) => asset.kind === 'AUDIO').map((asset) => asset.url) ?? []),
    question.audioUrl,
  ].filter((value): value is string => !!value);
  const imageSources = [
    ...(group?.assets.filter((asset) => asset.kind === 'IMAGE').map((asset) => asset.url) ?? []),
    question.imageUrl,
  ].filter((value): value is string => !!value);
  const groupTranscript = group?.transcript?.trim();
  const questionTranscript = question.transcript?.trim();
  const hasStimulus =
    group?.instruction ||
    group?.passage ||
    groupTranscript ||
    assetTexts.length ||
    audioSources.length ||
    imageSources.length;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node?.showModal();
    closeButton.current?.focus();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [question.id]);

  return (
    <dialog
      ref={dialog}
      className="attempt-review-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      {...backdropDismiss}
    >
      <header className="attempt-review-dialog-header">
        <h2 id={titleId}>{attempt.title}</h2>
        <button
          ref={closeButton}
          className="attempt-review-dialog-close"
          type="button"
          aria-label="Đóng chi tiết câu hỏi"
          onClick={onClose}
        >
          <Icon name="close" width="22" height="22" />
        </button>
      </header>

      <div className="attempt-review-dialog-body" ref={body}>
        <div className="attempt-review-dialog-part">Part {question.part}</div>
        <div key={question.id}>
          {hasStimulus && (
            <section className="attempt-review-dialog-stimulus" aria-label="Nội dung câu hỏi">
              {group?.instruction && <LessonMarkdown content={group.instruction} />}
              {[...new Set(audioSources)].map((source, i) => (
                <AudioPlayer
                  key={source}
                  mode="server"
                  source={source}
                  label={`Audio câu ${question.orderNo}${audioSources.length > 1 ? ` · ${i + 1}` : ''}`}
                  missingMessage="Chưa có tệp nghe cho câu hỏi này."
                  stopKey={question.id}
                />
              ))}
              {[...new Set(imageSources)].map((source, i) => (
                <img
                  key={source}
                  src={source}
                  alt={`Tài liệu câu ${question.orderNo}${imageSources.length > 1 ? ` · ${i + 1}` : ''}`}
                />
              ))}
              {group?.passage && (
                <LessonMarkdown
                  content={
                    question.part === 6
                      ? formatPassageBlanks(group.passage, group.instruction)
                      : group.passage
                  }
                />
              )}
              {groupTranscript && <TranscriptDetails content={groupTranscript} />}
              {assetTexts.map((asset) => (
                <LessonMarkdown key={asset.id} content={asset.content} />
              ))}
            </section>
          )}

          <section
            className="attempt-review-dialog-question"
            aria-label={`Câu ${question.orderNo}`}
          >
            <div className="attempt-review-dialog-question-heading">
              <h3 aria-live="polite">Câu {question.orderNo}</h3>
              <span
                className={`attempt-review-dialog-answer-state ${
                  !selected
                    ? 'is-blank'
                    : question.correctOption
                      ? selected === question.correctOption
                        ? 'is-correct'
                        : 'is-wrong'
                      : ''
                }`}
              >
                {!selected
                  ? 'Bạn chưa trả lời'
                  : question.correctOption
                    ? selected === question.correctOption
                      ? 'Trả lời đúng'
                      : 'Trả lời sai'
                    : 'Đã trả lời'}
              </span>
            </div>
            <LessonMarkdown content={question.text} />
            <ul className="attempt-review-dialog-options" aria-label="Các phương án trả lời">
              {question.options.map((option) => {
                const isSelected = selected === option.code;
                const isCorrect = question.correctOption === option.code;
                return (
                  <li
                    key={option.code}
                    className={`${isCorrect ? 'is-correct' : ''} ${
                      isSelected
                        ? question.correctOption && !isCorrect
                          ? 'is-wrong'
                          : 'is-selected'
                        : ''
                    }`}
                  >
                    <span
                      className={`attempt-review-dialog-radio ${isSelected ? 'is-checked' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="attempt-review-dialog-option-code">{option.code}.</span>
                    <div className="attempt-review-dialog-option-text">
                      <LessonMarkdown content={option.text} />
                    </div>
                    {(isSelected || isCorrect) && (
                      <span className="attempt-review-dialog-option-label">
                        {isCorrect && <Icon name="check" width="15" height="15" />}
                        {isCorrect
                          ? isSelected
                            ? 'Bạn chọn · Đáp án đúng'
                            : 'Đáp án đúng'
                          : 'Bạn chọn'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p
              className={`attempt-review-dialog-correct-answer ${question.correctOption ? '' : 'is-unavailable'}`}
            >
              Đáp án đúng: <strong>{question.correctOption ?? 'Chưa có dữ liệu'}</strong>
            </p>
          </section>

          {questionTranscript && questionTranscript !== groupTranscript && (
            <TranscriptDetails content={questionTranscript} />
          )}
          <details className="attempt-review-dialog-details">
            <summary>
              <Icon name="book" width="18" height="18" />
              Giải thích chi tiết
              <Icon name="down" width="17" height="17" />
            </summary>
            <div className="attempt-review-dialog-details-content">
              {question.explanation ? (
                <LessonMarkdown content={question.explanation} />
              ) : (
                <p>Chưa có lời giải cho câu hỏi này.</p>
              )}
            </div>
          </details>
        </div>
      </div>

      <footer className="attempt-review-dialog-footer">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => onNavigate(questions[index - 1].id)}
        >
          <Icon name="chevron" className="attempt-review-dialog-previous" width="17" height="17" />
          Câu trước
        </button>
        <span>
          {index + 1} / {questions.length}
        </span>
        <button
          type="button"
          disabled={index >= questions.length - 1}
          onClick={() => onNavigate(questions[index + 1].id)}
        >
          Câu tiếp
          <Icon name="chevron" width="17" height="17" />
        </button>
      </footer>
    </dialog>
  );
}

function TranscriptDetails({ content }: { content: string }) {
  return (
    <details className="attempt-review-dialog-details">
      <summary>
        <Icon name="headphones" width="18" height="18" />
        Transcript
        <Icon name="down" width="17" height="17" />
      </summary>
      <div className="attempt-review-dialog-details-content">
        <LessonMarkdown content={content} />
      </div>
    </details>
  );
}
