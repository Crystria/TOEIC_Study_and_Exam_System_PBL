import { QUESTION_FIXTURES } from './fixtures';
import { QUESTION_DETAIL_FIXTURES } from './detail-fixtures';
import type { DetailPreview, DetailResult, QuestionDetail } from './detail-types';

export interface QuestionDetailRepository {
  read(
    id: string,
    options: { signal: AbortSignal; preview: DetailPreview; retry: boolean },
  ): Promise<DetailResult>;
}

// RAM/timer only. Preview transformations never modify the catalog or fixture.
export const demoQuestionDetailRepository: QuestionDetailRepository = {
  async read(id, { signal, preview, retry }) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(
        () => {
          signal.removeEventListener('abort', abort);
          resolve();
        },
        preview === 'slow' ? 1400 : 280,
      );
      signal.addEventListener('abort', abort, { once: true });
    });
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!QUESTION_FIXTURES.some((question) => question.id === id)) return { kind: 'not-found' };
    const fixture = QUESTION_DETAIL_FIXTURES.find((question) => question.id === id);
    if (!fixture) return { kind: 'unsupported' };
    if (preview === 'error' && !retry) throw new Error('Lỗi đọc chi tiết demo được mô phỏng.');
    if (preview === 'empty') return { kind: 'unsupported' };
    let question: QuestionDetail = fixture;
    if (preview === 'missing')
      question = {
        ...fixture,
        stem: null,
        explanation: null,
        options: fixture.options!.map((option) => ({
          ...option,
          content: option.optionKey === 'C' ? null : option.content,
          isCorrect: null,
        })),
      };
    if (preview === 'long') {
      const text = 'Nội dung dài chỉ để xem thử UI. <strong>Văn bản an toàn</strong> ';
      question = {
        ...fixture,
        stem: `${fixture.stem}\n${text.repeat(10)}${'LongDemoText'.repeat(30)}`,
        options: fixture.options!.map((option) => ({
          ...option,
          content: `${option.content}\n${text.repeat(3)}${'LongOption'.repeat(20)}`,
        })),
        explanation: `${fixture.explanation}\n${text.repeat(12)}${'LongExplanation'.repeat(25)}`,
      };
    }
    return { kind: 'found', question };
  },
};
