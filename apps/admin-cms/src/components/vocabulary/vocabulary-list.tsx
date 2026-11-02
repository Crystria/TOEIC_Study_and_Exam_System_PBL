'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VOCABULARY_TOPICS } from '@/lib/vocabulary/fixtures';
import { demoVocabularyRepository } from '@/lib/vocabulary/demo-repository';
import { readVocabularyParams, vocabularyHref } from '@/lib/vocabulary/query';
import { hasVocabularyDetail } from '@/lib/vocabulary/detail-availability';
import { vocabularyDetailHref } from '@/lib/vocabulary/detail-navigation';
import {
  DEFAULT_VOCABULARY_QUERY,
  type VocabularyPage,
  type VocabularyPreview,
  type VocabularyQuery,
} from '@/lib/vocabulary/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: VocabularyPage };

export function VocabularyList() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const { query, preview } = readVocabularyParams(new URLSearchParams(raw));
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
  useEffect(() => setDraft(JSON.parse(queryKey) as VocabularyQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readVocabularyParams(current);
    const href = vocabularyHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/vocabulary?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);
  useEffect(() => {
    const controller = new AbortController();
    const parsed = readVocabularyParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoVocabularyRepository
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
            vocabularyHref(
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

  function navigate(next: VocabularyQuery, nextPreview = preview) {
    setNormalization('');
    const href = vocabularyHref(new URLSearchParams(raw), next, nextPreview);
    if (`/vocabulary?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), topicId: draft.topicId.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_VOCABULARY_QUERY, size: query.size };
    setDraft(next);
    navigate(next);
  }
  const filtered = Boolean(query.keyword || query.topicId);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} từ vựng minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';

  return (
    <section className="vocabulary-library" aria-labelledby="vocabulary-title">
      <div className="vocabulary-intro">
        <div>
          <span className="cms-eyebrow">NỘI DUNG HỌC TẬP</span>
          <h1 id="vocabulary-title">Từ vựng</h1>
          <p>Tra cứu kho từ vựng theo từ, nghĩa và chủ đề minh họa.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <div className="vocabulary-demo-note">
        <p>
          Từ, nghĩa, chủ đề và phiên âm đều là dữ liệu tự soạn để minh họa. Trường thiếu hiển thị
          “Chưa có dữ liệu”.
        </p>
        <p>
          Tìm kiếm, lọc và phân trang chạy cục bộ trên bộ demo; chưa gọi API hoặc tải dữ liệu tài
          khoản.
        </p>
      </div>
      <Card className="vocabulary-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc từ vựng">
          <div className="vocabulary-filters">
            <div className="vocabulary-field vocabulary-keyword">
              <label htmlFor="vocabulary-keyword">Từ khóa</label>
              <input
                id="vocabulary-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm theo từ hoặc nghĩa…"
                aria-describedby="vocabulary-search-hint"
              />
            </div>
            <div className="vocabulary-field">
              <label htmlFor="vocabulary-topic">Chủ đề minh họa</label>
              <select
                id="vocabulary-topic"
                value={draft.topicId}
                onChange={(event) => setDraft({ ...draft, topicId: event.target.value })}
              >
                <option value="">Tất cả chủ đề</option>
                {draft.topicId &&
                  !VOCABULARY_TOPICS.some((topic) => topic.id === draft.topicId) && (
                    <option value={draft.topicId}>
                      Chủ đề không có trong bộ demo: {draft.topicId}
                    </option>
                  )}
                {VOCABULARY_TOPICS.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="vocabulary-filter-footer">
            <p id="vocabulary-search-hint">
              Tìm trong từ hoặc nghĩa, không phân biệt hoa thường; kết hợp chủ đề đã chọn. Nhấn Áp
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
      <details className="vocabulary-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="vocabulary-preview-body">
          <label htmlFor="vocabulary-preview">Kịch bản UI demo</label>
          <select
            id="vocabulary-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRecovery({ scope: '', count: 0 });
              navigate({ ...query, page: 1 }, event.target.value as VocabularyPreview);
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
        <p className="vocabulary-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="vocabulary-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="vocabulary-results-title">
          Danh sách từ vựng
        </h2>
        <div className="vocabulary-page-size">
          <label htmlFor="vocabulary-size">Số từ mỗi trang</label>
          <select
            id="vocabulary-size"
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
      <p className="vocabulary-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="vocabulary-results"
        aria-busy={state === 'loading'}
        aria-labelledby="vocabulary-results-title"
      >
        {state === 'loading' && (
          <div className="vocabulary-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="vocabulary-state">
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
          <Card className="vocabulary-state">
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có từ vựng trong bộ demo'
                : 'Không tìm thấy từ vựng phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ từ vựng minh họa.'}
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
            <div className="vocabulary-list-heading" aria-hidden="true">
              <span>Từ</span>
              <span>Phiên âm</span>
              <span>Nghĩa</span>
              <span>Chủ đề minh họa</span>
            </div>
            <ul className="vocabulary-list" aria-label="Từ vựng minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-vocabulary-id={item.id}>
                  <div className="vocabulary-name">
                    <span className="vocabulary-code">{item.id.toUpperCase()}</span>
                    <h3>
                      {hasVocabularyDetail(item.id) ? (
                        <Link
                          href={vocabularyDetailHref(item.id, new URLSearchParams(raw))}
                          lang="en"
                          className="text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-700"
                        >
                          {item.word ?? 'Chưa có dữ liệu'}
                        </Link>
                      ) : (
                        (item.word ?? 'Chưa có dữ liệu')
                      )}
                    </h3>
                  </div>
                  <div>
                    <span className="vocabulary-cell-label">Phiên âm</span>
                    {item.pronunciation ?? 'Chưa có dữ liệu'}
                  </div>
                  <div>
                    <span className="vocabulary-cell-label">Nghĩa</span>
                    {item.meaning ?? 'Chưa có dữ liệu'}
                  </div>
                  <div>
                    <span className="vocabulary-cell-label">Chủ đề minh họa</span>
                    {VOCABULARY_TOPICS.find((topic) => topic.id === item.topicId)?.name ??
                      'Chưa có dữ liệu'}
                  </div>
                </li>
              ))}
            </ul>
            <nav className="vocabulary-pagination" aria-label="Phân trang từ vựng">
              <p>
                Hiển thị {(data.page - 1) * data.size + 1}–
                {Math.min(data.page * data.size, data.total)} / {data.total} từ vựng
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
      <p className="vocabulary-bottom-note">
        Danh sách chỉ đọc · Có chi tiết minh họa cho agenda và briefing.
      </p>
    </section>
  );
}
