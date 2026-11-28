import type { CmsTestMetadataQuery, CmsTestMetadataQueryInput } from './metadata-query-types';

export class CmsTestMetadataQueryError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
  ) {
    super(`Invalid CMS test metadata query at ${path}: expected ${expected}.`);
    this.name = 'CmsTestMetadataQueryError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CmsTestMetadataQueryError('$.keyword', 'a string, empty when unfiltered');
  }
  return value;
}

function typeFilter(value: unknown): CmsTestMetadataQueryInput['type'] {
  if (value === '' || value === 'FULL' || value === 'MINI') return value;
  throw new CmsTestMetadataQueryError('$.type', 'FULL, MINI or an empty string');
}

function statusFilter(value: unknown): CmsTestMetadataQueryInput['status'] {
  if (value === '' || value === 'DRAFT' || value === 'PUBLISHED' || value === 'ARCHIVED')
    return value;
  throw new CmsTestMetadataQueryError('$.status', 'DRAFT, PUBLISHED, ARCHIVED or an empty string');
}

function integer(value: unknown, path: string, maximum?: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new CmsTestMetadataQueryError(
      path,
      `an integer >= 1${maximum === undefined ? '' : ` and <= ${maximum}`}`,
    );
  }
  return value;
}

function validateInput(input: unknown): CmsTestMetadataQueryInput {
  if (!isObject(input)) throw new CmsTestMetadataQueryError('$', 'a normalized UI query object');
  for (const key of ['keyword', 'type', 'status', 'page', 'size']) {
    if (!Object.hasOwn(input, key)) {
      throw new CmsTestMetadataQueryError(`$.${key}`, 'a required normalized UI query key');
    }
  }
  return {
    keyword: keyword(input.keyword),
    type: typeFilter(input.type),
    status: statusFilter(input.status),
    page: integer(input.page, '$.page'),
    size: integer(input.size, '$.size', 50),
  };
}

/**
 * Accept the normalized UI query (readTestParams(...).query), not raw URL values.
 * Extra UI fields are ignored by projection; invalid required values throw.
 */
export function mapCmsTestMetadataQuery(input: unknown): CmsTestMetadataQuery {
  const query = validateInput(input);
  return {
    ...(query.keyword === '' ? {} : { keyword: query.keyword }),
    ...(query.type === '' ? {} : { type: query.type }),
    ...(query.status === '' ? {} : { status: query.status }),
    page: query.page,
    size: query.size,
  };
}

/**
 * Serialize the same normalized UI input as the mapper, not its API output.
 * Returns only a query string, without a leading '?' or an endpoint URL.
 */
export function serializeCmsTestMetadataQuery(input: unknown): string {
  const query = mapCmsTestMetadataQuery(input);
  const params = new URLSearchParams();
  if (query.keyword !== undefined) params.set('keyword', query.keyword);
  if (query.type !== undefined) params.set('type', query.type);
  if (query.status !== undefined) params.set('status', query.status);
  params.set('page', String(query.page));
  params.set('size', String(query.size));
  return params.toString();
}
