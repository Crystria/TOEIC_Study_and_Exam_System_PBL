import { randomUUID } from 'node:crypto';

export interface ObjectStorage {
  presignPut(bucket: string, key: string, ttlSeconds: number): Promise<string>;
  presignGet(bucket: string, key: string, ttlSeconds: number): Promise<string>;
  head(bucket: string, key: string): Promise<{ size: number; contentType: string }>;
}
export interface StoragePolicy {
  bucket: string;
  prefix: string;
  publicBase?: string;
}
export interface UploadTicket {
  uploadId: string;
  ownerId: string;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: number;
  putUrl: string;
}
const types: Record<string, { extension: string; maximum: number }> = {
  'audio/mpeg': { extension: 'mp3', maximum: 5 * 1024 * 1024 },
  'image/png': { extension: 'png', maximum: 2 * 1024 * 1024 },
  'image/jpeg': { extension: 'jpg', maximum: 2 * 1024 * 1024 },
  'image/webp': { extension: 'webp', maximum: 2 * 1024 * 1024 },
};

/** Service persists tickets; confirm never trusts a client-supplied key or metadata. */
export class StorageAdapter {
  constructor(
    private readonly storage: ObjectStorage,
    private readonly policy: StoragePolicy,
  ) {
    if (!/^(avatars|learning)\/$/.test(policy.prefix)) throw new Error('Invalid storage prefix');
    if (
      policy.prefix === 'avatars/' &&
      (!/^toeic-user(?:-p6)?$/.test(policy.bucket) || policy.publicBase)
    )
      throw new Error('Avatars must be private');
    if (policy.prefix === 'learning/' && !/^toeic-media(?:-p6)?$/.test(policy.bucket))
      throw new Error('Learning bucket mismatch');
  }
  async presign(
    ownerId: string,
    resourceId: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<UploadTicket> {
    if (![ownerId, resourceId].every((id) => /^[a-zA-Z0-9-]{1,128}$/.test(id)))
      throw new Error('Invalid resource identity');
    if (this.policy.prefix === 'avatars/' && ownerId !== resourceId)
      throw new Error('Avatar owner mismatch');
    const type = types[contentType];
    if (
      !type ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > type.maximum ||
      (this.policy.prefix === 'avatars/' && !contentType.startsWith('image/'))
    )
      throw new Error('Invalid media metadata');
    const uploadId = randomUUID();
    const objectKey = `${this.policy.prefix}${resourceId}/${uploadId}.${type.extension}`;
    return {
      uploadId,
      ownerId,
      bucket: this.policy.bucket,
      objectKey,
      contentType,
      sizeBytes,
      expiresAt: Date.now() + 300_000,
      putUrl: await this.storage.presignPut(this.policy.bucket, objectKey, 300),
    };
  }
  async confirm(ticket: UploadTicket, ownerId: string, resourceId: string): Promise<string> {
    if (
      ticket.ownerId !== ownerId ||
      ticket.expiresAt <= Date.now() ||
      ticket.bucket !== this.policy.bucket ||
      !ticket.objectKey.startsWith(`${this.policy.prefix}${resourceId}/`) ||
      ticket.objectKey.includes('..')
    )
      throw new Error('Invalid upload ticket');
    const stat = await this.storage.head(ticket.bucket, ticket.objectKey);
    if (stat.size !== ticket.sizeBytes || stat.contentType.split(';')[0] !== ticket.contentType)
      throw new Error('Object metadata mismatch');
    return ticket.objectKey;
  }
  async url(key: string): Promise<string> {
    if (!key.startsWith(this.policy.prefix) || key.includes('..') || key.includes('\\'))
      throw new Error('Invalid storage key');
    return this.policy.publicBase
      ? `${this.policy.publicBase.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
      : this.storage.presignGet(this.policy.bucket, key, 300);
  }
}
