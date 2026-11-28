export interface CmsTestMetadataFetchOptions {
  readonly method: 'GET';
}

export interface CmsTestMetadataFetchResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

// Minimal structural fetch signature. The caller supplies the implementation;
// this contract adds no origin, credentials, headers or cancellation policy.
export type CmsTestMetadataFetcher = (
  path: string,
  options: CmsTestMetadataFetchOptions,
) => Promise<CmsTestMetadataFetchResponse>;
