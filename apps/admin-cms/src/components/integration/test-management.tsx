'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { examApi } from '../../../../web/src/lib/integration/repositories';
import {
  gateway,
  failureMessage,
  mutationOutcomeUnknown,
} from '../../../../web/src/lib/integration/client';
import {
  ContractError,
  matchingId,
  parseTest,
  record,
  segment,
} from '../../../../web/src/lib/integration/contracts';
import { ResourceState, useResource } from '../../../../web/src/components/integration/shared';
import { cmsApi } from '../../lib/integration/repositories';
import { bankApi } from '../../lib/integration/content-api';
import { ManagementPager, useCmsLocation } from './content-management';
import { ManagementSearch } from './management-search';

type Ref = { questionId: string; part: number; orderNo: number };
export function TestManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const editorRoute = id === 'new' || path.endsWith('/edit');
  const editorBlocked = editorRoute && !writes;
  const state = useResource(`tests:${id}:${params}`, async (signal) =>
    editorBlocked
      ? { detail: null, page: null }
      : id && id !== 'new'
        ? { detail: await examApi.detail(id, signal), page: null }
        : { detail: null, page: id === 'new' ? null : await examApi.list(params, signal) },
  );
  const [deletingId, setDeletingId] = useState<string | null>(null),
    [error, setError] = useState(''),
    lock = useRef(false);
  const remove = async (testId: string) => {
    if (
      lock.current ||
      !writes ||
      !window.confirm(
        'Xóa đề thi này? Đề sẽ ngừng sử dụng; các lượt làm bài đã tạo vẫn được giữ lại.',
      )
    )
      return;
    lock.current = true;
    setDeletingId(testId);
    setError('');
    try {
      if (record(await gateway(`tests/${segment(testId)}`, { method: 'DELETE' })).success !== true)
        throw new ContractError('delete');
      if (id) window.location.assign(href());
      else state.reload();
    } catch (e) {
      setError(failureMessage(e));
    } finally {
      lock.current = false;
      setDeletingId(null);
    }
  };
  if (editorBlocked)
    return (
      <>
        <h1>Đề thi</h1>
        <p role="status">
          Chức năng tạo và chỉnh sửa đề thi không khả dụng với quyền hiện tại. Bạn vẫn có thể xem
          danh sách và nội dung đề thi.
        </p>
        <div className="api-actions">
          <Link href={href()}>Danh sách đề thi</Link>
          {id && id !== 'new' && <Link href={href(id)}>Xem nội dung đề thi</Link>}
        </div>
      </>
    );
  return (
    <>
      <h1>Đề thi Full Test</h1>
      {id ? (
        <Link href={href()}>Danh sách</Link>
      ) : (
        <>
          <ManagementSearch
            value={params.get('keyword') ?? ''}
            change={(value) => update('keyword', value)}
          />
          {writes && (
            <div className="api-actions">
              <Link className="api-primary-action" href={href('new')}>
                Tạo đề thi
              </Link>
            </div>
          )}
        </>
      )}
      <ResourceState {...state} retry={state.reload} empty={state.data?.page?.items.length === 0} />
      {state.data?.page && (
        <>
          {state.data.page.items.map((t) => (
            <article className="api-card" key={t.id}>
              <h2>
                <Link href={href(t.id)}>{t.title}</Link>
              </h2>
              <p>
                {t.questionCount} câu · {t.durationSeconds / 60} phút
              </p>
              <div className="api-actions">
                <Link href={href(t.id)}>Xem chi tiết</Link>
                {writes && t.status !== 'ARCHIVED' && (
                  <>
                    <Link href={href(t.id, true)}>Chỉnh sửa</Link>
                    <button
                      type="button"
                      className="api-danger-action"
                      disabled={deletingId !== null}
                      onClick={() => void remove(t.id)}
                    >
                      {deletingId === t.id ? 'Đang xóa…' : 'Xóa đề thi'}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
          <ManagementPager data={state.data.page} onPage={(n) => update('page', String(n))} />
        </>
      )}
      {state.data?.detail && !path.endsWith('/edit') && (
        <article className="api-card">
          <h2>{state.data.detail.title}</h2>
          <p>
            {state.data.detail.questionCount} câu · {state.data.detail.durationSeconds / 60} phút
          </p>
          <ol>
            {state.data.detail.questions?.map((q) => (
              <li key={q.questionId}>
                Part {q.part} ·{' '}
                <Link href={'/questions/' + encodeURIComponent(q.questionId)}>{q.questionId}</Link>
              </li>
            ))}
          </ol>
          {writes && state.data.detail.status !== 'ARCHIVED' && (
            <div className="api-actions">
              <Link href={href(id, true)}>Chỉnh sửa đề / cấu trúc</Link>
              <button
                type="button"
                className="api-danger-action"
                disabled={deletingId !== null}
                onClick={() => id && void remove(id)}
              >
                {deletingId === id ? 'Đang xóa…' : 'Xóa đề thi'}
              </button>
            </div>
          )}
        </article>
      )}
      {writes &&
        (id === 'new' || (path.endsWith('/edit') && state.data?.detail?.status === 'ACTIVE')) && (
          <TestEditor
            key={id}
            writes={writes}
            original={state.data?.detail ?? undefined}
            saved={(v) => window.location.assign(href(v.id))}
            cancelHref={id === 'new' ? href() : href(id)}
          />
        )}
      {state.data?.detail?.status === 'ARCHIVED' && (
        <p role="status">Đề thi đã bị xóa và ngừng sử dụng. Bạn có thể xem lại thông tin đề.</p>
      )}
      {path.endsWith('/edit') && state.data?.detail?.status === 'ARCHIVED' && (
        <Link href={href(id)}>Xem chi tiết đề thi</Link>
      )}
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
    </>
  );
}
function TestEditor({
  writes,
  original,
  saved,
  cancelHref,
}: {
  writes: boolean;
  original?: Awaited<ReturnType<typeof examApi.detail>>;
  saved: (v: Awaited<ReturnType<typeof examApi.detail>>) => void;
  cancelHref: string;
}) {
  const [title, setTitle] = useState(original?.title ?? ''),
    [refs, setRefs] = useState<Ref[]>(original?.questions ?? []),
    [keyword, setKeyword] = useState(''),
    [part, setPart] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false),
    lock = useRef(false);
  const picker = useResource(`picker:${keyword}:${part}:${page}`, (signal) =>
    cmsApi.questions(
      new URLSearchParams({ keyword, part, page: String(page), size: '50' }),
      signal,
    ),
  );
  const replace = (items: Ref[]) => {
    setRefs(items.map((q, i) => ({ ...q, orderNo: i + 1 })));
    setPreview(false);
  };
  return (
    <article className="api-card">
      <h2>{original ? 'Chỉnh sửa' : 'Tạo'} đề thi</h2>
      <p>
        Đề đủ 200 câu, 7 Part và 7200 giây. Backend kiểm tra cơ cấu Part và nhóm đầy đủ trước khi
        lưu.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || !writes) return;
          lock.current = true;
          setBusy(true);
          setError('');
          try {
            const q = parseTest(
              await gateway(`tests${original ? '/' + segment(original.id) : ''}`, {
                method: original ? 'PATCH' : 'POST',
                body: { title: title.trim(), durationSeconds: 7200, questions: refs },
              }),
            );
            saved(original ? matchingId(q, original.id) : q);
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
            Tên đề
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPreview(false);
              }}
            />
          </label>
          <p>
            {refs.length} / 200 câu · Part{' '}
            {[1, 2, 3, 4, 5, 6, 7]
              .map((p) => `${p}: ${refs.filter((q) => q.part === p).length}`)
              .join(' · ')}
          </p>
          <ol>
            {refs.map((q, i) => (
              <li key={q.questionId}>
                Part {q.part} · {q.questionId}
                <button
                  type="button"
                  aria-label={`Đưa câu ${i + 1} lên`}
                  disabled={i === 0}
                  onClick={() => {
                    const copy = [...refs];
                    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                    replace(copy);
                  }}
                >
                  Lên
                </button>
                <button
                  type="button"
                  aria-label={`Đưa câu ${i + 1} xuống`}
                  disabled={i === refs.length - 1}
                  onClick={() => {
                    const copy = [...refs];
                    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
                    replace(copy);
                  }}
                >
                  Xuống
                </button>
                <button
                  type="button"
                  aria-label={`Bỏ câu ${i + 1} khỏi đề`}
                  onClick={() => replace(refs.filter((r) => r.questionId !== q.questionId))}
                >
                  Bỏ
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => replace([...refs].sort((a, b) => a.part - b.part))}>
            Sắp theo Part
          </button>
          <button type="button" disabled={refs.length !== 200} onClick={() => setPreview(true)}>
            Kiểm tra và xem trước
          </button>
          <div className="api-actions">
            <button type="submit" className="api-primary-action">
              {busy ? 'Đang lưu…' : original ? 'Lưu thay đổi' : 'Tạo đề thi'}
            </button>
            <Link href={cancelHref}>Hủy</Link>
          </div>
        </fieldset>
      </form>
      {preview && (
        <p role="status">
          Đề có {refs.length} câu. Backend sẽ xác minh nội dung, media, nhóm và thứ tự khi lưu.
        </p>
      )}
      <fieldset disabled={!writes || busy || uncertain}>
        <legend>Chọn câu hỏi từ ngân hàng</legend>
        <label className="api-field">
          Từ khóa
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="api-field">
          Part
          <select
            aria-label="Part"
            value={part}
            onChange={(e) => {
              setPart(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <ResourceState {...picker} retry={picker.reload} empty={picker.data?.items.length === 0} />
        {picker.data?.items.map((q) => (
          <article className="api-card" key={q.id}>
            <p>
              Part {q.part} · {q.stem || q.id}
            </p>
            {q.status !== 'COMPLETE' && (
              <p>Câu hỏi chưa đủ nội dung hoặc media để đưa vào đề thi.</p>
            )}
            <button
              type="button"
              disabled={
                q.status !== 'COMPLETE' ||
                refs.some((r) => r.questionId === q.id) ||
                refs.length >= 200
              }
              onClick={async () => {
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError('');
                try {
                  let add: Ref[];
                  if (q.groupId) {
                    const g = await bankApi.group(q.groupId);
                    add = g.questionIds.map((questionId, i) => ({
                      questionId,
                      part: q.part,
                      orderNo: i + 1,
                    }));
                  } else add = [{ questionId: q.id, part: q.part, orderNo: 1 }];
                  const next = [
                    ...refs,
                    ...add.filter((q) => !refs.some((r) => r.questionId === q.questionId)),
                  ];
                  if (next.length > 200)
                    throw new Error('Vượt 200 câu. Hãy bỏ câu trước khi thêm nhóm.');
                  replace(next);
                } catch (e) {
                  setError(failureMessage(e));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              {q.groupId ? 'Thêm toàn nhóm' : 'Thêm câu'}
            </button>
          </article>
        ))}
        {picker.data && <ManagementPager data={picker.data} onPage={setPage} />}
      </fieldset>
      {error && (
        <p role="alert" className="api-error">
          {error}
        </p>
      )}
      {uncertain && (
        <p>Chưa xác định kết quả tạo đề. Giữ bản nháp và kiểm tra danh sách trước khi tạo lại.</p>
      )}
    </article>
  );
}
