'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LESSON_CATEGORIES } from '@/lib/lessons/fixtures';
import { demoLessonRepository } from '@/lib/lessons/demo-repository';
import { readLessonParams, lessonHref } from '@/lib/lessons/query';
import { hasLessonDetail } from '@/lib/lessons/detail-availability';
import { lessonDetailHref } from '@/lib/lessons/detail-navigation';
import {
  DEFAULT_LESSON_QUERY,
  LESSON_DEMO_PAGE_SIZE,
  type LessonPage,
  type LessonPreview,
  type LessonQuery,
} from '@/lib/lessons/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: LessonPage };

export function LessonList() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const { query, preview } = readLessonParams(new URLSearchParams(raw));
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
  useEffect(() => setDraft(JSON.parse(queryKey) as LessonQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readLessonParams(current);
    const href = lessonHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/lessons?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);
  useEffect(() => {
    const controller = new AbortController();
    const parsed = readLessonParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoLessonRepository
      .list(parsed.query, { signal: controller.signal, preview: parsed.preview, retry: retry > 0 })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.page !== parsed.query.page) {
          if (retry > 0) {
            setRecovery({
              scope: `${JSON.stringify({ ...parsed.query, page: data.page })}:${parsed.preview}`,
              count: retry,
            });
          }
          setNormalization(
            'Trang yêu cầu vượt số trang kết quả. Đã chuyển về trang hợp lệ gần nhất.',
          );
          router.replace(
            lessonHref(
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

  function navigate(next: LessonQuery, nextPreview = preview) {
    setNormalization('');
    const href = lessonHref(new URLSearchParams(raw), next, nextPreview);
    if (`/lessons?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), category: draft.category.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_LESSON_QUERY };
    setDraft(next);
    navigate(next);
  }
  const filtered = Boolean(query.keyword || query.category);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} bài học minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';

  return (
    <section className="lesson-library" aria-labelledby="lesson-title">
      <div className="lesson-intro">
        <div>
          <span className="cms-eyebrow">NỘI DUNG HỌC TẬP</span>
          <h1 id="lesson-title">Bài học ngữ pháp</h1>
          <p>Tra cứu danh mục bài giảng lý thuyết ngữ pháp minh họa.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <div className="lesson-demo-note">
        <p>
          Tên bài và danh mục là dữ liệu tự soạn để minh họa. Trường thiếu hiển thị &quot;Chưa có dữ
          liệu&quot;.
        </p>
        <p>
          Tìm kiếm, lọc danh mục và phân trang chỉ chạy cục bộ trên bộ demo; chưa có tham số API
          tương ứng. Danh mục không được suy ra từ cấp độ bài học.
        </p>
      </div>
      <Card className="lesson-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc bài học">
          <div className="lesson-filters">
            <div className="lesson-field lesson-keyword">
              <label htmlFor="lesson-keyword">Từ khóa</label>
              <input
                id="lesson-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm theo tên bài học…"
                aria-describedby="lesson-search-hint"
              />
            </div>
            <div className="lesson-field">
              <label htmlFor="lesson-category">Danh mục minh họa</label>
              <select
                id="lesson-category"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                <option value="">Tất cả danh mục</option>
                {[...new Set([...LESSON_CATEGORIES, draft.category].filter(Boolean))].map(
                  (category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
          <div className="lesson-filter-footer">
            <p id="lesson-search-hint">
              Tìm trong tên bài, không phân biệt hoa thường; kết hợp danh mục chính xác. Nhấn Áp
              dụng hoặc Enter để cập nhật kết quả demo.
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
      <details className="lesson-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="lesson-preview-body">
          <label htmlFor="lesson-preview">Kịch bản UI demo</label>
          <select
            id="lesson-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRecovery({ scope: '', count: 0 });
              navigate({ ...query, page: 1 }, event.target.value as LessonPreview);
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
        <p className="lesson-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="lesson-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="lesson-results-title">
          Danh sách bài học ngữ pháp
        </h2>
        <p className="lesson-page-note">
          {LESSON_DEMO_PAGE_SIZE} bài mỗi trang · Quy ước xem thử UI
        </p>
      </div>
      <p className="lesson-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="lesson-results"
        aria-busy={state === 'loading'}
        aria-labelledby="lesson-results-title"
      >
        {state === 'loading' && (
          <div className="lesson-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="lesson-state">
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
          <Card className="lesson-state">
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có bài học trong bộ demo'
                : 'Không tìm thấy bài học phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ bài học minh họa.'}
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
            <div className="lesson-list-heading" aria-hidden="true">
              <span>Tên bài học</span>
              <span>Danh mục minh họa</span>
            </div>
            <ul className="lesson-list" aria-label="Bài học ngữ pháp minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-lesson-id={item.id}>
                  <div className="lesson-name">
                    <span className="lesson-code">{item.id.toUpperCase()}</span>
                    <h3>
                      {hasLessonDetail(item.id) ? (
                        <Link
                          href={lessonDetailHref(item.id, new URLSearchParams(raw))}
                          style={{
                            color: '#1d4ed8',
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          {item.title ?? 'Chưa có dữ liệu'}
                        </Link>
                      ) : (
                        (item.title ?? 'Chưa có dữ liệu')
                      )}
                    </h3>
                  </div>
                  <div>
                    <span className="lesson-cell-label">Danh mục minh họa</span>
                    {item.category ?? 'Chưa có dữ liệu'}
                  </div>
                </li>
              ))}
            </ul>
            <nav className="lesson-pagination" aria-label="Phân trang bài học">
              <p>
                Hiển thị {(data.page - 1) * LESSON_DEMO_PAGE_SIZE + 1}–
                {Math.min(data.page * LESSON_DEMO_PAGE_SIZE, data.total)} / {data.total} bài học
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
      <p className="lesson-bottom-note">
        Danh mục chỉ đọc · Hai bài đầu có chi tiết minh họa. Chưa có trình soạn Markdown.
      </p>
    </section>
  );
}
