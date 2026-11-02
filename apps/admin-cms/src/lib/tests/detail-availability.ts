export const TEST_DETAIL_IDS = ['demo-test-001', 'demo-test-002'] as const;
export function hasTestDetail(id: string): boolean {
  return TEST_DETAIL_IDS.some((supported) => supported === id);
}
