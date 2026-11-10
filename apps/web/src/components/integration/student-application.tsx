'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are validated complete backend URLs. */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { learningApi, examApi, analyticsApi, profileApi } from '../../lib/integration/repositories';
import { failureMessage, validationFields } from '../../lib/integration/client';
import { matchingId, type User, type Page, type parseWord } from '../../lib/integration/contracts';
import { StudentShell } from '../layout/student-shell';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { AudioPlayer } from '../ui/audio-player';
import { ServerExamDetail, ServerHistory, ServerAttemptScreen } from './exam-flow';
import { VocabularySession, VocabularySessionStart } from './vocabulary-session';
import { MediaUpload } from './media-upload';
import { EmailActivation } from './email-activation';
import { ApiAuth, Blocked, ResourceState, SessionGate, useResource } from './shared';

export function ApiStudentApplication({
  children,
  writes = false,
  examWrites = false,
}: {
  children: ReactNode;
  writes?: boolean;
  examWrites?: boolean;
}) {
  const path = usePathname();
  if (path === '/') return <>{children}</>;
  if (path === '/verify-email') return <EmailActivation writes={writes} />;
  if (path === '/login' || path === '/register')
    return <ApiAuth register={path === '/register'} writes={writes} />;
  return (
    <SessionGate key={path}>
      {(user) => (
        <AuthenticatedStudent
          key={user.id}
          initial={user}
          writes={writes}
          examWrites={examWrites}
        />
      )}
    </SessionGate>
  );
}
function AuthenticatedStudent({
  initial,
  writes,
  examWrites,
}: {
  initial: User;
  writes: boolean;
  examWrites: boolean;
}) {
  const [user, setUser] = useState(initial),
    path = usePathname(),
    search = useSearchParams();
  return (
    <StudentShell apiAccount={user}>
      <div className="api-root" key={`${path}?${search}`}>
        <span className="api-label">API · Dữ liệu server · Local / test</span>
        {!writes && !path.startsWith('/exam') && path !== '/history' && path !== '/practice' && (
          <Blocked>
            Chế độ chỉ đọc. Chưa bật cập nhật hồ sơ, đánh giá Flashcard hoặc hoàn thành bài học cho
            tài khoản.
          </Blocked>
        )}
        <StudentDomain user={user} onProfile={setUser} writes={writes} examWrites={examWrites} />
      </div>
    </StudentShell>
  );
}
function StudentDomain({
  user,
  onProfile,
  writes,
  examWrites,
}: {
  user: User;
  onProfile: (user: User) => void;
  writes: boolean;
  examWrites: boolean;
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
    if (['result', 'review', 'take'].includes(parts[2]))
      return <ServerAttemptScreen writes={examWrites} review={parts[2] === 'review'} />;
    return <ServerExamDetail id={parts[1]} writes={examWrites} />;
  }
  if (path === '/history') return <ServerHistory />;
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
            <p>{state.data.vocabulary.reviewed} từ đã ôn</p>
            <p>{state.data.vocabulary.dueToday} từ đến lịch ôn</p>
            <Link href="/study/vocabulary?review=today">Ôn hôm nay</Link>
          </article>
          <article className="api-card">
            <h2>Ngữ pháp</h2>
            <p>{state.data.lessons.completed} bài đã hoàn thành</p>
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
        Mục tiêu và thời gian học chưa có API. Điểm Full Test và thống kê được đọc từ backend tại
        trang Thống kê.
      </Blocked>
    </>
  );
}
function Vocabulary({ topicId, writes }: { topicId?: string; writes: boolean }) {
  const { params, update } = usePageQuery(),
    review = params.get('review') === 'today';
  const topics = useResource('topics:' + params, (signal) => learningApi.topics(signal, params));
  const words = useResource('words:' + topicId + params, (signal) =>
    topicId
      ? learningApi.words(new URLSearchParams({ ...Object.fromEntries(params), topicId }), signal)
      : Promise.resolve(null),
  );
  const due = useResource('due:' + params, (signal) =>
    review ? learningApi.due(signal, params) : Promise.resolve(null),
  );
  if (params.has('session')) return <VocabularySession writes={writes} />;
  return (
    <>
      <h1>Từ vựng & Flashcard</h1>
      <p>
        <Link href="/study/vocabulary">Chủ đề</Link> ·{' '}
        <Link href="/study/vocabulary?review=today">Ôn hôm nay</Link>
      </p>
      {!topicId && !review && (
        <>
          <SearchForm
            value={params.get('keyword') ?? ''}
            onSearch={(keyword) => update({ keyword, page: '1' })}
          />
          <ResourceState
            {...topics}
            retry={topics.reload}
            empty={topics.data?.items.length === 0}
          />
          <div className="api-grid">
            {topics.data?.items.map((t) => (
              <article className="api-card" key={t.id}>
                <h2>
                  <Link href={'/study/vocabulary/' + encodeURIComponent(t.id)}>{t.name}</Link>
                </h2>
                <p>{t.wordCount} từ</p>
              </article>
            ))}
          </div>
          {topics.data && (
            <Pagination result={topics.data} onPage={(page) => update({ page: String(page) })} />
          )}
        </>
      )}
      {topicId && (
        <>
          <VocabularySessionStart topicId={topicId} writes={writes} />
          <SearchForm
            value={params.get('keyword') ?? ''}
            onSearch={(keyword) => update({ keyword, page: '1' })}
          />
          <ResourceState {...words} retry={words.reload} empty={words.data?.items.length === 0} />
          {words.data?.items.map((word) => (
            <Word key={word.id} value={word} />
          ))}
          {words.data && (
            <Pagination result={words.data} onPage={(page) => update({ page: String(page) })} />
          )}
        </>
      )}
      {review && (
        <>
          <ResourceState {...due} retry={due.reload} empty={due.data?.items.length === 0} />
          {due.data?.items.map((item) => (
            <article key={item.vocabularyId}>
              <Word value={item.word} />
              <p>Lịch ôn: {item.nextReviewAt}</p>
              <Link href={'/study/vocabulary/' + encodeURIComponent(item.word.topicId)}>
                Mở chủ đề để bắt đầu phiên ôn
              </Link>
            </article>
          ))}
          {due.data && (
            <Pagination result={due.data} onPage={(page) => update({ page: String(page) })} />
          )}
        </>
      )}
    </>
  );
}
function Word({ value: word }: { value: ReturnType<typeof parseWord> }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <article className="api-card">
      <h2>{word.word}</h2>
      <p>{word.pronunciation ?? 'Chưa có phiên âm'}</p>
      <button aria-expanded={flipped} onClick={() => setFlipped((v) => !v)}>
        Lật thẻ
      </button>
      {flipped && (
        <p>
          {word.meaning} · {word.example}
        </p>
      )}
      {word.imageUrl && <ServerImage source={word.imageUrl} label={word.word} />}
      <AudioPlayer
        mode="server"
        missingMessage="Server chưa cấp audio hợp lệ."
        source={word.audioUrl}
        label={'Phát âm ' + word.word}
      />
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
  const state = useResource(`lessons:${params}`, (signal) => learningApi.lessons(params, signal));
  return (
    <>
      <h1>Thư viện ngữ pháp</h1>
      <SearchForm
        value={params.get('keyword') ?? ''}
        onSearch={(keyword) => update({ keyword, page: '1' })}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({
            category: String(new FormData(e.currentTarget).get('category') ?? '').trim(),
            page: '1',
          });
        }}
      >
        <label className="api-field">
          Danh mục
          <input name="category" defaultValue={params.get('category') ?? ''} />
        </label>
        <button>Lọc bài học</button>
      </form>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      <div className="api-grid">
        {state.data?.items.map((lesson) => (
          <article className="api-card" key={lesson.id}>
            <h2>
              <Link href={`/study/grammar/${encodeURIComponent(lesson.id)}`}>{lesson.title}</Link>
            </h2>
            <p>Danh mục: {lesson.level}</p>
          </article>
        ))}
      </div>
      {state.data && (
        <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
      )}
    </>
  );
}
function GrammarLesson({ id, writes }: { id: string; writes: boolean }) {
  const state = useResource(`lesson:${id}`, (signal) => learningApi.lesson(id, signal));
  const progress = useResource(`lesson-progress:${id}`, (signal) =>
    learningApi.entityProgress(id, signal),
  );
  const operation = useRef<string>();
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
            <p>Danh mục: {state.data.level}</p>
            {state.data.content ? (
              <LessonMarkdown content={state.data.content} />
            ) : (
              <p>Server chưa có nội dung bài học.</p>
            )}
            <button
              disabled={
                busy ||
                !writes ||
                !!completed ||
                !!progress.data?.completedAt ||
                !progress.data ||
                !state.data.content
              }
              onClick={async () => {
                if (lock.current || !writes) return;
                lock.current = true;
                setBusy(true);
                setError('');
                try {
                  if (!progress.data)
                    throw new Error('Chưa đọc được revision tiến độ. Hãy thử lại.');
                  operation.current ??= crypto.randomUUID();
                  const result = await learningApi.complete(
                    id,
                    progress.data.revision,
                    operation.current,
                  );
                  setCompleted(new Date(result.completedAt!).toLocaleString('vi-VN'));
                } catch (e) {
                  setError(failureMessage(e));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              {busy
                ? 'Đang gửi…'
                : completed || progress.data?.completedAt
                  ? 'Đã hoàn thành'
                  : 'Đánh dấu hoàn thành'}
            </button>
            {completed && (
              <>
                <p role="status">Server xác nhận hoàn thành lúc {completed}.</p>
                <ProgressCards />
              </>
            )}
            {!completed && progress.data?.completedAt && (
              <p role="status">
                Đã hoàn thành lúc {new Date(progress.data.completedAt).toLocaleString('vi-VN')}.
              </p>
            )}
            {error && (
              <p role="alert" className="api-error">
                {error}
              </p>
            )}
            <ResourceState {...progress} retry={progress.reload} />
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
    </>
  );
}
function Analytics() {
  const { params, update } = usePageQuery(),
    range = params.get('timeRange') ?? 'LAST_30_DAYS';
  const state = useResource('analytics:' + range, (signal) => analyticsApi.progress(range, signal));
  const [more, setMore] = useState<Awaited<ReturnType<typeof analyticsApi.progress>>['scoreTrend']>(
      [],
    ),
    [next, setNext] = useState<string>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false);
  return (
    <>
      <h1>Thống kê học tập</h1>
      <label className="api-field">
        Khoảng thời gian
        <select value={range} onChange={(e) => update({ timeRange: e.target.value })}>
          <option value="LAST_7_DAYS">7 ngày</option>
          <option value="LAST_30_DAYS">30 ngày</option>
          <option value="ALL_TIME">Toàn bộ</option>
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} />
      {state.data && (
        <>
          <article className="api-card">
            <h2>Trong khoảng đã chọn</h2>
            <p>
              {state.data.activities.vocabulariesLearned} từ mới ·{' '}
              {state.data.activities.grammarLessonsCompleted} bài ngữ pháp ·{' '}
              {state.data.activities.mockTestCount} bài Full · {state.data.activities.practiceCount}{' '}
              lượt luyện Part
            </p>
            <p>
              Toàn bộ: {state.data.lifetime.totalStudyDays} ngày học ·{' '}
              {state.data.lifetime.totalVocabLearned} từ · {state.data.lifetime.totalLessons} bài
            </p>
            <p>
              Dự đoán server:{' '}
              {state.data.predictedToeicScore === null
                ? 'Cần ít nhất 3 bài Full hợp lệ trong 30 ngày'
                : state.data.predictedToeicScore}
            </p>
          </article>
          <article className="api-card">
            <h2>Điểm Full Test trong khoảng đã chọn</h2>
            {!state.data.scoreTrend.length && <p>Chưa có bài Full được chấm.</p>}
            <ul>
              {[...state.data.scoreTrend, ...more].map((v) => (
                <li key={v.attemptId}>
                  {new Date(v.completedAt).toLocaleDateString('vi-VN')}: {v.totalScore}
                </li>
              ))}
            </ul>
            {(next === undefined ? state.data.nextCursor : next) && (
              <button
                disabled={busy}
                onClick={async () => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  try {
                    const cursor = next ?? state.data!.nextCursor!;
                    const page = await analyticsApi.progress(range, undefined, cursor);
                    if (page.nextCursor === cursor)
                      throw new Error('Cursor server không tiến triển.');
                    setMore((v) => [
                      ...v,
                      ...page.scoreTrend.filter(
                        (q) =>
                          !state.data!.scoreTrend.some((x) => x.attemptId === q.attemptId) &&
                          !v.some((x) => x.attemptId === q.attemptId),
                      ),
                    ]);
                    setNext(page.nextCursor ?? '');
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Tải tiếp xu hướng điểm
              </button>
            )}
            {error && <p role="alert">{error}</p>}
          </article>
          <details className="api-card">
            <summary>Hoạt động theo ngày</summary>
            {state.data.dailyActivityTruncated && (
              <p>Backend giới hạn cửa sổ hoạt động gần nhất.</p>
            )}
            <div className="api-scroll">
              <table className="api-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.dailyActivity.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <article className="api-card">
            <h2>Theo Part — cửa sổ 30 ngày của backend</h2>
            <ul>
              {state.data.weakAreas.map((p) => (
                <li key={p.part}>
                  Part {p.part}: {p.correct} / {p.total} ·{' '}
                  {p.total < 20
                    ? 'Chưa đủ dữ liệu'
                    : p.isWeak
                      ? 'Cần cải thiện'
                      : 'Chưa thuộc vùng yếu'}
                </li>
              ))}
            </ul>
          </article>
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
        {user.avatarUrl && <ServerImage source={user.avatarUrl} label="Ảnh đại diện của bạn" />}
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
      <MediaUpload
        scope="avatar"
        resourceId={user.id}
        kind="IMAGE"
        writes={writes}
        saved={() => {
          void profileApi
            .read()
            .then((value) => onSaved(matchingId(value, user.id)))
            .catch((e) => setError(failureMessage(e)));
        }}
      />
    </>
  );
}
