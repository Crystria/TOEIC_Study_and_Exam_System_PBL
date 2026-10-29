import type {
  CmsTestMetadataGetRequest,
  CmsTestMetadataGetResponse,
  CmsTestMetadataTransport,
} from '../../src/lib/tests/metadata-repository-types';

// In-memory illustrative stub only. No captured requests/responses or real API/DB records.
// Existing accepted query/response fixtures remain unchanged.
export function metadataTransportStub(
  respond: (request: CmsTestMetadataGetRequest) => CmsTestMetadataGetResponse,
) {
  const requests: CmsTestMetadataGetRequest[] = [];
  const transport: CmsTestMetadataTransport = {
    async get(request) {
      // Freeze the actual request so later repository mutations fail in tests.
      requests.push(Object.freeze(request));
      return respond(request);
    },
  };
  return { transport, requests };
}
