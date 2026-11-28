// Illustrative response bodies only: not real API/DB records or captured responses.
// Deliberately separate from the accepted UI fixtures; overrides may be invalid.
export function cmsMetadataBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-test-001',
    title: 'Metadata minh họa · 日本語',
    type: 'FULL',
    durationSeconds: 61,
    questionCount: 0,
    status: 'DRAFT',
    ...overrides,
  };
}

export function cmsMetadataListBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    items: [
      cmsMetadataBody(),
      cmsMetadataBody({
        id: 'demo-test-002',
        type: 'MINI',
        durationSeconds: 123,
        questionCount: null,
        status: 'CUSTOM_REVIEW',
      }),
    ],
    total: 2,
    page: 1,
    size: 20,
    ...overrides,
  };
}
