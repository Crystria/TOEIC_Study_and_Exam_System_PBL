import { Client } from 'minio';
const endpoint = new URL(
  (process.env.MINIO_ENDPOINT ?? 'localhost:19000').replace(/^(?!https?:\/\/)/, 'http://'),
);
const bucket = process.env.MINIO_BUCKET ?? 'toeic-media';
const minio = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
  useSSL: endpoint.protocol === 'https:',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
});
if (!(await minio.bucketExists(bucket)))
  await minio.makeBucket(bucket, process.env.MINIO_REGION ?? 'us-east-1');
if (process.env.MINIO_PUBLIC_READ === 'true') {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Automatic public bucket policy is for local development only');
  await minio.setBucketPolicy(
    bucket,
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    }),
  );
}
console.log(`Media bucket ready: ${bucket}`);
