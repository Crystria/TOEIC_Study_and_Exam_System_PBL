import { Card } from '@/components/ui/card';
import type { TestDetail } from '@/lib/tests/detail-types';
import { TEST_STATUS_LABELS, TEST_TYPE_LABELS, formatTestDuration } from '@/lib/tests/types';

export function TestDetailContent({ test }: { test: TestDetail }) {
  return (
    <Card className="td-card td-content">
      <h2>Metadata đề minh họa</h2>
      <dl className="td-metadata">
        <div className="td-name">
          <dt>Tên đề</dt>
          <dd className="td-text">{test.title || 'Chưa có dữ liệu'}</dd>
        </div>
        <div>
          <dt>Loại đề</dt>
          <dd>{test.type ? TEST_TYPE_LABELS[test.type] : 'Chưa có dữ liệu'}</dd>
        </div>
        <div>
          <dt>Thời lượng</dt>
          <dd>{formatTestDuration(test.durationSeconds)}</dd>
        </div>
        <div>
          <dt>Số câu minh họa</dt>
          <dd>{test.questionCount === null ? 'Chưa có dữ liệu' : `${test.questionCount} câu`}</dd>
        </div>
        <div>
          <dt>Trạng thái minh họa</dt>
          <dd>
            {test.status
              ? `${TEST_STATUS_LABELS[test.status]} (${test.status})`
              : 'Chưa có dữ liệu'}
          </dd>
        </div>
      </dl>
      <p className="td-muted">
        Số câu minh họa không xác nhận đề đã được lắp đủ câu hỏi. Số câu Mini Test chưa có dữ liệu;
        thời lượng và số câu không được suy từ loại đề.
      </p>
      <p className="td-muted">
        DRAFT / PUBLISHED / ARCHIVED là từ vựng trong source dùng để minh họa trạng thái, chưa xác
        nhận quy trình xuất bản.
      </p>
    </Card>
  );
}
