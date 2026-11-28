/** Personal learning data belongs to the authenticated learner, never the shared catalog. */
export function isPersonalLearningRoute(path: string, method: string): boolean {
  const collection = /^learning\/personal\/(vocabulary-topics|vocabularies|lessons)$/;
  const item = /^learning\/personal\/(vocabulary-topics|vocabularies|lessons)\/[^/]+$/;
  return (
    (method === 'GET' && (collection.test(path) || item.test(path))) ||
    (method === 'POST' && collection.test(path)) ||
    (['PATCH', 'DELETE'].includes(method) && item.test(path))
  );
}

export function isPersonalLearningMutation(path: string, method: string): boolean {
  return method !== 'GET' && isPersonalLearningRoute(path, method);
}
