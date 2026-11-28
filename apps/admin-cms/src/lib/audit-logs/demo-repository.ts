import { AUDIT_LOG_FIXTURES } from './fixtures';
import { selectAuditPage } from './query';
import type { AuditPage, AuditPreview, AuditQuery } from './types';

export interface AuditRepository {
  list(
    query: AuditQuery,
    options: {
      signal: AbortSignal;
      preview: AuditPreview;
      retry: boolean;
    },
  ): Promise<AuditPage>;
}
// RAM/timer only. No API client, auth helpers, storage or audit creation.
export const demoAuditRepository: AuditRepository = {
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
    return selectAuditPage(preview === 'empty' ? [] : AUDIT_LOG_FIXTURES, query);
  },
};
