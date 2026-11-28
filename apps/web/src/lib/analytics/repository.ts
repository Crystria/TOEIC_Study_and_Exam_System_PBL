import { dashboardRepository } from '../dashboard/repository';
import { createDemoAnalytics } from './mock-data';
import type { AnalyticsPreview, AnalyticsSnapshot } from './types';

export interface AnalyticsRepository {
  load(scenario: AnalyticsPreview, signal: AbortSignal): Promise<AnalyticsSnapshot>;
}

// Reuse the existing cancellable demo boundary. Never read local exam/learning history,
// call an account endpoint, or silently turn an API error into fixture data.
export const analyticsRepository: AnalyticsRepository = {
  async load(scenario, signal) {
    if (scenario === 'loading') {
      return new Promise<never>((_, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      });
    }
    await dashboardRepository.load(scenario === 'error' ? 'error' : 'ready', signal);
    return createDemoAnalytics(scenario === 'error' ? 'ready' : scenario);
  },
};
