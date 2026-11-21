'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { examApi } from '../../lib/integration/repositories';
import { failureMessage, mutationOutcomeUnknown } from '../../lib/integration/client';
import {
  remainingTime,
  type AttemptChoices,
  type ServerAttempt,
} from '../../lib/integration/attempt-contract';
import { Blocked, ResourceState, useResource } from './shared';
import { ServerExamTaking } from './exam-taking';
import { ServerAttemptResult } from './attempt-result';
import { ServerPagination } from './server-pagination';
import { useExamNavigationGuard } from '../exams/use-exam-navigation-guard';

const attemptUrl = (a: { attemptId: string; status: string }) =>
  `/exam/server/${a.status === 'IN_PROGRESS' ? 'take' : 'result'}?attempt=${encodeURIComponent(a.attemptId)}`;
const statusLabel: Record<string, string> = {
  IN_PROGRESS: 'Đang làm bài',
  SUBMITTED: 'Đã nộp bài',
  EXPIRED: 'Đã hết giờ',
};
const modeLabel = (mode: string) => (mode === 'FULL' ? 'Thi thử Full Test' : 'Luyện theo Part');
export function ServerExamDetail({
  id,
  writes,
  practiceEntry,
}: {
  id: string;
  writes: boolean;
  practiceEntry: boolean;
}) {
  const state = useResource(`test:${id}`, (s) => examApi.detail(id, s));
  const available = useResource(`parts:${id}`, (s) => examApi.parts(id, s));
  const router = useRouter();
  const [mode, setMode] = useState(practiceEntry ? 'PART' : 'FULL'),
    [parts, setParts] = useState<number[]>([]),
    [duration, setDuration] = useState(1800);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    pending = useRef<{ key: string; mode: string; parts: number[]; duration: number }>();
  const fullAvailable = available.data?.length === 7 && available.data.every((p) => p.available);
  return (
    <>
      <Link href={practiceEntry ? '/practice' : '/exam'}>Danh sách đề</Link>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <article className="api-card">
          <h1>{state.data.title}</h1>
          <p>
            {state.data.questionCount} câu · {state.data.durationSeconds / 60} phút cho Full Test
          </p>
          <p>
            Bài làm được lưu theo tài khoản. Đáp án tự động lưu trong khi làm bài; bạn có thể tiếp
            tục phiên đang làm từ lịch sử. Full Test gồm Listening và Reading, thời gian 120 phút.
          </p>
          <fieldset disabled={busy || uncertain || !writes}>
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
                  Thời lượng luyện (phút)
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={duration / 60}
                    onChange={(e) => setDuration(Number(e.target.value) * 60)}
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
              Việc tạo phiên thi đang tạm tắt. Bạn vẫn có thể xem lại các bài đã làm trong lịch sử.
            </Blocked>
          )}
          <button
            className="api-primary"
            disabled={
              busy ||
              !writes ||
              (!uncertain && mode === 'FULL' && !fullAvailable) ||
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
          {mode === 'FULL' && <ResourceState {...available} retry={available.reload} />}
          {mode === 'FULL' && available.data && !fullAvailable && (
            <p role="alert">
              Đề chưa đủ 7 Part hợp lệ để thi Full Test. Bạn có thể chọn luyện các Part đã sẵn sàng.
            </p>
          )}
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
  const changeMode = (mode: string) => {
    const p = new URLSearchParams(search.toString());
    if (mode) p.set('mode', mode);
    else p.delete('mode');
    p.set('page', '1');
    router.push(`/history?${p}`);
  };
  return (
    <>
      <h1>Lịch sử làm bài</h1>
      <label className="api-field">
        Chế độ
        <select value={search.get('mode') ?? ''} onChange={(e) => changeMode(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="FULL">Full Test</option>
          <option value="PART">Luyện Part</option>
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data?.items.map((a) => (
        <Link
          className="api-card api-exam-card"
          key={a.attemptId}
          href={attemptUrl(a)}
          aria-label={`${a.status === 'IN_PROGRESS' && !a.readOnly ? 'Tiếp tục làm bài' : 'Xem chi tiết bài làm'}: ${a.title}, Part ${a.parts.join(', ')}, ${new Date(a.startedAt).toLocaleString('vi-VN')}`}
        >
          <h2>{a.title}</h2>
          <p>
            {modeLabel(a.mode)} · Part {a.parts.join(', ')} · {statusLabel[a.status]} ·{' '}
            {new Date(a.startedAt).toLocaleString('vi-VN')}
          </p>
          {a.score !== null && <p>Điểm TOEIC tham khảo: {a.score}</p>}
          <span className="history-entry-cta">
            {a.status === 'IN_PROGRESS' && !a.readOnly
              ? 'Tiếp tục làm bài →'
              : 'Xem chi tiết bài làm →'}
          </span>
        </Link>
      ))}
      {state.data && <ServerPagination result={state.data} />}
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
  const lastActive = useRef<{ id: string; active: boolean } | null>(null);
  if (id && state.data) {
    lastActive.current = {
      id,
      active: state.data.status === 'IN_PROGRESS' && !state.data.readOnly,
    };
  }
  const active = state.data
    ? state.data.status === 'IN_PROGRESS' && !state.data.readOnly
    : lastActive.current?.id === id && lastActive.current.active;
  const [navigationBlocked, setNavigationBlocked] = useState(false);
  useEffect(() => setNavigationBlocked(false), [id]);
  const allowNavigation = useExamNavigationGuard(Boolean(active && writes), id ?? '', () =>
    setNavigationBlocked(true),
  );
  return (
    <>
      {state.data && state.data.status !== 'IN_PROGRESS' && (
        <Link className="attempt-result-back" href="/history">
          ← Lịch sử làm bài
        </Link>
      )}
      {!id ? (
        <Blocked>Cần ID lượt làm bài từ server.</Blocked>
      ) : (
        <ResourceState {...state} retry={state.reload} />
      )}
      {navigationBlocked && !state.data && (
        <p role="status">
          Bạn cần nộp bài trước khi rời bài thi. Hãy tải lại dữ liệu để tiếp tục bài đang làm.
        </p>
      )}
      {state.data && (
        <Attempt
          key={`${state.data.attemptId}:${state.data.serverTime}`}
          initial={state.data}
          writes={writes}
          review={review}
          reload={state.reload}
          allowNavigation={allowNavigation}
          navigationBlocked={navigationBlocked}
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
  allowNavigation,
  navigationBlocked,
}: {
  initial: ServerAttempt;
  writes: boolean;
  review: boolean;
  reload: () => void;
  allowNavigation: () => void;
  navigationBlocked: boolean;
}) {
  const [choices, setChoices] = useState<AttemptChoices>(() =>
    Object.fromEntries(a.answers.map((v) => [v.questionId, v.selectedOption])),
  );
  const [flagged, setFlagged] = useState<string[]>([]);
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
  const answers = useCallback(
    () => a.questions.map((q) => ({ questionId: q.id, selectedOption: choices[q.id] ?? null })),
    [a.questions, choices],
  );
  const saveDraft = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('Đang lưu đáp án…');
    try {
      await examApi.draft(a.attemptId, answers());
      setDirty(false);
      setMessage('Đã lưu đáp án. Bạn có thể tiếp tục bài từ lịch sử.');
    } catch (e) {
      setError(failureMessage(e));
      setMessage('Đáp án chưa được xác nhận lưu. Bấm Lưu nháp để thử lại.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [a.attemptId, answers]);
  useEffect(() => {
    if (!dirty || !active || !writes || uncertain) return;
    const timer = setTimeout(() => {
      if (remainingTime(a.remainingSeconds, performance.now() - received.current) > 0)
        void saveDraft();
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, active, writes, uncertain, a.remainingSeconds, saveDraft]);
  useEffect(() => {
    if (!active) return;
    const tick = () =>
      setSeconds(remainingTime(a.remainingSeconds, performance.now() - received.current));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [a.remainingSeconds, active]);
  useEffect(() => {
    if (active && seconds === 0 && !busy && !expiredRequested.current) {
      expiredRequested.current = true;
      if (!writes) {
        reload();
        return;
      }
      lock.current = true;
      setBusy(true);
      setMessage('Đã hết giờ. Đang chấm bài với các đáp án đã lưu…');
      // The server finalizes expired attempts from its saved draft and rejects late answers.
      void examApi
        .submit(a.attemptId, [])
        .then((result) => {
          setDirty(false);
          allowNavigation();
          router.replace(attemptUrl(result));
          reload();
        })
        .catch((e) => {
          setError(failureMessage(e));
          setMessage('Chưa xác nhận kết quả khi hết giờ. Bấm Nộp bài để kiểm tra lại.');
          setUncertain(mutationOutcomeUnknown(e));
        })
        .finally(() => {
          lock.current = false;
          setBusy(false);
        });
    }
  }, [active, seconds, busy, reload, writes, a.attemptId, router, allowNavigation]);
  const submit = async () => {
    if (
      lock.current ||
      !window.confirm(
        `Bạn đã chọn ${Object.values(choices).filter(Boolean).length}/${a.totalQuestions} câu. Nộp bài với các lựa chọn hiện tại? Sau khi nộp không thể sửa.`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      // Reconcile a lost acknowledgment before retrying a submission.
      const current = uncertain ? await examApi.result(a.attemptId) : null;
      const result =
        current && current.status !== 'IN_PROGRESS'
          ? current
          : await examApi.submit(a.attemptId, answers());
      setDirty(false);
      allowNavigation();
      router.replace(attemptUrl(result));
      reload();
    } catch (e) {
      setError(failureMessage(e));
      if (mutationOutcomeUnknown(e)) setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (active)
    return (
      <ServerExamTaking
        attempt={a}
        choices={choices}
        flagged={flagged}
        seconds={seconds}
        editable={editable}
        writes={writes}
        busy={busy}
        dirty={dirty}
        uncertain={uncertain}
        message={message}
        error={error}
        navigationBlocked={navigationBlocked}
        onAnswer={(questionId, option) => {
          setChoices((v) => ({ ...v, [questionId]: option }));
          setDirty(true);
          setMessage('Chưa lưu thay đổi lên server.');
        }}
        onFlag={(questionId) =>
          setFlagged((v) =>
            v.includes(questionId) ? v.filter((id) => id !== questionId) : [...v, questionId],
          )
        }
        onSave={() => void saveDraft()}
        onReload={reload}
        onSubmit={() => void submit()}
      />
    );
  return <ServerAttemptResult attempt={a} review={review} writes={writes} />;
}
