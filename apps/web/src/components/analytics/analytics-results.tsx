import Link from 'next/link';

import { analyticsDate } from '@/lib/analytics/selectors';
import type { AnalyticsSelection } from '@/lib/analytics/selectors';
import type { AnalyticsSnapshot } from '@/lib/analytics/types';

import { ScoreTrend } from '../dashboard/score-trend';
import { buttonStyles } from '../ui/button';
import { Badge, EmptyState, Progress } from '../ui/feedback';
import { Icon } from '../ui/icon';
import { Panel, SectionHeading } from '../ui/panel';
import { AnalyticsTable } from './analytics-table';

export function AnalyticsScores({
  selected,
  data,
}: {
  selected: AnalyticsSelection;
  data: AnalyticsSnapshot;
}) {
  return (
    <Panel className="analytics-panel analytics-score-panel">
      <SectionHeading
        title="Xu hướng điểm TOEIC"
        description="Chỉ bài thi thử toàn bộ đề đã chấm, đủ Listening & Reading."
        action={<Badge>ĐIỂM MINH HỌA</Badge>}
      />
      {selected.scores.length ? (
        <>
          <div className="chart-legend">
            <span />
            <span>Điểm tổng TOEIC</span>
            <small>10–990 điểm</small>
          </div>
          <div
            className="analytics-chart-scroll"
            role="region"
            aria-label="Biểu đồ điểm TOEIC, cuộn ngang nếu cần"
            tabIndex={0}
          >
            <ScoreTrend attempts={selected.scores} target={data.targetScore} />
          </div>
          <p className="analytics-scroll-hint">
            Vuốt ngang biểu đồ để xem đủ dữ liệu hoặc mở bảng bên dưới.
          </p>
          <details className="analytics-details">
            <summary>Xem bảng điểm TOEIC</summary>
            <AnalyticsTable label="Bảng điểm TOEIC minh họa">
              <table>
                <caption>Điểm minh họa · chỉ các bài đủ điều kiện trong bộ lọc</caption>
                <thead>
                  <tr>
                    <th scope="col">Ngày hoàn thành</th>
                    <th scope="col">Listening</th>
                    <th scope="col">Reading</th>
                    <th scope="col">Tổng điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.scores.map((attempt) => (
                    <tr key={attempt.attemptId}>
                      <th scope="row">{analyticsDate(attempt.completedAt, data.timezone)}</th>
                      <td>{attempt.scoreListening}</td>
                      <td>{attempt.scoreReading}</td>
                      <td>{attempt.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AnalyticsTable>
          </details>
        </>
      ) : (
        <EmptyState
          title="Chưa đủ dữ liệu"
          description="Không có điểm TOEIC hợp lệ trong bộ lọc này. PRACTICE, một phần đề, thiếu kỹ năng hoặc chưa chấm không có điểm TOEIC."
          icon="chart"
        />
      )}
      <p className="analytics-note">
        {selected.scores.length} bài có điểm hợp lệ / {selected.attempts.length} phiên trong bộ lọc.
        Phiên không có điểm vẫn được tính là hoạt động làm bài.
      </p>
    </Panel>
  );
}

export function AnalyticsPrediction({ selected }: { selected: AnalyticsSelection }) {
  return (
    <Panel className="analytics-panel analytics-prediction">
      <span className="analytics-panel-icon">
        <Icon name="sparkles" />
      </span>
      <SectionHeading
        title="Điểm TOEIC dự đoán"
        description="Ví dụ minh họa, chưa liên kết tài khoản."
      />
      <Badge tone="amber">DEMO · KHÔNG ĐÁNH GIÁ NĂNG LỰC</Badge>
      {selected.prediction !== null ? (
        <div className="analytics-predicted-value" data-testid="analytics-prediction">
          {selected.prediction}
          <span> / 990 điểm</span>
        </div>
      ) : (
        <p className="analytics-insufficient" data-testid="analytics-prediction">
          Chưa đủ dữ liệu
        </p>
      )}
      <p>
        Có <strong>{selected.predictionCount}/3 bài hợp lệ</strong> trong 30 ngày gần nhất và thuộc
        bộ lọc hiện tại.
      </p>
      <p className="analytics-note">
        Cửa sổ 30 ngày luôn tính đến mốc dữ liệu mẫu. Chọn 7 ngày chỉ xét các bài còn trong 7 ngày
        đó. Dự đoán chỉ hiển thị khi đủ 3 bài và khớp ví dụ minh họa.
      </p>
      <Link href="/exam" className={buttonStyles('secondary')}>
        Khám phá đề thi
        <Icon name="arrow" width="16" />
      </Link>
    </Panel>
  );
}

export function AnalyticsParts({ selected }: { selected: AnalyticsSelection }) {
  return (
    <div className="analytics-results-grid">
      <Panel className="analytics-panel">
        <SectionHeading
          title="Độ chính xác theo Part"
          description="Đúng / tổng câu trong phạm vi đã chấm · dữ liệu minh họa."
        />
        <p className="analytics-note">
          Bao gồm PRACTICE và phiên một phần đề đã chấm. Tổng câu gồm cả câu bỏ trống; phiên chờ
          chấm không đóng góp đúng/tổng.
        </p>
        <AnalyticsTable label="Độ chính xác theo Part">
          <table>
            <caption>Kết quả theo Part trong bộ lọc hiện tại</caption>
            <thead>
              <tr>
                <th scope="col">Part / kỹ năng</th>
                <th scope="col">Đúng / tổng</th>
                <th scope="col">Tỷ lệ đúng</th>
                <th scope="col">Phiên đã chấm</th>
              </tr>
            </thead>
            <tbody>
              {selected.parts.map((part) => (
                <tr key={part.partId}>
                  <th scope="row">
                    <span className="analytics-part-title">
                      Part {part.partId} · {part.title}
                    </span>
                    <small>{part.partId <= 4 ? 'Listening' : 'Reading'}</small>
                  </th>
                  <td>{part.accuracy === null ? '—' : `${part.correct} / ${part.total}`}</td>
                  <td>
                    {part.accuracy === null ? (
                      <span className="analytics-muted">Chưa đủ dữ liệu</span>
                    ) : (
                      <div className="analytics-accuracy">
                        <strong>{part.accuracy.toLocaleString('vi-VN')}%</strong>
                        <Progress
                          value={part.correct}
                          max={part.total}
                          label={`Tỷ lệ đúng Part ${part.partId}`}
                        />
                      </div>
                    )}
                  </td>
                  <td>{part.samples || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AnalyticsTable>
      </Panel>
      <Panel className="analytics-panel">
        <SectionHeading
          title="Part cần cải thiện"
          description="Tối đa 3 Part có tỷ lệ đúng thấp nhất trong bộ lọc."
        />
        {selected.weakParts.length ? (
          <>
            <div className="weak-area-list">
              {selected.weakParts.map((part) => (
                <div className="weak-area" key={part.partId}>
                  <div className="weak-area-top">
                    <Badge tone="neutral">Part {part.partId}</Badge>
                    <span>{part.accuracy?.toLocaleString('vi-VN')}% đúng</span>
                  </div>
                  <h3>{part.title}</h3>
                  <Progress
                    value={part.correct}
                    max={part.total}
                    label={`Part cần cải thiện ${part.partId}`}
                    tone="orange"
                  />
                  <p className="analytics-note">
                    {part.correct}/{part.total} câu · {part.samples} phiên đã chấm
                  </p>
                </div>
              ))}
            </div>
            <p className="analytics-note">
              So sánh tỷ lệ trong mẫu hiện tại; số câu ít chưa đủ để kết luận năng lực.
            </p>
          </>
        ) : (
          <EmptyState
            title="Chưa đủ dữ liệu"
            description="Cần kết quả đã chấm theo Part để xác định phần nên dành thêm thời gian."
            icon="target"
          />
        )}
        <Link href="/practice" className="focus-footer">
          Luyện tập theo Part
          <Icon name="arrow" width="16" />
        </Link>
      </Panel>
    </div>
  );
}
