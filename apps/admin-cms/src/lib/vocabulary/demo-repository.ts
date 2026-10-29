import { VOCABULARY_FIXTURES } from './fixtures';
import { selectVocabularyPage } from './query';
import type { VocabularyPage, VocabularyPreview, VocabularyQuery } from './types';

export interface VocabularyRepository {
  list(
    query: VocabularyQuery,
    options: { signal: AbortSignal; preview: VocabularyPreview; retry: boolean },
  ): Promise<VocabularyPage>;
}
// Demo adapter only: no auth, fetch, API client, storage or student data.
export const demoVocabularyRepository: VocabularyRepository = {
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
    return selectVocabularyPage(preview === 'empty' ? [] : VOCABULARY_FIXTURES, query);
  },
};
