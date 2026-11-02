'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { analyticsRepository } from '@/lib/analytics/repository';
import {
  analyticsDate,
  analyticsModes,
  analyticsRanges,
  analyticsScopes,
  defaultAnalyticsFilters,
  parseAnalyticsFilters,
  selectAnalytics,
} from '@/lib/analytics/selectors';
import type { AnalyticsFilters, AnalyticsPreview, AnalyticsSnapshot } from '@/lib/analytics/types';

import { Button, buttonStyles } from '../ui/button';
import { Badge, EmptyState, ErrorState } from '../ui/feedback';
import { Icon, type IconName } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { ActivityTrend } from './activity-trend';
import { AnalyticsParts, AnalyticsPrediction, AnalyticsScores } from './analytics-results';

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: AnalyticsSnapshot };

export function AnalyticsView({
  scenario,
  initialFilters,
}: {
  scenario: AnalyticsPreview;
  initialFilters: AnalyticsFilters;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [filters, setFilters] = useState(initialFilters);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const rangeInput = useRef<HTMLSelectElement>(null);
  const retryFocus = useRef(false);

  useEffect(() => {
    const readLocation = () => {
      const query = new URLSearchParams(window.location.search);
      setFilters(
        parseAnalyticsFilters(
          Object.fromEntries(
            ['range', 'mode', 'scope'].map((key) => [
              key,
              query.getAll(key).length > 1 ? query.getAll(key) : (query.get(key) ?? undefined),
            ]),
          ),
        ),
      );
    };
    readLocation();
    window.addEventListener('popstate', readLocation);
    return () => window.removeEventListener('popstate', readLocation);
  }, [initialFilters]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    analyticsRepository
      .load(scenario === 'error' && retry > 0 ? 'ready' : scenario, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [scenario, retry]);

  useEffect(() => {
    if (state.status !== 'loading' && retryFocus.current) {
      retryFocus.current = false;
      if (document.activeElement === document.body) heading.current?.focus();
    }
  }, [state.status]);

  const updateFilters = (next: AnalyticsFilters) => {
    setFilters(next);
    const url = new URL(window.location.href);
    (Object.keys(defaultAnalyticsFilters) as Array<keyof AnalyticsFilters>).forEach((key) => {
      if (next[key] === defaultAnalyticsFilters[key]) url.searchParams.delete(key);
      else url.searchParams.set(key, next[key]);
    });
    window.history.replaceState(window.history.state, '', url);
  };

  const reset = () => {
    updateFilters(defaultAnalyticsFilters);
    rangeInput.current?.focus();
  };
  const selected = state.status === 'ready' ? selectAnalytics(state.data, filters) : null;
  const stat = (value: number | null, unit: string) =>
    value === null ? (
      <span className="analytics-stat-empty">Chưa đủ dữ liệu</span>
    ) : (
      <>
        {value.toLocaleString('vi-VN')}
        <span>{unit}</span>
      </>
    );
  const cards: Array<{
    label: string;
    value: number | null;
    unit: string;
    icon: IconName;
    color: string;
    detail: string;
  }> = selected
    ? [
        {
          label: 'Từ vựng mới đã học',
          value: selected.vocabulary,
          unit: 'từ',
          icon: 'layers',
          color: 'blue',
          detail: 'Theo khoảng thời gian đã chọn',
        },
        {
          label: 'Ngữ pháp hoàn thành',
          value: selected.grammar,
          unit: 'bài',
          icon: 'book',
          color: 'purple',
          detail: 'Theo khoảng thời gian đã chọn',
        },
        {
          label: 'Phiên làm bài đã kết thúc',
          value: selected.attempts.length || null,
          unit: 'phiên',
          icon: 'clipboard',
          color: 'green',
          detail: 'Gồm phiên đã chấm và chờ chấm',
        },
        {
          label: 'Ngày có hoạt động học',
          value: selected.studyDays,
          unit: 'ngày',
          icon: 'calendar',
          color: 'orange',
          detail: 'Từ vựng, ngữ pháp hoặc phiên phù hợp',
        },
      ]
    : [];

  return (
    <div className="analytics-page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">NHÌN LẠI ĐỂ TIẾN XA HƠN</div>
          <h1 ref={heading} tabIndex={-1}>
            Thống kê học tập
          </h1>
          <p>Theo dõi nhịp học, hiểu tiến bộ và tìm Part cần luyện thêm.</p>
        </div>
        <Link href="/exam" className={buttonStyles('primary')}>
          <Icon name="clipboard" width="17" />
          Khám phá đề thi
          <Icon name="arrow" width="16" />
        </Link>
      </header>
      <div className="demo-notice">
        <Icon name="info" width="18" />
        <span>
          <strong>Dữ liệu minh họa · Chưa liên kết tài khoản.</strong> Các con số và dự đoán là ví
          dụ có sẵn; phiên demo cục bộ không cập nhật thống kê này.
        </span>
      </div>
      <Panel className="analytics-filters" aria-label="Bộ lọc thống kê">
        <div>
          <label htmlFor="analytics-range">Khoảng thời gian</label>
          <select
            id="analytics-range"
            ref={rangeInput}
            aria-describedby="analytics-filter-help"
            value={filters.range}
            onChange={(event) =>
              updateFilters({ ...filters, range: event.target.value as AnalyticsFilters['range'] })
            }
          >
            {Object.entries(analyticsRanges).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="analytics-mode">Chế độ phiên làm bài</label>
          <select
            id="analytics-mode"
            aria-describedby="analytics-filter-help"
            value={filters.mode}
            onChange={(event) =>
              updateFilters({ ...filters, mode: event.target.value as AnalyticsFilters['mode'] })
            }
          >
            {Object.entries(analyticsModes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="analytics-scope">Phạm vi phiên làm bài</label>
          <select
            id="analytics-scope"
            aria-describedby="analytics-filter-help"
            value={filters.scope}
            onChange={(event) =>
              updateFilters({ ...filters, scope: event.target.value as AnalyticsFilters['scope'] })
            }
          >
            {Object.entries(analyticsScopes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="ghost" onClick={reset}>
          Đặt lại bộ lọc
        </Button>
        <p id="analytics-filter-help">
          Khoảng thời gian áp dụng cho toàn trang. Chế độ và phạm vi chỉ lọc phiên làm bài; từ vựng
          và ngữ pháp vẫn giữ nguyên.
        </p>
      </Panel>
      {state.status === 'loading' && (
        <div role="status" aria-label="Đang tải thống kê học tập">
          <span className="sr-only">Đang tải thống kê học tập…</span>
          <div className="stats-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="skeleton skeleton-stat" />
            ))}
          </div>
          <div className="skeleton skeleton-chart" />
        </div>
      )}
      {state.status === 'error' && (
        <ErrorState
          onRetry={() => {
            retryFocus.current = true;
            setRetry((value) => value + 1);
          }}
        />
      )}
      {state.status === 'ready' && selected && (
        <>
          <div className="analytics-context" role="status" aria-live="polite" aria-atomic="true">
            <span>
              {analyticsRanges[filters.range]} · {selected.attempts.length} phiên ·{' '}
              {selected.scores.length} bài có điểm TOEIC hợp lệ
            </span>
            <span>
              Mốc mẫu: {analyticsDate(state.data.snapshotAt, state.data.timezone)}{' '}
              {new Date(state.data.snapshotAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: state.data.timezone,
              })}{' '}
              · Giờ Việt Nam (UTC+7)
            </span>
          </div>
          <div className="stats-grid">
            {cards.map((card) => (
              <Panel className="stat-card" key={card.label}>
                <div className="stat-top">
                  <span>{card.label}</span>
                  <span className={`stat-icon stat-icon--${card.color}`}>
                    <Icon name={card.icon} />
                  </span>
                </div>
                <div className="stat-value">{stat(card.value, card.unit)}</div>
                <p>{card.detail}</p>
              </Panel>
            ))}
          </div>
          {selected.buckets.length === 0 && (
            <Panel>
              <EmptyState
                title="Chưa có hoạt động trong bộ lọc"
                description="Chưa đủ dữ liệu để tổng hợp. Thử khoảng thời gian khác hoặc đặt lại bộ lọc."
                icon="calendar"
              >
                <Button variant="secondary" onClick={reset}>
                  Đặt lại bộ lọc
                </Button>
              </EmptyState>
            </Panel>
          )}
          <Panel className="analytics-panel">
            <SectionHeading
              title="Nhịp học tập"
              description="Hoạt động học và làm bài theo thời gian, tách riêng từng loại."
              action={<Badge>MINH HỌA</Badge>}
            />
            {selected.buckets.length ? (
              <ActivityTrend buckets={selected.buckets} />
            ) : (
              <EmptyState
                title="Chưa đủ dữ liệu"
                description="Biểu đồ sẽ xuất hiện khi có hoạt động phù hợp."
                icon="chart"
              />
            )}
            <p className="analytics-note">
              {filters.range === 'LAST_7_DAYS'
                ? 'Gộp theo ngày.'
                : filters.range === 'LAST_30_DAYS'
                  ? 'Gộp theo tuần bắt đầu thứ Hai.'
                  : 'Gộp theo tháng.'}{' '}
              Chỉ hiển thị kỳ có hoạt động; kỳ đầu/cuối chỉ tính phần nằm trong khoảng lọc. Từ mới
              và bài hoàn thành không phải điểm thi.
            </p>
          </Panel>
          <div className="analytics-score-summary">
            <span>ĐIỂM THI · TÁCH BIỆT VỚI HOẠT ĐỘNG HỌC</span>
            <span>
              Điểm gần nhất:{' '}
              <strong>
                {selected.latestScore === null
                  ? 'Chưa đủ dữ liệu'
                  : `${selected.latestScore} / 990`}
              </strong>
            </span>
          </div>
          <div className="analytics-results-grid">
            <AnalyticsScores selected={selected} data={state.data} />
            <AnalyticsPrediction selected={selected} />
          </div>
          <AnalyticsParts selected={selected} />
          <p className="analytics-footnote">
            <Icon name="info" width="16" />
            Số liệu đúng/tổng và điểm ở đây đều từ bộ dữ liệu minh họa độc lập, không phải kết quả
            tài khoản hoặc lịch sử phiên demo trên thiết bị.
          </p>
        </>
      )}
    </div>
  );
}
