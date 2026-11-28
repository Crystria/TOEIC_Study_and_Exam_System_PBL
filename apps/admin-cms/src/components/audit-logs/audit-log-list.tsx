'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { demoAuditRepository } from '@/lib/audit-logs/demo-repository';
import { readAuditParams, auditHref } from '@/lib/audit-logs/query';
import { DEMO_AUDIT_ACTIONS } from '@/lib/audit-logs/fixtures';
import {
  DEFAULT_AUDIT_QUERY,
  AUDIT_DEMO_PAGE_SIZES,
  describeAuditAction,
  formatAuditTime,
  type AuditPage,
  type AuditPreview,
  type AuditQuery,
} from '@/lib/audit-logs/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: AuditPage };

export function AuditList() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const { query, preview } = readAuditParams(new URLSearchParams(raw));
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
  useEffect(() => setDraft(JSON.parse(queryKey) as AuditQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readAuditParams(current);
    const href = auditHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/audit-logs?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);
  useEffect(() => {
    const controller = new AbortController();
    const parsed = readAuditParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoAuditRepository
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
            auditHref(
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

  function navigate(next: AuditQuery, nextPreview = preview) {
    setNormalization('');
    const href = auditHref(new URLSearchParams(raw), next, nextPreview);
    if (`/audit-logs?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_AUDIT_QUERY, size: query.size };
    setDraft(next);
    navigate(next);
  }
  const filtered = Boolean(query.keyword || query.action);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} bản ghi minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';

  return (
    <section className="audit-library" aria-labelledby="audit-title">
      <div className="audit-intro">
        <div>
          <span className="cms-eyebrow">QUẢN TRỊ HỆ THỐNG</span>
          <h1 id="audit-title">Nhật ký quản trị</h1>
          <p>Tra cứu bản ghi minh họa theo các trường hiện có trong source.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <div className="audit-demo-note">
        <p>
          ID có tiền tố demo đều là mã giả. Source hiện ghi sự kiện đăng ký/đăng nhập; chưa xác nhận
          ghi đủ nhật ký truy cập và thao tác quản trị mà Word yêu cầu.
        </p>
        <p>
          userId là người dùng liên quan, chưa được xác nhận là người thực hiện quản trị.
          targetType/targetId là tham chiếu đích, chưa đồng nhất với tài khoản bị tác động trong
          Word. Trường thiếu hiển thị “Chưa có dữ liệu”; không suy ra kết quả hành động.
        </p>
      </div>
      <Card className="audit-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc nhật ký">
          <div className="audit-filters">
            <div className="audit-field audit-keyword">
              <label htmlFor="audit-keyword">Từ khóa</label>
              <input
                id="audit-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm mã bản ghi, hành động hoặc ID…"
                aria-describedby="audit-search-hint"
              />
            </div>
            <div className="audit-field">
              <label htmlFor="audit-action">Mã hành động trong bộ demo</label>
              <select
                id="audit-action"
                value={draft.action}
                onChange={(event) => setDraft({ ...draft, action: event.target.value })}
              >
                <option value="">Tất cả mã trong bộ demo</option>
                {draft.action && !DEMO_AUDIT_ACTIONS.includes(draft.action) && (
                  <option value={draft.action}>Mã ngoài bộ demo: {draft.action}</option>
                )}
                {DEMO_AUDIT_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="audit-filter-footer">
            <p id="audit-search-hint">
              Tìm chuỗi trong mã bản ghi, action, userId, targetType hoặc targetId, không phân biệt
              hoa thường; kết hợp mã action khớp chính xác. Nhấn Áp dụng hoặc Enter. Đây là lọc cục
              bộ, chưa phải tham số API; các mã mẫu không phải enum nghiệp vụ đầy đủ.
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
      <details className="audit-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="audit-preview-body">
          <label htmlFor="audit-preview">Kịch bản UI demo</label>
          <select
            id="audit-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRecovery({ scope: '', count: 0 });
              navigate({ ...query, page: 1 }, event.target.value as AuditPreview);
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
        <p className="audit-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="audit-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="audit-results-title">
          Danh sách nhật ký
        </h2>
        <div className="audit-page-size">
          <label htmlFor="audit-size">Số bản ghi mỗi trang</label>
          <select
            id="audit-size"
            disabled={!ready}
            value={query.size}
            onChange={(event) => navigate({ ...query, size: Number(event.target.value), page: 1 })}
          >
            {AUDIT_DEMO_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="audit-pagination-note">
        6/12/24 bản ghi mỗi trang là lựa chọn UI demo, không phải giới hạn backend. Thời gian ghi
        (createdAt) hiển thị tại Asia/Ho_Chi_Minh · UTC+07:00, chưa đồng nhất với occurred_at.
      </p>
      <p className="audit-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="audit-results"
        aria-busy={state === 'loading'}
        aria-labelledby="audit-results-title"
      >
        {state === 'loading' && (
          <div className="audit-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="audit-state">
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
          <Card className="audit-state">
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có nhật ký trong bộ demo'
                : 'Không tìm thấy nhật ký phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ bản ghi minh họa.'}
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
            <div className="audit-list-heading" aria-hidden="true">
              <span>Hành động & tóm tắt</span>
              <span>Người dùng liên quan</span>
              <span>Tham chiếu đích</span>
              <span>Thời gian ghi</span>
            </div>
            <ul className="audit-list" aria-label="Nhật ký minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-audit-id={item.id}>
                  <div className="audit-name">
                    <span className="audit-code">{item.id}</span>
                    <span className="audit-cell-label">Hành động (action)</span>
                    <h3>{item.action?.trim() || 'Chưa có dữ liệu'}</h3>
                    <p className="audit-summary">{describeAuditAction(item.action)}</p>
                  </div>
                  <div>
                    <span className="audit-cell-label">Người dùng liên quan (userId)</span>
                    {item.userId?.trim() || 'Chưa có dữ liệu'}
                  </div>
                  <div>
                    <span className="audit-cell-label">Loại đích (targetType)</span>
                    <p>{item.targetType?.trim() || 'Chưa có dữ liệu'}</p>
                    <span className="audit-target-label">ID đích (targetId)</span>
                    <p>{item.targetId?.trim() || 'Chưa có dữ liệu'}</p>
                  </div>
                  <div>
                    <span className="audit-cell-label">Thời gian ghi (createdAt)</span>
                    {item.createdAt ? (
                      <time dateTime={item.createdAt}>{formatAuditTime(item.createdAt)}</time>
                    ) : (
                      'Chưa có dữ liệu'
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <nav className="audit-pagination" aria-label="Phân trang nhật ký">
              <p>
                Hiển thị {(data.page - 1) * data.size + 1}–
                {Math.min(data.page * data.size, data.total)} / {data.total} bản ghi
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
      <p className="audit-bottom-note">
        Chỉ đọc dữ liệu demo cục bộ · Không có API hoặc phát sinh audit. Không hiển thị metadata hay
        dữ liệu trước/sau vì chưa có phép chiếu an toàn được xác nhận.
      </p>
    </section>
  );
}
