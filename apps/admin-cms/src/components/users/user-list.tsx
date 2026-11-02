'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { demoUserRepository } from '@/lib/users/demo-repository';
import { readUserParams, userHref } from '@/lib/users/query';
import {
  DEFAULT_USER_QUERY,
  USER_STATUSES,
  USER_STATUS_LABELS,
  USER_ROLE_LABELS,
  type UserStatus,
  type UserPage,
  type UserPreview,
  type UserQuery,
} from '@/lib/users/types';

type LoadState = { key: string; status: 'loading' | 'error' | 'ready'; data?: UserPage };

export function UserList() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const { query, preview } = readUserParams(new URLSearchParams(raw));
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
  useEffect(() => setDraft(JSON.parse(queryKey) as UserQuery), [queryKey]);
  useEffect(() => {
    const current = new URLSearchParams(raw);
    const parsed = readUserParams(current);
    const href = userHref(current, parsed.query, parsed.preview);
    if (parsed.corrected)
      setNormalization('Một số tham số URL không hợp lệ đã được đưa về giá trị mặc định.');
    if (`/users?${raw}` !== href) router.replace(href, { scroll: false });
  }, [raw, router]);
  useEffect(() => {
    const controller = new AbortController();
    const parsed = readUserParams(new URLSearchParams(raw));
    setLoad({ key: requestKey, status: 'loading' });
    demoUserRepository
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
            userHref(
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

  function navigate(next: UserQuery, nextPreview = preview) {
    setNormalization('');
    const href = userHref(new URLSearchParams(raw), next, nextPreview);
    if (`/users?${raw}` !== href) router.push(href, { scroll: false });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...draft, keyword: draft.keyword.trim(), page: 1 });
  }
  function clear() {
    const next = { ...DEFAULT_USER_QUERY, size: query.size };
    setDraft(next);
    navigate(next);
  }
  const filtered = Boolean(query.keyword || query.status);
  const statusMessage =
    state === 'loading'
      ? 'Đang đọc dữ liệu minh họa…'
      : state === 'error'
        ? 'Không thể đọc dữ liệu demo trong kịch bản này.'
        : data
          ? `${data.total} người dùng minh họa. Trang ${data.page} trên ${data.totalPages}.`
          : '';

  return (
    <section className="user-library" aria-labelledby="user-title">
      <div className="user-intro">
        <div>
          <span className="cms-eyebrow">QUẢN TRỊ HỆ THỐNG</span>
          <h1 id="user-title">Người dùng & vai trò</h1>
          <p>Tra cứu danh sách người dùng theo họ tên, email và trạng thái minh họa.</p>
        </div>
        <span className="cms-badge">CHỈ ĐỌC · DỮ LIỆU DEMO</span>
      </div>
      <div className="user-demo-note">
        <p>
          Mọi danh tính đều là nhân vật giả, email mẫu thuộc example.com. Trường thiếu hiển thị
          “Chưa có dữ liệu”.
        </p>
        <p>
          Tìm kiếm, lọc và phân trang chạy cục bộ trên bộ demo; chưa tải dữ liệu tài khoản thật hoặc
          thay đổi quyền và trạng thái.
        </p>
      </div>
      <Card className="user-filter-card">
        <form onSubmit={submit} aria-label="Tìm kiếm và lọc người dùng">
          <div className="user-filters">
            <div className="user-field user-keyword">
              <label htmlFor="user-keyword">Từ khóa</label>
              <input
                id="user-keyword"
                type="search"
                value={draft.keyword}
                onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                placeholder="Tìm theo họ tên hoặc email…"
                aria-describedby="user-search-hint"
              />
            </div>
            <div className="user-field">
              <label htmlFor="user-status">Trạng thái minh họa</label>
              <select
                id="user-status"
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as UserStatus | '' })
                }
              >
                <option value="">Tất cả trạng thái</option>
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {USER_STATUS_LABELS[status]} ({status})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="user-filter-footer">
            <p id="user-search-hint">
              Tìm trong họ tên hoặc email, không phân biệt hoa thường; kết hợp trạng thái đã chọn.
              Nhấn Áp dụng hoặc Enter để cập nhật kết quả demo.
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
      <details className="user-preview-controls">
        <summary>Công cụ xem thử trạng thái dữ liệu</summary>
        <div className="user-preview-body">
          <label htmlFor="user-preview">Kịch bản UI demo</label>
          <select
            id="user-preview"
            value={preview}
            disabled={!ready}
            onChange={(event) => {
              setRecovery({ scope: '', count: 0 });
              navigate({ ...query, page: 1 }, event.target.value as UserPreview);
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
        <p className="user-normalization" role="status">
          {normalization}
        </p>
      )}
      <div className="user-results-header">
        <h2 ref={resultHeading} tabIndex={-1} id="user-results-title">
          Danh sách người dùng
        </h2>
        <div className="user-page-size">
          <label htmlFor="user-size">Số người mỗi trang</label>
          <select
            id="user-size"
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
      <p className="user-result-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
      <div
        className="user-results"
        aria-busy={state === 'loading'}
        aria-labelledby="user-results-title"
      >
        {state === 'loading' && (
          <div className="user-loading" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}>
                <span />
                <span />
              </div>
            ))}
          </div>
        )}
        {state === 'error' && (
          <Card className="user-state">
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
          <Card className="user-state">
            <h3>
              {data.catalogTotal === 0
                ? 'Chưa có người dùng trong bộ demo'
                : 'Không tìm thấy người dùng phù hợp'}
            </h3>
            <p>
              {data.catalogTotal === 0
                ? 'Đang xem bộ dữ liệu trống mô phỏng. Chọn bộ dữ liệu bình thường trong công cụ xem thử để tiếp tục.'
                : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại toàn bộ người dùng minh họa.'}
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
            <div className="user-list-heading" aria-hidden="true">
              <span>Họ tên</span>
              <span>Email</span>
              <span>Vai trò</span>
              <span>Trạng thái</span>
            </div>
            <ul className="user-list" aria-label="Người dùng minh họa">
              {data.items.map((item) => (
                <li key={item.id} data-user-id={item.id}>
                  <div className="user-name">
                    <span className="user-code">{item.id.toUpperCase()}</span>
                    <h3>{item.fullName?.trim() || 'Chưa có dữ liệu'}</h3>
                  </div>
                  <div>
                    <span className="user-cell-label">Email</span>
                    {item.email?.trim() || 'Chưa có dữ liệu'}
                  </div>
                  <div>
                    <span className="user-cell-label">Vai trò</span>
                    {item.roles?.length ? (
                      <ul className="user-roles" aria-label="Vai trò của tài khoản">
                        {item.roles.map((role) => (
                          <li key={role}>
                            {USER_ROLE_LABELS[role]}
                            <small>{role}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      'Chưa có dữ liệu'
                    )}
                  </div>
                  <div>
                    <span className="user-cell-label">Trạng thái</span>
                    {item.status ? (
                      <span className="user-status" data-status={item.status}>
                        {USER_STATUS_LABELS[item.status]}
                        <small>{item.status}</small>
                      </span>
                    ) : (
                      'Chưa có dữ liệu'
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <nav className="user-pagination" aria-label="Phân trang người dùng">
              <p>
                Hiển thị {(data.page - 1) * data.size + 1}–
                {Math.min(data.page * data.size, data.total)} / {data.total} người dùng
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
      <p className="user-bottom-note">
        Danh sách chỉ đọc · Hiển thị các vai trò được gán, không suy ra quyền kế thừa. Chưa có chi
        tiết hoặc công cụ chỉnh sửa.
      </p>
    </section>
  );
}
