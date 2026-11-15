'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  personalLearningApi,
  type PersonalTopic,
  type PersonalWord,
  type PersonalLesson,
} from '../../lib/integration/personal-learning';
import { failureMessage, GatewayError } from '../../lib/integration/client';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { ResourceState, useResource } from './shared';
import { SearchForm } from './search-form';
import { LearningLibraryCard } from './learning-library-card';
import {
  PersonalContentEditor,
  PersonalDialog,
  type PersonalEditing,
} from './personal-learning-dialog';

type LibraryKind = 'vocabulary' | 'grammar';
type Removing =
  | { kind: 'topics'; item: PersonalTopic }
  | { kind: 'words'; item: PersonalWord }
  | { kind: 'lessons'; item: PersonalLesson };

export function LearningLibraryNav({
  kind,
  personal = false,
}: {
  kind: LibraryKind;
  personal?: boolean;
}) {
  const base = `/study/${kind}`;
  return (
    <nav className="personal-learning-tabs" aria-label="Thư viện học tập">
      <Link href={base} aria-current={!personal ? 'page' : undefined}>
        Thư viện chung
      </Link>
      <Link href={`${base}?library=personal`} aria-current={personal ? 'page' : undefined}>
        Của tôi
      </Link>
    </nav>
  );
}

