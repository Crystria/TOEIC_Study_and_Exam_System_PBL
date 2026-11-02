import type { ScoreAttempt } from '@/lib/dashboard/types';

export function ScoreTrend({
  attempts,
  target,
}: {
  attempts: ScoreAttempt[];
  target: number | null;
}) {
  const scores = attempts.map((attempt) => attempt.totalScore ?? 0);
  const min = Math.max(0, Math.floor((Math.min(...scores, target ?? 990) - 100) / 100) * 100);
  const max = Math.min(990, Math.ceil((Math.max(...scores, target ?? 0) + 50) / 100) * 100);
  const y = (value: number) => 180 - ((value - min) / (max - min || 1)) * 150;
  const x = (index: number) =>
    attempts.length === 1 ? 360 : 65 + (index / (attempts.length - 1)) * 590;
  const points = attempts
    .map((attempt, index) => `${x(index)},${y(attempt.totalScore ?? 0)}`)
    .join(' ');
  const date = (value: string) =>
    new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

  return (
    <div className="score-chart">
      <svg
        viewBox="0 0 720 230"
        role="img"
        aria-labelledby="score-chart-title score-chart-description"
      >
        <title id="score-chart-title">Xu hướng điểm thi thử TOEIC</title>
        <desc id="score-chart-description">
          {attempts
            .map((attempt) => `${date(attempt.completedAt)}: ${attempt.totalScore} điểm`)
            .join('; ')}
          . Chỉ gồm bài thi thử toàn bộ đề có điểm cả hai kỹ năng.
        </desc>
        {[0, 1, 2, 3].map((tick) => {
          const value = Math.round(min + ((max - min) * tick) / 3);
          return (
            <g key={tick}>
              <line x1="52" x2="684" y1={y(value)} y2={y(value)} className="chart-grid-line" />
              <text x="36" y={y(value) + 4} textAnchor="end" className="chart-axis-label">
                {value}
              </text>
            </g>
          );
        })}
        {target !== null && (
          <g>
            <line x1="52" x2="684" y1={y(target)} y2={y(target)} className="chart-target-line" />
            <text x="680" y={y(target) - 9} textAnchor="end" className="chart-target-label">
              Mục tiêu {target}
            </text>
          </g>
        )}
        <polygon
          points={`${x(0)},180 ${points} ${x(attempts.length - 1)},180`}
          fill="url(#score-area)"
        />
        <defs>
          <linearGradient id="score-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity=".14" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {attempts.map((attempt, index) => (
          <g key={attempt.attemptId}>
            <circle
              cx={x(index)}
              cy={y(attempt.totalScore ?? 0)}
              r="5"
              fill="#fff"
              stroke="#2563eb"
              strokeWidth="3"
            />
            <text
              x={x(index)}
              y={y(attempt.totalScore ?? 0) - 14}
              textAnchor="middle"
              className="chart-score-label"
            >
              {attempt.totalScore}
            </text>
            <text x={x(index)} y="211" textAnchor="middle" className="chart-axis-label">
              {date(attempt.completedAt)}
            </text>
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Điểm thi thử toàn bộ đề theo thời gian</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Listening</th>
            <th>Reading</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.attemptId}>
              <td>{date(attempt.completedAt)}</td>
              <td>{attempt.scoreListening}</td>
              <td>{attempt.scoreReading}</td>
              <td>{attempt.totalScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
