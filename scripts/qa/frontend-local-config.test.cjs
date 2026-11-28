const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mediaConfiguration } = require('./frontend-local-config.cjs');
const { StorageAdapter } = require('../../packages/common/dist/storage/storage');
const { ConfigService } = require('@nestjs/config');
const {
  MediaService,
} = require('../../services/question-bank-service/dist/modules/media/media.service');

test('Learning QA media configuration satisfies the actual Common storage policy', async () => {
  const config = mediaConfiguration('learning', 'toeic-frontend-s35-20261103', {});
  const storage = {
    presignPut: async (bucket, key) => `http://localhost:19000/${bucket}/${key}`,
  };
  const adapter = new StorageAdapter(storage, {
    bucket: config.MINIO_BUCKET,
    publicBase: config.MEDIA_PUBLIC_BASE_URL,
    prefix: 'learning/',
  });
  const ticket = await adapter.presign('qa-owner', 'qa-word', 'image/png', 1);
  assert.equal(ticket.bucket, 'toeic-media-p6');
  assert.match(ticket.objectKey, /^learning\/qa-word\//);
  assert.match(
    await adapter.url(ticket.objectKey),
    /^http:\/\/localhost:19000\/toeic-media-p6\/learning\//,
  );
});

test('Question Bank keeps existing seeded media URLs in its isolated bucket', () => {
  const config = mediaConfiguration('question-bank', 'toeic-frontend-s35-20261103', {
    MINIO_PUBLIC_ENDPOINT: 'http://localhost:19000/',
  });
  const service = new MediaService(new ConfigService(config), {});
  assert.equal(
    service.url('questions/part-1/qa-id/audio/qa.mp3'),
    'http://localhost:19000/toeic-frontend-s35-20261103/questions/part-1/qa-id/audio/qa.mp3',
  );
});

test('No media override preserves existing per-service configuration', () => {
  assert.deepEqual(
    mediaConfiguration('learning', undefined, {
      MINIO_BUCKET: 'toeic-media-p6',
      MEDIA_PUBLIC_BASE_URL: 'https://storage.example.test/toeic-media-p6',
    }),
    {},
  );
});

test('Storage policy continues rejecting unsupported Learning buckets and public avatars', () => {
  assert.throws(
    () =>
      new StorageAdapter(
        {},
        {
          bucket: 'toeic-frontend-s35-20261103',
          prefix: 'learning/',
        },
      ),
    /Learning bucket mismatch/,
  );
  assert.throws(
    () =>
      new StorageAdapter(
        {},
        {
          bucket: 'toeic-user',
          prefix: 'avatars/',
          publicBase: 'https://storage.example.test/toeic-user',
        },
      ),
    /Avatars must be private/,
  );
});
