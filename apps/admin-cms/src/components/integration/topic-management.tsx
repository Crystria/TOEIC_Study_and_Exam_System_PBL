'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Blocked,
  ResourceState,
  useResource,
} from '../../../../web/src/components/integration/shared';
import { GatewayError, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import { contentApi } from '../../lib/integration/content-api';
import { topicErrorMessage } from '../../lib/integration/topic-errors';
import { NumberedPagination } from '../ui/numbered-pagination';
import {
  ManagementPager,
  useCmsLocation,
  useNumberedManagementResource,
} from './content-management';
import { ManagementSearch } from './management-search';
import { VocabularyActions } from './vocabulary-actions';

type Topic = Awaited<ReturnType<typeof contentApi.read>>;
type Vocabulary = Awaited<ReturnType<typeof contentApi.list>>['items'][number];
type TopicWordSearch = { keyword: string; page: number };
type Deletion = { kind: 'topic' | 'word'; id: string } | { kind: 'words' };
const topicNotices = new Map([
  ['created', 'Đã tạo chủ đề từ vựng.'],
  ['updated', 'Đã lưu thay đổi chủ đề.'],
  ['deleted', 'Đã xóa chủ đề từ vựng.'],
]);

export function TopicManagement({ writes }: { writes: boolean }) {
  const location = useCmsLocation();
  const { id, path, params, href, update, router } = location;
  const savedNotice = params.get('topicNotice');
  const state = useNumberedManagementResource(
    location,
    'topics',
    (params, signal) => contentApi.list('topics', params, signal),
    (id, signal) => contentApi.read('topics', id, signal),
  );
  params.delete('topicNotice');
  const [search, setSearch] = useState<TopicWordSearch>({ keyword: '', page: 1 }),
    [deleting, setDeleting] = useState<Deletion | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    deleteLock = useRef(false);
  const edit = id === 'new' || path.endsWith('/edit');
  const runDeletion = async (deletion: Deletion, action: () => Promise<void>) => {
    if (deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(deletion);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(topicErrorMessage(failure));
      if (
        mutationOutcomeUnknown(failure) ||
        (failure instanceof GatewayError && failure.status === 409)
      )
        state.reload();
    } finally {
      deleteLock.current = false;
      setDeleting(null);
    }
  };
  const remove = async (topic: Topic) => {
    if (!writes || topic.deleted || !!topic.vocabularyCount || deleteLock.current) return;
    if (!window.confirm(`Xóa chủ đề “${topic.title}”?`)) return;
    await runDeletion({ kind: 'topic', id: topic.id }, async () => {
      await contentApi.remove('topics', topic.id);
      if (id) {
        const next = new URLSearchParams(params);
        next.set('topicNotice', 'deleted');
        router.replace(`/topics?${next}`);
      } else {
        setNotice(`Đã xóa chủ đề “${topic.title}”.`);
        state.reload();
      }
    });
  };
  const removeWords = async (topic: Topic, word?: Vocabulary) => {
    if (!writes || topic.deleted || deleteLock.current || word?.deleted) return;
    const confirmation = word
      ? `Xóa từ vựng “${word.title}” khỏi chủ đề “${topic.title}”?`
      : `Xóa tất cả từ vựng trong chủ đề “${topic.title}”, kể cả các từ ngoài kết quả tìm kiếm hiện tại?`;
    if (!window.confirm(confirmation)) return;
    await runDeletion(word ? { kind: 'word', id: word.id } : { kind: 'words' }, async () => {
      if (word) {
        await contentApi.remove('vocabulary', word.id);
        setNotice(`Đã xóa từ vựng “${word.title}”.`);
      } else {
        const deletedCount = await contentApi.removeTopicVocabulary(topic.id);
        setSearch((current) => ({ ...current, page: 1 }));
        setNotice(
          deletedCount
            ? `Đã xóa ${deletedCount} từ vựng trong chủ đề.`
            : 'Chủ đề không còn từ vựng để xóa.',
        );
      }
      state.reload();
    });
  };
  const actions = (topic: Topic) => (
    <div className="api-actions">
      <Link href={href(topic.id)}>Xem chi tiết</Link>
      {!topic.deleted && writes && (
        <>
          <Link href={href(topic.id, true)}>Chỉnh sửa</Link>
          <button
            type="button"
            className="api-danger-action"
            disabled={!!deleting || !!topic.vocabularyCount}
            onClick={() => void remove(topic)}
          >
            {deleting?.kind === 'topic' && deleting.id === topic.id ? 'Đang xóa…' : 'Xóa chủ đề'}
          </button>
        </>
      )}
    </div>
  );
  const flash = !edit && (notice || topicNotices.get(savedNotice ?? ''));

  return (
    <>
      <h1>Chủ đề từ vựng</h1>
      <p>Nhóm từ vựng theo chủ đề để quản lý và xây dựng nội dung học tập.</p>
      {id ? (
        <div className="api-actions">
          <Link href={href()}>← Danh sách chủ đề</Link>
        </div>
      ) : (
        <>
          <ManagementSearch
            value={params.get('keyword') ?? ''}
            change={(value) => update('keyword', value)}
          />
          {writes && (
            <div className="api-actions">
              <Link className="api-primary-action" href={href('new')}>
                Thêm chủ đề từ vựng
              </Link>
            </div>
          )}
        </>
      )}
      {flash && (
        <p className="api-success" role="status">
          {flash}
        </p>
      )}
      {error && (
        <p className="api-error" role="alert">
          {error}
        </p>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.page?.items.length === 0} />
      {state.page && (
        <>
          <div className="api-grid">
            {state.page.items.map((topic) => (
              <article className="api-card" key={topic.id}>
                <h2>
                  <Link href={href(topic.id)}>{topic.title}</Link>
                </h2>
                <p>
                  <span className="cms-badge">{topic.deleted ? 'Đã xóa' : 'Đang sử dụng'}</span>
                </p>
                {topic.vocabularyCount != null && (
                  <p>{topic.vocabularyCount} từ vựng đang sử dụng</p>
                )}
                {actions(topic)}
              </article>
            ))}
          </div>
          <NumberedPagination
            page={state.page.page}
            totalPages={state.totalPages}
            onPage={(nextPage) => update('page', String(nextPage))}
          />
        </>
      )}
      {state.data?.detail && !edit && (
        <>
          <article className="api-card">
            <h2>{state.data.detail.title}</h2>
            <p>
              <span className="cms-badge">
                {state.data.detail.deleted ? 'Đã xóa' : 'Đang sử dụng'}
              </span>
            </p>
            {state.data.detail.vocabularyCount != null && (
              <p>{state.data.detail.vocabularyCount} từ vựng đang sử dụng</p>
            )}
            {state.data.detail.deleted && (
              <p>
                Chủ đề đã xóa được giữ lại để đối chiếu nội dung. Không thể chỉnh sửa hoặc thêm từ
                vựng.
              </p>
            )}
            {!state.data.detail.deleted && writes && (
              <div className="api-actions">
                <Link href={href(id, true)}>Chỉnh sửa chủ đề</Link>
                <button
                  type="button"
                  className="api-danger-action"
                  disabled={!!deleting || !!state.data.detail.vocabularyCount}
                  onClick={() => void remove(state.data!.detail!)}
                >
                  {deleting?.kind === 'topic' ? 'Đang xóa…' : 'Xóa chủ đề'}
                </button>
              </div>
            )}
            {writes && !state.data.detail.deleted && !!state.data.detail.vocabularyCount && (
              <p>Xóa hoặc chuyển hết từ vựng trước khi xóa chủ đề.</p>
            )}
          </article>
          <TopicWords
            topic={state.data.detail}
            writes={writes}
            deleting={deleting}
            search={search}
            setSearch={setSearch}
            remove={removeWords}
          />
        </>
      )}
      {edit &&
        (id === 'new' || state.data?.detail) &&
        (state.data?.detail?.deleted ? (
          <Blocked>Chủ đề đã xóa không thể chỉnh sửa.</Blocked>
        ) : !writes ? (
          <Blocked>Tài khoản hiện tại không được phép thay đổi chủ đề.</Blocked>
        ) : (
          <TopicEditor
            key={id}
            original={state.data?.detail ?? undefined}
            cancelHref={id === 'new' ? href() : href(id)}
            listHref={href()}
            saved={(topic) => {
              const next = new URLSearchParams(params);
              next.set('topicNotice', id === 'new' ? 'created' : 'updated');
              router.replace(`/topics/${encodeURIComponent(topic.id)}?${next}`);
            }}
          />
        ))}
    </>
  );
}

function TopicEditor({
  original,
  cancelHref,
  listHref,
  saved,
}: {
  original?: Topic;
  cancelHref: string;
  listHref: string;
  saved: (topic: Topic) => void;
}) {
  const [name, setName] = useState(original?.title ?? ''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(''),
    request = useRef<{ name: string; key: string }>(),
    lock = useRef(false);
  return (
    <article className="api-card">
      <h2>{original ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề từ vựng'}</h2>
      {original && <p>Đổi tên chủ đề giữ nguyên các từ vựng đang thuộc chủ đề này.</p>}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current) return;
          const topicName = name.trim();
          if (!topicName || topicName.length > 255) {
            setError('Tên chủ đề phải có từ 1 đến 255 ký tự và không chỉ gồm khoảng trắng.');
            return;
          }
          lock.current = true;
          setBusy(true);
          setError('');
          if (!request.current || request.current.name !== topicName)
            request.current = { name: topicName, key: crypto.randomUUID() };
          try {
            saved(
              await contentApi.save('topics', { topicName }, request.current.key, original?.id),
            );
          } catch (failure) {
            setError(topicErrorMessage(failure));
            if (!original && mutationOutcomeUnknown(failure)) setUncertain(true);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <label className="api-field">
          Tên chủ đề
          <input
            name="topicName"
            required
            maxLength={255}
            value={name}
            disabled={busy || uncertain}
            aria-invalid={!!error}
            aria-describedby={error ? 'topic-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
        </label>
        {error && (
          <p id="topic-name-error" className="api-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="api-blocked" role="status">
            Chưa xác định kết quả tạo. Tên chủ đề được giữ nguyên; thử lại sẽ dùng cùng yêu cầu để
            tránh tạo trùng. Có thể mở danh sách để kiểm tra trước.
          </p>
        )}
        <div className="api-actions">
          <button type="submit" className="api-primary-action" disabled={busy}>
            {busy
              ? 'Đang lưu…'
              : uncertain
                ? 'Thử lại cùng yêu cầu'
                : original
                  ? 'Lưu thay đổi'
                  : 'Tạo chủ đề'}
          </button>
          <Link href={cancelHref}>Hủy</Link>
          {uncertain && <Link href={listHref}>Kiểm tra danh sách</Link>}
        </div>
      </form>
    </article>
  );
}

function TopicWords({
  topic,
  writes,
  deleting,
  search: { keyword, page },
  setSearch,
  remove,
}: {
  topic: Topic;
  writes: boolean;
  deleting: Deletion | null;
  search: TopicWordSearch;
  setSearch: (search: TopicWordSearch) => void;
  remove: (topic: Topic, word?: Vocabulary) => Promise<void>;
}) {
  const params = new URLSearchParams({
    topicId: topic.id,
    keyword,
    page: String(page),
    size: '10',
  });
  const state = useResource(`topic-words:${params}`, (signal) =>
    contentApi.list('vocabulary', params, signal),
  );
  const lastPage = state.data ? Math.max(1, Math.ceil(state.data.total / state.data.size)) : page;
  const pageOutOfRange = page > lastPage;
  const result = pageOutOfRange ? undefined : state.data;
  useEffect(() => {
    if (pageOutOfRange) setSearch({ keyword, page: lastPage });
  }, [keyword, lastPage, pageOutOfRange, setSearch]);
  const vocabularyHref = `/vocabulary?${new URLSearchParams({ topicId: topic.id })}`;
  return (
    <section className="api-card" aria-labelledby="topic-words-heading">
      <h2 id="topic-words-heading">Từ vựng thuộc chủ đề</h2>
      <div className="api-actions">
        <Link href={vocabularyHref}>Quản lý từ vựng của chủ đề</Link>
        {writes && !topic.deleted && (
          <>
            <Link
              className="api-primary-action"
              href={`/vocabulary/new?${new URLSearchParams({ topicId: topic.id })}`}
            >
              Thêm từ vựng vào chủ đề
            </Link>
            <button
              type="button"
              className="api-danger-action"
              disabled={!!deleting || topic.vocabularyCount === 0}
              onClick={() => void remove(topic)}
            >
              {deleting?.kind === 'words' ? 'Đang xóa từ…' : 'Xóa tất cả từ'}
            </button>
          </>
        )}
      </div>
      <ManagementSearch
        value={keyword}
        change={(value) => setSearch({ keyword: value, page: 1 })}
      />
      <ResourceState
        {...state}
        loading={state.loading || pageOutOfRange}
        retry={state.reload}
        empty={result?.items.length === 0}
      />
      {result && (
        <>
          <div className="api-grid">
            {result.items.map((word) => (
              <article className="api-card" key={word.id}>
                <h3>
                  <Link href={`/vocabulary/${encodeURIComponent(word.id)}?${params}`}>
                    {word.title}
                  </Link>
                </h3>
                <p>{word.fields.definition}</p>
                {word.deleted && <p>Đã xóa</p>}
                {writes && !word.deleted && !topic.deleted && (
                  <div className="api-actions">
                    <VocabularyActions
                      editHref={`/vocabulary/${encodeURIComponent(word.id)}/edit?${params}`}
                      onDelete={() => void remove(topic, word)}
                      busy={!!deleting}
                      deleting={deleting?.kind === 'word' && deleting.id === word.id}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
          <ManagementPager
            data={result}
            onPage={(nextPage) => setSearch({ keyword, page: nextPage })}
          />
        </>
      )}
    </section>
  );
}
