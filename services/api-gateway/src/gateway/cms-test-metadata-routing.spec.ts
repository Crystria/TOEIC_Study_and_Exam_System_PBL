import { isPublicPath, matchRoute, requiredRoles } from './route-policy';

describe('CMS metadata routes under the current Gateway policy', () => {
  it.each([
    '/api/v1/tests/cms-metadata',
    '/api/v1/tests/cms-metadata/demo-test-002?keyword=fixture',
    '/api/v1/tests',
    '/api/v1/tests/demo-test-001',
  ])('routes authenticated GET %s to Exam', (path) => {
    expect(matchRoute(path)?.upstream).toBe('EXAM_SERVICE_URL');
    expect(isPublicPath(path, 'GET')).toBe(false);
    // Exam enforces the stricter CONTENT_ADMIN policy for CMS metadata reads.
    expect(requiredRoles('GET', path)).toEqual([]);
  });
});
