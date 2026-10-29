import { TEST_FIXTURES } from './fixtures';
import { TEST_DETAIL_FIXTURES } from './detail-fixtures';
import type { TestDetail, TestDetailPreview, TestDetailResult } from './detail-types';

export interface TestDetailRepository {
  read(
    id: string,
    options: { signal: AbortSignal; preview: TestDetailPreview; retry: boolean },
  ): Promise<TestDetailResult>;
}

// Local timers and immutable preview projections only. No API/auth/persistence.
export const demoTestDetailRepository: TestDetailRepository = {
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
    if (!TEST_FIXTURES.some((test) => test.id === id)) return { kind: 'not-found' };
    const fixture = TEST_DETAIL_FIXTURES.find((test) => test.id === id);
    if (!fixture) return { kind: 'unsupported' };
    if (preview === 'error' && !retry) throw new Error('Lỗi đọc metadata demo được mô phỏng.');
    if (preview === 'empty') return { kind: 'unsupported' };
    let test: TestDetail = { ...fixture };
    if (preview === 'missing')
      test = {
        ...test,
        title: null,
        type: null,
        durationSeconds: null,
        questionCount: null,
        status: null,
      };
    if (preview === 'long')
      test = {
        ...test,
        title: `${fixture.title}\n${'Tên dài chỉ để xem thử UI. <strong>Văn bản an toàn</strong> '.repeat(8)}${'LongDemoTitle'.repeat(25)}`,
      };
    return { kind: 'found', test };
  },
};
