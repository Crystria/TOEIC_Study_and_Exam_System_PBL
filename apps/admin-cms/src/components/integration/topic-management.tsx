'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  Blocked,
  ResourceState,
  useResource,
} from '../../../../web/src/components/integration/shared';
import { mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import { contentApi } from '../../lib/integration/content-api';
import { topicErrorMessage } from '../../lib/integration/topic-errors';
import { ManagementPager, useCmsLocation } from './content-management';
import { ManagementSearch } from './management-search';

type Topic = Awaited<ReturnType<typeof contentApi.read>>;

export function TopicManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update, router } = useCmsLocation();
  const savedNotice = params.get('topicNotice');
  params.delete('topicNotice');
  const state = useResource(`topics:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await contentApi.read('topics', id, signal), page: null }
      : {
          detail: null,
          page: id === 'new' ? null : await contentApi.list('topics', params, signal),
        },
  );
  const [deletingId, setDeletingId] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    deleteLock = useRef(false);
  const edit = id === 'new' || path.endsWith('/edit');
  const remove = async (topic: Topic) => {
    if (!writes || topic.deleted || deleteLock.current) return;
    if (
      !window.confirm(
        `Xóa chủ đề “${topic.title}”? Chỉ xóa được chủ đề không còn từ vựng đang sử dụng.`,
      )
    )
      return;
    deleteLock.current = true;
    setDeletingId(topic.id);
    setError('');
    setNotice('');
    try {
      await contentApi.remove('topics', topic.id);
      setNotice(`Đã xóa chủ đề “${topic.title}”.`);
      state.reload();
    } catch (failure) {
      setError(topicErrorMessage(failure));
      if (mutationOutcomeUnknown(failure)) state.reload();
    } finally {
      deleteLock.current = false;
      setDeletingId('');
    }
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
            disabled={!!deletingId}
            onClick={() => void remove(topic)}
          >
            {deletingId === topic.id ? 'Đang xóa…' : 'Xóa chủ đề'}
          </button>
        </>
      )}
    </div>
  );
  const flash =
    !edit &&
    (notice ||
      (savedNotice === 'created'
        ? 'Đã tạo chủ đề từ vựng.'
        : savedNotice === 'updated'
          ? 'Đã lưu thay đổi chủ đề.'
          : ''));

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
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          <div className="api-grid">
            {state.data.page.items.map((topic) => (
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
          <ManagementPager data={state.data.page} onPage={(page) => update('page', String(page))} />
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
                  disabled={!!deletingId}
                  onClick={() => void remove(state.data!.detail!)}
                >
                  {deletingId ? 'Đang xóa…' : 'Xóa chủ đề'}
                </button>
              </div>
            )}
          </article>
          <TopicWords topic={state.data.detail} writes={writes} />
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

function TopicWords({ topic, writes }: { topic: Topic; writes: boolean }) {
  const [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({
    topicId: topic.id,
    keyword,
    page: String(page),
    size: '10',
  });
  const state = useResource(`topic-words:${params}`, (signal) =>
    contentApi.list('vocabulary', params, signal),
  );
  const vocabularyHref = `/vocabulary?${new URLSearchParams({ topicId: topic.id })}`;
  return (
    <section className="api-card" aria-labelledby="topic-words-heading">
      <h2 id="topic-words-heading">Từ vựng thuộc chủ đề</h2>
      <div className="api-actions">
        <Link href={vocabularyHref}>Quản lý từ vựng của chủ đề</Link>
        {writes && !topic.deleted && (
          <Link
            className="api-primary-action"
            href={`/vocabulary/new?${new URLSearchParams({ topicId: topic.id })}`}
          >
            Thêm từ vựng vào chủ đề
          </Link>
        )}
      </div>
      <ManagementSearch
        value={keyword}
        change={(value) => {
          setKeyword(value);
          setPage(1);
        }}
      />
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data && (
        <>
          <div className="api-grid">
            {state.data.items.map((word) => (
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
                    <Link href={`/vocabulary/${encodeURIComponent(word.id)}/edit?${params}`}>
                      Chỉnh sửa từ vựng
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
          <ManagementPager data={state.data} onPage={setPage} />
        </>
      )}
    </section>
  );
}
