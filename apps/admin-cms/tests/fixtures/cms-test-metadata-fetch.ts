import type {
  CmsTestMetadataFetcher,
  CmsTestMetadataFetchOptions,
  CmsTestMetadataFetchResponse,
} from '../../src/lib/tests/metadata-fetch-types';

// Illustrative in-memory fetch/JSON stubs only, never captured requests/responses
// or real API/DB records. Existing accepted query/body fixtures remain unchanged.
export function metadataFetcherStub(
  respond: (
    path: string,
    options: CmsTestMetadataFetchOptions,
  ) => CmsTestMetadataFetchResponse | Promise<CmsTestMetadataFetchResponse>,
) {
  const calls: { readonly path: string; readonly options: CmsTestMetadataFetchOptions }[] = [];
  const fetcher: CmsTestMetadataFetcher = async (path, options) => {
    calls.push(Object.freeze({ path, options: Object.freeze(options) }));
    return respond(path, options);
  };
  return { fetcher, calls };
}

export function metadataFetchResponse(status: number, body: unknown) {
  let jsonReads = 0;
  const response: CmsTestMetadataFetchResponse = Object.freeze({
    status,
    async json() {
      jsonReads++;
      return body;
    },
  });
  return {
    response,
    get jsonReads() {
      return jsonReads;
    },
  };
}
