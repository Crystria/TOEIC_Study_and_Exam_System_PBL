import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageAdapter, minioStorage } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Tx, activeVocabulary, contentAudit, contentLock, fail, idempotent } from '../../core';
@Injectable()
export class LearningMediaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly adapter: StorageAdapter;
  private readonly publicBase: string;
  private timer?: ReturnType<typeof setInterval>;
  private cleaning?: Promise<void>;
  constructor(
    config: ConfigService,
    private readonly db: PrismaService,
  ) {
    this.bucket = config.get<string>('MINIO_BUCKET') || 'toeic-media';
    const endpoint = new URL(
        (config.get<string>('MINIO_ENDPOINT') || 'http://localhost:19000').replace(
          /^(?!https?:\/\/)/,
          'http://',
        ),
      ),
      browser = new URL(config.get<string>('MINIO_PUBLIC_ENDPOINT') || endpoint.origin);
    const create = (url: URL) =>
      new Client({
        endPoint: url.hostname,
        port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
        useSSL: url.protocol === 'https:',
        accessKey: config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
        secretKey: config.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
        region: config.get<string>('MINIO_REGION') || 'us-east-1',
      });
    this.client = create(endpoint);
    this.publicBase = (
      config.get<string>('MEDIA_PUBLIC_BASE_URL') || browser.origin + '/toeic-media'
    ).replace(/\/$/, '');
    this.adapter = new StorageAdapter(minioStorage(this.client, create(browser)), {
      bucket: this.bucket,
      prefix: 'learning/',
      publicBase: this.publicBase,
    });
  }
  url(key: string | null): string | null {
    if (!key) return null;
    if (!key.startsWith('learning/') || key.includes('..') || key.includes('\\'))
      fail(503, 'INVALID_STORED_MEDIA_KEY');
    return this.publicBase + '/' + key.split('/').map(encodeURIComponent).join('/');
  }
  async presign(
    actor: string,
    id: string,
    key: string,
    body: { kind: 'AUDIO' | 'IMAGE'; contentType: string; sizeBytes: number },
  ) {
    return this.db.$transaction(async (tx) => {
      await contentLock(tx);
      return idempotent(tx, actor, `media:${id}:presign`, key, body, async () => {
        await activeVocabulary(tx, id);
        const ticket = await this.adapter.presign(actor, id, body.contentType, body.sizeBytes);
        await tx.learningUpload.create({
          data: {
            id: ticket.uploadId,
            ownerId: actor,
            vocabularyId: id,
            kind: body.kind,
            objectKey: ticket.objectKey,
            contentType: ticket.contentType,
            sizeBytes: ticket.sizeBytes,
            expiresAt: new Date(ticket.expiresAt),
          },
        });
        return {
          uploadId: ticket.uploadId,
          objectKey: ticket.objectKey,
          putUrl: ticket.putUrl,
          expiresAt: new Date(ticket.expiresAt).toISOString(),
          requiredHeaders: { 'Content-Type': ticket.contentType },
        };
      });
    });
  }
  async confirm(actor: string, id: string, key: string, uploadId: string, cid: string) {
    const ticket = await this.db.learningUpload.findUnique({ where: { id: uploadId } });
    if (!ticket || ticket.ownerId !== actor || ticket.vocabularyId !== id)
      fail(404, 'UPLOAD_NOT_FOUND');
    // HEAD goes outside the business transaction; signer URLs never permit selecting another key.
    if (!ticket.confirmedAt) {
      if (ticket.expiresAt <= new Date()) fail(409, 'UPLOAD_EXPIRED');
      try {
        await this.adapter.confirm(
          {
            uploadId,
            ownerId: actor,
            bucket: this.bucket,
            objectKey: ticket.objectKey,
            contentType: ticket.contentType,
            sizeBytes: ticket.sizeBytes,
            expiresAt: ticket.expiresAt.getTime(),
            putUrl: '',
          },
          actor,
          id,
        );
      } catch (error) {
        if (
          ['Object metadata mismatch', 'Invalid upload ticket'].includes(
            (error as Error).message,
          ) ||
          ['NoSuchKey', 'NotFound'].includes((error as { code: string }).code)
        )
          fail(400, 'INVALID_UPLOADED_OBJECT');
        fail(503, 'STORAGE_UNAVAILABLE');
      }
    }
    return this.db.$transaction(async (tx) => {
      await contentLock(tx);
      return idempotent(tx, actor, `media:${id}:confirm`, key, { uploadId }, async () => {
        const vocabulary = await activeVocabulary(tx, id),
          current = await tx.learningUpload.findUniqueOrThrow({ where: { id: uploadId } });
        if (!current.confirmedAt) {
          if (current.expiresAt <= new Date()) fail(409, 'UPLOAD_EXPIRED');
          const field = ticket.kind === 'AUDIO' ? 'audioKey' : 'imageKey',
            old = vocabulary[field];
          await tx.vocabulary.update({ where: { id }, data: { [field]: ticket.objectKey } });
          await tx.learningUpload.update({
            where: { id: uploadId },
            data: { confirmedAt: new Date() },
          });
          if (old && old !== ticket.objectKey) await this.garbage(tx, old);
          await contentAudit(
            tx,
            actor,
            id,
            'MEDIA_CONFIRMED',
            { objectKey: old },
            { objectKey: ticket.objectKey },
            cid,
          );
        }
        return { objectKey: ticket.objectKey, url: this.url(ticket.objectKey) };
      });
    });
  }
  async garbage(tx: Tx, objectKey: string) {
    if (!objectKey.startsWith('learning/') || objectKey.includes('..'))
      fail(503, 'INVALID_STORED_MEDIA_KEY');
    await tx.learningStorageGarbage.upsert({
      where: { objectKey },
      create: { objectKey, deleteAfter: new Date(Date.now() + 86400000) },
      update: {},
    });
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.cleaning)
        this.cleaning = this.cleanup()
          .catch(() => undefined)
          .finally(() => {
            this.cleaning = undefined;
          });
    }, 60000);
    this.timer.unref();
  }
  async cleanup() {
    for (const row of await this.db.learningUpload.findMany({
      where: { confirmedAt: null, expiresAt: { lt: new Date(Date.now() - 3600000) } },
      take: 100,
    })) {
      if (!row.objectKey.startsWith('learning/')) continue;
      await this.client.removeObject(this.bucket, row.objectKey);
      await this.db.learningUpload.deleteMany({ where: { id: row.id, confirmedAt: null } });
    }
    for (const row of await this.db.learningStorageGarbage.findMany({
      where: { deleteAfter: { lt: new Date() } },
      take: 100,
    })) {
      if (
        !row.objectKey.startsWith('learning/') ||
        (await this.db.vocabulary.count({
          where: {
            OR: [{ audioKey: row.objectKey }, { imageKey: row.objectKey }],
            deletedAt: null,
          },
        }))
      )
        continue;
      await this.client.removeObject(this.bucket, row.objectKey);
      await this.db.learningStorageGarbage.deleteMany({ where: { objectKey: row.objectKey } });
    }
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.cleaning;
  }
}
