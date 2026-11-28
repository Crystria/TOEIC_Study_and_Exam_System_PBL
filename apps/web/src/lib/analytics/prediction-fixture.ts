import type { DemoPrediction } from './types';

// Authored display value, shared scenario with Dashboard. No prediction algorithm runs here.
export const demoAnalyticsPrediction: DemoPrediction = {
  source: 'demo-fixture',
  score: 660,
  supportingAttemptIds: ['demo-full-03', 'demo-full-02', 'demo-full-01'],
};
