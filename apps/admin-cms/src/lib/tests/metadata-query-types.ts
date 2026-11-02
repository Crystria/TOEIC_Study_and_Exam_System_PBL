// Normalized UI query shape, structurally compatible with TestQuery.
// This is not the API DTO, a raw URL, or the complete readTestParams result.
export interface CmsTestMetadataQueryInput {
  readonly keyword: string;
  readonly type: 'FULL' | 'MINI' | '';
  readonly status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | '';
  readonly page: number;
  readonly size: number;
}

// Request query for the CMS list endpoint. Response status has a wider vocabulary.
export interface CmsTestMetadataQuery {
  readonly keyword?: string;
  readonly type?: 'FULL' | 'MINI';
  readonly status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  readonly page: number;
  readonly size: number;
}
