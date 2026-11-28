import { Card } from '@/components/ui/card';
import type { QuestionDraftPreview as Preview } from '@/lib/questions/form-draft';
import { DIFFICULTY_LABELS } from '@/lib/questions/types';

export function QuestionDraftPreview({ preview }: { preview: Preview }) {
  return (
    <Card className="qf-preview-content">
      <div className="qf-preview-meta">
        <span className="cms-badge">PART 5 · READING</span>
        <span>{DIFFICULTY_LABELS[preview.difficulty]}</span>
      </div>
      <h3>Nội dung câu hỏi</h3>
      <p className="qf-text qf-preview-stem" lang="en">
        {preview.stem}
      </p>
      <ul className="qf-preview-options" aria-label="Bốn phương án xem trước">
        {preview.options.map((option) => (
          <li key={option.optionKey} className={option.isCorrect ? 'qf-correct' : undefined}>
            <strong className="qf-option-key">{option.optionKey}</strong>
            <div>
              <p className="qf-text" lang="en">
                {option.content}
              </p>
              {option.isCorrect && <span className="qf-answer-label">Đáp án đúng minh họa</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="qf-preview-explanation">
        <h3>Đáp án đúng: Phương án {preview.answer}</h3>
        <h3>Lời giải</h3>
        <p className="qf-text">{preview.explanation || 'Chưa nhập lời giải (tùy chọn).'}</p>
      </div>
    </Card>
  );
}
