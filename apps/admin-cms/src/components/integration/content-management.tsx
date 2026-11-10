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
import { SafeMarkdown } from '../demo/workspace-primitives';
import { formatPassageBlanks } from '../../../../web/src/lib/exams/passage';

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
function Search({ value, change }: { value: string; change: (v: string) => void }) {
  return (
    <form
      className="api-actions"
      onSubmit={(e) => {
        e.preventDefault();
        change(String(new FormData(e.currentTarget).get('keyword') ?? ''));
      }}
    >
      <label className="api-field">
        Từ khóa
        <input name="keyword" type="search" defaultValue={value} />
      </label>
      <button>Tìm kiếm</button>
    </form>
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
          <Search value={params.get('keyword') ?? ''} change={(v) => update('keyword', v)} />
          {writes && <Link href={href('new')}>Tạo mới</Link>}
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
                <p>{v.deleted ? 'Đã ngừng sử dụng' : (v.fields.status ?? 'Đang sử dụng')}</p>
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
            <>
              <Link href={href(id, true)}>Chỉnh sửa</Link>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !id ||
                    !window.confirm('Ngừng sử dụng bản ghi này trên server?')
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  setError('');
                  try {
                    await contentApi.remove(kind, id);
                    state.reload();
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Ngừng sử dụng
              </button>
            </>
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
        (writes ? (
          <ContentEditor
            key={id}
            kind={kind}
            original={state.data?.detail ?? undefined}
            saved={(v) => window.location.assign(href(v.id))}
          />
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
}: {
  kind: ContentKind;
  original?: Awaited<ReturnType<typeof contentApi.read>>;
  saved: (v: Awaited<ReturnType<typeof contentApi.read>>) => void;
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
        <button disabled={busy || !preview}>
          {uncertain ? 'Thử lại cùng yêu cầu' : 'Lưu lên server'}
        </button>
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
          <Search value={params.get('keyword') ?? ''} change={(v) => update('keyword', v)} />
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
          {writes && <Link href={href('new')}>Tạo câu hỏi</Link>}
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
}: {
  original?: Awaited<ReturnType<typeof bankApi.question>>;
  writes: boolean;
  edit: boolean;
  saved: (v: Awaited<ReturnType<typeof bankApi.question>>) => void;
  editLink: string;
}) {
  const [q, setQ] = useState(original?.input ?? emptyQuestion()),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [preview, setPreview] = useState(false),
    lock = useRef(false);
  return (
    <article className="api-card">
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
            <button disabled={!preview}>Lưu lên server</button>
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
            <>
              <Link href={editLink}>Chỉnh sửa</Link>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !original ||
                    !window.confirm('Ngừng sử dụng câu hỏi trên server?')
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  try {
                    await cmsApi.archiveQuestion(original.id);
                    window.location.assign('/questions');
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Ngừng sử dụng
              </button>
            </>
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
export function GroupManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const state = useResource(`groups:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await bankApi.group(id, signal), page: null }
      : { detail: null, page: id === 'new' ? null : await bankApi.groups(params, signal) },
  );
  return (
    <>
      <h1>Nhóm câu hỏi</h1>
      {id ? (
        <Link href={href()}>Danh sách</Link>
      ) : (
        <>
          <Search value={params.get('keyword') ?? ''} change={(v) => update('keyword', v)} />
          {writes && <Link href={href('new')}>Tạo nhóm</Link>}
        </>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          {state.data.page.items.map((g) => (
            <article className="api-card" key={g.id}>
              <Link href={href(g.id)}>
                Part {g.part} · {g.type} · {g.questionIds.length} câu
              </Link>
            </article>
          ))}
          <ManagementPager data={state.data.page} onPage={(n) => update('page', String(n))} />
        </>
      )}
      {state.data?.detail && !path.endsWith('/edit') && (
        <>
          <MediaUpload
            scope="question-groups"
            resourceId={state.data.detail.id}
            kind="AUDIO"
            writes={writes}
            saved={state.reload}
          />
          <MediaUpload
            scope="question-groups"
            resourceId={state.data.detail.id}
            kind="IMAGE"
            writes={writes}
            saved={state.reload}
          />
        </>
      )}
      {(id === 'new' || state.data?.detail) && (
        <GroupEditor
          key={id}
          original={state.data?.detail ?? undefined}
          writes={writes}
          edit={id === 'new' || path.endsWith('/edit')}
          saved={(v) => window.location.assign(href(v.id))}
          editLink={href(id, true)}
        />
      )}
    </>
  );
}
function GroupEditor({
  original,
  writes,
  edit,
  saved,
  editLink,
}: {
  original?: Awaited<ReturnType<typeof bankApi.group>>;
  writes: boolean;
  edit: boolean;
  saved: (v: Awaited<ReturnType<typeof bankApi.group>>) => void;
  editLink: string;
}) {
  const [g, setG] = useState({
      part: original?.part ?? 7,
      type: original?.type ?? 'SINGLE_PASSAGE',
      instruction: original?.instruction ?? '',
      passageText: original?.passageText ?? '',
      transcript: original?.transcript ?? '',
      questionOrder: original?.questionIds,
      assets: original?.assets ?? [],
    }),
    [questions, setQuestions] = useState([emptyQuestion(7)]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    lock = useRef(false);
  return (
    <article className="api-card">
      {edit ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current || !writes) return;
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              saved(await bankApi.saveGroup(g, questions, original?.id));
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
            <label className="api-field">
              Part
              <select
                aria-label="Part"
                disabled={!!original}
                value={g.part}
                onChange={(e) => {
                  const part = Number(e.target.value);
                  setG((v) => ({ ...v, part }));
                  setQuestions((v) => v.map((q) => ({ ...q, part })));
                }}
              >
                {[3, 4, 6, 7].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {(['type', 'instruction', 'passageText', 'transcript'] as const).map((key, i) => (
              <label className="api-field" key={key}>
                {
                  [
                    'Loại nhóm',
                    'Hướng dẫn',
                    'Đoạn văn (Part 6 dùng [[1]], [[2]], …)',
                    'Transcript',
                  ][i]
                }
                <textarea
                  required={key === 'type'}
                  value={g[key]}
                  onChange={(e) => setG((v) => ({ ...v, [key]: e.target.value }))}
                />
              </label>
            ))}
            {original && (
              <ol>
                {g.questionOrder?.map((id, n) => (
                  <li key={id}>
                    {id}
                    <button
                      type="button"
                      disabled={n === 0}
                      onClick={() =>
                        setG((v) => {
                          const order = [...v.questionOrder!];
                          [order[n - 1], order[n]] = [order[n], order[n - 1]];
                          return { ...v, questionOrder: order };
                        })
                      }
                    >
                      Đưa câu lên
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <fieldset>
              <legend>Tài liệu bổ sung của nhóm</legend>
              {g.assets.map((a, n) => (
                <div key={n}>
                  <p>
                    {a.kind} · Vị trí {n + 1}
                  </p>
                  {a.kind === 'TEXT' ? (
                    <textarea
                      aria-label={'Nội dung tài liệu ' + (n + 1)}
                      value={a.content ?? ''}
                      onChange={(e) =>
                        setG((v) => ({
                          ...v,
                          assets: v.assets.map((a, i) =>
                            i === n ? { ...a, content: e.target.value } : a,
                          ),
                        }))
                      }
                    />
                  ) : (
                    <p>Tài liệu media đã gắn</p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setG((v) => ({
                        ...v,
                        assets: v.assets
                          .filter((_, i) => i !== n)
                          .map((a, i) => ({ ...a, orderNo: i + 1 })),
                      }))
                    }
                  >
                    Gỡ tài liệu
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setG((v) => ({
                    ...v,
                    assets: [
                      ...v.assets,
                      {
                        kind: 'TEXT',
                        content: '',
                        storageKey: null,
                        url: null,
                        orderNo: v.assets.length + 1,
                      },
                    ],
                  }))
                }
              >
                Thêm tài liệu văn bản
              </button>
            </fieldset>
            {!original && (
              <>
                {questions.map((q, n) => (
                  <fieldset key={n}>
                    <legend>Câu {n + 1}</legend>
                    <QuestionFields
                      fixedPart
                      input={q}
                      change={(v) =>
                        setQuestions((items) => items.map((q, i) => (i === n ? v : q)))
                      }
                    />
                    <button
                      type="button"
                      disabled={questions.length === 1}
                      onClick={() => setQuestions((v) => v.filter((_, i) => i !== n))}
                    >
                      Bỏ câu
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() => setQuestions((v) => [...v, emptyQuestion(g.part)])}
                >
                  Thêm câu vào nhóm
                </button>
              </>
            )}
            <button>Lưu nhóm lên server</button>
          </fieldset>
          {!original && [3, 4].includes(g.part) && (
            <p>
              Nhóm Listening mới cần audio và transcript để hoàn chỉnh. Lưu nhóm, sau đó gắn audio ở
              chi tiết.
            </p>
          )}
          {uncertain && <p>Chưa xác định kết quả tạo. Kiểm tra danh sách trước khi tạo lại.</p>}
        </form>
      ) : (
        <>
          <h2>
            Part {g.part} · {g.type}
          </h2>
          {original?.audioUrl && (
            <AudioPlayer
              mode="server"
              source={original.audioUrl}
              label="Audio nhóm"
              missingMessage="Chưa có audio"
            />
          )}
          {g.assets.map((a, i) => (
            <div key={i}>
              {a.content && <SafeMarkdown text={a.content} />}
              {a.kind === 'IMAGE' && a.url && (
                <img src={a.url} alt="Tài liệu nhóm" style={{ maxWidth: '100%' }} />
              )}
              {a.kind === 'AUDIO' && a.url && (
                <AudioPlayer
                  mode="server"
                  source={a.url}
                  label={`Audio tài liệu ${i + 1}`}
                  missingMessage="Server chưa cấp audio hợp lệ."
                />
              )}
            </div>
          ))}
          <SafeMarkdown
            text={g.part === 6 ? formatPassageBlanks(g.passageText, g.instruction) : g.passageText}
          />
          <p>{g.instruction}</p>
          <details>
            <summary>Transcript</summary>
            <p>{g.transcript}</p>
          </details>
          <ul>
            {original?.questionIds.map((id) => (
              <li key={id}>
                <Link href={'/questions/' + encodeURIComponent(id)}>{id}</Link>
              </li>
            ))}
          </ul>
          {writes && (
            <>
              <Link href={editLink}>Chỉnh sửa nhóm</Link>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !original ||
                    !window.confirm('Ngừng sử dụng nhóm và các câu hỏi liên quan?')
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  try {
                    await bankApi.removeGroup(original.id);
                    window.location.assign('/groups');
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Ngừng sử dụng nhóm
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </article>
  );
}
