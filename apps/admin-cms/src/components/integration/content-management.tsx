'use client';
/* eslint-disable @next/next/no-img-element -- URLs are supplied and validated by the backend adapter. */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  Blocked,
  ResourceState,
  useResource,
} from '../../../../web/src/components/integration/shared';
import { failureMessage, mutationOutcomeUnknown } from '../../../../web/src/lib/integration/client';
import {
  contentApi,
  bankApi,
  emptyQuestion,
  type ContentKind,
  type QuestionInput,
} from '../../lib/integration/content-api';
import { cmsApi } from '../../lib/integration/repositories';
import { MediaUpload } from '../../../../web/src/components/integration/media-upload';
import { AudioPlayer } from '../../../../web/src/components/ui/audio-player';
import { RelationPicker } from './relation-picker';
import { ManagementSearch } from './management-search';
import { SafeMarkdown } from '../demo/workspace-primitives';

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
  vocabulary: [
    ['topicId', 'ID chủ đề', 36],
    ['word', 'Từ vựng', 255],
    ['phonetic', 'Phiên âm', 255],
    ['definition', 'Định nghĩa', 10000],
    ['example', 'Ví dụ', 10000],
  ],
  lessons: [
    ['lessonTitle', 'Tiêu đề', 255],
    ['category', 'Danh mục', 255],
    ['contentMarkdown', 'Nội dung Markdown', 100000],
    ['status', 'Trạng thái', 20],
  ],
} satisfies Record<ContentKind, [string, string, number][]>;
export function ContentManagement({ kind, writes }: { kind: ContentKind; writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const state = useResource(`content:${kind}:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await contentApi.read(kind, id, signal), page: null }
      : { detail: null, page: id === 'new' ? null : await contentApi.list(kind, params, signal) },
  );
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const title =
    kind === 'topics' ? 'Chủ đề từ vựng' : kind === 'vocabulary' ? 'Từ vựng' : 'Bài học ngữ pháp';
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
                {kind === 'lessons'
                  ? 'Thêm bài học ngữ pháp'
                  : kind === 'vocabulary'
                    ? 'Thêm từ vựng'
                    : 'Thêm chủ đề'}
              </Link>
              {kind === 'vocabulary' && <Link href="/topics/new">Thêm chủ đề từ vựng</Link>}
            </div>
          )}
        </>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          <div className="api-grid">
            {state.data.page.items.map((v) => (
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
                  {writes && !v.deleted && <Link href={href(v.id, true)}>Chỉnh sửa</Link>}
                </div>
              </article>
            ))}
          </div>
          <ManagementPager data={state.data.page} onPage={(n) => update('page', String(n))} />
        </>
      )}
      {state.data?.detail && !path.endsWith('/edit') && (
        <article className="api-card">
          <h2>{state.data.detail.title}</h2>
          {kind === 'vocabulary' && (
            <>
              <AudioPlayer
                mode="server"
                source={state.data.detail.audioUrl}
                label={`Phát âm ${state.data.detail.title}`}
                missingMessage="Server chưa cấp audio hợp lệ."
              />
              {state.data.detail.imageUrl && (
                <img
                  src={state.data.detail.imageUrl}
                  alt={`Minh họa ${state.data.detail.title}`}
                  style={{ maxWidth: '100%' }}
                />
              )}
            </>
          )}
          {contentFields[kind].map(([key, label]) => (
            <div key={key}>
              <strong>{label}</strong>
              {key === 'contentMarkdown' ? (
                <SafeMarkdown text={state.data!.detail!.fields[key]} />
              ) : (
                <p>{state.data!.detail!.fields[key] || 'Chưa có'}</p>
              )}
            </div>
          ))}
          {writes && !state.data.detail.deleted && (
            <div className="api-actions">
              <Link href={href(id, true)}>Chỉnh sửa</Link>
              <button
                type="button"
                className="api-danger-action"
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !id ||
                    !window.confirm(
                      `Xóa “${state.data!.detail!.title}” khỏi nội dung đang sử dụng? Bản ghi được lưu trữ để giữ lịch sử học tập.`,
                    )
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  setNotice('');
                  try {
                    await contentApi.remove(kind, id);
                    setNotice('Đã xóa nội dung khỏi thư viện đang sử dụng.');
                    state.reload();
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Đang xóa…' : 'Xóa'}
              </button>
            </div>
          )}
        </article>
      )}
      {kind === 'vocabulary' &&
        state.data?.detail &&
        !state.data.detail.deleted &&
        !path.endsWith('/edit') && (
          <>
            <MediaUpload
              scope="vocabulary"
              resourceId={state.data.detail.id}
              kind="AUDIO"
              writes={writes}
              saved={state.reload}
            />
            <MediaUpload
              scope="vocabulary"
              resourceId={state.data.detail.id}
              kind="IMAGE"
              writes={writes}
              saved={state.reload}
            />
          </>
        )}
      {(id === 'new' || (path.endsWith('/edit') && state.data?.detail)) &&
        (state.data?.detail?.deleted ? (
          <Blocked>Nội dung đã xóa không thể chỉnh sửa.</Blocked>
        ) : writes ? (
          <ContentEditor
            key={id}
            kind={kind}
            original={state.data?.detail ?? undefined}
            saved={(v) => window.location.assign(href(v.id))}
            cancelHref={id === 'new' ? href() : href(id)}
            initialTopicId={
              kind === 'vocabulary' && id === 'new' ? (params.get('topicId') ?? '') : ''
            }
          />
        ) : (
          <Blocked>Thao tác ghi đang tắt.</Blocked>
        ))}
      {notice && (
        <p role="status" className="api-success">
          {notice}
        </p>
      )}
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
  initialTopicId,
}: {
  kind: ContentKind;
  original?: Awaited<ReturnType<typeof contentApi.read>>;
  saved: (v: Awaited<ReturnType<typeof contentApi.read>>) => void;
  cancelHref: string;
  initialTopicId: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    original?.fields ?? { status: 'DRAFT', ...(initialTopicId ? { topicId: initialTopicId } : {}) },
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
            ([name]) => !['phonetic', 'example'].includes(name) && !(values[name] ?? '').trim(),
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
                ) : ['contentMarkdown', 'definition', 'example'].includes(name) ? (
                  <textarea
                    aria-label={label}
                    required={!['example'].includes(name)}
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
                    required={!['phonetic'].includes(name)}
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
        <SafeMarkdown
          text={values.contentMarkdown ?? values.definition ?? values.topicName ?? ''}
        />
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
  const requestedPart = Number(params.get('part'));
  const initialPart = [1, 2, 3, 4, 5, 6, 7].includes(requestedPart) ? requestedPart : 5;
  const initialGroupId = [3, 4, 6, 7].includes(initialPart) ? params.get('groupId') : null;
  const state = useResource(`bank:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await bankApi.question(id, signal), page: null }
      : { detail: null, page: id === 'new' ? null : await cmsApi.questions(params, signal) },
  );
  return (
    <>
      <h1>Ngân hàng câu hỏi</h1>
      {id ? (
        <Link href={href()}>Danh sách</Link>
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
      {state.data?.detail && !path.endsWith('/edit') && (
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
          edit={id === 'new' || path.endsWith('/edit')}
          saved={(v) => window.location.assign(href(v.id))}
          editLink={href(id, true)}
          cancelHref={
            id === 'new' && initialGroupId
              ? `/groups/${encodeURIComponent(initialGroupId)}`
              : id === 'new'
                ? href()
                : href(id)
          }
          listHref={href()}
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
          <SafeMarkdown text={q.questionText} />
          {original?.audioUrl && (
            <AudioPlayer
              mode="server"
              source={original.audioUrl}
              label="Audio câu hỏi"
              missingMessage="Chưa có audio"
            />
          )}
          {original?.imageUrl && (
            <img src={original.imageUrl} alt="Minh họa câu hỏi" style={{ maxWidth: '100%' }} />
          )}
          <ul>
            {q.options.map((o) => (
              <li key={o.optionCode}>
                {o.optionCode}. {o.optionText}
                {o.optionCode === q.correctOption && ' · Đáp án đúng'}
              </li>
            ))}
          </ul>
          <SafeMarkdown text={q.explanation ?? ''} />
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
      {preview && <SafeMarkdown text={q.questionText} />}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </article>
  );
}
