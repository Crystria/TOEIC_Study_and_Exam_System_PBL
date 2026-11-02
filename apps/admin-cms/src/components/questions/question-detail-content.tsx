import { Card } from '@/components/ui/card';
import { explicitAnswer, type QuestionDetail } from '@/lib/questions/detail-types';
import { DIFFICULTY_LABELS } from '@/lib/questions/types';

export function QuestionDetailContent({ question }: { question: QuestionDetail }) {
  const answer = explicitAnswer(question.options);
  return (
    <article className="qd-content" aria-label="Nội dung câu hỏi minh họa">
      <dl className="qd-metadata">
        <div>
          <dt>Part</dt>
          <dd>Part {question.part} · Reading</dd>
        </div>
        <div>
          <dt>Độ khó</dt>
          <dd>{DIFFICULTY_LABELS[question.difficulty]}</dd>
        </div>
        <div>
          <dt>Nhãn (tag)</dt>
          <dd>{question.tags.length ? question.tags.join(', ') : 'Chưa có dữ liệu'}</dd>
        </div>
      </dl>
      <Card className="qd-card">
        <h2>Nội dung câu hỏi</h2>
        <p className="qd-text qd-stem" lang={question.stem ? 'en' : 'vi'}>
          {question.stem || 'Chưa có dữ liệu nội dung câu hỏi.'}
        </p>
        <h2 id="qd-options-title">Phương án</h2>
        {question.options?.length ? (
          <ul className="qd-options" aria-labelledby="qd-options-title">
            {question.options.map((option) => (
              <li
                key={option.optionKey}
                className={answer === option.optionKey ? 'qd-correct' : undefined}
              >
                <span className="qd-option-key" aria-label={`Phương án ${option.optionKey}`}>
                  {option.optionKey}
                </span>
                <div>
                  <p className="qd-text" lang={option.content ? 'en' : 'vi'}>
                    {option.content || 'Chưa có dữ liệu phương án.'}
                  </p>
                  {answer === option.optionKey && (
                    <strong className="qd-answer-label">Đáp án minh họa</strong>
                  )}
                  {option.isCorrect === null && <small>Chưa có dữ liệu xác định đúng/sai.</small>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Chưa có dữ liệu phương án.</p>
        )}
      </Card>
      <Card className="qd-card qd-explanation">
        <h2>Đáp án minh họa</h2>
        <p className="qd-answer">
          {answer ? `Phương án ${answer}` : 'Chưa có dữ liệu đáp án đúng được xác nhận.'}
        </p>
        <p className="qd-muted">
          Dùng để xem nội dung quản trị. Không phải kết quả chấm bài hoặc điểm của học viên.
        </p>
        <h2>Lời giải</h2>
        <p className="qd-text">{question.explanation || 'Chưa có dữ liệu lời giải.'}</p>
      </Card>
    </article>
  );
}
