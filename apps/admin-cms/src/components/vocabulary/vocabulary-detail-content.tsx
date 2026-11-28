import { Card } from '@/components/ui/card';
import type { VocabularyDetail } from '@/lib/vocabulary/detail-types';

export function VocabularyDetailContent({ vocabulary }: { vocabulary: VocabularyDetail }) {
  const { topic } = vocabulary;
  return (
    <div className="vd-content">
      <Card className="vd-card">
        <h2>Thông tin từ vựng</h2>
        <dl className="vd-fields">
          <div>
            <dt>Nghĩa</dt>
            <dd data-vd-field="meaning">{vocabulary.meaning || 'Chưa có dữ liệu nghĩa.'}</dd>
          </div>
          <div>
            <dt>Phiên âm dạng văn bản</dt>
            <dd data-vd-field="pronunciation" className="vd-pronunciation">
              {vocabulary.pronunciation || 'Chưa có dữ liệu phiên âm.'}
            </dd>
          </div>
          <div>
            <dt>Chủ đề minh họa</dt>
            <dd data-vd-field="topic">
              {topic.kind === 'found' && (topic.name || 'Chưa có dữ liệu tên chủ đề.')}
              {topic.kind === 'missing' && 'Chưa có dữ liệu mã chủ đề (topicId).'}
              {topic.kind === 'unresolved' && (
                <>
                  Không tìm thấy chủ đề khớp mã trong bộ demo: <span>{topic.id}</span>.
                </>
              )}
            </dd>
          </div>
        </dl>
      </Card>
      <Card className="vd-card vd-example-card">
        <span className="cms-eyebrow">NGỮ CẢNH CÔNG VIỆC</span>
        <h2>Ví dụ minh họa</h2>
        <p className="vd-example-note">Câu tiếng Anh tự soạn để xem thử nội dung CMS.</p>
        {vocabulary.example ? (
          <blockquote className="vd-example" lang="en">
            {vocabulary.example}
          </blockquote>
        ) : (
          <p className="vd-missing">Chưa có dữ liệu câu ví dụ.</p>
        )}
      </Card>
    </div>
  );
}
