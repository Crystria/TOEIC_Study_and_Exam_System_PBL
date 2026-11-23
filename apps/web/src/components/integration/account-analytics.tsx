'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { analyticsApi, learningApi } from '../../lib/integration/repositories';
import { ResourceState, useResource } from './shared';
import { failureMessage } from '../../lib/integration/client';
import { AnalyticsTable } from '../analytics/analytics-table';
import { ScoreTrend } from '../dashboard/score-trend';
import '../../styles/analytics.css';

type Summary = Awaited<ReturnType<typeof analyticsApi.progress>>;
const scopes = ['SHARED', 'PERSONAL'] as const;
const labels = { SHARED: 'Thư viện chung', PERSONAL: 'Của tôi' };
const ranges = { LAST_7_DAYS: '7 ngày', LAST_30_DAYS: '30 ngày', ALL_TIME: 'Toàn bộ' };
const day = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const pct = (n: number, total: number) =>
  total ? Math.round((n / total) * 100) + '%' : 'Chưa có dữ liệu';

function ExamHistory({ revision }: { revision: number }) {
  const [mode, setMode] = useState<'FULL' | 'PART'>('FULL'),
    [page, setPage] = useState(1);
  const state = useResource(
    mode + page,
    (signal) => analyticsApi.history(mode, page, signal),
    revision,
  );
  const history = state.data;
  return (
    <section className="api-card analytics-exam-history">
      <h2>Lịch sử làm bài · toàn bộ</h2>
      <label>
        Loại bài{' '}
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value === 'FULL' ? 'FULL' : 'PART');
            setPage(1);
          }}
        >
          <option value="FULL">Full Test</option>
          <option value="PART">Luyện Part</option>
        </select>
      </label>
      <ResourceState {...state} retry={state.reload} empty={history?.items.length === 0} />
      {history && history.items.length > 0 && (
        <AnalyticsTable label={mode === 'FULL' ? 'Lịch sử Full Test' : 'Lịch sử luyện Part'}>
          <table>
            <thead>
              <tr>
                <th scope="col">Ngày hoàn thành</th>
                <th scope="col">{mode === 'FULL' ? 'Điểm' : 'Số câu đúng'}</th>
                <th scope="col">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => {
                const completedOn = day(item.completedAt);
                return (
                  <tr key={item.attemptId}>
                    <th scope="row">
                      <time dateTime={item.completedAt}>{completedOn}</time>
                    </th>
                    <td>{item.result}</td>
                    <td>
                      <Link
                        href={'/exam/server/result?attempt=' + encodeURIComponent(item.attemptId)}
                        aria-label={`Xem kết quả ngày ${completedOn}, ${item.result}`}
                      >
                        Xem kết quả
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AnalyticsTable>
      )}
      {history && history.total > 10 && (
        <nav aria-label="Phân trang lịch sử">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Trang trước
          </button>{' '}
          {page} / {Math.ceil(history.total / 10)}{' '}
          <button disabled={page * 10 >= history.total} onClick={() => setPage(page + 1)}>
            Trang sau
          </button>
        </nav>
      )}
    </section>
  );
}

