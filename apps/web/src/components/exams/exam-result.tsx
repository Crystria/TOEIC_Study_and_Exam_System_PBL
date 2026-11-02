'use client';
import Link from 'next/link';
import type { LocalExamSession } from '@/lib/exams/session-types';
import { localResultHref, localSummary } from '@/lib/exams/results';
import { formatDuration, selectionQuery } from '@/lib/exams/selection';
import { buttonStyles } from '../ui/button';
import { Alert, Badge, Progress } from '../ui/feedback';
import { Panel } from '../ui/panel';
import { HistoryNotice, ResultHeading } from './exam-result-shared';
import { useExamHistory } from './exam-history-provider';
import { useExamSession } from './exam-session-provider';

export function ExamResult({ session }: { session: LocalExamSession }) {
  const { test, answered, unanswered, elapsedSeconds, toeicEligible } = localSummary(session);
  const { history } = useExamHistory();
  const { dirty, session: current } = useExamSession();
  const archived = history.sessions.some((item) => item.localId === session.localId);
  return (
    <div className="exam-page exam-outcome">
      <ResultHeading title="Thông tin phiên đã kết thúc" description={test.title} />
      <HistoryNotice />
      <Alert>
        <strong>Chưa có kết quả chấm từ server.</strong>
        <p>
          Phiên này chỉ kết thúc tại trình duyệt. Chưa nộp bài, chưa có Attempt trên server và chưa
          xác định đúng/sai.
        </p>
      </Alert>
      <div className="result-grid">
        <Panel className="result-panel result-overview">
          <Badge tone={session.status === 'expired' ? 'amber' : 'green'}>
            {session.status === 'expired' ? 'Hết giờ cục bộ' : 'Kết thúc thủ công'}
          </Badge>
          <h2>Phạm vi phiên demo</h2>
          <dl className="result-facts">
            <div>
              <dt>Chế độ</dt>
              <dd>
                {session.selection.mode === 'PRACTICE'
                  ? 'Luyện tập · PRACTICE'
                  : 'Thi thử · MOCK_TEST'}
              </dd>
            </div>
            <div>
              <dt>Phạm vi</dt>
              <dd>
                {session.selection.scope === 'full' ? 'Toàn bộ đề' : 'Chọn Part'} ·{' '}
                {session.selection.partIds.map((id) => `Part ${id}`).join(', ')}
              </dd>
            </div>
            <div>
              <dt>Thời lượng đã chốt</dt>
              <dd>
                {formatDuration(session.durationSeconds)}
                {session.qa === 'short-timer' && ' · QA 15 giây'}
              </dd>
            </div>
            <div>
              <dt>Thời gian đã dùng</dt>
              <dd>{formatDuration(elapsedSeconds)}</dd>
            </div>
            <div>
              <dt>Bắt đầu</dt>
              <dd>{formatLocalDate(session.startedAt)}</dd>
            </div>
            <div>
              <dt>Kết thúc</dt>
              <dd>{formatLocalDate(session.endedAt!)}</dd>
            </div>
          </dl>
          <p className="result-local-id">Mã cục bộ: {session.localId}</p>
        </Panel>
        <Panel className="result-panel">
          <span className="eyebrow">LỰA CHỌN ĐÃ GHI NHẬN</span>
          <div className="result-count">
            <strong>{answered}</strong>
            <span>/ {session.questionIds.length} câu có lựa chọn</span>
          </div>
          <Progress value={answered} max={session.questionIds.length} label="Số câu đã trả lời" />
          <dl className="result-facts result-counts">
            <div>
              <dt>Bỏ trống</dt>
              <dd>{unanswered} câu</dd>
            </div>
            <div>
              <dt>Đánh dấu xem lại</dt>
              <dd>{session.flaggedIds.length} câu</dd>
            </div>
            <div>
              <dt>Đúng / sai</dt>
              <dd>Chưa được chấm</dd>
            </div>
            <div>
              <dt>Điểm TOEIC</dt>
              <dd>{toeicEligible ? 'Chưa có điểm từ server' : 'Không áp dụng'}</dd>
            </div>
          </dl>
          <p className="result-muted">
            {toeicEligible
              ? 'Đủ phạm vi chỉ là điều kiện ban đầu. Điểm phải do server chấm và trả về; client không tự quy đổi.'
              : 'PRACTICE, phiên một phần đề hoặc thiếu Listening/Reading không có điểm TOEIC.'}
          </p>
        </Panel>
      </div>
      <Panel className="result-panel">
        <h2>Xem lại lựa chọn</h2>
        <p>
          Đọc lại câu hỏi, lựa chọn và đánh dấu của phiên này. Đáp án đúng, transcript và lời giải
          chưa được cung cấp cho phiên chưa chấm.
        </p>
        <div className="result-actions">
          <Link href={localResultHref(session, 'review')} className={buttonStyles('primary')}>
            Xem lại phiên này
          </Link>
          <Link href="/history" className={buttonStyles('secondary')}>
            Lịch sử demo
          </Link>
          <Link
            href={`/exam/${test.id}/prepare?${selectionQuery(session.selection)}`}
            className={buttonStyles('secondary')}
          >
            Chuẩn bị phiên mới
          </Link>
        </div>
        <p className="result-muted">
          {archived
            ? 'Bản kết thúc đã có trong lịch sử demo của trình duyệt này (tối đa 30 phiên).'
            : 'Chưa xác nhận lưu lịch sử demo. Dữ liệu hiện tại có thể chỉ còn trong tab.'}
          {current?.localId === session.localId && dirty
            ? ' Bản nháp mới nhất cũng chưa lưu được.'
            : ''}{' '}
          Không phải lịch sử tài khoản; không cập nhật dashboard, streak, thống kê hay dự đoán điểm.
        </p>
      </Panel>
      <div className="result-example-link">
        <strong>Muốn xem giao diện có lời giải?</strong>
        <p>
          Ví dụ Reading riêng gồm 10 câu với lựa chọn và lời giải mẫu, không phải kết quả của bạn.
        </p>
        <Link href="/history/example" className={buttonStyles('ghost')}>
          Mở ví dụ kết quả và lời giải
        </Link>
      </div>
    </div>
  );
}
export function formatLocalDate(time: number) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(time);
}
