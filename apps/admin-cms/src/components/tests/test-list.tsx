'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { demoTestRepository } from '@/lib/tests/demo-repository';
import { readTestParams, testHref } from '@/lib/tests/query';
import { hasTestDetail } from '@/lib/tests/detail-availability';
import { testDetailHref } from '@/lib/tests/detail-navigation';
import {
  DEFAULT_TEST_QUERY,
  TEST_TYPE_LABELS,
  TEST_STATUS_LABELS,
  formatTestDuration,
  type TestPage,
  type TestPreview,
  type TestQuery,
} from '@/lib/tests/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: TestPage };

export function TestList() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const { query, preview } = readTestParams(new URLSearchParams(raw));
  const queryKey = JSON.stringify(query);
  const [draft, setDraft] = useState(query);
  // Recovery is tied to this scenario and query, so a different error URL still demonstrates error.
  const [recovery, setRecovery] = useState({ scope: '', count: 0 });
  const scope = `${queryKey}:${preview}`;
  const retry = recovery.scope === scope ? recovery.count : 0;
  const requestKey = `${scope}:${retry}`;
  const [load, setLoad] = useState<LoadState>({ key: '', status: 'loading' });
  const [normalization, setNormalization] = useState('');
  const [ready, setReady] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef(false);

  useEffect(() => setReady(true), []);
  useEffect(() => setDraft(JSON.parse(queryKey) as TestQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readTestParams(current);
    const href = testHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/tests?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);
  useEffect(() => {
    const controller = new AbortController();
    const parsed = readTestParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoTestRepository
      .list(parsed.query, { signal: controller.signal, preview: parsed.preview, retry: retry > 0 })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.page !== parsed.query.page) {
          setNormalization(
            'Trang yêu cầu vượt số trang kết quả. Đã chuyển về trang hợp lệ gần nhất.',
          );
          router.replace(
            testHref(
              new URLSearchParams(raw),
              { ...parsed.query, page: data.page },
              parsed.preview,
            ),
            { scroll: false },
          );
          return;
        }
        setLoad({ key: requestKey, status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ key: requestKey, status: 'error' });
      });
    return () => controller.abort();
  }, [raw, requestKey, retry, router]);

  const state = load.key === requestKey ? load.status : 'loading';
  const data = state === 'ready' ? load.data : undefined;
  useEffect(() => {
    if (state !== 'loading' && pendingFocus.current) {
      pendingFocus.current = false;
      if (document.activeElement === document.body) resultHeading.current?.focus();
    }
  }, [state]);

  function navigate(next: TestQuery, nextPreview = preview) {
    setNormalization('');
    const href = testHref(new URLSearchParams(raw), next, nextPreview);
    if (`/tests?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_TEST_QUERY, size: query.size };
    setDraft(next);
    navigate(next);
  }
  const filtered = Boolean(query.keyword || query.type || query.status);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} đề thi minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';

  return (
    <section className="test-library" aria-labelledby="test-title">
      <div className="test-intro">
        <div>
          <span className="cms-eyebrow">NỘI DUNG HỌC TẬP</span>
          <h1 id="test-title">Đề thi</h1>
          <p>Tra cứu danh mục Full Test và Mini Test minh họa.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <div className="test-demo-note">
        <p>
          Tên, thời lượng, số câu và trạng thái đều là dữ liệu minh họa. Trường thiếu hiển thị “Chưa
          có dữ liệu”; không suy ra từ loại đề.
        </p>
        <p>
          Full Test / Mini Test là loại đề, khác chế độ làm bài PRACTICE / MOCK_TEST của học viên.
          Trạng thái là ví dụ trong bộ demo, chưa thể hiện quy trình xuất bản thực tế.
        </p>
      </div>
      <Card className="test-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc đề thi">
          <div className="test-filters">
            <div className="test-field test-keyword">
              <label htmlFor="test-keyword">Từ khóa</label>
              <input
                id="test-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm theo tên đề…"
                aria-describedby="test-search-hint"
              />
            </div>
            <div className="test-field">
              <label htmlFor="test-type">Loại đề</label>
              <select
                id="test-type"
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value as TestQuery['type'] })
                }
              >
                <option value="">Tất cả loại đề</option>
                {Object.entries(TEST_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="test-field">
              <label htmlFor="test-status">Trạng thái minh họa</label>
              <select
                id="test-status"
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as TestQuery['status'] })
                }
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(TEST_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="test-filter-footer">
            <p id="test-search-hint">
              Tìm chuỗi trong tên, không phân biệt hoa thường. Nhấn Áp dụng để cập nhật kết quả
              demo.
            </p>
            <div>
              <Button type="submit" disabled={!ready}>
                Áp dụng bộ lọc
              </Button>
              <Button variant="secondary" disabled={!ready} onClick={clear}>
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </form>
      </Card>
      <details className="test-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="test-preview-body">
          <label htmlFor="test-preview">Kịch bản UI demo</label>
          <select
            id="test-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRecovery({ scope: '', count: 0 });
              navigate({ ...query, page: 1 }, event.target.value as TestPreview);
            }}
          >
            <option value="normal">Bộ dữ liệu bình thường</option>
            <option value="slow">Tải chậm mô phỏng</option>
            <option value="empty">Bộ dữ liệu trống mô phỏng</option>
            <option value="error">Lỗi tải mô phỏng</option>
          </select>
          <p>
            Chỉ để xem thử UI bằng dữ liệu và thời gian chờ cục bộ. Không gọi API. Reload kịch bản
            lỗi sẽ mô phỏng lỗi lại.
          </p>
        </div>
      </details>
      {normalization && (
        <p className="test-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="test-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="test-results-title">
          Danh sách đề thi
        </h2>
        <div className="test-page-size">
          <label htmlFor="test-size">Số đề mỗi trang</label>
          <select
            id="test-size"
            disabled={!ready}
            value={query.size}
            onChange={(event) => navigate({ ...query, size: Number(event.target.value), page: 1 })}
          >
            {[...new Set([5, 10, 20, 50, query.size])]
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
          </select>
        </div>
      </div>
      <p className="test-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="test-results"
        aria-busy={state === 'loading'}
        aria-labelledby="test-results-title"
      >
        {state === 'loading' && (
          <div className="test-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="test-state">
            <h3>Chưa đọc được dữ liệu demo</h3>
            <p>
              Lỗi đọc dữ liệu đang được mô phỏng. Thử lại để đọc bộ dữ liệu bình thường trên trình
              duyệt.
            </p>
            <Button
              onClick={() => {
                pendingFocus.current = true;
                setRecovery({ scope, count: retry + 1 });
              }}
            >
              Thử lại dữ liệu demo
            </Button>
          </Card>
        )}
        {data && data.total === 0 && (
          <Card className="test-state">
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có đề thi trong bộ demo'
                : 'Không tìm thấy đề thi phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ đề thi minh họa.'}
            </p>
            {data.catalogTotal !== 0 && (
              <Button variant="secondary" onClick={clear}>
                Xóa bộ lọc kết quả
              </Button>
            )}
          </Card>
        )}
        {data && data.total > 0 && (
          <>
            <div className="test-list-heading" aria-hidden="true">
              <span>Tên đề</span>
              <span>Loại đề</span>
              <span>Thời lượng</span>
              <span>Số câu</span>
              <span>Trạng thái demo</span>
            </div>
            <ul className="test-list" aria-label="Đề thi minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-test-id={item.id}>
                  <div className="test-name">
                    <span className="test-code">{item.id.toUpperCase()}</span>
                    <h3>
                      {hasTestDetail(item.id) ? (
                        <Link href={testDetailHref(item.id, new URLSearchParams(raw))}>
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                  </div>
                  <div>
                    <span className="test-cell-label">Loại đề</span>
                    <span className="test-type">{TEST_TYPE_LABELS[item.type]}</span>
                  </div>
                  <div>
                    <span className="test-cell-label">Thời lượng</span>
                    {formatTestDuration(item.durationSeconds)}
                  </div>
                  <div>
                    <span className="test-cell-label">Số câu</span>
                    {item.questionCount === null ? 'Chưa có dữ liệu' : `${item.questionCount} câu`}
                  </div>
                  <div>
                    <span className="test-cell-label">Trạng thái demo</span>
                    <span
                      className={`test-status test-status-${item.status?.toLowerCase() ?? 'unknown'}`}
                    >
                      {item.status ? TEST_STATUS_LABELS[item.status] : 'Chưa có dữ liệu'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <nav className="test-pagination" aria-label="Phân trang đề thi">
              <p>
                Hiển thị {(data.page - 1) * data.size + 1}–
                {Math.min(data.page * data.size, data.total)} / {data.total} đề thi
                {filtered ? ' phù hợp' : ''}
              </p>
              <div>
                <Button
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => {
                    pendingFocus.current = true;
                    navigate({ ...query, page: data.page - 1 });
                  }}
                >
                  Trang trước
                </Button>
                <span aria-current="page">
                  Trang {data.page} / {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={data.page >= data.totalPages}
                  onClick={() => {
                    pendingFocus.current = true;
                    navigate({ ...query, page: data.page + 1 });
                  }}
                >
                  Trang sau
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
      <p className="test-bottom-note">
        Danh mục chỉ đọc · Hai đề demo đầu có chi tiết metadata; chưa có cấu trúc câu hỏi để xem.
      </p>
    </section>
  );
}
