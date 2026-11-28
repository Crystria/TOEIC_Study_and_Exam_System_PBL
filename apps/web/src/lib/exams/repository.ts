import { demoExamTests } from './mock-data';
import type { ExamPreview, ExamTest } from './types';

export function examPreview(value: unknown): ExamPreview {
  return typeof value === 'string' && ['empty', 'error', 'loading', 'unavailable'].includes(value)
    ? (value as ExamPreview)
    : 'default';
}

// An explicit demo adapter. Never calls the API or silently falls back from it.
export async function loadDemoTests(
  preview: ExamPreview,
  signal: AbortSignal,
): Promise<ExamTest[]> {
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, 350);
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  if (preview === 'error') throw new Error('Không tải được danh sách đề demo.');
  if (preview === 'empty') return [];
  return demoExamTests.map((test) => ({
    ...test,
    parts: test.parts.map((part) => ({
      ...part,
      active: preview === 'unavailable' && part.id === 3 ? false : part.active,
    })),
  }));
}
