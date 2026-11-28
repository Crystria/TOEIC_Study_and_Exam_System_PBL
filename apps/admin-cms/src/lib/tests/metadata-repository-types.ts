import type { CmsTestMetadataQueryInput } from './metadata-query-types';
import type { CmsTestMetadata, CmsTestMetadataPage } from './metadata-types';

export interface CmsTestMetadataGetRequest {
  // Origin-relative API path, including the already serialized query when present.
  readonly path: string;
}

export interface CmsTestMetadataGetResponse {
  readonly status: number;
  readonly body: unknown;
}

// The caller supplies the GET transport. No default implementation or auth policy.
export interface CmsTestMetadataTransport {
  get(request: CmsTestMetadataGetRequest): Promise<CmsTestMetadataGetResponse>;
}

// Repository result, not an API envelope or the demo found/unsupported union.
export type CmsTestMetadataDetailResult =
  { readonly kind: 'success'; readonly metadata: CmsTestMetadata } | { readonly kind: 'not-found' };

export interface CmsTestMetadataRepository {
  list(query: CmsTestMetadataQueryInput): Promise<CmsTestMetadataPage>;
  read(id: string): Promise<CmsTestMetadataDetailResult>;
}
