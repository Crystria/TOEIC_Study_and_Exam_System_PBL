import { QUESTION_FIXTURES } from './fixtures';
import { selectQuestionPage } from './query';
import type { QuestionPage, QuestionPreview, QuestionQuery } from './types';

export interface QuestionRepository {
  list(
    query: QuestionQuery,
    options: { signal: AbortSignal; preview: QuestionPreview; retry: boolean },
  ): Promise<QuestionPage>;
}

// Separate demo adapter. No API client, credentials, token, storage or media requests.
export const demoQuestionRepository: QuestionRepository = {
  async list(query, { signal, preview, retry }) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
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
    if (preview === 'error' && !retry) throw new Error('Lỗi tải fixture được mô phỏng.');
    return selectQuestionPage(preview === 'empty' ? [] : QUESTION_FIXTURES, query);
  },
};
