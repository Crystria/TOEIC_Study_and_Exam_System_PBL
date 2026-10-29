'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QUESTION_TAGS } from '@/lib/questions/fixtures';
import { demoQuestionRepository } from '@/lib/questions/demo-repository';
import { questionHref, readQuestionParams } from '@/lib/questions/query';
import { hasQuestionDetail } from '@/lib/questions/detail-availability';
import { questionDetailHref } from '@/lib/questions/detail-navigation';
import { questionFormHref } from '@/lib/questions/form-navigation';
import {
  DEFAULT_QUERY,
  DIFFICULTY_LABELS,
  type Difficulty,
  type QuestionPage,
  type QuestionPreview,
  type QuestionQuery,
} from '@/lib/questions/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: QuestionPage };

export function QuestionList() {
  const router = useRouter();
  const search = useSearchParams();
  const raw = search.toString();
  const params = readQuestionParams(new URLSearchParams(raw));
  const { query, preview } = params;
  const queryKey = JSON.stringify(query);
  const [draft, setDraft] = useState(query);
  const [retry, setRetry] = useState(0);
  const requestKey = `${queryKey}:${preview}:${retry}`;
  const [load, setLoad] = useState<LoadState>({ key: '', status: 'loading' });
  const [normalization, setNormalization] = useState('');
  const [ready, setReady] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const retryFocus = useRef(false);

  useEffect(() => setReady(true), []);
  useEffect(() => setDraft(JSON.parse(queryKey) as QuestionQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readQuestionParams(current);
    const href = questionHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/questions?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);

  useEffect(() => {
    const controller = new AbortController();
    const parsed = readQuestionParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoQuestionRepository
      .list(parsed.query, { signal: controller.signal, preview: parsed.preview, retry: retry > 0 })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.page !== parsed.query.page) {
          setNormalization(
            'Trang yêu cầu vượt số trang kết quả. Đã chuyển về trang hợp lệ gần nhất.',
          );
          router.replace(
            questionHref(
              new URLSearchParams(raw),
              { ...parsed.query, page: data.page },
              parsed.preview,
            ),
            { scroll: false },
          );
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
    if (state !== 'loading' && retryFocus.current) {
      retryFocus.current = false;
      if (document.activeElement === document.body) resultHeading.current?.focus();
    }
  }, [state]);

  function navigate(next: QuestionQuery, nextPreview = preview) {
    setNormalization('');
    const href = questionHref(new URLSearchParams(raw), next, nextPreview);
    if (`/questions?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), tag: draft.tag.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_QUERY, size: query.size };
    setDraft(next);
    navigate(next);
  }

  const filtered = Boolean(query.keyword || query.part || query.difficulty || query.tag);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} câu hỏi minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';
  return (
    <section className="question-library" aria-labelledby="question-title">
      <div className="question-intro">
        <div>
          <span className="cms-eyebrow">NỘI DUNG HỌC TẬP</span>
          <h1 id="question-title">Ngân hàng câu hỏi</h1>
          <p>Tra cứu câu hỏi Listening và Reading trong bộ dữ liệu minh họa.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <p className="question-demo-note">
        Bản tóm tắt văn bản tự soạn. Ba câu Part 5 có liên kết xem chi tiết demo; các câu khác chưa
        có chi tiết. Chưa tải câu hỏi từ server hoặc nội dung media.
      </p>
      <Link
        className="cms-link-button"
        style={{ marginTop: 0, marginBottom: 20 }}
        href={questionFormHref(new URLSearchParams(raw))}
      >
        Thử tạo câu hỏi
      </Link>
      <Card className="question-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc câu hỏi">
          <div className="question-filters">
            <div className="question-field question-keyword">
              <label htmlFor="question-keyword">Từ khóa</label>
              <input
                id="question-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm trong nội dung, lời giải tóm tắt…"
                aria-describedby="question-search-hint"
              />
            </div>
            <div className="question-field">
              <label htmlFor="question-part">Part</label>
              <select
                id="question-part"
                value={draft.part}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    part: event.target.value
                      ? (Number(event.target.value) as QuestionQuery['part'])
                      : '',
                  })
                }
              >
                <option value="">Tất cả Part</option>
                {[1, 2, 3, 4, 5, 6, 7].map((part) => (
                  <option key={part} value={part}>
                    Part {part}
                  </option>
                ))}
              </select>
            </div>
            <div className="question-field">
              <label htmlFor="question-difficulty">Độ khó</label>
              <select
                id="question-difficulty"
                value={draft.difficulty}
                onChange={(event) =>
                  setDraft({ ...draft, difficulty: event.target.value as Difficulty | '' })
                }
              >
                <option value="">Tất cả độ khó</option>
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="question-field">
              <label htmlFor="question-tag">Nhãn (tag)</label>
              <input
                id="question-tag"
                list="question-tags"
                value={draft.tag}
                onChange={(event) => setDraft({ ...draft, tag: event.target.value })}
                placeholder="Ví dụ: office"
              />
              <datalist id="question-tags">
                {QUESTION_TAGS.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="question-filter-footer">
            <p id="question-search-hint">
              Tìm chuỗi không phân biệt hoa thường; nhãn khớp chính xác. Nhấn Áp dụng để cập nhật
              kết quả demo.
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
      <details className="question-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="question-preview-body">
          <label htmlFor="question-preview">Kịch bản UI demo</label>
          <select
            id="question-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRetry(0);
              navigate({ ...query, page: 1 }, event.target.value as QuestionPreview);
            }}
          >
            <option value="normal">Bộ dữ liệu bình thường</option>
            <option value="slow">Tải chậm mô phỏng</option>
            <option value="empty">Bộ dữ liệu trống mô phỏng</option>
            <option value="error">Lỗi tải mô phỏng</option>
          </select>
          <p>
            Chỉ đổi fixture và thời gian chờ trên trình duyệt. Không gọi API hoặc thay đổi dữ liệu
            quản trị. Reload kịch bản lỗi sẽ mô phỏng lỗi lại.
          </p>
        </div>
      </details>
      {normalization && (
        <p className="question-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="question-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="question-results-title">
          Danh sách câu hỏi
        </h2>
        <div className="question-page-size">
          <label htmlFor="question-size">Số câu mỗi trang</label>
          <select
            id="question-size"
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
      <p className="question-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="question-results"
        aria-busy={state === 'loading'}
        aria-labelledby="question-results-title"
      >
        {state === 'loading' && (
          <div className="question-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="question-state">
            <span className="question-state-icon" aria-hidden="true">
              !
            </span>
            <h3>Chưa đọc được dữ liệu demo</h3>
            <p>
              Lỗi tải fixture đang được mô phỏng. Thử lại để đọc bộ dữ liệu bình thường, không gửi
              request mạng.
            </p>
            <Button
              onClick={() => {
                retryFocus.current = true;
                setRetry(retry + 1);
              }}
            >
              Thử lại dữ liệu demo
            </Button>
          </Card>
        )}
        {data && data.total === 0 && (
          <Card className="question-state">
            <span className="question-state-icon" aria-hidden="true">
              ∅
            </span>
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có câu hỏi trong bộ demo'
                : 'Không tìm thấy câu hỏi phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ câu hỏi minh họa.'}
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
            <div className="question-list-heading" aria-hidden="true">
              <span>Nội dung câu hỏi</span>
              <span>Part</span>
              <span>Độ khó</span>
              <span>Nhãn</span>
            </div>
            <ul className="question-list" aria-label="Câu hỏi minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-question-id={item.id}>
                  <div className="question-stem">
                    <span className="question-code">{item.id.toUpperCase()}</span>
                    <h3>{item.stem}</h3>
                    {hasQuestionDetail(item.id) && (
                      <Link
                        className="cms-link-button"
                        href={questionDetailHref(item.id, new URLSearchParams(raw))}
                      >
                        Xem chi tiết <span className="sr-only">{item.id}</span>
                      </Link>
                    )}
                  </div>
                  <div className="question-part">
                    <span className="question-cell-label">Part</span>
                    <strong>Part {item.part}</strong>
                    <small>{item.part <= 4 ? 'Listening' : 'Reading'}</small>
                  </div>
                  <div className="question-level">
                    <span className="question-cell-label">Độ khó</span>
                    <span
                      className={`question-difficulty question-difficulty-${item.difficulty.toLowerCase()}`}
                    >
                      {DIFFICULTY_LABELS[item.difficulty]}
                    </span>
                  </div>
                  <div className="question-row-tags">
                    <span className="question-cell-label">Nhãn</span>
                    {item.tags.map((tag) => (
                      <span key={tag} className="question-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <nav className="question-pagination" aria-label="Phân trang câu hỏi">
              <p>
                Hiển thị {(data.page - 1) * data.size + 1}–
                {Math.min(data.page * data.size, data.total)} / {data.total} câu hỏi
                {filtered ? ' phù hợp' : ''}
              </p>
              <div>
                <Button
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => {
                    retryFocus.current = true;
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
                    retryFocus.current = true;
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
      <p className="question-bottom-note">
        Danh sách chỉ đọc · Không có thao tác tạo, sửa, xóa hoặc tải tệp.
      </p>
    </section>
  );
}
