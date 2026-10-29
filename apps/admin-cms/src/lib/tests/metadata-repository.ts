import { parseCmsTestMetadataDetail, parseCmsTestMetadataList } from './metadata-adapter';
import { serializeCmsTestMetadataQuery } from './metadata-query';
import type {
  CmsTestMetadataGetResponse,
  CmsTestMetadataRepository,
  CmsTestMetadataTransport,
} from './metadata-repository-types';

const METADATA_PATH = '/api/v1/tests/cms-metadata';

export class CmsTestMetadataIdError extends Error {
  readonly path = '$.id';
  readonly expected = 'a non-blank string encodable as a URI path segment';

  constructor() {
    super('Invalid CMS test metadata ID: expected a non-blank, URI-encodable string.');
    this.name = 'CmsTestMetadataIdError';
  }
}

export class CmsTestMetadataHttpError extends Error {
  constructor(readonly status: number) {
    super(`CMS test metadata GET returned HTTP ${status}.`);
    this.name = 'CmsTestMetadataHttpError';
  }
}

export class CmsTestMetadataTransportError extends Error {
  constructor(cause: unknown) {
    super('CMS test metadata GET transport failed.', { cause });
    this.name = 'CmsTestMetadataTransportError';
  }
}

function encodeId(id: unknown): string {
  if (typeof id !== 'string' || id.trim().length === 0) throw new CmsTestMetadataIdError();
  try {
    // Treat literal percent sequences as ID text; never decode or trim the input.
    return encodeURIComponent(id);
  } catch {
    // A lone UTF-16 surrogate cannot be encoded without changing the opaque ID.
    throw new CmsTestMetadataIdError();
  }
}

/** Read-only composition of the accepted query mapper and response adapter. */
export function createCmsTestMetadataRepository(
  transport: CmsTestMetadataTransport,
): CmsTestMetadataRepository {
  if (!transport || typeof transport.get !== 'function') {
    throw new TypeError('A CMS test metadata GET transport is required.');
  }

  async function get(path: string): Promise<CmsTestMetadataGetResponse> {
    try {
      return await transport.get({ path });
    } catch (cause) {
      // Catch only the injected call, leaving mapper/adapter errors identifiable.
      throw new CmsTestMetadataTransportError(cause);
    }
  }

  return {
    async list(query) {
      const search = serializeCmsTestMetadataQuery(query);
      const response = await get(`${METADATA_PATH}?${search}`);
      if (response.status !== 200) throw new CmsTestMetadataHttpError(response.status);
      return parseCmsTestMetadataList(response.body);
    },
    async read(id) {
      const segment = encodeId(id);
      const response = await get(`${METADATA_PATH}/${segment}`);
      if (response.status === 404) return { kind: 'not-found' };
      if (response.status !== 200) throw new CmsTestMetadataHttpError(response.status);
      return { kind: 'success', metadata: parseCmsTestMetadataDetail(response.body) };
    },
  };
}
