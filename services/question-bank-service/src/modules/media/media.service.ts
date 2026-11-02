import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@toeic/common';
import { Client } from 'minio';
import { PresignMediaDto } from '../questions/dto/presign-media.dto';

const types: Record<string, { ext: string[]; media: string }> = {
  'audio/mpeg': { ext: ['mp3'], media: 'AUDIO' },
  'image/png': { ext: ['png'], media: 'IMAGE' },
  'image/jpeg': { ext: ['jpg', 'jpeg'], media: 'IMAGE' },
  'image/webp': { ext: ['webp'], media: 'IMAGE' },
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: Client;
  private readonly signer: Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  constructor(
    config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const endpoint = new URL(
      (config.get<string>('MINIO_ENDPOINT') ?? 'localhost:19000').replace(
        /^(?!https?:\/\/)/,
        'http://',
      ),
    );
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'toeic-media';
    this.publicBase = (
      config.get<string>('MEDIA_PUBLIC_BASE_URL') ?? `${endpoint.origin}/${this.bucket}`
    ).replace(/\/$/, '');
    this.client = new Client({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
      useSSL: endpoint.protocol === 'https:',
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
    const publicEndpoint = config.get<string>('MINIO_PUBLIC_ENDPOINT');
    if (publicEndpoint) {
      const publicUrl = new URL(publicEndpoint);
      this.signer = new Client({
        endPoint: publicUrl.hostname,
        port: Number(publicUrl.port || (publicUrl.protocol === 'https:' ? 443 : 80)),
        useSSL: publicUrl.protocol === 'https:',
        accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
        secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
        // Presigning must not try to contact the browser-facing address from a container.
        region: config.get<string>('MINIO_REGION') ?? 'us-east-1',
      });
    } else this.signer = this.client;
  }
  url(key: string | null): string | null {
    return key ? `${this.publicBase}/${key.split('/').map(encodeURIComponent).join('/')}` : null;
  }
  prefix(scope: 'questions' | 'groups', part: number, id: string) {
    return `${scope}/part-${part}/${id}/`;
  }
  async presign(
    scope: 'questions' | 'groups',
    part: number,
    id: string,
    dto: PresignMediaDto,
    idempotencyKey?: string,
  ) {
    const type = types[dto.contentType];
    const ext = dto.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (
      !type ||
      type.media !== dto.mediaType ||
      !type.ext.includes(ext) ||
      /[\\/]/.test(dto.fileName)
    )
      throw new BadRequestException('Media type, content type and extension must match');
    if (idempotencyKey && idempotencyKey.length > 200)
      throw new BadRequestException('Idempotency-Key is too long');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([part, dto.mediaType, dto.contentType, dto.fileName]))
      .digest('hex');
    const cacheKey = idempotencyKey
      ? `media:presign:${scope}:${id}:${createHash('sha256').update(idempotencyKey).digest('hex')}`
      : undefined;
    const key = `${this.prefix(scope, part, id)}${dto.mediaType.toLowerCase()}/${randomUUID()}.${ext}`;
    const response = {
      uploadUrl: await this.signer.presignedPutObject(this.bucket, key, 300),
      objectName: key,
      storageKey: key,
      bucket: this.bucket,
      expiresIn: 300,
      contentType: dto.contentType,
      publicUrl: this.url(key),
    };
    if (!cacheKey) return response;
    const redisClient = this.redis.getClient();
    if (redisClient.status !== 'ready') {
      this.logger.warn('Presign idempotency cache unavailable; returning a fresh upload target');
      return response;
    }
    let stored: string | null = null;
    let timer: NodeJS.Timeout | undefined;
    try {
      stored = await Promise.race([
        (async () => {
          await redisClient.set(
            cacheKey,
            JSON.stringify({ fingerprint, response, expiresAt: Date.now() + 300_000 }),
            'EX',
            300,
            'NX',
          );
          return redisClient.get(cacheKey);
        })(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Redis cache timed out')), 500);
        }),
      ]);
    } catch (error) {
      this.logger.warn(`Presign idempotency cache unavailable: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (!stored) return response;
    const cached = JSON.parse(stored) as {
      fingerprint: string;
      response: typeof response;
      expiresAt: number;
    };
    if (cached.fingerprint !== fingerprint)
      throw new ConflictException('Idempotency-Key was already used with a different request');
    return {
      ...cached.response,
      expiresIn: Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000)),
    };
  }
  async verify(
    key: string | null | undefined,
    prefix: string,
    kind: 'AUDIO' | 'IMAGE',
  ): Promise<void> {
    if (key == null) return;
    if (!key.startsWith(`${prefix}${kind.toLowerCase()}/`) || key.includes('..'))
      throw new BadRequestException('Storage key does not belong to this resource/media type');
    let stat;
    try {
      stat = await this.client.statObject(this.bucket, key);
    } catch {
      throw new BadRequestException('Media object does not exist');
    }
    const contentType = String(
      stat.metaData?.['content-type'] ?? stat.metaData?.['Content-Type'] ?? '',
    ).split(';')[0];
    const type = types[contentType];
    if (!type || type.media !== kind || !type.ext.includes(key.split('.').pop() ?? ''))
      throw new BadRequestException('Uploaded object has an invalid content type');
  }
}
