// Illustrative normalized UI query stub only; never a captured request or live data.
// Invalid overrides intentionally exercise the mapper's runtime boundary.
export function cmsMetadataQueryInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    keyword: '',
    type: '',
    status: '',
    page: 1,
    size: 20,
    ...overrides,
  };
}
