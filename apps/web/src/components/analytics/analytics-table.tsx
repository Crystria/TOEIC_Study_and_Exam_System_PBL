import type { ReactNode } from 'react';

export function AnalyticsTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <p className="analytics-scroll-hint">
        Vuốt ngang bảng hoặc dùng phím mũi tên khi bảng nhận focus để xem các cột còn lại.
      </p>
      <div className="analytics-table-scroll" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </>
  );
}
