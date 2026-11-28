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
import { FlashcardPracticeSettings } from '../learning/flashcard-practice-settings';
import { LessonMarkdown } from '../learning/lesson-markdown';
import { useFlashcardPracticeLimit } from '../learning/use-flashcard-practice-limit';
import { VocabularyEnglishDefinition } from '../learning/vocabulary-english-definition';
import { VocabularyFlashcard } from '../learning/vocabulary-flashcard';
import { VocabularyListCard } from '../learning/vocabulary-list-card';
import { Icon } from '../ui/icon';
import { ResourceState, useResource } from './shared';
import { SearchForm } from './search-form';
import { LearningLibraryCard } from './learning-library-card';
import { ServerPagination } from './server-pagination';
import { flashcardTopicHref, VocabularySessionStart } from './vocabulary-session';
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
  const [limit, setLimit] = useFlashcardPracticeLimit(ownerId);
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
  const [mode, setMode] = useState<'list' | 'cards'>('cards');
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
      refresh();
    } catch (cause) {
      if (cause instanceof GatewayError && cause.status === 404) {
        setRemoving(null);
        setNotice('Nội dung này không còn tồn tại. Danh sách đã được cập nhật.');
        refresh();
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
          ← Danh sách từ vựng của tôi
        </Link>
      )}
      {topicId && <ResourceState {...topic} retry={topic.reload} />}
      {kind === 'vocabulary' && <FlashcardPracticeSettings limit={limit} onSave={setLimit} />}
      <div className="personal-learning-heading">
        <div>
          <h2>
            {kind === 'grammar'
              ? 'Bài ngữ pháp của tôi'
              : topicId
                ? (topic.data?.name ?? 'Từ vựng của tôi')
                : 'Danh sách từ vựng của tôi'}
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
      {topicId && topic.data && (
        <VocabularySessionStart topicId={topicId} scope="PERSONAL" limit={limit} />
      )}
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
        <div className="vocabulary-list-grid">
          {topics.data?.items.map((item) => (
            <VocabularyListCard
              key={item.id}
              title={item.name}
              wordCount={item.wordCount}
              href={flashcardTopicHref(item.id, 'PERSONAL')}
              actionLabel="Mở danh sách"
              cornerActions={
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'topics', item })}
                    aria-label={`Sửa chủ đề ${item.name}`}
                    title="Sửa chủ đề"
                  >
                    <Icon name="pencil" width="16" height="16" />
                  </button>
                  <button
                    type="button"
                    className="personal-learning-delete"
                    onClick={() => {
                      setError('');
                      setRemoving({ kind: 'topics', item });
                    }}
                    aria-label={`Xóa chủ đề ${item.name}`}
                    title="Xóa chủ đề"
                  >
                    <Icon name="trash" width="16" height="16" />
                  </button>
                </>
              }
            />
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
          <div
            className={
              mode === 'cards' ? 'vocabulary-flashcard-grid' : 'api-grid personal-learning-grid'
            }
          >
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
      {pagination && <ServerPagination result={pagination} />}
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
  const front = (
    <>
      <h2 lang="en">{word.word}</h2>
      {word.pronunciation && (
        <p className="personal-learning-pronunciation">{word.pronunciation}</p>
      )}
    </>
  );
  const definition = (
    <div className="personal-learning-definition">
      <p>{word.meaning}</p>
      <VocabularyEnglishDefinition definition={word.englishDefinition} />
      {word.example && <p className="personal-learning-example">{word.example}</p>}
    </div>
  );
  const actions = (
    <>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Sửa từ ${word.word}`}
        title={flashcard ? 'Sửa từ' : undefined}
      >
        {flashcard ? <Icon name="pencil" width="16" height="16" /> : 'Sửa'}
      </button>
      <button
        type="button"
        className="personal-learning-delete"
        onClick={onDelete}
        aria-label={`Xóa từ ${word.word}`}
        title={flashcard ? 'Xóa từ' : undefined}
      >
        {flashcard ? <Icon name="trash" width="16" height="16" /> : 'Xóa'}
      </button>
    </>
  );
  if (flashcard)
    return (
      <VocabularyFlashcard
        className="personal-vocabulary-flashcard"
        word={word.word}
        front={front}
        back={definition}
        cornerActions={actions}
      />
    );

  return (
    <article className="api-card personal-learning-card">
      {front}
      {definition}
      <div className="personal-learning-card-actions">{actions}</div>
    </article>
  );
}
