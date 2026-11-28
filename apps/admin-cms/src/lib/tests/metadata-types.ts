// Read contract for the CMS metadata endpoints, independent of demo view models.
// Construct these values through metadata-adapter after validating an unknown body.
export interface CmsTestMetadata {
  readonly id: string;
  readonly title: string | null;
  readonly type: 'FULL' | 'MINI' | null;
  readonly durationSeconds: number | null;
  // Linked TestQuestion rows; neither completeness nor permission evidence.
  readonly questionCount: number | null;
  readonly status: string | null;
}

export interface CmsTestMetadataPage {
  readonly items: readonly CmsTestMetadata[];
  // Number of Tests matching the filters, not question count or catalog size.
  readonly total: number;
  readonly page: number;
  readonly size: number;
}
