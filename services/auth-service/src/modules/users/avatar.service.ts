import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { StorageAdapter, minioStorage } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { failure, lockedUser } from '../../identity';

@Injectable()
export class AvatarService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly adapter: StorageAdapter;
  private timer?: ReturnType<typeof setInterval>;
  private cleaning?: Promise<void>;
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = config.get<string>('AUTH_AVATAR_BUCKET') || 'toeic-user';
    const endpoint = new URL(
      (config.get<string>('MINIO_ENDPOINT') || 'http://localhost:19000').replace(
        /^(?!https?:\/\/)/,
        'http://',
      ),
    );
    const browser = new URL(config.get<string>('MINIO_PUBLIC_ENDPOINT') || endpoint.origin);
    const create = (url: URL) =>
      new Client({
        endPoint: url.hostname,
        port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
        useSSL: url.protocol === 'https:',
        accessKey: config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
        secretKey: config.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
        region: 'us-east-1',
      });
    this.client = create(endpoint);
    this.adapter = new StorageAdapter(minioStorage(this.client, create(browser)), {
      bucket: this.bucket,
      prefix: 'avatars/',
    });
  }
  url(key: string | null): Promise<string | null> {
    return key ? this.adapter.url(key) : Promise.resolve(null);
  }
  async presign(userId: string, input: { contentType: string; sizeBytes: number }) {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        try {
          await this.client.makeBucket(this.bucket);
        } catch (error) {
          if (!(await this.client.bucketExists(this.bucket))) throw error;
        }
      }
      // This bucket is exclusively owned by Auth and must never allow anonymous reads.
      await this.client.setBucketPolicy(this.bucket, '');
      const ticket = await this.adapter.presign(userId, userId, input.contentType, input.sizeBytes);
      await this.prisma.avatarUpload.create({
        data: {
          id: ticket.uploadId,
          userId,
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
    } catch {
      failure(503, 'STORAGE_UNAVAILABLE');
    }
  }
  async confirm(userId: string, uploadId: string) {
    const ticket = await this.prisma.avatarUpload.findUnique({ where: { id: uploadId } });
    if (!ticket || ticket.userId !== userId) failure(404, 'UPLOAD_NOT_FOUND');
    if (ticket.confirmedAt)
      return { objectKey: ticket.objectKey, url: await this.url(ticket.objectKey) };
    if (ticket.expiresAt <= new Date()) failure(400, 'UPLOAD_EXPIRED');
    try {
      await this.adapter.confirm(
        {
          uploadId: ticket.id,
          ownerId: userId,
          bucket: this.bucket,
          objectKey: ticket.objectKey,
          contentType: ticket.contentType,
          sizeBytes: ticket.sizeBytes,
          expiresAt: ticket.expiresAt.getTime(),
          putUrl: '',
        },
        userId,
        userId,
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        ['NoSuchKey', 'NotFound', 'NoSuchObject'].includes(code || '') ||
        ['Object metadata mismatch', 'Invalid upload ticket'].includes((error as Error).message)
      )
        failure(400, 'INVALID_UPLOADED_OBJECT');
      failure(503, 'STORAGE_UNAVAILABLE');
    }
    await this.prisma.$transaction(async (tx) => {
      const user = await lockedUser(tx, userId);
      const current = await tx.avatarUpload.findUniqueOrThrow({ where: { id: uploadId } });
      if (current.confirmedAt) return;
      if (current.expiresAt <= new Date()) failure(400, 'UPLOAD_EXPIRED');
      await tx.avatarUpload.update({ where: { id: uploadId }, data: { confirmedAt: new Date() } });
      await tx.user.update({ where: { id: userId }, data: { avatarKey: ticket.objectKey } });
      if (user.avatarKey && user.avatarKey !== ticket.objectKey)
        await tx.storageGarbage.upsert({
          where: { objectKey: user.avatarKey },
          create: { objectKey: user.avatarKey, deleteAfter: new Date(Date.now() + 86400000) },
          update: {},
        });
    });
    return { objectKey: ticket.objectKey, url: await this.url(ticket.objectKey) };
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
    const expired = await this.prisma.avatarUpload.findMany({
      where: { confirmedAt: null, expiresAt: { lt: new Date(Date.now() - 3600000) } },
      take: 100,
    });
    for (const ticket of expired) {
      await this.client.removeObject(this.bucket, ticket.objectKey);
      await this.prisma.avatarUpload.deleteMany({ where: { id: ticket.id, confirmedAt: null } });
    }
    const garbage = await this.prisma.storageGarbage.findMany({
      where: { deleteAfter: { lt: new Date() } },
      take: 100,
    });
    for (const row of garbage) {
      if (!(await this.prisma.user.count({ where: { avatarKey: row.objectKey } }))) {
        await this.client.removeObject(this.bucket, row.objectKey);
        await this.prisma.storageGarbage.deleteMany({ where: { objectKey: row.objectKey } });
      }
    }
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.cleaning;
  }
}
