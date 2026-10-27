import type { ActivityBucket } from '@/lib/analytics/types';

import { AnalyticsTable } from './analytics-table';

const series = [
  { key: 'vocabulary', label: 'Từ vựng mới (từ)', color: '#2563eb' },
  { key: 'grammar', label: 'Ngữ pháp hoàn thành (bài)', color: '#8b5cf6' },
  { key: 'exams', label: 'Làm bài (phiên)', color: '#0e876b' },
] as const;

export function ActivityTrend({ buckets }: { buckets: ActivityBucket[] }) {
  const max = Math.max(1, ...buckets.flatMap((bucket) => series.map(({ key }) => bucket[key])));
  const y = (value: number) => 180 - (value / max) * 145;
  const step = 590 / buckets.length;
  const width = Math.min(22, step / 4);
  return (
    <>
      <ul className="analytics-legend" aria-label="Chú giải hoạt động">
        {series.map((item) => (
          <li key={item.key}>
            <span style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      <div
        className="analytics-chart-scroll"
        role="region"
        aria-label="Biểu đồ hoạt động, cuộn ngang nếu cần"
        tabIndex={0}
      >
        <svg
          viewBox="0 0 720 235"
          role="img"
          aria-labelledby="analytics-activity-title analytics-activity-description"
        >
          <title id="analytics-activity-title">Nhịp học tập · dữ liệu minh họa</title>
          <desc id="analytics-activity-description">
            Số lượng từ mới, bài ngữ pháp và phiên làm bài theo thời gian. Đơn vị riêng theo chú
            giải; số liệu chi tiết trong bảng ngay sau biểu đồ.
          </desc>
          {[0, 1, 2, 3].map((tick) => {
            const value = Math.ceil((max * tick) / 3);
            return (
              <g key={tick}>
                <line x1="50" x2="690" y1={y(value)} y2={y(value)} className="chart-grid-line" />
                <text x="38" y={y(value) + 5} textAnchor="end" className="chart-axis-label">
                  {value}
                </text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => (
            <g key={bucket.key}>
              {series.map((item, seriesIndex) => (
                <rect
                  key={item.key}
                  x={65 + step * (index + 0.5) + (seriesIndex - 1.5) * width}
                  y={y(bucket[item.key])}
                  width={width - 3}
                  height={180 - y(bucket[item.key])}
                  fill={item.color}
                  rx="3"
                >
                  <title>
                    {bucket.label}: {bucket[item.key]} {item.label}
                  </title>
                </rect>
              ))}
              <text
                x={65 + step * (index + 0.5)}
                y="214"
                textAnchor="middle"
                className="chart-axis-label"
              >
                {bucket.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="analytics-scroll-hint">
        Vuốt ngang biểu đồ để xem đủ dữ liệu hoặc mở bảng bên dưới.
      </p>
      <details className="analytics-details">
        <summary>Xem bảng hoạt động học tập</summary>
        <AnalyticsTable label="Bảng hoạt động học tập">
          <table>
            <caption>Hoạt động minh họa trong bộ lọc hiện tại</caption>
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Từ mới</th>
                <th scope="col">Bài ngữ pháp</th>
                <th scope="col">Phiên làm bài</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket) => (
                <tr key={bucket.key}>
                  <th scope="row">{bucket.label}</th>
                  <td>{bucket.vocabulary}</td>
                  <td>{bucket.grammar}</td>
                  <td>{bucket.exams}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AnalyticsTable>
      </details>
    </>
  );
}
