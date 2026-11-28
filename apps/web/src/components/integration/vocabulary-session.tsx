'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { failureMessage, GatewayError, mutationOutcomeUnknown } from '../../lib/integration/client';
import {
  flashcardSessions,
  vocabularySessions,
  type FlashcardMode,
  type FlashcardScope,
} from '../../lib/integration/vocabulary-session';
import type { MemoryQuality } from '../../lib/learning/types';
import { Button } from '../ui/button';
import { Progress } from '../ui/feedback';
import { VocabularyQuizQuestions } from '../ui/vocabulary-quiz-questions';
import { ResourceState, useResource } from './shared';
import { VocabularyWordCard } from './vocabulary-word-card';

type Review = { vocabularyId: string; quality: number };
type SessionData = Awaited<ReturnType<typeof flashcardSessions.read>>;

const ratings: { quality: MemoryQuality; label: string }[] = [
  { quality: 1, label: 'Chưa thuộc' },
  { quality: 3, label: 'Mơ hồ' },
  { quality: 5, label: 'Đã thuộc' },
];

export function flashcardTopicHref(topicId: string, scope: FlashcardScope) {
  return scope === 'PERSONAL'
    ? '/study/vocabulary?' + new URLSearchParams({ library: 'personal', topic: topicId })
    : '/study/vocabulary/' + encodeURIComponent(topicId);
}

function noEligibleFlashcards(error: unknown) {
  if (!(error instanceof GatewayError) || error.status !== 409) return false;
  const envelope = error.details;
  if (!envelope || typeof envelope !== 'object') return false;
  const detail = 'details' in envelope ? envelope.details : envelope;
  return (
    detail &&
    typeof detail === 'object' &&
    'code' in detail &&
    detail.code === 'NO_ELIGIBLE_FLASHCARDS'
  );
}

export function VocabularySessionStart({
  topicId,
  scope,
  limit,
  initialMode = 'NEW',
}: {
  topicId: string;
  scope: FlashcardScope;
  limit: number;
  initialMode?: FlashcardMode;
}) {
  const [mode, setMode] = useState<FlashcardMode>(initialMode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<{ key: string; mode: FlashcardMode; limit: number }>();
  const lock = useRef(false);
  const router = useRouter();

  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    const request = (pending.current ??= { key: crypto.randomUUID(), mode, limit });
    try {
      const session = await flashcardSessions.start(topicId, request.mode, request.key, {
        scope,
        limit: request.limit,
      });
      const href = flashcardTopicHref(topicId, scope);
      router.push(
        href +
          (scope === 'PERSONAL' ? '&' : '?') +
          'flashcardSession=' +
          encodeURIComponent(session.id),
      );
    } catch (cause) {
      const unknown = mutationOutcomeUnknown(cause);
      setUncertain(unknown);
      if (!unknown) pending.current = undefined;
      setError(
        noEligibleFlashcards(cause)
          ? request.mode === 'NEW'
            ? 'Danh sách này không còn từ mới để học.'
            : 'Danh sách này chưa có từ đến hạn ôn.'
          : failureMessage(cause),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="api-card">
      <h2>Luyện tập bằng flashcard</h2>
      <p>Lịch ôn được cập nhật sau mỗi lần đánh giá thẻ.</p>
      <label className="api-field">
        Loại phiên
        <select
          disabled={busy || uncertain}
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as FlashcardMode);
            setError('');
          }}
        >
          <option value="NEW">Học từ mới</option>
          <option value="REVIEW">Ôn từ đến hạn</option>
        </select>
      </label>
      <button type="button" className="api-primary" disabled={busy} onClick={() => void start()}>
        {busy ? 'Đang tạo phiên…' : uncertain ? 'Thử bắt đầu lại' : 'Bắt đầu flashcard → quiz'}
      </button>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </section>
  );
}

