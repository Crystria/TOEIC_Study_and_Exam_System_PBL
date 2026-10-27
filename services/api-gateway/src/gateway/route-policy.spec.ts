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
    expect(matchRoute('/api/v1/question-groups/123')?.upstream).toBe(
      'QUESTION_BANK_SERVICE_URL',
    );
    expect(matchRoute('/api/v1/tests/123/part-attempts')?.upstream).toBe(
      'EXAM_SERVICE_URL',
    );
    expect(matchRoute('/api/v1/unknown')).toBeUndefined();
  });

  it('allows public auth and health paths only', () => {
    expect(isPublicPath('/api/v1/auth/login')).toBe(true);
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

  it('requires admin roles for content writes', () => {
    expect(requiredRoles('POST', '/api/v1/questions')).toEqual([
      RoleCode.CONTENT_ADMIN,
      RoleCode.SYSTEM_ADMIN,
    ]);
    expect(requiredRoles('PATCH', '/api/v1/question-groups/g1')).toEqual([
      RoleCode.CONTENT_ADMIN,
      RoleCode.SYSTEM_ADMIN,
    ]);
    expect(requiredRoles('POST', '/api/v1/tests')).toEqual([
      RoleCode.CONTENT_ADMIN,
      RoleCode.SYSTEM_ADMIN,
    ]);
    expect(requiredRoles('GET', '/api/v1/tests')).toEqual([]);
    expect(requiredRoles('GET', '/api/v1/admin/users')).toEqual([
      RoleCode.SYSTEM_ADMIN,
    ]);
  });

  it('applies ip limits to auth and anonymous traffic', () => {
    expect(ipRateLimitPolicy('OPTIONS', '/api/v1/auth/login', false)).toBeUndefined();
    expect(ipRateLimitPolicy('GET', '/health', false)).toBeUndefined();
    expect(ipRateLimitPolicy('POST', '/api/v1/auth/login', false)?.bucket).toBe(
      'auth',
    );
    expect(ipRateLimitPolicy('GET', '/api/v1/tests', false)?.bucket).toBe(
      'anonymous',
    );
    expect(ipRateLimitPolicy('GET', '/api/v1/tests', true)).toBeUndefined();
  });

  it('selects user limits by action', () => {
    expect(userRateLimitPolicy('POST', '/api/v1/attempts/a1/submit').bucket).toBe(
      'submit',
    );
    expect(
      userRateLimitPolicy('POST', '/api/v1/question-groups/g1/media/presign').bucket,
    ).toBe('presign');
    expect(userRateLimitPolicy('POST', '/api/v1/ai/chat').bucket).toBe('ai');
    expect(userRateLimitPolicy('GET', '/api/v1/tests').bucket).toBe('read');
  });

  it('uses a longer timeout only for submit', () => {
    expect(isSubmitPath('POST', '/api/v1/attempts/a1/submit')).toBe(true);
    expect(proxyTimeoutMs('POST', '/api/v1/attempts/a1/submit')).toBe(15_000);
    expect(proxyTimeoutMs('POST', '/api/v1/tests')).toBe(5_000);
  });
});
