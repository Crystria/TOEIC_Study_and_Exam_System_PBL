import { createDemoDashboard } from './mock-data';
import type { PreviewScenario, StudentDashboard } from './types';

export interface DashboardRepository {
  load(scenario: PreviewScenario, signal: AbortSignal): Promise<StudentDashboard>;
}

// Stage 1 explicitly uses a demo adapter. No automatic API-error-to-mock fallback.
export const dashboardRepository: DashboardRepository = {
  async load(scenario, signal) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 250);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    if (scenario === 'error') throw new Error('Demo loading error');
    return createDemoDashboard(scenario);
  },
};
