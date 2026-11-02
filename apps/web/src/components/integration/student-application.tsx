'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are validated complete backend URLs. */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import {
  learningApi,
  examApi,
  analyticsApi,
  profileApi,
  EXAM_BLOCKERS,
} from '../../lib/integration/repositories';
import { failureMessage, validationFields } from '../../lib/integration/client';
import { matchingId, type User, type Page, type parseWord } from '../../lib/integration/contracts';
import { StudentShell } from '../layout/student-shell';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { AudioPlayer } from '../ui/audio-player';
import { ApiAuth, Blocked, ResourceState, SessionGate, useResource } from './shared';

export function ApiStudentApplication({
  children,
  writes = false,
}: {
  children: ReactNode;
  writes?: boolean;
}) {
  const path = usePathname();
  if (path === '/') return <>{children}</>;
  if (path === '/login' || path === '/register')
    return <ApiAuth register={path === '/register'} writes={writes} />;
  return (
    <SessionGate key={path}>
      {(user) => <AuthenticatedStudent key={user.id} initial={user} writes={writes} />}
    </SessionGate>
  );
}
function AuthenticatedStudent({ initial, writes }: { initial: User; writes: boolean }) {
  const [user, setUser] = useState(initial),
    path = usePathname(),
    search = useSearchParams();
  return (
    <StudentShell apiAccount={user}>
      <div className="api-root" key={`${path}?${search}`}>
        <span className="api-label">API · Dữ liệu server · Local / test</span>
        {!writes && (
          <Blocked>
            Chế độ chỉ đọc. Chưa bật cập nhật hồ sơ, đánh giá Flashcard hoặc hoàn thành bài học cho
            tài khoản.
          </Blocked>
        )}
        <StudentDomain user={user} onProfile={setUser} writes={writes} />
      </div>
    </StudentShell>
  );
}
function StudentDomain({
  user,
  onProfile,
  writes,
}: {
  user: User;
  onProfile: (user: User) => void;
  writes: boolean;
}) {
  const path = usePathname(),
    parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    try {
      parts[i] = decodeURIComponent(parts[i]);
    } catch {
      /* transport rejects invalid IDs */
    }
  }
  if (path === '/dashboard') return <ApiDashboard />;
  if (path.startsWith('/study/vocabulary'))
    return <Vocabulary key={parts[2] ?? 'topics'} topicId={parts[2]} writes={writes} />;
  if (path.startsWith('/study/grammar'))
    return parts[2] ? <GrammarLesson id={parts[2]} writes={writes} /> : <GrammarLibrary />;
  if (path === '/exam' || path === '/practice') return <ExamLibrary />;
  if (parts[0] === 'exam' && parts[1]) {
    if (parts[2] === 'result' || parts[2] === 'review') return <AttemptResult />;
    if (parts[2] === 'take')
      return (
        <>
          <h1>Làm bài</h1>
          <AttemptBlocked />
        </>
      );
    return <ExamDetail id={parts[1]} />;
  }
  if (path === '/history') return <History />;
  if (path.startsWith('/history/example'))
    return (
      <>
        <h1>Kết quả</h1>
        <Blocked>
          Ví dụ minh họa chỉ có trong chế độ DEMO. Chế độ API không dùng dữ liệu mẫu.
        </Blocked>
      </>
    );
  if (path === '/analytics') return <Analytics />;
  if (path === '/profile') return <Profile user={user} onSaved={onProfile} writes={writes} />;
  if (path === '/settings')
    return (
      <>
        <h1>Cài đặt học tập</h1>
        <Blocked>
          Backend chưa có API mục tiêu từ vựng, thời gian học, điểm mục tiêu, ngày thi và nhắc học.
          Các cài đặt chưa thể đọc hoặc lưu cho tài khoản.
        </Blocked>
      </>
    );
  if (path === '/ai-chat')
    return (
      <>
        <h1>Trợ lý học tập AI</h1>
        <Blocked>
          Chưa thể gửi tin: AI service hiện nhận user_id từ client và chưa kiểm tra người sở hữu hội
          thoại bằng JWT. Cần hoàn thiện xác thực, phản hồi quota và timeout trước khi bật. Không có
          lượt chat hoặc phản hồi mẫu trong chế độ API.
        </Blocked>
      </>
    );
  return (
    <>
      <h1>Không tìm thấy trang</h1>
      <Link href="/dashboard">Về tổng quan</Link>
    </>
  );
}
export function Pagination({
  result,
  onPage,
}: {
  result: Pick<Page<unknown>, 'page' | 'size' | 'total'>;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label="Phân trang dữ liệu server" className="api-actions">
      <button disabled={result.page <= 1} onClick={() => onPage(result.page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {result.page} · {result.total} bản ghi
      </span>
      <button
        disabled={result.page * result.size >= result.total}
        onClick={() => onPage(result.page + 1)}
      >
        Trang sau
      </button>
    </nav>
  );
}
function usePageQuery() {
  const search = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const update = (values: Record<string, string>) => {
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(values))
      value ? params.set(key, value) : params.delete(key);
    router.push(`${path}?${params}`);
  };
  return { params: new URLSearchParams(search.toString()), update };
}
function ProgressCards() {
  const state = useResource('learning-progress', (signal) => learningApi.progress(signal));
  return (
    <>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <div className="api-grid">
          <article className="api-card">
            <h2>Từ vựng</h2>
            <p>
              {state.data.vocabulary.reviewed} / {state.data.vocabulary.total} từ đã ôn
            </p>
            <p>{state.data.vocabulary.dueToday} từ đến lịch ôn</p>
            <Link href="/study/vocabulary?review=today">Ôn hôm nay</Link>
          </article>
          <article className="api-card">
            <h2>Ngữ pháp</h2>
            <p>
              {state.data.lessons.completed} / {state.data.lessons.total} bài đã hoàn thành
            </p>
            <Link href="/study/grammar">Đọc bài học</Link>
          </article>
        </div>
      )}
    </>
  );
}
function ApiDashboard() {
  const state = useResource('streak', (signal) => analyticsApi.streak(signal));
  return (
    <>
      <h1>Mỗi ngày, tiến thêm một bước</h1>
      <p>Tiến độ của tài khoản từ server. Tải lại sau hoạt động học để nhận số liệu mới nhất.</p>
      <ProgressCards />
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <article className="api-card">
          <h2>Chuỗi ngày học</h2>
          <p>
            {state.data.current} ngày hiện tại · Dài nhất {state.data.longest} ngày
          </p>
        </article>
      )}
      <Blocked>
        Điểm TOEIC, mục tiêu học và thời gian học chưa có dữ liệu đã được xác nhận đủ điều kiện.
        Không thay bằng số liệu minh họa.
      </Blocked>
    </>
  );
}
function Vocabulary({ topicId, writes }: { topicId?: string; writes: boolean }) {
  const { params, update } = usePageQuery(),
    review = params.get('review') === 'today';
  const topics = useResource('vocabulary-topics', (signal) => learningApi.topics(signal));
  const due = useResource(`due:${review}`, async (signal) =>
    review ? learningApi.due(signal) : null,
  );
  const words = useResource(`words:${topicId}:${params}`, async (signal) =>
    topicId
      ? learningApi.words(new URLSearchParams({ ...Object.fromEntries(params), topicId }), signal)
      : null,
  );
  const [revision, setRevision] = useState(0);
  return (
    <>
      <h1>{review ? 'Lịch ôn hôm nay' : 'Từ vựng & Flashcard'}</h1>
      <p>
        <Link href="/study/vocabulary">Chủ đề</Link> ·{' '}
        <Link href="/study/vocabulary?review=today">Ôn hôm nay</Link>
      </p>
      <div key={revision}>
        <ProgressCards />
      </div>
      <ResourceState {...topics} retry={topics.reload} empty={topics.data?.length === 0} />
      {!topicId && !review && (
        <div className="api-grid">
          {topics.data?.map((topic) => (
            <article className="api-card" key={topic.id}>
              <h2>
                <Link href={`/study/vocabulary/${encodeURIComponent(topic.id)}`}>
                  {topic.name || 'Chưa có tên'}
                </Link>
              </h2>
              <p>{topic.description}</p>
              <p>{topic.wordCount} từ</p>
            </article>
          ))}
        </div>
      )}
      {topicId && (
        <>
          <p>Chủ đề: {topics.data?.find((t) => t.id === topicId)?.name ?? topicId}</p>
          <SearchForm
            value={params.get('keyword') ?? ''}
            onSearch={(keyword) => update({ keyword, page: '1' })}
          />
          <ResourceState {...words} retry={words.reload} empty={words.data?.items.length === 0} />
          {words.data?.items.map((word) => (
            <Word
              key={word.id}
              value={word}
              writes={writes}
              onReviewed={() => {
                setRevision((n) => n + 1);
                due.reload();
              }}
            />
          ))}
          {words.data && (
            <Pagination result={words.data} onPage={(page) => update({ page: String(page) })} />
          )}
        </>
      )}
      {review && (
        <>
          <ResourceState {...due} retry={due.reload} empty={due.data?.length === 0} />
          {due.data?.map((item) => (
            <Word
              key={item.vocabularyId}
              value={item.word}
              writes={writes}
              onReviewed={() => {
                setRevision((n) => n + 1);
                due.reload();
              }}
            />
          ))}
        </>
      )}
      <Blocked>
        Quiz và kết quả quiz chưa có API. Đánh giá nhớ gửi quality 0–5 đến server; trình duyệt không
        tự tính SM-2 hoặc tăng tiến độ.
      </Blocked>
    </>
  );
}
function Word({
  value: word,
  onReviewed,
  writes,
}: {
  value: ReturnType<typeof parseWord>;
  onReviewed: () => void;
  writes: boolean;
}) {
  const [flipped, setFlipped] = useState(false),
    [quality, setQuality] = useState(''),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    lock = useRef(false);
  return (
    <article className="api-card">
      <h2>{word.word}</h2>
      <p>{word.pronunciation ?? 'Chưa có phiên âm'}</p>
      <button onClick={() => setFlipped((v) => !v)} aria-expanded={flipped}>
        Lật thẻ
      </button>
      {flipped && (
        <div>
          <p>{word.meaning}</p>
          <p>{word.example ?? 'Chưa có ví dụ'}</p>
        </div>
      )}
      {word.imageUrl && <ServerImage source={word.imageUrl} label={`Minh họa ${word.word}`} />}
      <AudioPlayer
        source={word.audioUrl}
        label={`Phát âm ${word.word}`}
        missingTitle="Chưa có audio"
        missingMessage="Server chưa cấp URL audio hợp lệ."
      />
      <label className="api-field">
        Chất lượng nhớ (SM-2)
        <select
          value={quality}
          disabled={busy || !writes}
          onChange={(e) => setQuality(e.target.value)}
        >
          <option value="">Chọn đánh giá</option>
          {[0, 1, 2, 3, 4, 5].map((q) => (
            <option key={q} value={q}>
              {q} / 5
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy || !writes || quality === ''}
        onClick={async () => {
          if (lock.current || !writes) return;
          lock.current = true;
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const result = await learningApi.review(word.id, Number(quality));
            setMessage(
              `Đã đồng bộ. Lịch ôn tiếp: ${result.nextReviewAt ? new Date(result.nextReviewAt).toLocaleString('vi-VN') : 'chưa có'}.`,
            );
            setQuality('');
            onReviewed();
          } catch (e) {
            setError(
              `${failureMessage(e)} Chưa xác nhận đồng bộ; hãy kiểm tra lịch ôn trước khi gửi lại để tránh tính hai lần.`,
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? 'Đang đồng bộ…' : 'Gửi đánh giá'}
      </button>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </article>
  );
}
function ServerImage({ source, label }: { source: string; label: string }) {
  const [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  return failed ? (
    <div role="status">
      <p>Chưa tải được hình ảnh từ URL server cấp.</p>
      <button
        onClick={() => {
          setFailed(false);
          setRevision((n) => n + 1);
        }}
      >
        Tải lại hình ảnh
      </button>
    </div>
  ) : (
    <img key={revision} src={source} alt={label} loading="lazy" onError={() => setFailed(true)} />
  );
}
function GrammarLibrary() {
  const { params, update } = usePageQuery();
  const state = useResource(`lessons:${params}`, (signal) =>
    learningApi.lessons(
      new URLSearchParams({ ...Object.fromEntries(params), status: 'PUBLISHED' }),
      signal,
    ),
  );
  return (
    <>
      <h1>Thư viện ngữ pháp</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ level: String(new FormData(e.currentTarget).get('level') ?? '').trim() });
        }}
      >
        <label className="api-field">
          Trình độ (level theo server)
          <input name="level" defaultValue={params.get('level') ?? ''} />
        </label>
        <button>Lọc bài học</button>
      </form>
      <ResourceState {...state} retry={state.reload} empty={state.data?.length === 0} />
      <div className="api-grid">
        {state.data?.map((lesson) => (
          <article className="api-card" key={lesson.id}>
            <h2>
              <Link href={`/study/grammar/${encodeURIComponent(lesson.id)}`}>{lesson.title}</Link>
            </h2>
            <p>Trình độ: {lesson.level}</p>
          </article>
        ))}
      </div>
    </>
  );
}
function GrammarLesson({ id, writes }: { id: string; writes: boolean }) {
  const state = useResource(`lesson:${id}`, (signal) => learningApi.lesson(id, signal));
  const [busy, setBusy] = useState(false),
    [completed, setCompleted] = useState(''),
    [error, setError] = useState(''),
    lock = useRef(false);
  return (
    <>
      <Link href="/study/grammar">← Thư viện ngữ pháp</Link>
      <ResourceState {...state} retry={state.reload} />
      {state.data &&
        (state.data.status !== 'PUBLISHED' ? (
          <Blocked>Bài học chưa được công bố. Cần backend kiểm soát trạng thái truy cập.</Blocked>
        ) : (
          <article className="api-card">
            <h1>{state.data.title}</h1>
            <p>Trình độ: {state.data.level}</p>
            {state.data.content ? (
              <LessonMarkdown content={state.data.content} />
            ) : (
              <p>Server chưa có nội dung bài học.</p>
            )}
            <button
              disabled={busy || !writes || !!completed || !state.data.content}
              onClick={async () => {
                if (lock.current || !writes) return;
                lock.current = true;
                setBusy(true);
                setError('');
                try {
                  const result = await learningApi.complete(id);
                  setCompleted(new Date(result.completedAt).toLocaleString('vi-VN'));
                } catch (e) {
                  setError(failureMessage(e));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Đang gửi…' : completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
            </button>
            {completed && (
              <>
                <p role="status">Server xác nhận hoàn thành lúc {completed}.</p>
                <ProgressCards />
              </>
            )}
            {error && (
              <p role="alert" className="api-error">
                {error}
              </p>
            )}
            {!completed && (
              <p>
                Chưa có API đọc trạng thái hoàn thành từng bài; không suy ra trạng thái từ tổng số
                bài.
              </p>
            )}
          </article>
        ))}
    </>
  );
}
export function SearchForm({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="api-actions"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <label className="api-field">
        Từ khóa
        <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button>Tìm kiếm</button>
    </form>
  );
}
function ExamLibrary() {
  const { params, update } = usePageQuery();
  const state = useResource(`tests:${params}`, (signal) =>
    examApi.list(
      new URLSearchParams({ ...Object.fromEntries(params), status: 'PUBLISHED' }),
      signal,
    ),
  );
  return (
    <>
      <h1>Thư viện đề thi</h1>
      <SearchForm
        value={params.get('keyword') ?? ''}
        onSearch={(keyword) => update({ keyword, page: '1' })}
      />
      <label className="api-field">
        Loại đề
        <select
          value={params.get('type') ?? ''}
          onChange={(e) => update({ type: e.target.value, page: '1' })}
        >
          <option value="">Tất cả</option>
          <option value="FULL">Full Test</option>
          <option value="MINI">Mini Test</option>
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      <div className="api-grid">
        {state.data?.items.map((test) => (
          <article className="api-card" key={test.id}>
            <h2>
              <Link href={`/exam/${encodeURIComponent(test.id)}`}>{test.title}</Link>
            </h2>
            <p>
              {test.type} · {test.questionCount} câu · {test.durationSeconds / 60} phút
            </p>
          </article>
        ))}
      </div>
      {state.data && (
        <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
      )}
      <AttemptBlocked />
    </>
  );
}
function AttemptBlocked() {
  return (
    <Blocked>
      <ul>
        {EXAM_BLOCKERS.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      Chưa thể bắt đầu hoặc nộp lượt làm bài thật. Các luồng luyện Part vẫn có thể kiểm thử riêng
      trong chế độ DEMO.
    </Blocked>
  );
}
function ExamDetail({ id }: { id: string }) {
  const state = useResource(`test:${id}`, (signal) => examApi.detail(id, signal));
  const [mode, setMode] = useState('TEST'),
    [parts, setParts] = useState<number[]>([]);
  return (
    <>
      <Link href="/exam">← Danh sách đề</Link>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <article className="api-card">
          <h1>{state.data.title}</h1>
          <p>
            {state.data.type} · {state.data.questionCount} câu · {state.data.durationSeconds / 60}{' '}
            phút
          </p>
          <p>Trạng thái: {state.data.status}</p>
          <label className="api-field">
            Chế độ muốn làm
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="TEST">Thi thử</option>
              <option value="PRACTICE">Luyện tập</option>
            </select>
          </label>
          <fieldset>
            <legend>Part trong cấu trúc server (lựa chọn chưa được gửi)</legend>
            {[...new Set(state.data.questions?.map((q) => q.part) ?? [])].sort().map((part) => (
              <label className="api-actions" key={part}>
                <input
                  style={{ width: 'auto' }}
                  type="checkbox"
                  checked={parts.includes(part)}
                  onChange={(e) =>
                    setParts((p) => (e.target.checked ? [...p, part] : p.filter((x) => x !== part)))
                  }
                />
                Part {part}
              </label>
            ))}
          </fieldset>
          <p>
            Đã chọn {parts.length} Part · {mode}. Backend chưa nhận được lựa chọn này.
          </p>
          <button disabled>Bắt đầu · chưa khả dụng</button>
        </article>
      )}
      <AttemptBlocked />
    </>
  );
}
function History() {
  const state = useResource('score-history', (signal) => analyticsApi.scores(signal));
  return (
    <>
      <h1>Lịch sử từ server</h1>
      <ResourceState {...state} retry={state.reload} empty={state.data?.length === 0} />
      {state.data?.map((item) => (
        <article className="api-card" key={item.attemptId}>
          <p>
            {item.testType} · {new Date(item.takenAt).toLocaleString('vi-VN')}
          </p>
          <Link href={`/exam/server/result?attempt=${encodeURIComponent(item.attemptId)}`}>
            Mở kết quả lượt {item.attemptId}
          </Link>
        </article>
      ))}
      <Blocked>
        API này chỉ có lịch sử đã phát sinh score, chưa phải danh sách đầy đủ lượt làm bài. Điểm
        server hiện là placeholder số câu đúng; không hiển thị thành điểm TOEIC.
      </Blocked>
    </>
  );
}
function AttemptResult() {
  const search = useSearchParams(),
    attempt = search.get('attempt');
  const state = useResource(`result:${attempt}`, async (signal) =>
    attempt ? examApi.result(attempt, signal) : null,
  );
  return (
    <>
      <h1>Kết quả & lựa chọn đã đồng bộ</h1>
      <Link href="/history">← Lịch sử</Link>
      {!attempt ? (
        <Blocked>
          Cần ID lượt làm bài thật từ server. ID local/demo không được gửi sang API.
        </Blocked>
      ) : (
        <ResourceState {...state} retry={state.reload} />
      )}
      {state.data && (
        <article className="api-card">
          <h2>{state.data.title ?? state.data.testId}</h2>
          <p>Trạng thái: {state.data.status}</p>
          {state.data.status !== 'IN_PROGRESS' && state.data.totalCorrect !== null && (
            <p>Số câu đúng server trả về: {state.data.totalCorrect}. Chưa phải điểm TOEIC.</p>
          )}
          {state.data.answers.length === 0 && <p>Server chưa trả lựa chọn.</p>}
          <ul>
            {state.data.answers.map((answer) => (
              <li key={answer.questionId}>
                {answer.questionId}: {answer.selectedOption ?? 'Bỏ trống'}
                {answer.isCorrect === null ? '' : answer.isCorrect ? ' · Đúng' : ' · Sai'}
              </li>
            ))}
          </ul>
        </article>
      )}
      <Blocked>
        Chưa có contract review chứa nội dung câu hỏi, đáp án đúng, lời giải hoặc transcript theo
        thời điểm được phép. Không gọi ngân hàng câu hỏi để suy ra đáp án.
      </Blocked>
    </>
  );
}
function Analytics() {
  const { params, update } = usePageQuery(),
    range = params.get('time_range') ?? 'LAST_30_DAYS';
  const state = useResource(`analytics:${range}`, async (signal) => {
    const [progress, streak, weak, prediction] = await Promise.all([
      analyticsApi.progress(range, signal),
      analyticsApi.streak(signal),
      analyticsApi.weakAreas(signal),
      analyticsApi.prediction(signal),
    ]);
    if (progress.timeRange !== range)
      throw new Error('Khoảng thời gian server trả về không khớp bộ lọc.');
    return { progress, streak, weak, prediction };
  });
  return (
    <>
      <h1>Thống kê tiến độ</h1>
      <label className="api-field">
        Khoảng thời gian hoạt động
        <select value={range} onChange={(e) => update({ time_range: e.target.value })}>
          {[
            ['LAST_7_DAYS', '7 ngày'],
            ['LAST_30_DAYS', '30 ngày'],
            ['LAST_90_DAYS', '90 ngày'],
            ['ALL_TIME', 'Toàn thời gian'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <>
          <article className="api-card">
            <h2>Tổng tích lũy (mọi thời gian)</h2>
            <p>
              {state.data.progress.lifetime.totalStudyDays} ngày ·{' '}
              {state.data.progress.lifetime.totalVocabLearned} từ ·{' '}
              {state.data.progress.lifetime.totalLessons} bài học
            </p>
            <p>Chuỗi hiện tại: {state.data.streak.current} ngày.</p>
          </article>
          <article className="api-card">
            <h2>Hoạt động trong khoảng đã chọn</h2>
            {Object.keys(state.data.progress.activities).length === 0 ? (
              <p>Chưa có hoạt động.</p>
            ) : (
              <ul>
                {Object.entries(state.data.progress.activities).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="api-card">
            <h2>Khu vực cần cải thiện (tổng tích lũy)</h2>
            {state.data.weak.length === 0 ? (
              <p>Chưa có dữ liệu đã chấm.</p>
            ) : (
              <ul>
                {state.data.weak.map((item, i) => (
                  <li key={i}>
                    {item.skillArea} · Part {item.part} · Tỷ lệ lỗi{' '}
                    {(item.errorRate * 100).toFixed(1)}% · {item.sampleCount} mẫu
                  </li>
                ))}
              </ul>
            )}
            <p>
              Backend chưa có đúng/tổng theo Part và chuỗi dữ liệu theo ngày; không dựng biểu đồ
              bằng số mẫu.
            </p>
          </article>
          <Blocked>
            Dự đoán: {state.data.prediction.reason} ({state.data.prediction.recentAttempts} lượt
            trong cửa sổ backend). Không hiển thị giá trị PLACEHOLDER_MEAN thành dự đoán TOEIC.
          </Blocked>
        </>
      )}
    </>
  );
}
function Profile({
  user,
  onSaved,
  writes,
}: {
  user: User;
  onSaved: (user: User) => void;
  writes: boolean;
}) {
  const [fullName, setName] = useState(user.fullName),
    [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    lock = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <h1>Hồ sơ của bạn</h1>
      <article className="api-card">
        <p>Email: {user.email}</p>
        <p>Vai trò: {user.roles.join(', ')}</p>
        <p>Trạng thái: {user.status}</p>
        <form
          ref={form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || !writes) return;
            setError('');
            setSaved(false);
            setErrors({});
            if (fullName.trim().length < 2) {
              setErrors({ fullName: 'Họ tên cần ít nhất hai ký tự.' });
              form.current?.querySelector('input')?.focus();
              return;
            }
            lock.current = true;
            setBusy(true);
            try {
              const result = matchingId(await profileApi.update(fullName, phone), user.id);
              onSaved(result);
              setName(result.fullName);
              setPhone(result.phoneNumber ?? '');
              setSaved(true);
            } catch (cause) {
              setError(failureMessage(cause));
              setErrors(validationFields(cause, ['fullName', 'phoneNumber']));
              requestAnimationFrame(() =>
                form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
              );
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy || !writes}>
            <label className="api-field">
              Họ và tên
              <input
                autoComplete="name"
                value={fullName}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'profile-name-error' : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
              />
              {errors.fullName && (
                <span id="profile-name-error" className="api-error">
                  {errors.fullName}
                </span>
              )}
            </label>
            <label className="api-field">
              Số điện thoại
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                aria-invalid={!!errors.phoneNumber}
                aria-describedby={errors.phoneNumber ? 'profile-phone-error' : undefined}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSaved(false);
                }}
              />
              {errors.phoneNumber && (
                <span id="profile-phone-error" className="api-error">
                  {errors.phoneNumber}
                </span>
              )}
            </label>
          </fieldset>
          <button disabled={busy || !writes}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </form>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {saved && <p role="status">Server đã xác nhận cập nhật hồ sơ.</p>}
      </article>
      <Blocked>
        Avatar cần API presign, hoàn tất và URL đọc riêng tư. Chưa thể thay avatar hoặc xác
        minh/thay email bằng API hiện tại.
      </Blocked>
    </>
  );
}
