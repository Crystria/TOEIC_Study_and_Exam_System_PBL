'use client';
/* eslint-disable @next/next/no-img-element -- Media URLs are validated complete backend URLs. */
import Link from 'next/link';
import { AccountAnalytics } from './account-analytics';
import { PasswordForm } from './password-forms';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { learningApi, examApi, analyticsApi, profileApi } from '../../lib/integration/repositories';
import { failureMessage, validationFields } from '../../lib/integration/client';
import { matchingId, type User } from '../../lib/integration/contracts';
import { StudentShell } from '../layout/student-shell';
import { FlashcardPracticeSettings } from '../learning/flashcard-practice-settings';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { useFlashcardPracticeLimit } from '../learning/use-flashcard-practice-limit';
import { VocabularyEntryCard } from '../learning/vocabulary-entry-card';
import { VocabularyListCard } from '../learning/vocabulary-list-card';
import { ServerExamDetail, ServerHistory, ServerAttemptScreen } from './exam-flow';
import { ExamLibraryCard } from '../exams/exam-library-card';
import {
  flashcardTopicHref,
  VocabularySession,
  VocabularySessionStart,
} from './vocabulary-session';
import { MediaUpload } from './media-upload';
import { AccountAvatar } from '../profile/account-avatar';
import { ProfileUpdateStatus } from '../profile/profile-update-status';
import { EmailActivation } from './email-activation';
import { Blocked, ResourceState, SessionGate, useResource } from './shared';
import { SearchForm } from './search-form';
import { LearningLibraryNav, PersonalLearningLibrary } from './personal-learning';
import { LearningLibraryCard } from './learning-library-card';
import { ServerPagination } from './server-pagination';

