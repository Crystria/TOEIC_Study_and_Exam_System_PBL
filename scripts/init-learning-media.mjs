import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'minio';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) =>
  fs.existsSync(path.join(root, p)) ? dotenv.parse(fs.readFileSync(path.join(root, p))) : {};
const env = { ...read('.env'), ...read('services/learning-service/.env'), ...process.env };
const endpoint = new URL(
  (env.MINIO_ENDPOINT || 'http://localhost:19000').replace(/^(?!https?:\/\/)/, 'http://'),
);
if (!['localhost', '127.0.0.1', 'minio'].includes(endpoint.hostname))
  throw new Error('Expected local development MinIO');
const client = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port || 80),
  useSSL: endpoint.protocol === 'https:',
  accessKey: env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: env.MINIO_SECRET_KEY || 'minioadmin',
  region: 'us-east-1',
});
const bucket = 'toeic-media';
if (!(await client.bucketExists(bucket))) await client.makeBucket(bucket);
let policy;
try {
  policy = JSON.parse(await client.getBucketPolicy(bucket));
} catch (e) {
  if (e.code !== 'NoSuchBucketPolicy') throw e;
  policy = { Version: '2012-10-17', Statement: [] };
}
policy.Statement = policy.Statement || [];
if (!policy.Statement.some((s) => s.Sid === 'LearningPublicRead')) {
  policy.Statement.push({
    Sid: 'LearningPublicRead',
    Effect: 'Allow',
    Principal: { AWS: ['*'] },
    Action: ['s3:GetObject'],
    Resource: ['arn:aws:s3:::toeic-media/learning/*'],
  });
  await client.setBucketPolicy(bucket, JSON.stringify(policy));
}
console.log(
  'Learning public GET policy ready; existing statements preserved, no public write permission added.',
);
