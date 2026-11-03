'use client';
/* eslint-disable @next/next/no-img-element -- Complete media URLs are supplied by the backend. */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { examApi } from '../../lib/integration/repositories';
import { failureMessage, mutationOutcomeUnknown } from '../../lib/integration/client';
import {
  remainingTime,
  type AttemptChoices,
  type ServerAttempt,
} from '../../lib/integration/attempt-contract';
import { AudioPlayer } from '../ui/audio-player';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { Blocked, ResourceState, useResource } from './shared';

const attemptUrl = (a: { attemptId: string; status: string }) =>
  `/exam/server/${a.status === 'IN_PROGRESS' ? 'take' : 'result'}?attempt=${encodeURIComponent(a.attemptId)}`;
function Pager({
  page,
  size,
  total,
  change,
}: {
  page: number;
  size: number;
  total: number;
  change: (n: number) => void;
}) {
  return (
    <nav className="api-actions" aria-label="Phân trang">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {page} · {total} lượt
      </span>
      <button disabled={page * size >= total} onClick={() => change(page + 1)}>
        Trang sau
      </button>
    </nav>
  );
}
export function ServerExamDetail({ id, writes }: { id: string; writes: boolean }) {
  const state = useResource(`test:${id}`, (s) => examApi.detail(id, s));
  const available = useResource(`parts:${id}`, (s) => examApi.parts(id, s));
  const router = useRouter();
  const [mode, setMode] = useState('FULL'),
    [parts, setParts] = useState<number[]>([]),
    [duration, setDuration] = useState(1800);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    pending = useRef<{ key: string; mode: string; parts: number[]; duration: number }>();
  return (
    <>
      <Link href="/exam">Danh sách đề</Link>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <article className="api-card">
          <h1>{state.data.title}</h1>
          <p>
            {state.data.questionCount} câu · {state.data.durationSeconds / 60} phút cho Full Test
          </p>
          <fieldset disabled={busy || uncertain}>
            <legend>Chuẩn bị làm bài</legend>
            <label className="api-field">
              Chế độ
              <select aria-label="Chế độ" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="FULL">Thi thử Full Test</option>
                <option value="PART">Luyện một hoặc nhiều Part</option>
              </select>
            </label>
            {mode === 'PART' && (
              <>
                <ResourceState {...available} retry={available.reload} />
                <div className="api-actions">
                  {available.data?.map((p) => (
                    <label key={p.part}>
                      <input
                        style={{ width: 'auto' }}
                        type="checkbox"
                        disabled={!p.available}
                        checked={parts.includes(p.part)}
                        onChange={(e) =>
                          setParts((v) =>
                            e.target.checked
                              ? [...v, p.part].sort()
                              : v.filter((n) => n !== p.part),
                          )
                        }
                      />{' '}
                      Part {p.part} ({p.totalQuestions} câu){!p.available && ' · chưa sẵn sàng'}
                    </label>
                  ))}
                </div>
                <label className="api-field">
                  Thời lượng luyện (giây)
                  <input
                    type="number"
                    min={300}
                    max={10800}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <p>
                  Luyện Part chỉ có độ chính xác và số câu đúng; chọn cả 7 Part vẫn là luyện Part.
                </p>
              </>
            )}
          </fieldset>
          {!writes && (
            <Blocked>
              Chế độ chỉ đọc. Bật FRONTEND_TEST_WRITES trong môi trường local/test để tạo lượt.
            </Blocked>
          )}
          <button
            disabled={
              busy ||
              !writes ||
              (mode === 'PART' &&
                (!parts.length ||
                  !Number.isInteger(duration) ||
                  duration < 300 ||
                  duration > 10800))
            }
            onClick={async () => {
              if (lock.current || !writes) return;
              lock.current = true;
              setBusy(true);
              setError('');
              pending.current ??= { key: crypto.randomUUID(), mode, parts, duration };
              const p = pending.current;
              try {
                router.push(
                  attemptUrl(await examApi.start(id, p.mode, p.parts, p.duration, p.key)),
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
            {busy ? 'Đang tạo lượt…' : uncertain ? 'Thử lại cùng yêu cầu' : 'Bắt đầu làm bài'}
          </button>
          {error && (
            <p className="api-error" role="alert">
              {error}
            </p>
          )}
          {uncertain && (
            <p>
              Chưa xác định kết quả tạo. Thử lại giữ nguyên Idempotency-Key và lựa chọn; có thể kiểm
              tra <Link href="/history">lịch sử</Link>.
            </p>
          )}
        </article>
      )}
    </>
  );
}
export function ServerHistory() {
  const search = useSearchParams(),
    router = useRouter();
  const state = useResource(`attempt-history:${search}`, (s) =>
    examApi.history(new URLSearchParams(search.toString()), s),
  );
  const change = (key: string, value: string) => {
    const p = new URLSearchParams(search.toString());
    p.set(key, value);
    if (key !== 'page') p.set('page', '1');
    router.push(`/history?${p}`);
  };
  return (
    <>
      <h1>Lịch sử làm bài</h1>
      <label className="api-field">
        Chế độ
        <select value={search.get('mode') ?? ''} onChange={(e) => change('mode', e.target.value)}>
          <option value="">Tất cả</option>
          <option value="FULL">Full Test</option>
          <option value="PART">Luyện Part</option>
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data?.items.map((a) => (
        <article className="api-card" key={a.attemptId}>
          <h2>{a.title}</h2>
          <p>
            {a.mode} · Part {a.parts.join(', ')} · {a.status} ·{' '}
            {new Date(a.startedAt).toLocaleString('vi-VN')}
          </p>
          {a.score !== null && <p>Điểm server: {a.score}</p>}
          <Link href={attemptUrl(a)}>
            {a.status === 'IN_PROGRESS' && !a.readOnly ? 'Tiếp tục làm bài' : 'Xem lượt làm bài'}
          </Link>
        </article>
      ))}
      {state.data && <Pager {...state.data} change={(n) => change('page', String(n))} />}
    </>
  );
}
export function ServerAttemptScreen({
  writes,
  review = false,
}: {
  writes: boolean;
  review?: boolean;
}) {
  const search = useSearchParams(),
    id = search.get('attempt');
  const state = useResource(`attempt:${id}`, (s) =>
    id ? examApi.result(id, s) : Promise.resolve(null),
  );
  return (
    <>
      <Link href="/history">Lịch sử làm bài</Link>
      {!id ? (
        <Blocked>Cần ID lượt làm bài từ server.</Blocked>
      ) : (
        <ResourceState {...state} retry={state.reload} />
      )}
      {state.data && (
        <Attempt
          key={`${state.data.attemptId}:${state.data.serverTime}`}
          initial={state.data}
          writes={writes}
          review={review}
          reload={state.reload}
        />
      )}
    </>
  );
}
function Attempt({
  initial: a,
  writes,
  review,
  reload,
}: {
  initial: ServerAttempt;
  writes: boolean;
  review: boolean;
  reload: () => void;
}) {
  const [choices, setChoices] = useState<AttemptChoices>(() =>
    Object.fromEntries(a.answers.map((v) => [v.questionId, v.selectedOption])),
  );
  const [index, setIndex] = useState(0),
    [flagged, setFlagged] = useState<string[]>([]),
    [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [dirty, setDirty] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [seconds, setSeconds] = useState(a.remainingSeconds);
  const received = useRef(performance.now()),
    lock = useRef(false),
    expiredRequested = useRef(false);
  const router = useRouter();
  const active = a.status === 'IN_PROGRESS' && !a.readOnly,
    editable = active && writes && seconds > 0 && !busy && !uncertain;
  useEffect(() => {
    if (!active) return;
    const tick = () =>
      setSeconds(remainingTime(a.remainingSeconds, performance.now() - received.current));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [a.remainingSeconds, active]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);
  useEffect(() => {
    if (active && seconds === 0 && !busy && !expiredRequested.current) {
      expiredRequested.current = true;
      reload();
    }
  }, [active, seconds, busy, reload]);
  const answers = () =>
    a.questions.map((q) => ({ questionId: q.id, selectedOption: choices[q.id] ?? null }));
  const filtered = a.questions.filter(
    (q) =>
      filter === 'ALL' ||
      (filter === 'BLANK' && !choices[q.id]) ||
      (filter === 'FLAGGED' && flagged.includes(q.id)) ||
      (filter === 'WRONG' && a.answers.find((v) => v.questionId === q.id)?.isCorrect === false),
  );
  const q = filtered[Math.min(index, Math.max(0, filtered.length - 1))];
  const group = a.groups.find((g) => g.id === q?.groupId);
  return (
    <>
      <h1>{a.title}</h1>
      <p>
        {a.mode} · Part {a.parts.join(', ')} · {a.status}
      </p>
      {active && (
        <p role="timer" aria-label="Thời gian còn lại">
          Còn {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · Deadline server:{' '}
          {new Date(a.deadlineAt).toLocaleString('vi-VN')}
        </p>
      )}
      {a.readOnly && <Blocked>Lượt cũ không có snapshot, chỉ đọc dữ liệu hiện có.</Blocked>}
      {!active && (
        <article className="api-card">
          <h2>Kết quả từ backend</h2>
          <p>
            {a.totalCorrect ?? 'Chưa có'} / {a.totalQuestions} câu đúng ·{' '}
            {a.accuracy === null ? 'Chưa có độ chính xác' : `${(a.accuracy * 100).toFixed(1)}%`}
          </p>
          {a.mode === 'FULL' ? (
            <>
              <p>
                Listening: {a.scoreListening ?? '—'} · Reading: {a.scoreReading ?? '—'} · Tổng:{' '}
                {a.score ?? '—'}
              </p>
              <p>{a.scoreDisclaimer}</p>
            </>
          ) : (
            <p>Luyện Part không quy đổi điểm TOEIC.</p>
          )}
          <ul>
            {a.partStats.map((p) => (
              <li key={p.part}>
                Part {p.part}: {p.correct ?? '—'} / {p.total}
              </li>
            ))}
          </ul>
          {!review && (
            <Link href={`/exam/server/review?attempt=${encodeURIComponent(a.attemptId)}`}>
              Xem lại đáp án và giải thích
            </Link>
          )}
        </article>
      )}
      {active && !writes && <Blocked>Chế độ chỉ đọc. Không gửi đáp án hoặc nộp bài.</Blocked>}
      <p>
        Đã chọn {Object.values(choices).filter(Boolean).length} / {a.totalQuestions} câu. Đánh dấu
        xem lại chỉ giữ trong trang hiện tại.
      </p>
      <label className="api-field">
        Lọc câu
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setIndex(0);
          }}
        >
          <option value="ALL">Tất cả</option>
          <option value="BLANK">Bỏ trống</option>
          <option value="FLAGGED">Đánh dấu</option>
          {!active && <option value="WRONG">Sai / bỏ trống</option>}
        </select>
      </label>
      <nav className="api-actions" aria-label="Điều hướng câu hỏi">
        {filtered.map((v, n) => (
          <button
            key={v.id}
            aria-current={q?.id === v.id ? 'step' : undefined}
            onClick={() => setIndex(n)}
          >
            {v.orderNo}
            {choices[v.id] ? ' ✓' : ''}
            {flagged.includes(v.id) ? ' ★' : ''}
          </button>
        ))}
      </nav>
      {!q && <p>Không có câu phù hợp.</p>}
      {q && (
        <article className="api-card">
          <h2>
            Câu {q.orderNo} · Part {q.part}
          </h2>
          {group && (
            <>
              <p>{group.instruction}</p>
              {group.passage && <LessonMarkdown content={group.passage} />}
              <AudioPlayer
                mode="server"
                missingMessage="Server chưa cấp audio hợp lệ."
                source={group.audioUrl}
                label="Audio nhóm"
              />
              {group.assets.map((asset) => (
                <div key={asset.id}>
                  {asset.content && <LessonMarkdown content={asset.content} />}
                  {asset.kind === 'IMAGE' && asset.url && (
                    <img src={asset.url} alt="Tài liệu nhóm" style={{ maxWidth: '100%' }} />
                  )}
                  {asset.kind === 'AUDIO' && (
                    <AudioPlayer
                      mode="server"
                      missingMessage="Server chưa cấp audio hợp lệ."
                      source={asset.url}
                      label="Audio tài liệu"
                    />
                  )}
                </div>
              ))}
              {!active && group.transcript && (
                <details>
                  <summary>Transcript nhóm</summary>
                  <p>{group.transcript}</p>
                </details>
              )}
            </>
          )}
          <LessonMarkdown content={q.text} />
          {q.imageUrl && (
            <img src={q.imageUrl} alt={`Minh họa câu ${q.orderNo}`} style={{ maxWidth: '100%' }} />
          )}
          {q.audioUrl && (
            <AudioPlayer
              mode="server"
              missingMessage="Server chưa cấp audio hợp lệ."
              source={q.audioUrl}
              label={`Audio câu ${q.orderNo}`}
            />
          )}
          <fieldset disabled={!editable}>
            <legend>Lựa chọn của bạn</legend>
            {q.options.map((o) => (
              <label className="api-actions" key={o.code}>
                <input
                  style={{ width: 'auto' }}
                  type="radio"
                  name={`answer-${q.id}`}
                  checked={choices[q.id] === o.code}
                  onChange={() => {
                    setChoices((v) => ({ ...v, [q.id]: o.code }));
                    setDirty(true);
                    setMessage('Chưa lưu thay đổi lên server.');
                  }}
                />
                {o.code}. {o.text}
              </label>
            ))}
            <button
              onClick={() => {
                setChoices((v) => ({ ...v, [q.id]: null }));
                setDirty(true);
                setMessage('Chưa lưu thay đổi lên server.');
              }}
            >
              Xóa lựa chọn
            </button>
          </fieldset>
          <button
            onClick={() =>
              setFlagged((v) => (v.includes(q.id) ? v.filter((id) => id !== q.id) : [...v, q.id]))
            }
          >
            {flagged.includes(q.id) ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}
          </button>
          {!active && (
            <>
              <p>
                Bạn chọn: {choices[q.id] ?? 'Bỏ trống'} · Đáp án backend:{' '}
                {q.correctOption ?? 'Chưa có'}
              </p>
              {q.explanation && <LessonMarkdown content={q.explanation} />}
              {q.transcript && (
                <details>
                  <summary>Transcript</summary>
                  <p>{q.transcript}</p>
                </details>
              )}
            </>
          )}
          <div className="api-actions">
            <button disabled={index === 0} onClick={() => setIndex((n) => n - 1)}>
              Câu trước
            </button>
            <button disabled={index >= filtered.length - 1} onClick={() => setIndex((n) => n + 1)}>
              Câu sau
            </button>
          </div>
        </article>
      )}
      {active && (
        <div className="api-actions">
          <button
            disabled={!editable || !dirty}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError('');
              try {
                await examApi.draft(a.attemptId, answers());
                setDirty(false);
                setMessage('Server đã xác nhận lưu nháp.');
              } catch (e) {
                setError(failureMessage(e));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            Lưu nháp lên server
          </button>
          <button
            disabled={busy || !writes}
            onClick={async () => {
              if (
                lock.current ||
                !window.confirm('Nộp bài với các lựa chọn hiện tại? Sau khi nộp không thể sửa.')
              )
                return;
              lock.current = true;
              setBusy(true);
              setError('');
              setMessage('');
              try {
                // Read the locked attempt before retrying after a lost submit acknowledgment.
                const current = uncertain ? await examApi.result(a.attemptId) : null;
                const r =
                  current && current.status !== 'IN_PROGRESS'
                    ? current
                    : await examApi.submit(a.attemptId, answers());
                setDirty(false);
                router.push(attemptUrl(r));
                reload();
              } catch (e) {
                setError(failureMessage(e));
                if (mutationOutcomeUnknown(e)) setUncertain(true);
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {uncertain ? 'Thử nộp lại cùng lựa chọn' : 'Nộp bài'}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && (
        <p>
          Chưa xác định kết quả nộp. Các lựa chọn đang được giữ; kiểm tra lại trạng thái server
          trước khi sửa.
        </p>
      )}
      <button disabled={busy || dirty} onClick={reload}>
        Tải lại trạng thái server
      </button>
      {dirty && <p>Lưu nháp hoặc thử nộp lại trước khi tải lại để giữ lựa chọn.</p>}
    </>
  );
}
