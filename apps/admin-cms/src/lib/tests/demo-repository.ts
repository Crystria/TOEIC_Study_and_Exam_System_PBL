import { TEST_FIXTURES } from './fixtures';
import { selectTestPage } from './query';
import type { TestPage, TestPreview, TestQuery } from './types';

export interface TestRepository {
  list(
    query: TestQuery,
    options: { signal: AbortSignal; preview: TestPreview; retry: boolean },
  ): Promise<TestPage>;
}
// Demo adapter only: no auth, fetch, API client, storage or student data.
export const demoTestRepository: TestRepository = {
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
    return selectTestPage(preview === 'empty' ? [] : TEST_FIXTURES, query);
  },
};
