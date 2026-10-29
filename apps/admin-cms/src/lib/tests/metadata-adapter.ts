import type { CmsTestMetadata, CmsTestMetadataPage } from './metadata-types';

export class CmsTestMetadataContractError extends Error {
  constructor(
    readonly path: string,
    readonly expected: string,
  ) {
    super(`Invalid CMS test metadata at ${path}: expected ${expected}.`);
    this.name = 'CmsTestMetadataContractError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactObject(
  value: unknown,
  keys: readonly string[],
  path: string,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new CmsTestMetadataContractError(path, 'an object');
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      throw new CmsTestMetadataContractError(`${path}.${key}`, 'a required own key');
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) {
      throw new CmsTestMetadataContractError(`${path}.${String(key)}`, 'no additional key');
    }
  }
  // The object shape is established above; values remain unknown until read below.
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CmsTestMetadataContractError(path, 'a non-blank string');
  }
  return value;
}

function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}

function integer(value: unknown, path: string, minimum: number, maximum?: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    (maximum !== undefined && value > maximum)
  ) {
    throw new CmsTestMetadataContractError(
      path,
      `an integer >= ${minimum}${maximum === undefined ? '' : ` and <= ${maximum}`}`,
    );
  }
  return value;
}

function testType(value: unknown, path: string): CmsTestMetadata['type'] {
  if (value === null || value === 'FULL' || value === 'MINI') return value;
  throw new CmsTestMetadataContractError(path, 'FULL, MINI or null');
}

function metadata(value: unknown, path: string): CmsTestMetadata {
  const item = exactObject(
    value,
    ['id', 'title', 'type', 'durationSeconds', 'questionCount', 'status'],
    path,
  );
  return {
    id: text(item.id, `${path}.id`),
    title: nullableText(item.title, `${path}.title`),
    type: testType(item.type, `${path}.type`),
    durationSeconds:
      item.durationSeconds === null
        ? null
        : integer(item.durationSeconds, `${path}.durationSeconds`, 1),
    questionCount:
      item.questionCount === null ? null : integer(item.questionCount, `${path}.questionCount`, 0),
    status: nullableText(item.status, `${path}.status`),
  };
}

/** Validate a successful detail body. Errors are contract errors, never demo fallbacks. */
export function parseCmsTestMetadataDetail(body: unknown): CmsTestMetadata {
  return metadata(body, '$');
}

/** Validate a successful list body without inferring totals or clamping its page. */
export function parseCmsTestMetadataList(body: unknown): CmsTestMetadataPage {
  const envelope = exactObject(body, ['items', 'total', 'page', 'size'], '$');
  if (!Array.isArray(envelope.items)) {
    throw new CmsTestMetadataContractError('$.items', 'an array of metadata items');
  }
  return {
    // Array.from also validates holes as undefined instead of silently skipping them.
    items: Array.from(envelope.items, (item: unknown, index) =>
      metadata(item, `$.items[${index}]`),
    ),
    total: integer(envelope.total, '$.total', 0),
    page: integer(envelope.page, '$.page', 1),
    size: integer(envelope.size, '$.size', 1, 50),
  };
}
