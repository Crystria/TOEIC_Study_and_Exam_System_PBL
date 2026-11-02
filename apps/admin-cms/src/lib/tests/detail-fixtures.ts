import { TEST_FIXTURES } from './fixtures';
import { TEST_DETAIL_IDS } from './detail-availability';
import type { TestDetail } from './detail-types';

// Reuse only the confirmed catalog metadata for these two IDs. Explicit projection
// prevents future catalog additions from silently becoming detail fields.
export const TEST_DETAIL_FIXTURES: readonly TestDetail[] = TEST_DETAIL_IDS.map((id) => {
  const item = TEST_FIXTURES.find((test) => test.id === id)!;
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    durationSeconds: item.durationSeconds,
    questionCount: item.questionCount,
    status: item.status,
  };
});
