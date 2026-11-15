/** Content management is available independently of experimental account writes. */
export function cmsContentWritesEnabled(environment?: string, setting?: string) {
  return ['local', 'test'].includes(environment ?? '') && setting !== 'disabled';
}

export function isCmsContentMutation(path: string, method: string) {
  const collection =
    '(questions|question-groups|tests|learning/admin/(lessons|vocabularies|vocabulary-topics))';
  return (
    (method === 'POST' && new RegExp(`^${collection}$`).test(path)) ||
    (['PATCH', 'DELETE'].includes(method) && new RegExp(`^${collection}/[^/]+$`).test(path)) ||
    (method === 'POST' &&
      (/^(questions|question-groups)\/[^/]+\/media\/presign$/.test(path) ||
        /^learning\/vocabularies\/[^/]+\/media\/(presign|confirm)$/.test(path)))
  );
}