function Scores({ summary }: { summary: Summary }) {
  const [extra, setExtra] = useState<Summary['scoreTrend']>([]),
    [cursor, setCursor] = useState<string | null>(summary.nextCursor),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef<AbortController>();
  useEffect(() => () => pending.current?.abort(), []);
  const rows = [...summary.scoreTrend, ...extra];
  async function more() {
    if (!cursor || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const page = await analyticsApi.progress(summary.timeRange, controller.signal, cursor);
      if (controller.signal.aborted) return;
      if (page.nextCursor === cursor) throw Error('Không tải được trang điểm tiếp theo.');
      const ids = new Set(rows.map((r) => r.attemptId));
      setExtra((v) => [...v, ...page.scoreTrend.filter((r) => !ids.has(r.attemptId))]);
      setCursor(page.nextCursor);
    } catch (e) {
      if (!controller.signal.aborted) setError(failureMessage(e));
    } finally {
      pending.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="api-card">
      <h2>Điểm Full Test</h2>
      <p>
        Gần nhất <strong>{summary.latest ?? '—'}</strong> · Cao nhất{' '}
        <strong>{summary.best ?? '—'}</strong>
      </p>
      {rows.length > 0 ? (
        <>
          <ScoreTrend attempts={rows.slice(-10)} target={null} showSkills />
          <p>Biểu đồ hiển thị tối đa 10 kết quả cuối trong số đã tải.</p>
          <AnalyticsTable label="Điểm theo kỹ năng">
            <table>
              <thead>
                <tr>
                  {['Ngày', 'Listening', 'Reading', 'Tổng', 'Bảng điểm tham khảo'].map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.attemptId}>
                    <th>{day(r.completedAt)}</th>
                    <td>{r.scoreListening}</td>
                    <td>{r.scoreReading}</td>
                    <td>{r.totalScore}</td>
                    <td>{String(r.scoring.tableVersion ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AnalyticsTable>
        </>
      ) : (
        <p>Chưa có bài Full Test được chấm trong khoảng này.</p>
      )}
      {cursor && (
        <button disabled={busy} onClick={more}>
          Tải thêm điểm
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        Dự đoán TOEIC trong 30 ngày ·{' '}
        {summary.predictedToeicScore ?? 'Cần ít nhất 3 bài Full Test hợp lệ'}
      </p>
    </section>
  );
}

export function AccountAnalytics() {
  const search = useSearchParams(),
    router = useRouter(),
    raw = search.get('timeRange');
  const range = raw && Object.prototype.hasOwnProperty.call(ranges, raw) ? raw : 'LAST_30_DAYS';
  const [revision, setRevision] = useState(0),
    refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = window.setInterval(visible, 30000);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  const state = useResource(range, (signal) => analyticsApi.progress(range, signal), revision);
  const learning = useResource('due', (signal) => learningApi.progress(signal), revision);
  const data = state.data,
    due = learning.data?.libraries;
  const peakActivity = Math.max(1, ...(data?.dailyActivity.map((v) => v.count) ?? []));
  const weak = data?.weakAreas
    .filter((p) => p.isWeak)
    .sort((a, b) => a.correct / a.total - b.correct / b.total || a.part - b.part)[0];
  return (
    <div className="analytics-page">
      <header className="page-heading">
        <div>
          <h1>Thống kê học tập</h1>
          <p>Theo dõi tiến độ học và kết quả thi của bạn.</p>
        </div>
      </header>
      <section
        className="analytics-filters analytics-filters--account"
        aria-label="Bộ lọc thống kê"
      >
        <div>
          <label htmlFor="account-analytics-range">Khoảng thời gian</label>
          <select
            id="account-analytics-range"
            value={range}
            onChange={(e) => router.push('/analytics?timeRange=' + e.target.value)}
          >
            {Object.entries(ranges).map(([key, v]) => (
              <option key={key} value={key}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={refresh}>
          Làm mới
        </button>
      </section>
      <ResourceState {...state} retry={state.reload} />
      {data && (
        <>
          <div className="api-card account-metrics">
            <dl aria-label="Chỉ số học tập">
              {[
                ['Từ mới đã học', data.activities.vocabulariesLearned],
                ['Lượt ôn', data.activities.reviewCount],
                ['Bài ngữ pháp hoàn thành', data.activities.grammarLessonsCompleted],
                ['Full Test', data.activities.mockTestCount],
                ['Lượt luyện Part', data.activities.practiceCount],
                ['Ngày học', data.activities.studyDays],
              ].map(([name, n]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>
          </div>
          <section className="api-card">
            <h2>Nhịp học</h2>
            <p>
              Chuỗi hiện tại <strong>{data.current} ngày</strong> · Dài nhất {data.longest} ngày ·
              Toàn bộ {data.lifetime.totalStudyDays} ngày học
            </p>
            {data.activities.studyDays === 0 && <p>Chưa ghi nhận hoạt động trong khoảng này.</p>}
            <div className="account-activity" aria-label="Số hoạt động theo ngày">
              {data.dailyActivity.map((d) => (
                <span
                  key={d.date}
                  title={day(d.date) + ' · ' + d.count + ' hoạt động'}
                  style={{ height: Math.max(3, (80 * d.count) / peakActivity) }}
                />
              ))}
            </div>
            {data.dailyActivityTruncated && <p>Biểu đồ hiển thị 366 ngày gần nhất.</p>}
            <details>
              <summary>Bảng hoạt động theo ngày</summary>
              <AnalyticsTable label="Hoạt động theo ngày">
                <table>
                  <thead>
                    <tr>
                      {['Ngày', 'Lượt ôn', 'Ngữ pháp', 'Full', 'Part'].map((v) => (
                        <th key={v}>{v}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.dailyActivity.map((d) => (
                      <tr key={d.date}>
                        <th>{day(d.date)}</th>
                        <td>{d.reviews}</td>
                        <td>{d.lessons}</td>
                        <td>{d.full}</td>
                        <td>{d.part}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AnalyticsTable>
            </details>
          </section>
          <section className="api-card">
            <h2>Từ vựng và flashcard</h2>
            <AnalyticsTable label="Tiến độ theo thư viện">
              <table>
                <thead>
                  <tr>
                    {[
                      'Thư viện',
                      'Từ mới',
                      'Lượt ôn',
                      'Phiên quiz',
                      'Câu đúng',
                      'Tỷ lệ đúng',
                      'Đến lịch ôn hiện tại',
                    ].map((v) => (
                      <th key={v}>{v}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...scopes, 'ALL' as const].map((scope) => {
                    const a = data.libraries.SHARED,
                      b = data.libraries.PERSONAL;
                    const v =
                      scope === 'ALL'
                        ? {
                            reviews: a.reviews + b.reviews,
                            learned: a.learned + b.learned,
                            sessions: a.sessions + b.sessions,
                            correct: a.correct + b.correct,
                            total: a.total + b.total,
                          }
                        : data.libraries[scope];
                    return (
                      <tr key={scope}>
                        <th>{scope === 'ALL' ? 'Tổng' : labels[scope]}</th>
                        <td>{v.learned}</td>
                        <td>{v.reviews}</td>
                        <td>{v.sessions}</td>
                        <td>
                          {v.correct}/{v.total}
                        </td>
                        <td>{pct(v.correct, v.total)}</td>
                        <td>
                          {due
                            ? scope === 'ALL'
                              ? due.SHARED.due + due.PERSONAL.due
                              : due[scope].due
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AnalyticsTable>
            <ResourceState {...learning} retry={learning.reload} />
            {(!data.from || data.from < data.historyLiveFrom) && (
              <p>Lịch sử cá nhân và quiz trước {day(data.historyLiveFrom)} có thể chưa đầy đủ.</p>
            )}
          </section>
          <Scores key={range + ':' + (data.updatedAt ?? '')} summary={data} />
          <section className="api-card">
            <h2>Độ chính xác theo Part · 30 ngày</h2>
            <AnalyticsTable label="Kết quả theo Part">
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Câu đúng</th>
                    <th>Tỷ lệ đúng</th>
                    <th>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weakAreas.map((p) => (
                    <tr key={p.part}>
                      <th>Part {p.part}</th>
                      <td>
                        {p.correct}/{p.total}
                      </td>
                      <td>{pct(p.correct, p.total)}</td>
                      <td>
                        {p.total < 20
                          ? 'Chưa đủ 20 câu'
                          : p.isWeak
                            ? 'Cần luyện thêm'
                            : 'Đạt ngưỡng'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AnalyticsTable>
          </section>
          <section className="api-card">
            <h2>Học gì tiếp theo?</h2>
            <ul>
              {due && due.SHARED.due + due.PERSONAL.due > 0 && (
                <li>
                  <Link
                    href={
                      due.SHARED.due
                        ? '/study/vocabulary?review=today'
                        : '/study/vocabulary?library=personal'
                    }
                  >
                    Ôn {due.SHARED.due || due.PERSONAL.due} từ đến lịch ·{' '}
                    {due.SHARED.due ? labels.SHARED : labels.PERSONAL}
                  </Link>
                </li>
              )}
              {weak && (
                <li>
                  <Link href="/practice">
                    Luyện Part {weak.part} · đúng {weak.correct}/{weak.total} câu
                  </Link>
                </li>
              )}
              {data.predictedToeicScore === null ? (
                <li>
                  <Link href="/exam">Làm Full Test để theo dõi điểm dự đoán</Link>
                </li>
              ) : (
                <li>
                  <Link href="/study/grammar">Tiếp tục học ngữ pháp</Link>
                </li>
              )}
            </ul>
          </section>
          <small>
            Cập nhật hoạt động gần nhất ·{' '}
            {data.updatedAt
              ? new Date(data.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
              : 'Chưa có hoạt động'}
          </small>
        </>
      )}
      <ExamHistory revision={revision} />
    </div>
  );
}
