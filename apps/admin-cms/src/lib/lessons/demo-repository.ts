import { LESSON_FIXTURES } from './fixtures';
import { selectLessonPage } from './query';
import type { LessonPage, LessonPreview, LessonQuery } from './types';

export interface LessonRepository {
  list(
    query: LessonQuery,
    options: { signal: AbortSignal; preview: LessonPreview; retry: boolean },
  ): Promise<LessonPage>;
}
// Demo adapter only: no auth, fetch, API client, storage or student data.
export const demoLessonRepository: LessonRepository = {
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
    if (preview === 'error' && !retry) throw new Error('Lỗi đọc fixture được mô phỏng.');
    return selectLessonPage(preview === 'empty' ? [] : LESSON_FIXTURES, query);
  },
};
