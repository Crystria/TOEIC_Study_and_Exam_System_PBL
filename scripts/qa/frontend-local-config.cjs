/* Respect each service's storage contract while keeping local QA media separate. */
function mediaConfiguration(service, requestedBucket, env) {
  if (!requestedBucket) return {};
  // Common StorageAdapter intentionally restricts Learning to the supported QA bucket.
  const bucket = service === 'learning' ? 'toeic-media-p6' : requestedBucket;
  const endpoint = (env.MINIO_PUBLIC_ENDPOINT || 'http://localhost:19000').replace(/\/$/, '');
  return {
    MINIO_BUCKET: bucket,
    MEDIA_PUBLIC_BASE_URL: endpoint + '/' + bucket,
  };
}

module.exports = { mediaConfiguration };
