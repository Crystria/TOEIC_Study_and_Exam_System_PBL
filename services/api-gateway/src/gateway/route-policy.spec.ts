import { RoleCode } from '@toeic/common';
import {
  ipRateLimitPolicy,
  isPublicPath,
  isSubmitPath,
  isTestAttemptStart,
  matchRoute,
  normalizePath,
  proxyTimeoutMs,
  requiredRoles,
  userRateLimitPolicy,
} from './route-policy';

describe('route policy', () => {
  it('normalizes paths and query strings', () => {
    expect(normalizePath('/api/v1/tests/?page=1')).toBe('/api/v1/tests');
    expect(normalizePath('/')).toBe('/');
  });

  it('maps upstream prefixes', () => {
    expect(matchRoute('/api/v1/question-groups/123')?.upstream).toBe('QUESTION_BANK_SERVICE_URL');
    expect(matchRoute('/api/v1/tests/123/part-attempts')?.upstream).toBe('EXAM_SERVICE_URL');
    expect(matchRoute('/api/v1/unknown')).toBeUndefined();
  });

  it('allows public auth and health paths only', () => {
    expect(isPublicPath('/api/v1/auth/login')).toBe(true);
    for (const path of ['/api/v1/auth/forgot-password', '/api/v1/auth/reset-password']) {
      expect(isPublicPath(path, 'POST')).toBe(true);
      expect(isPublicPath(path, 'GET')).toBe(false);
      expect(ipRateLimitPolicy('POST', path, false)?.bucket).toBe('password-recovery');
    }
    expect(isPublicPath('/api/v1/auth/change-password', 'POST')).toBe(false);
    expect(userRateLimitPolicy('POST', '/api/v1/auth/change-password').bucket).toBe(
      'change-password',
    );
    expect(isPublicPath('/api/v1/auth/me')).toBe(false);
    expect(isPublicPath('/health')).toBe(true);
    expect(isPublicPath('/status/')).toBe(true);
  });

  it('allows users to start full and part attempts', () => {
    expect(isTestAttemptStart('POST', '/api/v1/tests/t1/attempts')).toBe(true);
    expect(isTestAttemptStart('POST', '/api/v1/tests/t1/part-attempts')).toBe(true);
    expect(requiredRoles('POST', '/api/v1/tests/t1/attempts')).toEqual([]);
    expect(requiredRoles('POST', '/api/v1/tests/t1/part-attempts')).toEqual([]);
  });

  it('keeps user administration and search reindexing with system admins', () => {
    expect(requiredRoles('GET', '/api/v1/admin/users')).toEqual([RoleCode.SYSTEM_ADMIN]);
    expect(requiredRoles('GET', '/api/v1/admin/users/1')).toEqual([RoleCode.SYSTEM_ADMIN]);
    expect(requiredRoles('POST', '/api/v1/questions/reindex')).toEqual([RoleCode.SYSTEM_ADMIN]);
  });

  it('reserves all test mutations for content admins while keeping test reads available', () => {
    for (const [method, path] of [
      ['POST', '/api/v1/tests'],
      ['PATCH', '/api/v1/tests/t1'],
      ['DELETE', '/api/v1/tests/t1/'],
    ])
      expect(requiredRoles(method, path)).toEqual([RoleCode.CONTENT_ADMIN]);
    expect(requiredRoles('GET', '/api/v1/tests/t1')).toEqual([]);
    expect(matchRoute('/api/v1/tests')?.writeRoles).toEqual([RoleCode.CONTENT_ADMIN]);
  });

  it('applies ip limits to auth and anonymous traffic', () => {
    expect(ipRateLimitPolicy('OPTIONS', '/api/v1/auth/login', false)).toBeUndefined();
    expect(ipRateLimitPolicy('GET', '/health', false)).toBeUndefined();
    expect(ipRateLimitPolicy('POST', '/api/v1/auth/login', false)?.bucket).toBe('auth');
    expect(ipRateLimitPolicy('GET', '/api/v1/tests', false)?.bucket).toBe('anonymous');
    expect(ipRateLimitPolicy('GET', '/api/v1/tests', true)).toBeUndefined();
  });

  it('selects user limits by action', () => {
    expect(userRateLimitPolicy('POST', '/api/v1/attempts/a1/submit').bucket).toBe('submit');
    expect(userRateLimitPolicy('POST', '/api/v1/question-groups/g1/media/presign').bucket).toBe(
      'presign',
    );
    expect(userRateLimitPolicy('POST', '/api/v1/ai/chat').bucket).toBe('ai');
    expect(userRateLimitPolicy('GET', '/api/v1/tests').bucket).toBe('read');
  });

  it('uses longer timeouts for attempt submit, workbook import and topic vocabulary deletion', () => {
    expect(isSubmitPath('POST', '/api/v1/attempts/a1/submit')).toBe(true);
    expect(proxyTimeoutMs('POST', '/api/v1/attempts/a1/submit')).toBe(15_000);
    const importPath = '/api/v1/learning/admin/vocabularies/import';
    expect(proxyTimeoutMs('POST', importPath)).toBe(30_000);
    expect(proxyTimeoutMs('GET', importPath)).toBe(5_000);
    expect(requiredRoles('POST', importPath)).toEqual([RoleCode.CONTENT_ADMIN]);
    const clearTopicPath = '/api/v1/learning/admin/vocabulary-topics/t1/vocabularies';
    expect(proxyTimeoutMs('DELETE', clearTopicPath)).toBe(30_000);
    expect(proxyTimeoutMs('GET', clearTopicPath)).toBe(5_000);
    expect(requiredRoles('DELETE', clearTopicPath)).toEqual([RoleCode.CONTENT_ADMIN]);
    expect(proxyTimeoutMs('POST', '/api/v1/tests')).toBe(5_000);
  });
});

describe('P1 public methods and Learning roles', () => {
  it('only allows POST email activation endpoints without JWT', () => {
    expect(isPublicPath('/api/v1/auth/verify-email', 'POST')).toBe(true);
    expect(isPublicPath('/api/v1/auth/verify-email', 'GET')).toBe(false);
    expect(isPublicPath('/api/v1/auth/logout', 'POST')).toBe(false);
  });
  it('requires content role for Learning admin reads and media writes', () => {
    expect(requiredRoles('GET', '/api/v1/learning/admin/lessons')).toEqual([
      RoleCode.CONTENT_ADMIN,
    ]);
    expect(requiredRoles('POST', '/api/v1/learning/vocabularies/id/media/confirm')).toEqual([
      RoleCode.CONTENT_ADMIN,
    ]);
  });
});