type ProfileChanges = Partial<Pick<User, 'fullName' | 'phoneNumber' | 'avatarUrl'>>;

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
  if (['/', '/login', '/register', '/forgot-password', '/reset-password'].includes(path))
    return <>{children}</>;
  if (path === '/verify-email') return <EmailActivation writes={writes} />;
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
  const viewParams = new URLSearchParams(search.toString());
  viewParams.delete('page');
  const practiceEntry = /^\/exam\/[^/]+$/.test(path) && search.get('entry') === 'practice';
  const hideReadOnlyNotice = [
    '/analytics',
    '/dashboard',
    '/study/vocabulary',
    '/study/grammar',
    '/history',
  ].some((section) => path === section || path.startsWith(`${section}/`));
  return (
    <StudentShell apiAccount={user} activeSection={practiceEntry ? '/practice' : undefined}>
      <div
        className={`api-root${/^\/exam\/[^/]+\/take$/.test(path) ? ' api-root-exam' : ''}`}
        key={`${path}?${viewParams}`}
      >
        {!writes &&
          !hideReadOnlyNotice &&
          !path.startsWith('/exam') &&
          path !== '/practice' &&
          search.get('library') !== 'personal' && (
            <Blocked>
              Chưa bật cập nhật hồ sơ, phiên học kèm quiz hoặc hoàn thành bài học cho tài khoản.
            </Blocked>
          )}
        <StudentDomain
          user={user}
          onProfile={(changes) => setUser((current) => ({ ...current, ...changes }))}
          writes={writes}
          examWrites={examWrites}
          practiceEntry={practiceEntry}
        />
      </div>
    </StudentShell>
  );
}
function StudentDomain({
  user,
  onProfile,
  writes,
  examWrites,
  practiceEntry,
}: {
  user: User;
  onProfile: (changes: ProfileChanges) => void;
  writes: boolean;
  examWrites: boolean;
  practiceEntry: boolean;
}) {
  const path = usePathname(),
    search = useSearchParams(),
    parts = path.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    try {
      parts[i] = decodeURIComponent(parts[i]);
    } catch {
      /* transport rejects invalid IDs */
    }
  }
  if (path === '/dashboard') return <ApiDashboard />;
  if (path.startsWith('/study/vocabulary')) {
    const personal = search.get('library') === 'personal';
    const topicId = personal ? search.get('topic') : parts[2];
    const flashcardSession = search.get('flashcardSession');
    const legacySession = search.get('session');
    const session = flashcardSession || legacySession;
    if (session && topicId)
      return (
        <VocabularySession
          id={session}
          legacy={!flashcardSession}
          writes={Boolean(flashcardSession) || writes}
          backHref={flashcardTopicHref(topicId, personal ? 'PERSONAL' : 'SHARED')}
        />
      );
    if (personal) return <PersonalLearningLibrary kind="vocabulary" ownerId={user.id} />;
    return <Vocabulary key={parts[2] ?? 'topics'} topicId={parts[2]} ownerId={user.id} />;
  }
  if (path.startsWith('/study/grammar')) {
    if (search.get('library') === 'personal')
      return <PersonalLearningLibrary kind="grammar" ownerId={user.id} />;
    return parts[2] ? <GrammarLesson id={parts[2]} writes={writes} /> : <GrammarLibrary />;
  }
  if (path === '/exam' || path === '/practice')
    return <ExamLibrary practice={path === '/practice'} />;
  if (parts[0] === 'exam' && parts[1]) {
    if (['result', 'review', 'take'].includes(parts[2]))
      return <ServerAttemptScreen writes={examWrites} review={parts[2] === 'review'} />;
    return <ServerExamDetail id={parts[1]} writes={examWrites} practiceEntry={practiceEntry} />;
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
  if (path === '/analytics') return <AccountAnalytics />;
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
              {state.data.vocabulary.reviewed + (state.data.libraries?.PERSONAL.reviewed ?? 0)} từ
              đã ôn
            </p>
            <p>{state.data.vocabulary.dueToday} từ thư viện chung đến lịch ôn</p>
            <Link href="/study/vocabulary?review=today">Luyện tập bằng flashcard</Link>
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
        <Link href="/analytics">trang Thống kê</Link>.
      </Blocked>
    </>
  );
}
function Vocabulary({ topicId, ownerId }: { topicId?: string; ownerId: string }) {
  const { params, update } = usePageQuery(),
    review = params.get('review') === 'today';
  const [limit, setLimit] = useFlashcardPracticeLimit(ownerId);
  const topics = useResource('topics:' + params, (signal) =>
    !topicId ? learningApi.topics(signal, params) : Promise.resolve(null),
  );
  const topic = useResource('topic:' + topicId, (signal) =>
    topicId ? learningApi.topic(topicId, signal) : Promise.resolve(null),
  );
  const words = useResource('words:' + topicId + params, (signal) =>
    topicId && !review
      ? learningApi.words(new URLSearchParams({ ...Object.fromEntries(params), topicId }), signal)
      : Promise.resolve(null),
  );
  return (
    <>
      <h1>{topic.data?.name ?? 'Từ vựng & Flashcard'}</h1>
      <LearningLibraryNav kind="vocabulary" />
      <nav className="vocabulary-nav" aria-label="Điều hướng từ vựng">
        <Link href="/study/vocabulary" aria-current={!topicId && !review ? 'page' : undefined}>
          Danh sách từ vựng
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/study/vocabulary?review=today" aria-current={review ? 'page' : undefined}>
          Luyện tập bằng flashcard
        </Link>
      </nav>
      <FlashcardPracticeSettings limit={limit} onSave={setLimit} />
      {!topicId && (
        <>
          {review && <h2>Chọn danh sách để luyện tập</h2>}
          <SearchForm
            value={params.get('keyword') ?? ''}
            onSearch={(keyword) => update({ keyword, page: '1' })}
          />
          <ResourceState
            {...topics}
            retry={topics.reload}
            empty={topics.data?.items.length === 0}
          />
          <div className="vocabulary-list-grid">
            {topics.data?.items.map((t) => (
              <VocabularyListCard
                key={t.id}
                title={t.name}
                wordCount={t.wordCount}
                href={`/study/vocabulary/${encodeURIComponent(t.id)}${review ? '?review=today' : ''}`}
                actionLabel={review ? 'Luyện tập' : undefined}
              />
            ))}
          </div>
          {topics.data && <ServerPagination result={topics.data} />}
        </>
      )}
      {topicId && (
        <VocabularySessionStart
          topicId={topicId}
          scope="SHARED"
          limit={limit}
          initialMode={review ? 'REVIEW' : 'NEW'}
        />
      )}
      {topicId && !review && (
        <>
          <h2>Danh sách từ vựng</h2>
          <SearchForm
            value={params.get('keyword') ?? ''}
            onSearch={(keyword) => update({ keyword, page: '1' })}
          />
          <ResourceState {...words} retry={words.reload} empty={words.data?.items.length === 0} />
          <div className="vocabulary-entry-list">
            {words.data?.items.map((word) => (
              <VocabularyEntryCard
                key={word.id}
                entry={word}
                image={word.imageUrl && <ServerImage source={word.imageUrl} label={word.word} />}
              />
            ))}
          </div>
          {words.data && <ServerPagination result={words.data} />}
        </>
      )}
    </>
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
      <LearningLibraryNav kind="grammar" />
      <SearchForm
        value={params.get('keyword') ?? ''}
        onSearch={(keyword) => update({ keyword, page: '1' })}
      />
      <form
        className="api-search-form"
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
          <LearningLibraryCard
            key={lesson.id}
            title={lesson.title}
            openLabel={`Xem bài: ${lesson.title}`}
            href={`/study/grammar/${encodeURIComponent(lesson.id)}`}
          >
            <p>Danh mục: {lesson.level}</p>
          </LearningLibraryCard>
        ))}
      </div>
      {state.data && <ServerPagination result={state.data} />}
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
function ExamLibrary({ practice }: { practice: boolean }) {
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
          <ExamLibraryCard test={test} key={test.id} practice={practice} />
        ))}
      </div>
      {state.data && <ServerPagination result={state.data} />}
    </>
  );
}
function Profile({
  user,
  onSaved,
  writes,
}: {
  user: User;
  onSaved: (changes: ProfileChanges) => void;
  writes: boolean;
}) {
  const [fullName, setName] = useState(user.fullName),
    [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [busy, setBusy] = useState(false),
    [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null),
    lock = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <>
      <h1>Hồ sơ của bạn</h1>
      <article className="api-card">
        <AccountAvatar
          source={user.avatarUrl}
          name={user.fullName}
          label="Ảnh đại diện của bạn"
          large
        />
        <p>Email: {user.email}</p>
        <p>Vai trò: {user.roles.join(', ')}</p>
        <p>Trạng thái: {user.status}</p>
        <form
          ref={form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || !writes) return;
            setSaveStatus(null);
            setErrors({});
            if (fullName.trim().length < 2) {
              setErrors({ fullName: 'Họ tên cần ít nhất hai ký tự.' });
              setSaveStatus('error');
              form.current?.querySelector('input')?.focus();
              return;
            }
            lock.current = true;
            setBusy(true);
            try {
              const result = matchingId(await profileApi.update(fullName, phone), user.id);
              onSaved({ fullName: result.fullName, phoneNumber: result.phoneNumber });
              setName(result.fullName);
              setPhone(result.phoneNumber ?? '');
              setSaveStatus('success');
            } catch (cause) {
              setSaveStatus('error');
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
                  setSaveStatus(null);
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
                  setSaveStatus(null);
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
        {saveStatus && <ProfileUpdateStatus status={saveStatus} />}
      </article>
      <MediaUpload
        scope="avatar"
        resourceId={user.id}
        kind="IMAGE"
        writes={writes}
        saved={async () => {
          const { avatarUrl } = matchingId(await profileApi.read(), user.id);
          onSaved({ avatarUrl });
        }}
      />
      <article className="api-card">
        <PasswordForm mode="change" profileUpdateFeedback />
      </article>
    </>
  );
}
