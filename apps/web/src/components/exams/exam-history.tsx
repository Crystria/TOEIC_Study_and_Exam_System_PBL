'use client';
import Link from 'next/link';
import { useState } from 'react';
import { filterDemoHistory, localResultHref, localSummary } from '@/lib/exams/results';
import { formatDuration } from '@/lib/exams/selection';
import { Button, buttonStyles } from '../ui/button';
import { Field } from '../ui/field';
import { Alert, Badge, EmptyState } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { useExamHistory } from './exam-history-provider';
import { formatLocalDate } from './exam-result';
import { HistoryNotice, ResultHeading, ResultLoading } from './exam-result-shared';
import type { ExamQuery } from '@/lib/exams/types';

const PAGE_SIZE = 8;
export function ExamHistory({ query }: { query: ExamQuery }) {
  const { ready, history, issue } = useExamHistory();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('all');
  const [scope, setScope] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(false);
  const preview = retry ? undefined : query.preview;
  const displayedSessions = preview === 'empty' ? [] : history.sessions;
  const results = filterDemoHistory(displayedSessions, search, mode, scope, status);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const clear = () => {
    setSearch('');
    setMode('all');
    setScope('all');
    setStatus('all');
    setPage(1);
  };
  if (!ready || preview === 'loading')
    return (
      <ResultLoading>
        {preview === 'loading' && <Button onClick={() => setRetry(true)}>Đọc lịch sử demo</Button>}
      </ResultLoading>
    );
  return (
    <div className="exam-page exam-outcome">
      <ResultHeading
        title="Lịch sử phiên demo"
        description="Các phiên đã kết thúc trên trình duyệt này. Chưa kết nối lịch sử tài khoản."
      />
      <Alert>
        Chỉ lưu tối đa 30 phiên demo gần nhất. Không có điểm chấm từ server; dữ liệu này không cập
        nhật dashboard, streak, thống kê hoặc dự đoán điểm.
      </Alert>
      <HistoryNotice />
      <div className="result-example-link">
        <strong>Xem thử kết quả có lời giải</strong>
        <p>
          Ví dụ Reading riêng có đáp án và lựa chọn mẫu. Không phải kết quả của bạn và không nằm
          trong danh sách bên dưới.
        </p>
        <Link href="/history/example" className={buttonStyles('secondary')}>
          Mở ví dụ kết quả
        </Link>
      </div>
      {preview === 'error' ? (
        <Panel className="result-panel" role="alert">
          <h2>Lỗi đọc lịch sử demo (kịch bản QA)</h2>
          <p>Dữ liệu lưu thực tế được giữ nguyên.</p>
          <Button onClick={() => setRetry(true)}>Thử đọc lại lịch sử</Button>
        </Panel>
      ) : issue ? null : (
        <>
          <Panel className="result-panel">
            <div className="result-filters history-filters">
              <Field
                id="history-search"
                label="Tìm phiên demo"
                placeholder="Tên đề, mã cục bộ hoặc Part"
                icon="search"
                value={search}
                maxLength={150}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <label>
                Chế độ
                <select
                  aria-label="Chế độ"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả chế độ</option>
                  <option value="PRACTICE">Luyện tập</option>
                  <option value="MOCK_TEST">Thi thử</option>
                </select>
              </label>
              <label>
                Phạm vi
                <select
                  aria-label="Phạm vi"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả phạm vi</option>
                  <option value="full">Toàn bộ đề</option>
                  <option value="parts">Chọn Part</option>
                </select>
              </label>
              <label>
                Kết thúc
                <select
                  aria-label="Kết thúc"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="ended">Kết thúc thủ công</option>
                  <option value="expired">Hết giờ cục bộ</option>
                </select>
              </label>
            </div>
            <div className="result-filter-summary">
              <p role="status">
                {results.length} phiên phù hợp · {displayedSessions.length} phiên demo đã lưu
              </p>
              <Button variant="ghost" onClick={clear}>
                Xóa bộ lọc
              </Button>
            </div>
          </Panel>
          {!results.length ? (
            <Panel>
              <EmptyState
                title={
                  displayedSessions.length
                    ? 'Không có phiên phù hợp'
                    : 'Chưa có phiên demo đã kết thúc'
                }
                description={
                  displayedSessions.length
                    ? 'Thử tìm kiếm hoặc bộ lọc khác.'
                    : 'Kết thúc một phiên demo để xem thông tin và lựa chọn đã lưu tại đây.'
                }
              >
                {displayedSessions.length ? (
                  <Button onClick={clear}>Xóa bộ lọc</Button>
                ) : (
                  <Link href="/exam" className={buttonStyles('primary')}>
                    Chọn đề để xem thử
                  </Link>
                )}
              </EmptyState>
            </Panel>
          ) : (
            <>
              <ol className="history-list">
                {results
                  .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                  .map((session) => {
                    const { test, answered, unanswered, elapsedSeconds } = localSummary(session);
                    return (
                      <li key={session.localId}>
                        <Panel className="result-panel history-entry">
                          <div>
                            <div className="history-badges">
                              <Badge tone="amber">Demo cục bộ · chưa chấm</Badge>
                              <Badge tone="neutral">
                                {session.status === 'expired' ? 'Hết giờ' : 'Kết thúc thủ công'}
                              </Badge>
                            </div>
                            <h2>
                              <Link href={localResultHref(session)}>{test.title}</Link>
                            </h2>
                            <p>
                              {session.selection.mode === 'PRACTICE' ? 'Luyện tập' : 'Thi thử'} ·{' '}
                              {session.selection.scope === 'full' ? 'Toàn bộ đề' : 'Chọn Part'} ·{' '}
                              {session.selection.partIds.map((id) => `Part ${id}`).join(', ')}
                            </p>
                            <p className="result-muted">
                              {formatLocalDate(session.endedAt!)} (giờ Việt Nam) · Đã dùng{' '}
                              {formatDuration(elapsedSeconds)} /{' '}
                              {formatDuration(session.durationSeconds)}
                              {session.qa === 'short-timer' && ' · QA 15 giây'}
                            </p>
                            <p>
                              {answered}/{session.questionIds.length} câu có lựa chọn · {unanswered}{' '}
                              bỏ trống
                            </p>
                            <p className="result-local-id">{session.localId}</p>
                          </div>
                          <div className="history-entry-actions">
                            <Link
                              href={localResultHref(session)}
                              className={buttonStyles('primary')}
                            >
                              Thông tin phiên
                            </Link>
                            <Link
                              href={localResultHref(session, 'review')}
                              className={buttonStyles('secondary')}
                            >
                              Xem lại lựa chọn
                            </Link>
                          </div>
                        </Panel>
                      </li>
                    );
                  })}
              </ol>
              <nav className="result-pagination" aria-label="Phân trang lịch sử demo cục bộ">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Trang trước
                </Button>
                <span role="status">
                  Trang {currentPage} / {pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Trang sau
                </Button>
              </nav>
            </>
          )}
        </>
      )}
    </div>
  );
}
