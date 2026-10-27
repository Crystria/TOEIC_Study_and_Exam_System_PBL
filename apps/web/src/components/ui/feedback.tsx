import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { Icon, type IconName } from './icon';

export function Badge({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'neutral';
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Alert({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'error' | 'success';
}) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={tone === 'success' ? 'check' : 'info'} />
      <div>{children}</div>
    </div>
  );
}

export function Progress({
  value,
  max,
  label,
  tone = 'blue',
}: {
  value: number;
  max: number;
  label: string;
  tone?: 'blue' | 'green' | 'orange';
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn('progress', `progress--${tone}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={`${value} / ${max}`}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = 'layers',
  children,
}: {
  title: string;
  description: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name={icon} width="26" height="26" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="panel error-state" role="alert">
      <span className="empty-state-icon">
        <Icon name="info" />
      </span>
      <h2>Chưa tải được dữ liệu học tập</h2>
      <p>Vui lòng kiểm tra kết nối và thử lại. Các thao tác học tập của bạn vẫn được giữ nguyên.</p>
      <Button onClick={onRetry}>
        <Icon name="refresh" />
        Thử lại
      </Button>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Đang tải tổng quan học tập">
      <span className="sr-only">Đang tải tổng quan học tập…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="stats-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}
