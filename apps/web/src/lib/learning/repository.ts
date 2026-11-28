import { createLearningCatalog } from './mock-data';
import type { LearningCatalog, LearningScenario } from './types';

export function learningScenario(value: string | null): LearningScenario {
  return value === 'empty' || value === 'error' || value === 'save-error' || value === 'audio-error'
    ? value
    : 'ready';
}

export interface LearningRepository {
  loadCatalog(scenario: LearningScenario, signal: AbortSignal): Promise<LearningCatalog>;
}

// Explicit demo adapter. Replace with an adapter using the existing apiClient at integration.
// No API failure is silently replaced with sample content.
export const learningRepository: LearningRepository = {
  async loadCatalog(scenario, signal) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, 250);
      signal.addEventListener('abort', abort, { once: true });
    });
    if (scenario === 'error') throw new Error('Demo catalog error');
    return createLearningCatalog(scenario === 'empty');
  },
};
