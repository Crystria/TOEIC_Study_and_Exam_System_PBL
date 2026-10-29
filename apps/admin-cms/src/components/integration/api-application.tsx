'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import {
  ApiAuth,
  Blocked,
  LogoutButton,
  ResourceState,
  SessionGate,
  useResource,
} from '../../../../web/src/components/integration/shared';
import {
  failureMessage,
  mutationOutcomeUnknown,
  validationFields,
} from '../../../../web/src/lib/integration/client';
import { learningApi, examApi } from '../../../../web/src/lib/integration/repositories';
import type { User, Page, parseQuestion } from '../../../../web/src/lib/integration/contracts';
import { cmsApi, cmsMetadataApi, metadataQuery } from '../../lib/integration/repositories';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { CmsShell } from '../layout/cms-shell';
import { Field, SafeMarkdown } from '../demo/workspace-primitives';
import {
  DRAFT_OPTION_KEYS,
  newQuestionDraft,
  validateQuestionDraft,
  type QuestionDraft,
} from '../../lib/questions/form-draft';

export function ApiCmsApplication({
  writes,
  metadataVerified,
}: {
  writes: boolean;
  metadataVerified: boolean;
}) {
  const path = usePathname();
  if (path === '/login' || path === '/') return <ApiAuth cms />;
  return (
    <SessionGate key={path}>
      {(user) => {
        if (!user.roles.some((role) => ['CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(role)))
          return (
            <main className="api-login">
              <h1>Không có quyền quản trị</h1>
              <p>Quyền tài khoản từ backend: {user.roles.join(', ') || 'chưa có'}.</p>
              <LogoutButton />
            </main>
          );
        return (
          <CmsShell apiAccount={user}>
            <div className="api-root">
              {!writes && (
                <Blocked>
                  Chế độ đọc dữ liệu server. Chỉ bật ghi sau khi xác nhận dữ liệu kiểm thử cô lập.
                </Blocked>
              )}
              <CmsDomain
                key={path}
                user={user}
                writes={writes}
                metadataVerified={metadataVerified}
              />
            </div>
          </CmsShell>
        );
      }}
    </SessionGate>
  );
}
function useLocation() {
  const path = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const params = new URLSearchParams(search.toString());
  let id = path.split('/')[2];
  try {
    if (id) id = decodeURIComponent(id);
  } catch {
    /* invalid ID is rejected by transport */
  }
  const section = path.split('/')[1];
  return {
    path,
    id,
    section,
    params,
    href: (nextId?: string, edit = false) =>
      `/${section}${nextId ? `/${encodeURIComponent(nextId)}${edit ? '/edit' : ''}` : ''}?${params}`,
    update: (values: Record<string, string>) => {
      for (const [k, v] of Object.entries(values)) v ? params.set(k, v) : params.delete(k);
      router.push(`/${section}?${params}`);
    },
  };
}
function CmsDomain({
  user,
  writes,
  metadataVerified,
}: {
  user: User;
  writes: boolean;
  metadataVerified: boolean;
}) {
  const { section, id, path } = useLocation();
  const system = ['users', 'audit-logs'].includes(section),
    content = user.roles.includes('CONTENT_ADMIN'),
    admin = user.roles.includes('SYSTEM_ADMIN');
  const allowed = system
    ? admin
    : ['questions', 'media'].includes(section)
      ? content || admin
      : content;
  if (!allowed)
    return (
      <>
        <h1>Không có quyền truy cập</h1>
        <p>403 · Mục này yêu cầu vai trò {system ? 'SYSTEM_ADMIN' : 'CONTENT_ADMIN'} từ backend.</p>
      </>
    );
  if (section === 'questions') return <Questions writes={writes} />;
  if (section === 'tests') return <Tests writes={writes} verified={metadataVerified} />;
  if (section === 'users') return <Users writes={writes} currentId={user.id} />;
  if (section === 'audit-logs') return <Audit />;
  if (section === 'groups')
    return (
      <>
        <h1>Nhóm câu hỏi</h1>
        <Blocked>
          Chưa có entity/DTO và endpoint nhóm, shared stimulus, transcript hoặc quy tắc thành viên.
          Luồng biên tập nhóm hiện có tiếp tục thuộc DEMO.
        </Blocked>
      </>
    );
  if (section === 'media')
    return (
      <>
        <h1>Media quản trị</h1>
        <Blocked>
          API presign chỉ cấp uploadUrl/objectName; chưa có bước xác nhận, URL đọc, gắn/thay/gỡ/xóa
          và xử lý tham chiếu. Chưa thể upload hoặc báo đã lưu media. Preview file cục bộ có sẵn
          trong chế độ DEMO.
        </Blocked>
      </>
    );
  if (['lessons', 'vocabulary', 'topics'].includes(section)) {
    if (id === 'new' || path.endsWith('/edit'))
      return (
        <>
          <h1>Biên tập nội dung học</h1>
          <Blocked>
            Learning service chưa có CMS create/update/delete. Không thể lưu thay đổi lên server.
          </Blocked>
        </>
      );
    return <LearningRead />;
  }
  return (
    <>
      <h1>Không tìm thấy trang</h1>
      <Link href={content ? '/questions' : '/users'}>Về danh sách</Link>
    </>
  );
}
function Pagination({
  result,
  onPage,
}: {
  result: Pick<Page<unknown>, 'page' | 'size' | 'total'>;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="api-actions" aria-label="Phân trang">
      <Button
        disabled={result.page <= 1}
        variant="secondary"
        onClick={() => onPage(result.page - 1)}
      >
        Trang trước
      </Button>
      <span>
        Trang {result.page} · {result.total} bản ghi
      </span>
      <Button
        variant="secondary"
        disabled={result.page * result.size >= result.total}
        onClick={() => onPage(result.page + 1)}
      >
        Trang sau
      </Button>
    </nav>
  );
}
function Filters({
  fields,
}: {
  fields: Array<{ name: string; label: string; options?: readonly string[] }>;
}) {
  const { params, update } = useLocation();
  return (
    <form
      className="api-actions"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update({
          ...Object.fromEntries(
            fields.map((field) => [field.name, String(data.get(field.name) ?? '')]),
          ),
          page: '1',
        });
      }}
    >
      {fields.map((field) => (
        <label key={`${field.name}:${params.get(field.name)}`} className="api-field">
          {field.label}
          {field.options ? (
            <select name={field.name} defaultValue={params.get(field.name) ?? ''}>
              <option value="">Tất cả</option>
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input name={field.name} defaultValue={params.get(field.name) ?? ''} />
          )}
        </label>
      ))}
      <Button type="submit">Áp dụng</Button>
    </form>
  );
}
function Panel({ children }: { children: ReactNode }) {
  return <Card className="ws-panel api-card">{children}</Card>;
}
function Questions({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useLocation();
  const state = useResource(`questions:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await cmsApi.question(id, signal), page: null }
      : { detail: null, page: id === 'new' ? null : await cmsApi.questions(params, signal) },
  );
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="ws-root">
      <h1>Ngân hàng câu hỏi</h1>
      {id && <Link href={href()}>← Danh sách</Link>}
      {!id && (
        <>
          <Filters
            fields={[
              { name: 'keyword', label: 'Từ khóa' },
              { name: 'part', label: 'Part', options: ['1', '2', '3', '4', '5', '6', '7'] },
              { name: 'difficulty', label: 'Độ khó', options: ['EASY', 'MEDIUM', 'HARD'] },
              { name: 'tag', label: 'Tag' },
            ]}
          />
          {writes && (
            <Link className="cms-link-button" href={href('new')}>
              Tạo câu hỏi Part 5 văn bản
            </Link>
          )}
        </>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {notice && <p role="status">{notice}</p>}
      {state.data?.page && (
        <>
          <div className="api-scroll" role="region" aria-label="Danh sách câu hỏi" tabIndex={0}>
            <table className="api-table">
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Part</th>
                  <th>Độ khó / trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {state.data.page.items.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link href={href(q.id)}>{q.stem || q.id}</Link>
                    </td>
                    <td>{q.part}</td>
                    <td>
                      {q.difficulty} · {q.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination result={state.data.page} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
      {id === 'new' &&
        (writes ? (
          <QuestionEditor
            onSaved={(q) => {
              window.location.assign(href(q.id));
            }}
          />
        ) : (
          <Blocked>Chưa bật ghi dữ liệu kiểm thử.</Blocked>
        ))}
      {state.data?.detail &&
        (path.endsWith('/edit') ? (
          writes ? (
            <QuestionEditor
              original={state.data.detail}
              onSaved={(q) => {
                window.location.assign(href(q.id));
              }}
            />
          ) : (
            <Blocked>Chưa bật ghi dữ liệu kiểm thử.</Blocked>
          )
        ) : (
          <Panel>
            <h2>Part {state.data.detail.part}</h2>
            <SafeMarkdown text={state.data.detail.stem} />
            <p>
              {state.data.detail.difficulty} · {state.data.detail.status}
            </p>
            <ul>
              {state.data.detail.options.map((o, i) => (
                <li key={i}>
                  {o.optionKey}. {o.content} {o.isCorrect && ' · Đáp án đúng'}
                </li>
              ))}
            </ul>
            <SafeMarkdown text={state.data.detail.explanation ?? ''} />
            <p>Tags: {state.data.detail.tags.join(', ') || 'chưa có'}</p>
            {state.data.detail.mediaUrl && (
              <p>Server có media URL; chưa xác định loại/phân quyền phát từ contract hiện tại.</p>
            )}
            {writes && (
              <div className="api-actions">
                <Link href={href(id, true)}>Chỉnh sửa</Link>
                <Button
                  disabled={busy}
                  variant="danger"
                  onClick={async () => {
                    if (
                      busy ||
                      !window.confirm(
                        'Ngưng sử dụng câu hỏi trên server? Source DELETE chuyển sang ARCHIVED; chưa có kiểm tra tham chiếu đề thi.',
                      )
                    )
                      return;
                    setBusy(true);
                    setNotice('');
                    try {
                      await cmsApi.archiveQuestion(id);
                      setNotice('Server đã xác nhận ngưng sử dụng câu hỏi.');
                      state.reload();
                    } catch (e) {
                      setNotice(failureMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Ngưng sử dụng
                </Button>
              </div>
            )}
          </Panel>
        ))}
      <Blocked>
        Nhóm/transcript/media chưa có đủ contract. Chỉ editor Part 5 văn bản có thể gửi DTO hiện có;
        các Part còn lại được đọc nguyên dữ liệu server. Không tự coi JSON fixture là DTO.
      </Blocked>
    </section>
  );
}
function QuestionEditor({
  original,
  onSaved,
}: {
  original?: ReturnType<typeof parseQuestion>;
  onSaved: (q: ReturnType<typeof parseQuestion>) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(() => {
    const value = newQuestionDraft();
    if (original) {
      value.stem = original.stem;
      value.explanation = original.explanation ?? '';
      value.difficulty =
        original.difficulty === 'EASY' ||
        original.difficulty === 'MEDIUM' ||
        original.difficulty === 'HARD'
          ? original.difficulty
          : '';
      for (const key of DRAFT_OPTION_KEYS)
        value.options[key] = original.options.find((o) => o.optionKey === key)?.content ?? '';
      const correct = original.options.filter((o) => o.isCorrect);
      value.answer =
        correct.length === 1
          ? (DRAFT_OPTION_KEYS.find((k) => k === correct[0].optionKey) ?? '')
          : '';
    }
    return value;
  });
  const [errors, setErrors] = useState<ReturnType<typeof validateQuestionDraft>>({}),
    [preview, setPreview] = useState(false);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    lock = useRef(false),
    form = useRef<HTMLFormElement>(null);
  const update = (value: QuestionDraft) => {
    setDraft(value);
    setPreview(false);
    setError('');
  };
  if (
    original &&
    (original.part !== 5 ||
      original.type !== 'SINGLE_CHOICE' ||
      original.mediaUrl ||
      original.options.some((o) => o.mediaUrl) ||
      original.options.length !== 4 ||
      new Set(original.options.map((o) => o.optionKey)).size !== 4 ||
      original.options.some((o) => !DRAFT_OPTION_KEYS.some((k) => k === o.optionKey)))
  )
    return (
      <Blocked>
        Editor API chưa hỗ trợ bản ghi này. Không được bỏ media, loại câu hoặc cấu trúc hiện tại khi
        cập nhật.
      </Blocked>
    );
  return (
    <Panel>
      <h2>{original ? 'Sửa câu hỏi trên server' : 'Câu hỏi Part 5 mới · DRAFT'}</h2>
      <form
        ref={form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const next = validateQuestionDraft(draft);
          setErrors(next);
          if (Object.keys(next).length) {
            setPreview(false);
            requestAnimationFrame(() =>
              form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
            );
          } else setPreview(true);
        }}
      >
        <fieldset disabled={busy || uncertain}>
          <Field
            name="stem"
            label="Nội dung *"
            multiline
            value={draft.stem}
            onChange={(stem) => update({ ...draft, stem })}
            error={errors.stem}
          />
          <Field
            name="difficulty"
            label="Độ khó *"
            value={draft.difficulty}
            onChange={(value) => {
              if (value === '' || value === 'EASY' || value === 'MEDIUM' || value === 'HARD')
                update({ ...draft, difficulty: value });
            }}
            error={errors.difficulty}
          >
            <option value="">Chọn độ khó</option>
            {['EASY', 'MEDIUM', 'HARD'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Field>
          {DRAFT_OPTION_KEYS.map((key) => (
            <Field
              key={key}
              name={`option-${key}`}
              label={`Phương án ${key} *`}
              value={draft.options[key]}
              onChange={(value) =>
                update({ ...draft, options: { ...draft.options, [key]: value } })
              }
              error={errors[`option-${key}`]}
            />
          ))}
          <Field
            name="answer"
            label="Đáp án đúng *"
            value={draft.answer}
            onChange={(answer) => {
              const key = DRAFT_OPTION_KEYS.find((k) => k === answer);
              update({ ...draft, answer: key ?? '' });
            }}
            error={errors.answer}
          >
            <option value="">Chọn đáp án</option>
            {DRAFT_OPTION_KEYS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Field>
          <Field
            name="explanation"
            label="Lời giải"
            multiline
            value={draft.explanation}
            onChange={(explanation) => update({ ...draft, explanation })}
          />
          <Button type="submit">Xem trước và kiểm tra</Button>
          <Button
            disabled={!preview || busy || uncertain}
            onClick={async () => {
              if (lock.current || Object.keys(validateQuestionDraft(draft)).length) return;
              lock.current = true;
              setBusy(true);
              setError('');
              try {
                const result = await cmsApi.saveQuestion(draft, original?.id);
                onSaved(result);
              } catch (e) {
                setError(failureMessage(e));
                setErrors(validationFields(e, ['stem', 'difficulty', 'answer']));
                setPreview(false);
                requestAnimationFrame(() =>
                  form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
                );
                if (!original && mutationOutcomeUnknown(e)) setUncertain(true);
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            Lưu lên server
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {uncertain && (
          <Blocked>
            Chưa biết server đã tạo hay chưa. Kiểm tra danh sách trước khi tạo lại để tránh trùng.
            Input vẫn được giữ trên màn hình.
          </Blocked>
        )}
      </form>
      {preview && (
        <article>
          <h2>Xem trước</h2>
          <SafeMarkdown text={draft.stem} />
          <ul>
            {DRAFT_OPTION_KEYS.map((key) => (
              <li key={key}>
                {key}. {draft.options[key]} {draft.answer === key && ' · Đáp án đúng'}
              </li>
            ))}
          </ul>
          <SafeMarkdown text={draft.explanation} />
        </article>
      )}
    </Panel>
  );
}
function Tests({ writes, verified }: { writes: boolean; verified: boolean }) {
  const { id, params, href, update, path } = useLocation();
  const state = useResource(`metadata:${verified}:${id}:${params}`, async () => {
    if (!verified || id === 'new') return null;
    const repo = cmsMetadataApi(verified);
    return id
      ? { detail: await repo.read(id), page: null }
      : { detail: null, page: await repo.list(metadataQuery(params)) };
  });
  const structure = useResource(`structure:${verified}:${id}`, async (signal) =>
    verified && id && id !== 'new' ? examApi.detail(id, signal) : null,
  );
  return (
    <>
      <h1>Đề thi</h1>
      {id && <Link href={href()}>← Danh sách</Link>}
      {!verified && (
        <Blocked>
          Transport metadata lượt 24–27 tiếp tục bị khóa: chưa kiểm chứng Gateway, auth, headers và
          response thật. Không gửi request metadata hoặc dùng fixture thay thế.
        </Blocked>
      )}
      {!id && (
        <Filters
          fields={[
            { name: 'keyword', label: 'Từ khóa' },
            { name: 'type', label: 'Loại', options: ['FULL', 'MINI'] },
            { name: 'status', label: 'Trạng thái', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          ]}
        />
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {writes && verified && !id && <Link href={href('new')}>Tạo metadata đề nháp</Link>}
      {state.data?.page && (
        <>
          <div className="api-grid">
            {state.data.page.items.map((test) => (
              <Panel key={test.id}>
                <h2>
                  <Link href={href(test.id)}>{test.title ?? 'Chưa có tiêu đề'}</Link>
                </h2>
                <p>
                  {test.type ?? 'Chưa có loại'} · {test.questionCount ?? 'Chưa có số'} câu ·{' '}
                  {test.status ?? 'Chưa có trạng thái'}
                </p>
              </Panel>
            ))}
          </div>
          <Pagination result={state.data.page} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
      {state.data?.detail?.kind === 'not-found' && <p role="status">Không tìm thấy đề thi.</p>}
      {state.data?.detail?.kind === 'success' && !path.endsWith('/edit') && (
        <Panel>
          <h2>{state.data.detail.metadata.title ?? 'Chưa có tiêu đề'}</h2>
          <p>
            {state.data.detail.metadata.type} ·{' '}
            {state.data.detail.metadata.durationSeconds ?? 'Chưa có thời lượng'} giây ·{' '}
            {state.data.detail.metadata.status}
          </p>
          {writes && <Link href={href(id, true)}>Sửa metadata</Link>}
        </Panel>
      )}
      {id && verified && (
        <>
          <ResourceState {...structure} retry={structure.reload} />
          {structure.data?.questions && (
            <Panel>
              <h2>Cấu trúc server</h2>
              <ol>
                {structure.data.questions.map((q) => (
                  <li key={q.orderNo}>
                    Câu {q.orderNo} · Part {q.part} · {q.questionId}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}
      {writes && verified && (id === 'new' || (path.endsWith('/edit') && structure.data)) && (
        <TestMetadataEditor
          original={structure.data ?? undefined}
          onSaved={(test) => window.location.assign(href(test.id))}
        />
      )}
      <Blocked>
        Chỉnh cấu trúc/nhóm và công bố đề chưa được bật: backend chưa kiểm tra tham chiếu Question
        Bank; thiếu contract nhóm. DELETE đề chưa có endpoint. Không thay thế cấu trúc bằng danh
        sách rỗng khi sửa metadata.
      </Blocked>
    </>
  );
}
function TestMetadataEditor({
  original,
  onSaved,
}: {
  original?: Awaited<ReturnType<typeof examApi.detail>>;
  onSaved: (test: Awaited<ReturnType<typeof examApi.detail>>) => void;
}) {
  const [title, setTitle] = useState(original?.title ?? ''),
    [type, setType] = useState(original?.type ?? 'MINI'),
    [duration, setDuration] = useState(String(original?.durationSeconds ?? 1800));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false),
    lock = useRef(false);
  return (
    <Panel>
      <h2>Metadata đề {original ? 'hiện có' : 'nháp mới'}</h2>
      <p>
        FULL/MINI là mã source; Word dùng FULL_TEST/MINI_TEST. Thao tác này không công bố hoặc thay
        cấu trúc đề.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError('');
          try {
            onSaved(
              await cmsApi.saveTestMetadata(
                {
                  title,
                  type,
                  durationSeconds: Number(duration),
                  questionCount: original?.questionCount,
                },
                original?.id,
              ),
            );
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
          <Field name="title" label="Tên đề *" value={title} onChange={setTitle} />
          <Field name="type" label="Loại *" value={type} onChange={setType}>
            <option value="MINI">MINI</option>
            <option value="FULL">FULL</option>
          </Field>
          <Field
            name="duration"
            label="Thời lượng (giây) *"
            type="number"
            value={duration}
            onChange={setDuration}
          />
          <Button type="submit">Lưu metadata lên server</Button>
        </fieldset>
        {error && (
          <p role="alert" className="api-error">
            {error}
          </p>
        )}
        {uncertain && (
          <Blocked>Chưa xác định kết quả tạo. Kiểm tra danh sách trước khi gửi lại.</Blocked>
        )}
      </form>
    </Panel>
  );
}
function Users({ writes, currentId }: { writes: boolean; currentId: string }) {
  const { id, params, href, update } = useLocation();
  const state = useResource(`users:${params}`, (signal) => cmsApi.users(params, signal));
  const user = state.data?.items.find((user) => user.id === id);
  return (
    <>
      <h1>Người dùng & vai trò</h1>
      {id ? (
        <Link href={href()}>← Danh sách</Link>
      ) : (
        <Filters
          fields={[
            { name: 'keyword', label: 'Tên / email' },
            {
              name: 'status',
              label: 'Trạng thái',
              options: ['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING'],
            },
          ]}
        />
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data && !id && (
        <>
          <div className="api-scroll" role="region" aria-label="Danh sách người dùng" tabIndex={0}>
            <table className="api-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={href(user.id)}>{user.fullName}</Link>
                      <p>{user.email}</p>
                    </td>
                    <td>{user.roles.join(', ')}</td>
                    <td>{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
        </>
      )}
      {user && <UserEditor key={user.id} user={user} writes={writes && user.id !== currentId} />}
      {id === currentId && (
        <Blocked>
          Phiên này không tự đổi vai trò hoặc trạng thái của chính tài khoản đang đăng nhập.
        </Blocked>
      )}
      {id && state.data && !user && (
        <Blocked>
          Không có tài khoản này trong trang kết quả hiện tại. Backend chưa có GET chi tiết admin
          theo ID. Hãy mở từ đúng trang danh sách; không suy ra rằng tài khoản đã bị xóa.
        </Blocked>
      )}
    </>
  );
}
function UserEditor({ user: initial, writes }: { user: User; writes: boolean }) {
  const [user, setUser] = useState(initial),
    [roles, setRoles] = useState(initial.roles),
    [status, setStatus] = useState(initial.status);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    lock = useRef(false);
  async function save(kind: 'roles' | 'status') {
    if (
      lock.current ||
      !window.confirm(
        `Cập nhật ${kind === 'roles' ? 'vai trò' : 'trạng thái'} của ${user.email} trên server?`,
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result =
        kind === 'roles'
          ? await cmsApi.updateRoles(user.id, roles)
          : await cmsApi.updateStatus(user.id, status);
      setUser(result);
      setRoles(result.roles);
      setStatus(result.status);
      setNotice('Server đã xác nhận thay đổi. Danh sách và nhật ký đọc lại từ server khi mở.');
    } catch (e) {
      setError(failureMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Panel>
      <h2>{user.fullName}</h2>
      <p>
        {user.email} · {user.id}
      </p>
      <fieldset disabled={!writes || busy}>
        <legend>Vai trò từ backend</legend>
        {['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'].map((role) => (
          <label key={role} className="api-actions">
            <input
              style={{ width: 'auto' }}
              type="checkbox"
              checked={roles.includes(role)}
              onChange={(e) =>
                setRoles((value) =>
                  e.target.checked ? [...value, role] : value.filter((r) => r !== role),
                )
              }
            />
            {role}
          </label>
        ))}
        <Button disabled={!roles.length || !writes || busy} onClick={() => save('roles')}>
          Lưu vai trò
        </Button>
        <Field name="status" label="Trạng thái theo source" value={status} onChange={setStatus}>
          {!['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING'].includes(status) && (
            <option value={status}>{status} (chưa nhận diện)</option>
          )}
          {['ACTIVE', 'LOCKED', 'DISABLED', 'PENDING'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Field>
        <Button disabled={!writes || busy} onClick={() => save('status')}>
          Lưu trạng thái
        </Button>
      </fieldset>
      <p>
        Hai thao tác dùng hai endpoint độc lập; không giả lập giao dịch cập nhật chung. Word
        ACTIVE/SUSPENDED/INACTIVE chưa được ánh xạ sang enum source.
      </p>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </Panel>
  );
}
function Audit() {
  const { params, update } = useLocation();
  const state = useResource(`audit:${params}`, (signal) => cmsApi.audit(params, signal));
  return (
    <>
      <h1>Nhật ký quản trị</h1>
      <p>Chỉ đọc bản ghi từ server. Frontend không tạo audit.</p>
      <ResourceState {...state} retry={state.reload} empty={state.data?.items.length === 0} />
      {state.data?.items.map((item) => (
        <Panel key={item.id}>
          <h2>{item.action}</h2>
          <p>{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
          <p>Người thực hiện: {item.actorId ?? 'Không được server cung cấp'}</p>
          <p>
            Đối tượng: {item.resourceType ?? 'Chưa có loại'} · {item.resourceId ?? 'Chưa có ID'}
          </p>
          {item.metadata != null && (
            <details>
              <summary>Metadata</summary>
              <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
            </details>
          )}
        </Panel>
      ))}
      {state.data && (
        <Pagination result={state.data} onPage={(page) => update({ page: String(page) })} />
      )}
    </>
  );
}
function LearningRead() {
  const { section, id, params, href, update } = useLocation();
  const state = useResource(`learning:${section}:${id}:${params}`, async (signal) => {
    if (section === 'lessons')
      return {
        lessons: id
          ? [await learningApi.lesson(id, signal)]
          : await learningApi.lessons(params, signal),
        topics: null,
        words: null,
      };
    if (section === 'topics')
      return { lessons: null, topics: await learningApi.topics(signal), words: null };
    return { lessons: null, topics: null, words: await learningApi.words(params, signal) };
  });
  return (
    <>
      <h1>
        {section === 'lessons' ? 'Bài học ngữ pháp' : section === 'topics' ? 'Chủ đề' : 'Từ vựng'}
      </h1>
      <nav className="api-nav">
        <Link href="/lessons">Bài học</Link>
        <Link href="/vocabulary">Từ vựng</Link>
        <Link href="/topics">Chủ đề</Link>
      </nav>
      {!id && section === 'lessons' && (
        <Filters
          fields={[
            { name: 'level', label: 'Level' },
            { name: 'status', label: 'Trạng thái', options: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
          ]}
        />
      )}
      {!id && section === 'vocabulary' && (
        <Filters
          fields={[
            { name: 'keyword', label: 'Từ khóa' },
            { name: 'topicId', label: 'ID chủ đề' },
          ]}
        />
      )}
      <ResourceState
        {...state}
        retry={state.reload}
        empty={
          state.data?.lessons?.length === 0 ||
          state.data?.topics?.length === 0 ||
          state.data?.words?.items.length === 0
        }
      />
      {state.data?.lessons?.map((lesson) => (
        <Panel key={lesson.id}>
          <h2>{id ? lesson.title : <Link href={href(lesson.id)}>{lesson.title}</Link>}</h2>
          <p>
            Level: {lesson.level} · {lesson.status}
          </p>
          {id && <SafeMarkdown text={lesson.content} />}
        </Panel>
      ))}
      {state.data?.topics
        ?.filter((topic) => !id || topic.id === id)
        .map((topic) => (
          <Panel key={topic.id}>
            <h2>{topic.name}</h2>
            <p>{topic.description}</p>
            <Link href={`/vocabulary?topicId=${encodeURIComponent(topic.id)}`}>
              {topic.wordCount} từ · Mở danh sách
            </Link>
          </Panel>
        ))}
      {state.data?.words?.items
        .filter((word) => !id || word.id === id)
        .map((word) => (
          <Panel key={word.id}>
            <h2>{word.word}</h2>
            <p>{word.pronunciation ?? 'Chưa có IPA'}</p>
            <p>{word.meaning}</p>
            <p>{word.example}</p>
            <p>Chủ đề: {word.topicId}</p>
          </Panel>
        ))}
      {id && state.data?.topics && !state.data.topics.some((topic) => topic.id === id) && (
        <p role="status">Không tìm thấy chủ đề trong danh mục server.</p>
      )}
      {id && state.data?.words && !state.data.words.items.some((word) => word.id === id) && (
        <p role="status">
          Không có từ này trong trang hiện tại. Backend chưa có GET chi tiết từ theo ID.
        </p>
      )}
      {state.data?.words && !id && (
        <Pagination result={state.data.words} onPage={(page) => update({ page: String(page) })} />
      )}
      <Blocked>
        Danh sách/chi tiết đọc từ Learning API. Chưa có CMS CRUD cho bài học, chủ đề hoặc từ vựng.
        Level giữ đúng nghĩa source, không thay cho category của Word.
      </Blocked>
    </>
  );
}
