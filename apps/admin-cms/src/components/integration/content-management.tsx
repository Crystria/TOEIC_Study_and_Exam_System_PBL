'use client';
/* eslint-disable @next/next/no-img-element -- URLs are supplied and validated by the backend adapter. */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Blocked,
  ResourceState,
  useResource,
} from '../../../../web/src/components/integration/shared';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import type { Page } from '../../../../web/src/lib/integration/contracts';
import {
  contentApi,
  bankApi,
  emptyQuestion,
  optionalVocabularyFields,
  type ContentKind,
  type QuestionInput,
} from '../../lib/integration/content-api';
import { cmsApi } from '../../lib/integration/repositories';
import { MediaUpload } from '../../../../web/src/components/integration/media-upload';
import { RelationPicker } from './relation-picker';
import { ManagementSearch } from './management-search';
import { SafeMarkdown } from '../demo/workspace-primitives';
import { QuestionDetailContent } from './question-content';
import { NumberedPagination } from '../ui/numbered-pagination';
import { VocabularyActions } from './vocabulary-actions';
import { VocabularyBatchEditor, vocabularyFields } from './vocabulary-batch-editor';
import { VocabularyWorkbookImport } from './vocabulary-workbook-import';

const MANAGEMENT_PAGE_SIZE = 10;

export function useCmsLocation() {
  const path = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const section = path.split('/')[1];
  let id = path.split('/')[2];
  try {
    if (id) id = decodeURIComponent(id);
  } catch {
    /* The transport rejects invalid identifiers. */
  }
  const params = new URLSearchParams(search.toString());
  return {
    path,
    id,
    section,
    params,
    router,
    href: (itemId?: string, edit = false) =>
      `/${section}${itemId ? '/' + encodeURIComponent(itemId) + (edit ? '/edit' : '') : ''}?${params}`,
    update: (key: string, value: string) => {
      params.set(key, value);
      if (key !== 'page') params.set('page', '1');
      router.push(`/${section}?${params}`);
    },
  };
}

export function useNumberedManagementResource<T>(
  { id, path, params, router }: ReturnType<typeof useCmsLocation>,
  key: string,
  list: (params: URLSearchParams, signal: AbortSignal) => Promise<Page<T>>,
  read?: (id: string, signal: AbortSignal) => Promise<T>,
) {
  const search = params.toString();
  const requestParams = new URLSearchParams(search);
  if (!id) {
    const requestedPage = Number(params.get('page') ?? 1);
    const validPage =
      Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 2_147_483_647;
    requestParams.set('page', String(validPage ? requestedPage : 1));
    requestParams.set('size', String(MANAGEMENT_PAGE_SIZE));
  }
  const state = useResource(`${key}:${id}:${requestParams}`, async (signal) => {
    if (!id) return { detail: null, page: await list(requestParams, signal) };
    if (id === 'new' || !read) return { detail: null, page: null };
    return { detail: await read(id, signal), page: null };
  });
  const page = state.data?.page;
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / MANAGEMENT_PAGE_SIZE));
  const pageOutOfRange = !!page && page.page > totalPages;
  useEffect(() => {
    if (!pageOutOfRange) return;
    const next = new URLSearchParams(search);
    next.set('page', String(totalPages));
    router.replace(`${path}?${next}`, { scroll: false });
  }, [pageOutOfRange, path, router, search, totalPages]);

  return {
    ...state,
    loading: state.loading || pageOutOfRange,
    page: pageOutOfRange ? null : page,
    totalPages,
  };
}

