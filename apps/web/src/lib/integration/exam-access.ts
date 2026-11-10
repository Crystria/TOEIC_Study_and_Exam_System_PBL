/** Student attempts are a normal feature, independent of experimental content writes. */
export function examWritesEnabled(environment?: string, setting?: string) {
  return ['local', 'test'].includes(environment ?? '') && setting !== 'disabled';
}

export function isExamMutation(path: string, method: string) {
  return (
    (method === 'POST' &&
      /^(tests\/[^/]+\/(attempts|part-attempts)|attempts\/[^/]+\/submit)$/.test(path)) ||
    (method === 'PUT' && /^attempts\/[^/]+\/(draft|answers\/[^/]+)$/.test(path))
  );
}
