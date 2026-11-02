import type { CmsTestMetadataFetcher } from './metadata-fetch-types';
import type { CmsTestMetadataTransport } from './metadata-repository-types';

/** Fetcher and JSON failures propagate unchanged; the repository wraps their cause. */
export function createCmsTestMetadataTransport(
  fetcher: CmsTestMetadataFetcher,
): CmsTestMetadataTransport {
  if (typeof fetcher !== 'function') {
    throw new TypeError('A CMS test metadata fetcher is required.');
  }

  return {
    async get({ path }) {
      // The repository already serialized this path. Preserve it exactly.
      const response = await fetcher(path, { method: 'GET' });
      const status = response.status;
      return {
        status,
        // Error/no-content bodies are not metadata and need not be JSON.
        body: status === 200 ? await response.json() : undefined,
      };
    },
  };
}