export function ManagementPager({
  data,
  onPage,
}: {
  data: { page: number; size: number; total: number };
  onPage: (n: number) => void;
}) {
  return (
    <nav className="api-actions" aria-label="Phân trang">
      <button disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
        Trang trước
      </button>
      <span>
        Trang {data.page} · {data.total} bản ghi
      </span>
      <button disabled={data.page * data.size >= data.total} onClick={() => onPage(data.page + 1)}>
        Trang sau
      </button>
    </nav>
  );
}
const contentFields = {
  topics: [['topicName', 'Tên chủ đề', 255]],
  vocabulary: [['topicId', 'ID chủ đề', 36], ...vocabularyFields],
  lessons: [
    ['lessonTitle', 'Tiêu đề', 255],
    ['category', 'Danh mục', 255],
    ['contentMarkdown', 'Nội dung Markdown', 100000],
    ['status', 'Trạng thái', 20],
  ],
} satisfies Record<ContentKind, ReadonlyArray<readonly [string, string, number]>>;
export function ContentManagement({
  kind,
  writes,
}: {
  kind: 'vocabulary' | 'lessons';
  writes: boolean;
}) {
  const location = useCmsLocation();
  const { id, path, section, params, href, update, router } = location;
  const state = useNumberedManagementResource(
    location,
    `content:${kind}`,
    (params, signal) => contentApi.list(kind, params, signal),
    (id, signal) => contentApi.read(kind, id, signal),
  );
  const noticeKey = kind === 'vocabulary' ? 'vocabularyNotice' : 'lessonNotice';
  const deleted = params.get(noticeKey) === 'deleted';
  params.delete(noticeKey);
  const [error, setError] = useState(''),
    [deletingId, setDeletingId] = useState(''),
    [listDeleted, setListDeleted] = useState(false),
    lock = useRef(false);
  const title = kind === 'vocabulary' ? 'Từ vựng' : 'Bài học ngữ pháp';
  const detail = state.data?.detail;
  const remove = async (item: { id: string; title: string }) => {
    if (
      !writes ||
      lock.current ||
      !window.confirm(
        `Xóa “${item.title}” khỏi nội dung đang sử dụng? Bản ghi được lưu trữ để giữ lịch sử học tập.`,
      )
    )
      return;
    lock.current = true;
    setDeletingId(item.id);
    setError('');
    setListDeleted(false);
    try {
      await contentApi.remove(kind, item.id);
      if (id) {
        const next = new URLSearchParams(params);
        next.set(noticeKey, 'deleted');
        router.replace(`/${section}?${next}`);
      } else {
        setListDeleted(true);
        state.reload();
      }
    } catch (failure) {
      setError(failureMessage(failure));
      if (!id) state.reload();
    } finally {
      lock.current = false;
      setDeletingId('');
    }
  };
  return (
    <>
      <h1>{title}</h1>
      {id ? (
        <Link href={href()}>Danh sách</Link>
      ) : (
        <>
          <ManagementSearch
            value={params.get('keyword') ?? ''}
            change={(v) => update('keyword', v)}
          />
          {writes && (
            <div className="api-actions">
              <Link className="api-primary-action" href={href('new')}>
                {kind === 'vocabulary' ? 'Thêm từ vựng' : 'Thêm bài học ngữ pháp'}
              </Link>
              {kind === 'vocabulary' && <Link href="/topics/new">Thêm chủ đề từ vựng</Link>}
            </div>
          )}
          {writes && kind === 'vocabulary' && <VocabularyWorkbookImport onImported={state.reload} />}
        </>
      )}
      {!id && (deleted || listDeleted) && (
        <p role="status" className="api-success">
          {kind === 'vocabulary'
            ? 'Đã xóa từ vựng khỏi thư viện đang sử dụng.'
            : 'Đã xóa bài học ngữ pháp khỏi thư viện đang sử dụng.'}
        </p>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.page?.items.length === 0} />
      {state.page && (
        <>
          <div className="api-grid">
            {state.page.items.map((v) => (
              <article className="api-card" key={v.id}>
                <h2>
                  <Link href={href(v.id)}>{v.title}</Link>
                </h2>
                <p>
                  {v.deleted
                    ? 'Đã xóa'
                    : v.fields.status === 'DRAFT'
                      ? 'Bản nháp'
                      : v.fields.status === 'PUBLISHED'
                        ? 'Đã công bố'
                        : 'Đang sử dụng'}
                </p>
                {kind === 'lessons' && <p>{v.fields.category}</p>}
                {kind === 'vocabulary' && <p>{v.fields.definition}</p>}
                <div className="api-actions">
                  <Link href={href(v.id)}>Xem chi tiết</Link>
                  {writes &&
                    !v.deleted &&
                    (kind === 'vocabulary' ? (
                      <VocabularyActions
                        editHref={href(v.id, true)}
                        onDelete={() => void remove(v)}
                        busy={!!deletingId}
                        deleting={deletingId === v.id}
                      />
                    ) : (
                      <Link href={href(v.id, true)}>Chỉnh sửa</Link>
                    ))}
                </div>
              </article>
            ))}
          </div>
          <NumberedPagination
            page={state.page.page}
            totalPages={state.totalPages}
            onPage={(page) => update('page', String(page))}
          />
        </>
      )}
      {detail && !path.endsWith('/edit') && (
        <article className={kind === 'vocabulary' ? 'api-card cms-vocabulary-content' : 'api-card'}>
          <h2>{detail.title}</h2>
          {contentFields[kind].map(([key, label]) => (
            <div key={key}>
              <strong>{label}</strong>
              {key === 'contentMarkdown' ? (
                <SafeMarkdown text={detail.fields[key]} />
              ) : (
                <p lang={key === 'englishDefinition' && detail.fields[key] ? 'en' : undefined}>
                  {detail.fields[key] || 'Chưa có'}
                </p>
              )}
            </div>
          ))}
          {writes && !detail.deleted && (
            <div className="api-actions">
              <Link href={href(id, true)}>Chỉnh sửa</Link>
              <button
                type="button"
                className="api-danger-action"
                disabled={!!deletingId}
                onClick={() => void remove(detail)}
              >
                {deletingId ? 'Đang xóa…' : 'Xóa'}
              </button>
            </div>
          )}
        </article>
      )}
      {(id === 'new' || (path.endsWith('/edit') && state.data?.detail)) &&
        (state.data?.detail?.deleted ? (
          <Blocked>Nội dung đã xóa không thể chỉnh sửa.</Blocked>
        ) : writes ? (
          kind === 'vocabulary' && id === 'new' ? (
            <VocabularyBatchEditor
              initialTopicId={params.get('topicId') ?? ''}
              cancelHref={href()}
              saved={(topicId) => router.replace(`/topics/${encodeURIComponent(topicId)}`)}
            />
          ) : (
            <ContentEditor
              key={id}
              kind={kind}
              original={state.data?.detail ?? undefined}
              saved={(item) => window.location.assign(href(item.id))}
              cancelHref={id === 'new' ? href() : href(id)}
            />
          )
        ) : (
          <Blocked>Thao tác ghi đang tắt.</Blocked>
        ))}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </>
  );
}
function ContentEditor({
  kind,
  original,
  saved,
  cancelHref,
}: {
  kind: ContentKind;
  original?: Awaited<ReturnType<typeof contentApi.read>>;
  saved: (v: Awaited<ReturnType<typeof contentApi.read>>) => void;
  cancelHref: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    original?.fields ?? { status: 'DRAFT' },
  );
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false),
    key = useRef<string>(),
    lock = useRef(false);
  return (
    <article className="api-card">
      <h2>{original ? 'Chỉnh sửa' : 'Tạo mới'}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          const missing = contentFields[kind].find(
            ([name]) => !optionalVocabularyFields.includes(name) && !(values[name] ?? '').trim(),
          );
          if (missing) {
            setError(`Vui lòng nhập ${missing[1].toLowerCase()}.`);
            return;
          }
          lock.current = true;
          setBusy(true);
          setError('');
          key.current ??= crypto.randomUUID();
          try {
            saved(await contentApi.save(kind, values, key.current, original?.id));
          } catch (e) {
            setError(failureMessage(e));
            if (!original && mutationOutcomeUnknown(e)) setUncertain(true);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || uncertain}>
          {contentFields[kind].map(([name, label, max]) =>
            name === 'topicId' ? (
              <RelationPicker
                key={name}
                kind="topic"
                value={values[name] ?? ''}
                change={(id) => {
                  setValues((v) => ({ ...v, [name]: id }));
                  setPreview(false);
                }}
              />
            ) : (
              <label className="api-field" key={name}>
                {label}
                {name === 'status' ? (
                  <select
                    aria-label="Trạng thái"
                    value={values[name] ?? 'DRAFT'}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [name]: e.target.value }));
                      setPreview(false);
                    }}
                  >
                    <option value="DRAFT">Nháp</option>
                    <option value="PUBLISHED">Công bố</option>
                  </select>
                ) : ['contentMarkdown', 'definition', 'example', 'englishDefinition'].includes(name) ? (
                  <textarea
                    aria-label={label}
                    required={!optionalVocabularyFields.includes(name)}
                    maxLength={max}
                    rows={name === 'contentMarkdown' ? 14 : 4}
                    value={values[name] ?? ''}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [name]: e.target.value }));
                      setPreview(false);
                    }}
                  />
                ) : (
                  <input
                    aria-label={label}
                    required={!optionalVocabularyFields.includes(name)}
                    maxLength={max}
                    value={values[name] ?? ''}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [name]: e.target.value }));
                      setPreview(false);
                    }}
                  />
                )}
              </label>
            ),
          )}
          <button type="button" onClick={() => setPreview(true)}>
            Xem trước
          </button>
        </fieldset>
        <div className="api-actions">
          <button type="submit" className="api-primary-action" disabled={busy}>
            {busy
              ? 'Đang lưu…'
              : uncertain
                ? 'Thử lại cùng yêu cầu'
                : original
                  ? 'Lưu thay đổi'
                  : 'Tạo mới'}
          </button>
          <Link href={cancelHref}>Hủy</Link>
        </div>
      </form>
      {preview && (
        <>
          <SafeMarkdown
            text={values.contentMarkdown ?? values.definition ?? values.topicName ?? ''}
          />
          {kind === 'vocabulary' && values.englishDefinition?.trim() && (
            <p lang="en">{values.englishDefinition}</p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && (
        <p>Chưa xác định kết quả tạo. Dữ liệu và khóa yêu cầu được giữ nguyên khi thử lại.</p>
      )}
    </article>
  );
}
export function QuestionFields({
  input: q,
  change,
  fixedPart = false,
}: {
  input: QuestionInput;
  change: (q: QuestionInput) => void;
  fixedPart?: boolean;
}) {
  const field = (
    name: 'type' | 'questionText' | 'explanation' | 'transcript',
    label: string,
    multiline = false,
  ) => (
    <label className="api-field">
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          value={q[name] ?? ''}
          onChange={(e) => change({ ...q, [name]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          required
          value={q[name] ?? ''}
          onChange={(e) => change({ ...q, [name]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <>
      <label className="api-field">
        Part
        <select
          aria-label="Part"
          disabled={fixedPart}
          value={q.part}
          onChange={(e) => {
            const part = Number(e.target.value);
            change({
              ...q,
              part,
              groupId: null,
              positionInGroup: null,
              options: ['A', 'B', 'C', 'D'].slice(0, part === 2 ? 3 : 4).map(
                (code) =>
                  q.options.find((o) => o.optionCode === code) ?? {
                    optionCode: code,
                    optionText: '',
                  },
              ),
              correctOption: 'A',
            });
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      {field('type', 'Loại câu hỏi')}
      {field('questionText', 'Nội dung câu hỏi', true)}
      <label className="api-field">
        Độ khó
        <select
          aria-label="Độ khó"
          value={q.difficulty}
          onChange={(e) => change({ ...q, difficulty: e.target.value })}
        >
          {['EASY', 'MEDIUM', 'HARD'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {q.options.map((o, i) => (
        <label className="api-field" key={o.optionCode}>
          Phương án {o.optionCode}
          <input
            required
            value={o.optionText}
            onChange={(e) =>
              change({
                ...q,
                options: q.options.map((v, n) =>
                  n === i ? { ...v, optionText: e.target.value } : v,
                ),
              })
            }
          />
        </label>
      ))}
      <label className="api-field">
        Đáp án đúng
        <select
          aria-label="Đáp án đúng"
          value={q.correctOption}
          onChange={(e) => change({ ...q, correctOption: e.target.value })}
        >
          {q.options.map((o) => (
            <option key={o.optionCode}>{o.optionCode}</option>
          ))}
        </select>
      </label>
      <label className="api-field">
        Tags (phân cách bằng dấu phẩy)
        <input
          value={q.tags.join(',')}
          onChange={(e) => change({ ...q, tags: e.target.value.split(',') })}
        />
      </label>
      {field('explanation', 'Giải thích', true)}
      {field('transcript', 'Transcript', true)}
      {[3, 4, 6, 7].includes(q.part) && !fixedPart && (
        <>
          <RelationPicker
            kind="group"
            part={q.part}
            value={q.groupId ?? ''}
            change={(id) => change({ ...q, groupId: id })}
          />
          <label className="api-field">
            Vị trí trong nhóm
            <input
              type="number"
              required
              min={1}
              value={q.positionInGroup ?? ''}
              onChange={(e) => change({ ...q, positionInGroup: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </>
  );
}
export function QuestionManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const edit = id === 'new' || path.endsWith('/edit');
  const editorBlocked = edit && !writes;
  const fromTest = params.get('fromTest')?.trim();
  const returnToTest =
    fromTest && id && id !== 'new'
      ? `/tests/${encodeURIComponent(fromTest)}#question-${encodeURIComponent(id)}`
      : undefined;
  const title = returnToTest ? 'Câu hỏi' : 'Ngân hàng câu hỏi';
  const requestedPart = Number(params.get('part'));
  const initialPart = [1, 2, 3, 4, 5, 6, 7].includes(requestedPart) ? requestedPart : 5;
  const initialGroupId = [3, 4, 6, 7].includes(initialPart) ? params.get('groupId') : null;
  const state = useResource(`bank:${path}:${params}:${editorBlocked}`, async (signal) =>
    editorBlocked || id === 'new'
      ? { detail: null, page: null }
      : id
        ? { detail: await bankApi.question(id, signal), page: null }
        : { detail: null, page: await cmsApi.questions(params, signal) },
  );
  if (editorBlocked)
    return (
      <>
        <h1>{title}</h1>
        <p role="status">Bạn chỉ có quyền xem câu hỏi.</p>
        <div className="api-actions">
          {returnToTest ? (
            <Link href={returnToTest}>Quay lại đề thi</Link>
          ) : (
            <Link href={href()}>Danh sách câu hỏi</Link>
          )}
          {id && id !== 'new' && <Link href={href(id)}>Xem chi tiết câu hỏi</Link>}
        </div>
      </>
    );
  return (
    <>
      <h1>{title}</h1>
      {returnToTest && (
        <div className="api-actions">
          <Link href={returnToTest}>← Quay lại đề thi</Link>
        </div>
      )}
      {id ? (
        !returnToTest && <Link href={href()}>Danh sách</Link>
      ) : (
        <>
          <ManagementSearch
            value={params.get('keyword') ?? ''}
            change={(v) => update('keyword', v)}
          />
          <label className="api-field">
            Part
            <select
              value={params.get('part') ?? ''}
              onChange={(e) => update('part', e.target.value)}
            >
              <option value="">Tất cả</option>
              {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          {writes && (
            <div className="api-actions">
              <Link className="api-primary-action" href={href('new')}>
                Thêm câu hỏi
              </Link>
            </div>
          )}
        </>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          <div className="api-grid">
            {state.data.page.items.map((q) => (
              <article className="api-card" key={q.id}>
                <Link href={href(q.id)}>{q.stem || q.id}</Link>
                <p>
                  Part {q.part} · {q.difficulty} · {q.status}
                </p>
                <div className="api-actions">
                  <Link href={href(q.id)}>Xem chi tiết</Link>
                  {writes && <Link href={href(q.id, true)}>Chỉnh sửa</Link>}
                </div>
              </article>
            ))}
          </div>
          <ManagementPager data={state.data.page} onPage={(n) => update('page', String(n))} />
        </>
      )}
      {state.data?.detail && !edit && writes && (
        <>
          <MediaUpload
            scope="questions"
            resourceId={state.data.detail.id}
            kind="AUDIO"
            writes={writes}
            saved={state.reload}
          />
          <MediaUpload
            scope="questions"
            resourceId={state.data.detail.id}
            kind="IMAGE"
            writes={writes}
            saved={state.reload}
          />
        </>
      )}
      {(id === 'new' || state.data?.detail) && (
        <QuestionEditor
          key={id}
          original={state.data?.detail ?? undefined}
          writes={writes}
          edit={edit}
          saved={(v) => window.location.assign(returnToTest ?? href(v.id))}
          editLink={href(id, true)}
          cancelHref={
            returnToTest ??
            (id === 'new' && initialGroupId
              ? `/groups/${encodeURIComponent(initialGroupId)}`
              : id === 'new'
                ? href()
                : href(id))
          }
          listHref={returnToTest ?? href()}
          initialInput={{ ...emptyQuestion(initialPart), groupId: initialGroupId }}
        />
      )}
    </>
  );
}
function QuestionEditor({
  original,
  writes,
  edit,
  saved,
  editLink,
  cancelHref,
  listHref,
  initialInput,
}: {
  original?: Awaited<ReturnType<typeof bankApi.question>>;
  writes: boolean;
  edit: boolean;
  saved: (v: Awaited<ReturnType<typeof bankApi.question>>) => void;
  editLink: string;
  cancelHref: string;
  listHref: string;
  initialInput: QuestionInput;
}) {
  const [q, setQ] = useState(original?.input ?? initialInput),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [preview, setPreview] = useState(false),
    lock = useRef(false);
  return (
    <article className="api-card">
      {edit && <h2>{original ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi'}</h2>}
      {edit ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || !writes) return;
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              saved(await bankApi.saveQuestion(q, original?.id));
            } catch (e) {
              setError(failureMessage(e));
              if (!original && mutationOutcomeUnknown(e)) setUncertain(true);
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={!writes || busy || uncertain}>
            <QuestionFields
              input={q}
              change={(v) => {
                setQ(v);
                setPreview(false);
              }}
            />
            <button type="button" onClick={() => setPreview(true)}>
              Xem trước
            </button>
            <div className="api-actions">
              <button type="submit" className="api-primary-action">
                {busy ? 'Đang lưu…' : original ? 'Lưu thay đổi' : 'Tạo câu hỏi'}
              </button>
              <Link href={cancelHref}>Hủy</Link>
            </div>
          </fieldset>
          {uncertain && <p>Chưa xác định kết quả tạo. Kiểm tra danh sách trước khi tạo lại.</p>}
        </form>
      ) : (
        <>
          <h2>Part {q.part}</h2>
          {original && <QuestionDetailContent question={original} />}
          {writes && (
            <div className="api-actions">
              <Link href={editLink}>Chỉnh sửa</Link>
              <button
                type="button"
                className="api-danger-action"
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !original ||
                    !window.confirm(
                      'Xóa câu hỏi khỏi ngân hàng đang sử dụng? Các lượt làm bài đã tạo vẫn giữ nội dung câu hỏi.',
                    )
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  try {
                    await cmsApi.archiveQuestion(original.id);
                    window.location.assign(listHref);
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Đang xóa…' : 'Xóa câu hỏi'}
              </button>
            </div>
          )}
        </>
      )}
      {preview && (
        <QuestionDetailContent
          question={{
            id: original?.id ?? 'preview',
            audioUrl: original?.audioUrl ?? null,
            imageUrl: original?.imageUrl ?? null,
            input: q,
          }}
        />
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </article>
  );
}
