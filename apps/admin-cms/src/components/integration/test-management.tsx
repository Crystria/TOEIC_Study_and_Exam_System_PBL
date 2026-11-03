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

type Ref = { questionId: string; part: number; orderNo: number };
export function TestManagement({ writes }: { writes: boolean }) {
  const { id, path, params, href, update } = useCmsLocation();
  const state = useResource(`tests:${id}:${params}`, async (signal) =>
    id && id !== 'new'
      ? { detail: await examApi.detail(id, signal), page: null }
      : { detail: null, page: id === 'new' ? null : await examApi.list(params, signal) },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false);
  return (
    <>
      <h1>Đề thi Full Test</h1>
      {id ? (
        <Link href={href()}>Danh sách</Link>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update('keyword', String(new FormData(e.currentTarget).get('keyword') ?? ''));
            }}
          >
            <label className="api-field">
              Từ khóa
              <input name="keyword" defaultValue={params.get('keyword') ?? ''} />
            </label>
            <button>Tìm kiếm</button>
          </form>
          {writes && <Link href={href('new')}>Tạo đề đủ 7 Part</Link>}
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
          {writes && (
            <>
              <Link href={href(id, true)}>Chỉnh sửa đề / cấu trúc</Link>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    lock.current ||
                    !id ||
                    !window.confirm('Ngừng sử dụng đề? Các lượt đã tạo giữ snapshot riêng.')
                  )
                    return;
                  lock.current = true;
                  setBusy(true);
                  try {
                    if (
                      record(await gateway(`tests/${segment(id)}`, { method: 'DELETE' }))
                        .success !== true
                    )
                      throw new ContractError('delete');
                    window.location.assign('/tests');
                  } catch (e) {
                    setError(failureMessage(e));
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                }}
              >
                Ngừng sử dụng đề
              </button>
            </>
          )}
        </article>
      )}
      {(id === 'new' || (path.endsWith('/edit') && state.data?.detail)) && (
        <TestEditor
          key={id}
          writes={writes}
          original={state.data?.detail ?? undefined}
          saved={(v) => window.location.assign(href(v.id))}
        />
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
}: {
  writes: boolean;
  original?: Awaited<ReturnType<typeof examApi.detail>>;
  saved: (v: Awaited<ReturnType<typeof examApi.detail>>) => void;
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
          <button disabled={!preview}>Lưu đề lên server</button>
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
            <button
              type="button"
              disabled={refs.some((r) => r.questionId === q.id) || refs.length >= 200}
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
