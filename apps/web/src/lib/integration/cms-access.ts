/** Content management is available independently of experimental account writes. */
export function cmsContentWritesEnabled(environment?: string, setting?: string) {
  return ['local', 'test'].includes(environment ?? '') && setting !== 'disabled';
}

export const vocabularyWorkbookImportPath = 'learning/admin/vocabularies/import';
export const MAX_VOCABULARY_IMPORT_BYTES = 4 * 1024 * 1024;

export function isTopicVocabularyDeletion(path: string, method: string) {
  return (
    method === 'DELETE' && /^learning\/admin\/vocabulary-topics\/[^/]+\/vocabularies$/.test(path)
  );
}

export function isCmsContentMutation(path: string, method: string) {
  const collection =
    '(questions|question-groups|tests|learning/admin/(lessons|vocabularies|vocabulary-topics))';
  return (
    (method === 'POST' && new RegExp(`^${collection}$`).test(path)) ||
    (method === 'POST' &&
      (path === 'learning/admin/vocabularies/bulk' || path === vocabularyWorkbookImportPath)) ||
    isTopicVocabularyDeletion(path, method) ||
    (['PATCH', 'DELETE'].includes(method) && new RegExp(`^${collection}/[^/]+$`).test(path)) ||
    (method === 'POST' &&
      (/^(questions|question-groups)\/[^/]+\/media\/presign$/.test(path) ||
        /^learning\/vocabularies\/[^/]+\/media\/(presign|confirm)$/.test(path)))
  );
}
