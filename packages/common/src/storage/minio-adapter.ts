import { ObjectStorage } from './storage';

/** Structural MinIO/S3 client boundary avoids exposing credentials to business modules. */
interface MinioClient {
  presignedPutObject(bucket: string, key: string, ttl: number): Promise<string>;
  presignedGetObject(bucket: string, key: string, ttl: number): Promise<string>;
  statObject(
    bucket: string,
    key: string,
  ): Promise<{ size: number; metaData?: Record<string, unknown> }>;
}
export function minioStorage(
  client: MinioClient,
  browserSigner: MinioClient = client,
): ObjectStorage {
  return {
    presignPut: (bucket, key, ttl) => browserSigner.presignedPutObject(bucket, key, ttl),
    presignGet: (bucket, key, ttl) => browserSigner.presignedGetObject(bucket, key, ttl),
    head: async (bucket, key) => {
      const stat = await client.statObject(bucket, key);
      return {
        size: stat.size,
        contentType: String(
          stat.metaData?.['content-type'] ?? stat.metaData?.['Content-Type'] ?? '',
        ),
      };
    },
  };
}
