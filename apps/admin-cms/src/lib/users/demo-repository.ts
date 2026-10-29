import { USER_FIXTURES } from './fixtures';
import { selectUserPage } from './query';
import type { UserPage, UserPreview, UserQuery } from './types';

export interface UserRepository {
  list(
    query: UserQuery,
    options: { signal: AbortSignal; preview: UserPreview; retry: boolean },
  ): Promise<UserPage>;
}
// Demo adapter only: no auth, fetch, API client, storage or student data.
export const demoUserRepository: UserRepository = {
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
    return selectUserPage(preview === 'empty' ? [] : USER_FIXTURES, query);
  },
};