export function PersonalLearningLibrary({ kind, ownerId }: { kind: LibraryKind; ownerId: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const topicId = kind === 'vocabulary' ? search.get('topic') : null;
  const params = new URLSearchParams();
  for (const field of ['keyword', 'page', 'category']) {
    const value = search.get(field);
    if (value) params.set(field, value);
  }
  params.set('size', '12');
  if (topicId) params.set('topicId', topicId);
  const topics = useResource(`personal-topics:${params}`, (signal) =>
    kind === 'vocabulary' && !topicId
      ? personalLearningApi.topics.list(params, signal)
      : Promise.resolve(null),
  );
  const topic = useResource(`personal-topic:${topicId}`, (signal) =>
    topicId ? personalLearningApi.topics.get(topicId, signal) : Promise.resolve(null),
  );
  const words = useResource(`personal-words:${params}`, (signal) =>
    topicId ? personalLearningApi.words.list(params, signal) : Promise.resolve(null),
  );
  const lessons = useResource(`personal-lessons:${params}`, (signal) =>
    kind === 'grammar' ? personalLearningApi.lessons.list(params, signal) : Promise.resolve(null),
  );
  const [editing, setEditing] = useState<PersonalEditing | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [viewing, setViewing] = useState<PersonalLesson | null>(null);
  const [mode, setMode] = useState<'list' | 'cards'>('list');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const state = kind === 'grammar' ? lessons : topicId ? words : topics;
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.set('library', 'personal');
    router.push(`${path}?${next}`);
  };
  const refresh = () => {
    if (kind === 'grammar') lessons.reload();
    else if (topicId) {
      words.reload();
      topic.reload();
    } else topics.reload();
  };
  const refreshAfterRemove = () => {
    if (state.data && state.data.items.length === 1 && state.data.page > 1)
      update({ page: String(state.data.page - 1) });
    else refresh();
  };
  const itemName =
    removing?.kind === 'topics'
      ? removing.item.name
      : removing?.kind === 'words'
        ? removing.item.word
        : removing?.item.title;
  const remove = async () => {
    if (!removing || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await personalLearningApi[removing.kind].remove(removing.item.id);
      setRemoving(null);
      setNotice('Đã xóa nội dung cá nhân.');
      refreshAfterRemove();
    } catch (cause) {
      if (cause instanceof GatewayError && cause.status === 404) {
        setRemoving(null);
        setNotice('Nội dung này không còn tồn tại. Danh sách đã được cập nhật.');
        refreshAfterRemove();
      } else setError(failureMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const pagination = state.data;
  return (
    <section className="personal-learning-library">
      <h1>{kind === 'vocabulary' ? 'Từ vựng & Flashcard' : 'Thư viện ngữ pháp'}</h1>
      <LearningLibraryNav kind={kind} personal />
      <p className="personal-learning-intro">
        Tạo và lưu{' '}
        {kind === 'vocabulary'
          ? 'chủ đề, từ vựng và thẻ ghi nhớ'
          : 'bài học, ví dụ và ghi chú ngữ pháp'}{' '}
        riêng trong tài khoản của bạn.
      </p>
      {topicId && (
        <Link className="personal-learning-back" href="/study/vocabulary?library=personal">
          ← Chủ đề của tôi
        </Link>
      )}
      {topicId && <ResourceState {...topic} retry={topic.reload} />}
      <div className="personal-learning-heading">
        <div>
          <h2>
            {kind === 'grammar'
              ? 'Bài ngữ pháp của tôi'
              : topicId
                ? (topic.data?.name ?? 'Từ vựng của tôi')
                : 'Chủ đề của tôi'}
          </h2>
          <p>
            {pagination
              ? `${pagination.total} ${kind === 'grammar' ? 'bài học' : topicId ? 'từ vựng' : 'chủ đề'}`
              : 'Nội dung cá nhân'}
          </p>
        </div>
        <button
          type="button"
          className="api-primary"
          disabled={Boolean(topicId && !topic.data)}
          onClick={() => {
            setEditing(
              kind === 'grammar'
                ? { kind: 'lessons' }
                : topicId
                  ? { kind: 'words', topicId }
                  : { kind: 'topics' },
            );
          }}
        >
          + {kind === 'grammar' ? 'Thêm bài ngữ pháp' : topicId ? 'Thêm từ vựng' : 'Thêm chủ đề'}
        </button>
      </div>
      <div className="personal-learning-filters">
        <SearchForm
          value={search.get('keyword') ?? ''}
          onSearch={(keyword) => update({ keyword, page: '1' })}
        />
        {kind === 'grammar' && (
          <form
            className="api-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              update({
                category: String(new FormData(event.currentTarget).get('category') ?? '').trim(),
                page: '1',
              });
            }}
          >
            <label className="api-field">
              Danh mục
              <input name="category" maxLength={255} defaultValue={search.get('category') ?? ''} />
            </label>
            <button type="submit">Lọc bài học</button>
          </form>
        )}
      </div>
      {notice && (
        <p role="status" className="personal-learning-notice">
          {notice}
        </p>
      )}
      <ResourceState {...state} retry={state.reload} empty={pagination?.total === 0} />
      {kind === 'vocabulary' && !topicId && (
        <div className="api-grid personal-learning-grid">
          {topics.data?.items.map((item) => (
            <LearningLibraryCard
              key={item.id}
              title={item.name}
              openLabel={`Mở chủ đề: ${item.name}`}
              href={`/study/vocabulary?library=personal&topic=${encodeURIComponent(item.id)}`}
              actions={
                <>
                  <Link
                    href={`/study/vocabulary?library=personal&topic=${encodeURIComponent(item.id)}`}
                  >
                    Mở chủ đề →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'topics', item })}
                    aria-label={`Sửa chủ đề ${item.name}`}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="personal-learning-delete"
                    onClick={() => {
                      setError('');
                      setRemoving({ kind: 'topics', item });
                    }}
                    aria-label={`Xóa chủ đề ${item.name}`}
                  >
                    Xóa
                  </button>
                </>
              }
            >
              <p>{item.wordCount} từ vựng</p>
            </LearningLibraryCard>
          ))}
        </div>
      )}
      {topicId && (
        <>
          <div className="personal-learning-view" role="group" aria-label="Cách hiển thị từ vựng">
            <button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}>
              Danh sách
            </button>
            <button type="button" aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}>
              Flashcard
            </button>
          </div>
          <div className="api-grid personal-learning-grid">
            {words.data?.items.map((item) => (
              <PersonalWordCard
                key={item.id}
                word={item}
                flashcard={mode === 'cards'}
                onEdit={() => setEditing({ kind: 'words', item, topicId })}
                onDelete={() => {
                  setError('');
                  setRemoving({ kind: 'words', item });
                }}
              />
            ))}
          </div>
        </>
      )}
      {kind === 'grammar' && (
        <div className="api-grid personal-learning-grid">
          {lessons.data?.items.map((item) => (
            <LearningLibraryCard
              key={item.id}
              title={item.title}
              openLabel={`Xem bài: ${item.title}`}
              onOpen={() => setViewing(item)}
              eyebrow={<span className="personal-learning-category">{item.level}</span>}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setViewing(item)}
                    aria-label={`Xem bài ${item.title}`}
                  >
                    Xem bài
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'lessons', item })}
                    aria-label={`Sửa bài ${item.title}`}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="personal-learning-delete"
                    onClick={() => {
                      setError('');
                      setRemoving({ kind: 'lessons', item });
                    }}
                    aria-label={`Xóa bài ${item.title}`}
                  >
                    Xóa
                  </button>
                </>
              }
            >
              <p className="personal-learning-excerpt">
                {item.content.slice(0, 160)}
                {item.content.length > 160 && '…'}
              </p>
            </LearningLibraryCard>
          ))}
        </div>
      )}
      {pagination && pagination.total > 0 && (
        <nav className="api-actions" aria-label="Phân trang nội dung cá nhân">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => update({ page: String(pagination.page - 1) })}
          >
            Trang trước
          </button>
          <span>
            Trang {pagination.page} / {Math.max(1, Math.ceil(pagination.total / pagination.size))}
          </span>
          <button
            type="button"
            disabled={pagination.page * pagination.size >= pagination.total}
            onClick={() => update({ page: String(pagination.page + 1) })}
          >
            Trang sau
          </button>
        </nav>
      )}
      {editing && (
        <PersonalContentEditor
          key={`${editing.kind}:${editing.item?.id ?? 'new'}`}
          editing={editing}
          ownerId={ownerId}
          onClose={(uncertain) => {
            setEditing(null);
            if (uncertain) {
              setNotice('Chưa xác nhận kết quả lưu. Mở lại form để thử lại cùng nội dung.');
              refresh();
            }
          }}
          onSaved={() => {
            setEditing(null);
            setNotice('Đã lưu nội dung cá nhân.');
            if (Number(search.get('page') ?? 1) > 1) update({ page: '1' });
            else refresh();
          }}
        />
      )}
      {removing && (
        <PersonalDialog title="Xóa nội dung cá nhân?" busy={busy} onClose={() => setRemoving(null)}>
          <p>Bạn muốn xóa “{itemName}”?</p>
          {removing.kind === 'topics' && (
            <p>
              Xóa chủ đề cũng xóa toàn bộ {removing.item.wordCount} từ vựng và Flashcard trong chủ
              đề này.
            </p>
          )}
          <p className="personal-learning-hint">Thao tác này không thể hoàn tác.</p>
          {error && (
            <p role="alert" className="api-error">
              {error}
            </p>
          )}
          <div className="personal-learning-dialog-actions">
            <button type="button" disabled={busy} onClick={() => setRemoving(null)}>
              Hủy
            </button>
            <button
              type="button"
              className="personal-learning-delete"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Đang xóa…' : 'Xóa'}
            </button>
          </div>
        </PersonalDialog>
      )}
      {viewing && (
        <PersonalDialog title={viewing.title} onClose={() => setViewing(null)}>
          <p className="personal-learning-category">{viewing.level}</p>
          <div className="personal-learning-preview">
            <LessonMarkdown content={viewing.content} />
          </div>
          <div className="personal-learning-dialog-actions">
            <button type="button" onClick={() => setViewing(null)}>
              Đóng
            </button>
            <button
              type="button"
              className="api-primary"
              onClick={() => {
                setViewing(null);
                setEditing({ kind: 'lessons', item: viewing });
              }}
            >
              Sửa bài học
            </button>
          </div>
        </PersonalDialog>
      )}
    </section>
  );
}

