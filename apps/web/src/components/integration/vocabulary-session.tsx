'use client';
import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { vocabularySessions } from '../../lib/integration/vocabulary-session';
import { failureMessage, mutationOutcomeUnknown } from '../../lib/integration/client';
import { AudioPlayer } from '../ui/audio-player';
import { ResourceState, useResource } from './shared';

export function VocabularySessionStart({ topicId, writes }: { topicId: string; writes: boolean }) {
  const [mode, setMode] = useState<'NEW' | 'REVIEW'>('NEW'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const pending = useRef<{ key: string; mode: 'NEW' | 'REVIEW' }>(),
    lock = useRef(false),
    router = useRouter();
  return (
    <article className="api-card">
      <h2>Phiên 5 Flashcard và quiz</h2>
      <p>
        Cần đủ 5 từ phù hợp và 4 định nghĩa khác nhau trong chủ đề. Lịch SM-2 chỉ cập nhật sau khi
        backend chấm quiz.
      </p>
      <label className="api-field">
        Loại phiên
        <select
          disabled={busy || uncertain}
          value={mode}
          onChange={(e) => setMode(e.target.value as 'NEW' | 'REVIEW')}
        >
          <option value="NEW">Học từ mới</option>
          <option value="REVIEW">Ôn từ đến hạn</option>
        </select>
      </label>
      <button
        disabled={!writes || busy}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError('');
          pending.current ??= { key: crypto.randomUUID(), mode };
          try {
            const s = await vocabularySessions.start(
              topicId,
              pending.current.mode,
              pending.current.key,
            );
            router.push(
              `/study/vocabulary/${encodeURIComponent(topicId)}?session=${encodeURIComponent(s.id)}`,
            );
          } catch (e) {
            setError(failureMessage(e));
            if (mutationOutcomeUnknown(e)) setUncertain(true);
            else {
              pending.current = undefined;
              setUncertain(false);
            }
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? 'Đang tạo phiên…' : uncertain ? 'Thử lại cùng yêu cầu' : 'Bắt đầu Flashcard → quiz'}
      </button>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function VocabularySession({ writes }: { writes: boolean }) {
  const id = useSearchParams().get('session');
  const state = useResource(`vocabulary-session:${id}`, (s) =>
    id ? vocabularySessions.read(id, s) : Promise.resolve(null),
  );
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <Session
          key={state.data.id + state.data.status}
          initial={state.data}
          writes={writes}
          reload={state.reload}
        />
      )}
    </>
  );
}
function Session({
  initial: s,
  writes,
  reload,
}: {
  initial: Awaited<ReturnType<typeof vocabularySessions.read>>;
  writes: boolean;
  reload: () => void;
}) {
  const [reviews, setReviews] = useState<Record<string, number>>(() =>
      Object.fromEntries(s.reviews.map((v) => [v.vocabularyId, v.quality])),
    ),
    [answers, setAnswers] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<'cards' | 'quiz'>('cards'),
    [flipped, setFlipped] = useState<string[]>([]),
    [result, setResult] = useState(s.result),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [reviewUncertain, setReviewUncertain] = useState(false);
  const operation = useRef<string>(),
    lock = useRef(false),
    pendingReviews = useRef<{ vocabularyId: string; quality: number }[]>();
  const done = !!result,
    active = s.status === 'IN_PROGRESS' && !done;
  return (
    <article className="api-card">
      <h2>Phiên Flashcard / quiz</h2>
      <p>
        {done ? 'COMPLETED' : s.status} · ID {s.id}
      </p>
      {done ? (
        <>
          <h3>
            Backend chấm: {result.correct} / {result.total}
          </h3>
          <ul>
            {result.answers.map((a) => (
              <li key={a.id}>
                Câu {s.quiz.find((q) => q.id === a.id)?.prompt}: bạn chọn {a.selected}, đáp án{' '}
                {a.correct} · {a.isCorrect ? 'Đúng' : 'Sai'}
              </li>
            ))}
          </ul>
        </>
      ) : active ? (
        <>
          {stage === 'cards' ? (
            <>
              {s.words.map((w) => (
                <article className="api-card" key={w.id}>
                  <h3>{w.word}</h3>
                  <p>{w.pronunciation}</p>
                  <AudioPlayer
                    mode="server"
                    missingMessage="Server chưa cấp audio hợp lệ."
                    source={w.audioUrl}
                    label={`Phát âm ${w.word}`}
                  />
                  <button
                    onClick={() =>
                      setFlipped((v) =>
                        v.includes(w.id) ? v.filter((id) => id !== w.id) : [...v, w.id],
                      )
                    }
                  >
                    Lật thẻ
                  </button>
                  {flipped.includes(w.id) && (
                    <p>
                      {w.meaning} · {w.example}
                    </p>
                  )}
                  <label className="api-field">
                    Mức độ nhớ (0–5)
                    <select
                      disabled={!writes || busy || uncertain || reviewUncertain}
                      value={reviews[w.id] ?? ''}
                      onChange={(e) =>
                        setReviews((v) => ({ ...v, [w.id]: Number(e.target.value) }))
                      }
                    >
                      <option value="" disabled>
                        Chọn đánh giá
                      </option>
                      {[0, 1, 2, 3, 4, 5].map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
              <button
                disabled={!writes || busy || Object.keys(reviews).length !== s.words.length}
                onClick={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  pendingReviews.current ??= Object.entries(reviews).map(
                    ([vocabularyId, quality]) => ({ vocabularyId, quality }),
                  );
                  try {
                    // A lost response may follow a committed draft. Read before retrying it.
                    const current = reviewUncertain ? await vocabularySessions.read(s.id) : null;
                    if (current?.result) {
                      setResult(current.result);
                    } else if (
                      !current ||
                      !pendingReviews.current.every((review) =>
                        current.reviews.some(
                          (saved) =>
                            saved.vocabularyId === review.vocabularyId &&
                            saved.quality === review.quality,
                        ),
                      )
                    ) {
                      if (current && current.status !== 'IN_PROGRESS')
                        throw new Error('Phiên không còn hoạt động. Đọc lại trạng thái server.');
                      await vocabularySessions.reviews(s.id, pendingReviews.current);
                    }
                    pendingReviews.current = undefined;
                    setReviewUncertain(false);
                    setStage('quiz');
                  } catch (e) {
                    setError(failureMessage(e));
                    if (mutationOutcomeUnknown(e)) setReviewUncertain(true);
                    else if (!reviewUncertain) pendingReviews.current = undefined;
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {reviewUncertain
                  ? 'Kiểm tra và thử lại đánh giá đã gửi'
                  : 'Lưu đánh giá và chuyển quiz'}
              </button>
            </>
          ) : (
            <>
              <p>Đánh giá Flashcard đã lưu. Đáp án quiz chưa nộp sẽ mất khi tải lại trang.</p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  operation.current ??= crypto.randomUUID();
                  try {
                    if (uncertain) {
                      const current = await vocabularySessions.read(s.id);
                      if (current.result) {
                        setResult(current.result);
                        setUncertain(false);
                        return;
                      }
                      if (current.status !== 'IN_PROGRESS')
                        throw new Error('Phiên không còn hoạt động. Đọc lại trạng thái server.');
                    }
                    setResult(
                      await vocabularySessions.submit(s.id, {
                        operationId: operation.current,
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
                  } catch (e) {
                    setError(failureMessage(e));
                    if (mutationOutcomeUnknown(e)) setUncertain(true);
                    else {
                      operation.current = undefined;
                      setUncertain(false);
                    }
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                <fieldset disabled={!writes || busy || uncertain}>
                  {s.quiz.map((q) => (
                    <fieldset key={q.id}>
                      <legend>Nghĩa của “{q.prompt}”</legend>
                      {q.options.map((o) => (
                        <label className="api-actions" key={o.code}>
                          <input
                            type="radio"
                            required
                            style={{ width: 'auto' }}
                            name={q.id}
                            checked={answers[q.id] === o.code}
                            onChange={() => setAnswers((v) => ({ ...v, [q.id]: o.code }))}
                          />
                          {o.code}. {o.text}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </fieldset>
                <button disabled={!writes || busy || Object.keys(answers).length !== s.quiz.length}>
                  {uncertain ? 'Thử nộp lại cùng operationId' : 'Nộp quiz'}
                </button>
              </form>
            </>
          )}
        </>
      ) : (
        <p>Phiên đã hết hạn hoặc bị hủy; không thể gửi thay đổi.</p>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && <p>Giữ nguyên dữ liệu khi thử lại để tránh cập nhật SM-2 hai lần.</p>}
      {reviewUncertain && (
        <p>Chưa xác nhận lưu đánh giá. Giữ nguyên lựa chọn; kiểm tra server trước khi gửi lại.</p>
      )}
      {active && (
        <button
          disabled={busy || !writes || uncertain || reviewUncertain}
          onClick={async () => {
            if (lock.current || !window.confirm('Hủy phiên học hiện tại?')) return;
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              await vocabularySessions.cancel(s.id);
              reload();
            } catch (e) {
              setError(failureMessage(e));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          Hủy phiên
        </button>
      )}
      <button disabled={busy} onClick={reload}>
        Đọc lại phiên từ server
      </button>
    </article>
  );
}