export function VocabularySession({
  id,
  legacy = false,
  writes = true,
  backHref,
}: {
  id: string;
  legacy?: boolean;
  writes?: boolean;
  backHref: string;
}) {
  const api = legacy ? vocabularySessions : flashcardSessions;
  const state = useResource(`vocabulary-session:${legacy}:${id}`, (signal) => api.read(id, signal));
  return (
    <>
      <Link href={backHref}>← Quay lại danh sách từ vựng</Link>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <Session
          key={state.data.id}
          initial={state.data}
          api={api}
          writes={writes}
          reload={state.reload}
        />
      )}
    </>
  );
}

function Session({
  initial,
  api,
  writes,
  reload,
}: {
  initial: SessionData;
  api: typeof flashcardSessions;
  writes: boolean;
  reload: () => void;
}) {
  const { id, words, quiz, status } = initial;
  const [reviews, setReviews] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.reviews.map((review) => [review.vocabularyId, review.quality])),
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(initial.result);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<'rate' | 'submit' | 'cancel' | null>(null);
  const [reviewUncertain, setReviewUncertain] = useState(false);
  const [submitUncertain, setSubmitUncertain] = useState(false);
  const pendingReview = useRef<Review>();
  const operationId = useRef<string>();
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const position = words.findIndex((word) => !Object.hasOwn(reviews, word.id));
  const card = words[position];
  const active = status === 'IN_PROGRESS' && !result;
  const busy = pendingAction !== null;

  useEffect(() => {
    heading.current?.focus();
  }, [card?.id, result]);

  async function rate(quality: number) {
    if (!card || !writes || lock.current) return;
    lock.current = true;
    setPendingAction('rate');
    setError('');
    const review = (pendingReview.current ??= { vocabularyId: card.id, quality });
    try {
      if (reviewUncertain) {
        const current = await api.read(id);
        if (current.result) {
          setResult(current.result);
          setReviewUncertain(false);
          return;
        }
        if (current.status !== 'IN_PROGRESS') {
          reload();
          return;
        }
        const saved = current.reviews.find((item) => item.vocabularyId === review.vocabularyId);
        if (!saved) await api.reviews(id, [review]);
        setReviews(
          Object.fromEntries(
            [...current.reviews, saved ?? review].map((item) => [item.vocabularyId, item.quality]),
          ),
        );
      } else {
        await api.reviews(id, [review]);
        setReviews((previous) => ({ ...previous, [review.vocabularyId]: review.quality }));
      }
      pendingReview.current = undefined;
      setReviewUncertain(false);
      setRevealed(false);
    } catch (cause) {
      setError(failureMessage(cause));
      const unknown = mutationOutcomeUnknown(cause);
      setReviewUncertain(unknown);
      if (!unknown) pendingReview.current = undefined;
    } finally {
      lock.current = false;
      setPendingAction(null);
    }
  }

  async function submit() {
    if (!writes || lock.current || Object.keys(answers).length !== quiz.length) return;
    lock.current = true;
    setPendingAction('submit');
    setError('');
    operationId.current ??= crypto.randomUUID();
    try {
      if (submitUncertain) {
        const current = await api.read(id);
        if (current.result) {
          setResult(current.result);
          setSubmitUncertain(false);
          return;
        }
        if (current.status !== 'IN_PROGRESS') {
          reload();
          return;
        }
      }
      setResult(
        await api.submit(id, {
          operationId: operationId.current,
          reviews: Object.entries(reviews).map(([vocabularyId, quality]) => ({
            vocabularyId,
            quality,
          })),
          answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
            questionId,
            selectedOption,
          })),
        }),
      );
      setSubmitUncertain(false);
    } catch (cause) {
      setError(failureMessage(cause));
      const unknown = mutationOutcomeUnknown(cause);
      setSubmitUncertain(unknown);
      if (!unknown) operationId.current = undefined;
    } finally {
      lock.current = false;
      setPendingAction(null);
    }
  }

  async function cancel() {
    if (lock.current || !window.confirm('Hủy phiên học hiện tại?')) return;
    lock.current = true;
    setPendingAction('cancel');
    setError('');
    try {
      await api.cancel(id);
      reload();
    } catch (cause) {
      setError(failureMessage(cause));
    } finally {
      lock.current = false;
      setPendingAction(null);
    }
  }

  return (
    <article className={`flashcard-practice-round${active && !card ? '' : ' api-card'}`}>
      {result ? (
        <>
          <h2 ref={heading} tabIndex={-1}>
            Kết quả quiz
          </h2>
          <p>
            {result.correct} / {result.total} câu đúng
          </p>
          <ul>
            {result.answers.map((answer) => {
              const question = quiz.find((item) => item.id === answer.id);
              const correct = question?.options.find((option) => option.code === answer.correct);
              return (
                <li key={answer.id}>
                  {question?.prompt} ·{' '}
                  {answer.isCorrect
                    ? 'Đúng'
                    : `Sai. Đáp án đúng là ${correct?.text ?? answer.correct}.`}
                </li>
              );
            })}
          </ul>
        </>
      ) : !active ? (
        <p>{status === 'CANCELED' ? 'Phiên học đã hủy.' : 'Phiên học đã hết hạn.'}</p>
      ) : card ? (
        <>
          <h2 ref={heading} tabIndex={-1}>
            Thẻ {position + 1} / {words.length}
          </h2>
          <Progress
            value={Object.keys(reviews).length}
            max={words.length}
            label="Tiến độ luyện tập flashcard"
          />
          <VocabularyWordCard key={card.id} word={card} flipped={revealed} onFlip={setRevealed} />
          <div className="flashcard-rating">
            <h3>Bạn nhớ từ này đến mức nào?</h3>
            {!revealed && <p>Bấm vào thẻ để xem nghĩa.</p>}
            <div className="rating-grid">
              {ratings.map(({ quality, label }) => (
                <Button
                  key={quality}
                  className={`rating-button rating-button--${quality}`}
                  variant="secondary"
                  disabled={!writes || !revealed || busy || reviewUncertain}
                  onClick={() => void rate(quality)}
                >
                  <strong>{label}</strong>
                </Button>
              ))}
            </div>
          </div>
          {pendingAction === 'rate' && <p role="status">Đang lưu đánh giá…</p>}
          {reviewUncertain && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (pendingReview.current) void rate(pendingReview.current.quality);
              }}
            >
              Kiểm tra và thử lưu lại
            </button>
          )}
        </>
      ) : (
        <>
          <h2>Quiz từ vựng</h2>
          <VocabularyQuizQuestions
            questions={quiz.map((question) => {
              const word = words.find((item) => item.id === question.wordId);
              return {
                id: question.id,
                prompt: question.prompt,
                confirmation: question.confirmsMeaning,
                pronunciation: word?.pronunciation,
                partOfSpeech: word?.partOfSpeech,
                options: question.options.map((option) => ({ id: option.code, label: option.text })),
              };
            })}
            answers={answers}
            onAnswer={(questionId, optionId) => {
              setAnswers((previous) => ({ ...previous, [questionId]: optionId }));
              setError('');
            }}
            onSubmit={() => void submit()}
            disabled={!writes || pendingAction === 'cancel'}
            busy={pendingAction === 'submit'}
            answersLocked={submitUncertain}
            submitLabel={
              pendingAction === 'submit'
                ? 'Đang nộp quiz…'
                : submitUncertain
                  ? 'Thử nộp lại'
                  : 'Nộp quiz'
            }
          />
        </>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {active && (
        <div className="api-actions">
          <button
            type="button"
            disabled={busy || !writes || submitUncertain || reviewUncertain}
            onClick={() => void cancel()}
          >
            Hủy phiên
          </button>
          {error && (
            <button type="button" disabled={busy} onClick={reload}>
              Tải lại phiên
            </button>
          )}
        </div>
      )}
    </article>
  );
}