function PersonalWordCard({
  word,
  flashcard,
  onEdit,
  onDelete,
}: {
  word: PersonalWord;
  flashcard: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <article
      className={`api-card personal-learning-card ${flashcard ? 'personal-learning-flashcard' : ''}`}
    >
      <h2>{word.word}</h2>
      {word.pronunciation && (
        <p className="personal-learning-pronunciation">{word.pronunciation}</p>
      )}
      <div className="personal-learning-definition" aria-live="polite">
        {!flashcard || flipped ? (
          <>
            <p>{word.meaning}</p>
            {word.example && <p className="personal-learning-example">{word.example}</p>}
          </>
        ) : (
          <p className="personal-learning-hint">Lật thẻ để xem nghĩa và ví dụ.</p>
        )}
      </div>
      <div className="personal-learning-card-actions">
        {flashcard && (
          <button
            type="button"
            aria-pressed={flipped}
            onClick={() => setFlipped((v) => !v)}
            aria-label={`Lật thẻ ${word.word}`}
          >
            Lật thẻ
          </button>
        )}
        <button type="button" onClick={onEdit} aria-label={`Sửa từ ${word.word}`}>
          Sửa
        </button>
        <button
          type="button"
          className="personal-learning-delete"
          onClick={onDelete}
          aria-label={`Xóa từ ${word.word}`}
        >
          Xóa
        </button>
      </div>
    </article>
  );
}
