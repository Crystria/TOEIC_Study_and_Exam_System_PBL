import { RoleCode } from '@toeic/common';

export type UpstreamConfigKey =
  | 'AUTH_SERVICE_URL'
  | 'QUESTION_BANK_SERVICE_URL'
  | 'EXAM_SERVICE_URL'
  | 'LEARNING_SERVICE_URL'
  | 'ANALYTICS_SERVICE_URL'
  | 'AI_CHATBOX_SERVICE_URL';

export interface RouteRule {
  prefix: string;
  upstream: UpstreamConfigKey;
  auth: 'public' | 'jwt';
  writeRoles?: RoleCode[];
}

export interface RateLimitPolicy {
  bucket: string;
  scope: 'ip' | 'user';
  capacity: number;
  refillPerSecond: number;
}

export const ROUTES: RouteRule[] = [
  { prefix: '/api/v1/auth', upstream: 'AUTH_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/users', upstream: 'AUTH_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/admin', upstream: 'AUTH_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/sync', upstream: 'AUTH_SERVICE_URL', auth: 'jwt' },
  {
    prefix: '/api/v1/questions',
    upstream: 'QUESTION_BANK_SERVICE_URL',
    auth: 'jwt',
    writeRoles: [RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN],
  },
  {
    prefix: '/api/v1/question-groups',
    upstream: 'QUESTION_BANK_SERVICE_URL',
    auth: 'jwt',
    writeRoles: [RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN],
  },
  {
    prefix: '/api/v1/tests',
    upstream: 'EXAM_SERVICE_URL',
    auth: 'jwt',
    writeRoles: [RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN],
  },
  { prefix: '/api/v1/attempts', upstream: 'EXAM_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/learning', upstream: 'LEARNING_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/analytics', upstream: 'ANALYTICS_SERVICE_URL', auth: 'jwt' },
  { prefix: '/api/v1/ai', upstream: 'AI_CHATBOX_SERVICE_URL', auth: 'jwt' },
];

export const PUBLIC_PATHS = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/health',
  '/status',
]);

const AUTH_PUBLIC_PREFIXES = [
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
];

const TEST_ATTEMPT_START = /^\/api\/v1\/tests\/[^/]+\/(?:part-)?attempts$/;
const SUBMIT_PATH = /^\/api\/v1\/attempts\/[^/]+\/submit$/;

export function normalizePath(path: string): string {
  const withoutQuery = path.split('?')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || '/';
}

export function isHealthPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === '/health' || normalized === '/status';
}

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(normalizePath(path));
}

export function isAuthPublicPath(path: string): boolean {
  const normalized = normalizePath(path);
  return AUTH_PUBLIC_PREFIXES.includes(normalized);
}

export function matchPrefix(path: string, prefix: string): boolean {
  const normalized = normalizePath(path);
  return normalized === prefix || normalized.startsWith(`${prefix}/`);
}

export function matchRoute(path: string): RouteRule | undefined {
  return ROUTES.find((route) => matchPrefix(path, route.prefix));
}

export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export function isTestAttemptStart(method: string, path: string): boolean {
  return method === 'POST' && TEST_ATTEMPT_START.test(normalizePath(path));
}

export function isSubmitPath(method: string, path: string): boolean {
  return method === 'POST' && SUBMIT_PATH.test(normalizePath(path));
}

export function isPresignPath(method: string, path: string): boolean {
  return method === 'POST' && /\/media\/presign$/.test(normalizePath(path));
}

export function requiredRoles(method: string, path: string): RoleCode[] {
  const normalized = normalizePath(path);

  if (matchPrefix(normalized, '/api/v1/admin')) {
    return [RoleCode.SYSTEM_ADMIN];
  }

  if (isSafeMethod(method) || isTestAttemptStart(method, normalized)) {
    return [];
  }

  if (
    matchPrefix(normalized, '/api/v1/questions') ||
    matchPrefix(normalized, '/api/v1/question-groups') ||
    matchPrefix(normalized, '/api/v1/tests')
  ) {
    return [RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN];
  }

  return [];
}

export function ipRateLimitPolicy(
  method: string,
  path: string,
  hasBearerToken: boolean,
): RateLimitPolicy | undefined {
  if (method === 'OPTIONS' || isHealthPath(path)) {
    return undefined;
  }

  if (isAuthPublicPath(path)) {
    return { bucket: 'auth', scope: 'ip', capacity: 10, refillPerSecond: 10 / 60 };
  }

  if (!hasBearerToken) {
    return { bucket: 'anonymous', scope: 'ip', capacity: 60, refillPerSecond: 1 };
  }

  return undefined;
}

export function userRateLimitPolicy(method: string, path: string): RateLimitPolicy {
  if (isPresignPath(method, path)) {
    return { bucket: 'presign', scope: 'user', capacity: 30, refillPerSecond: 30 / 3600 };
  }
  if (isSubmitPath(method, path)) {
    return { bucket: 'submit', scope: 'user', capacity: 30, refillPerSecond: 0.5 };
  }
  if (matchPrefix(path, '/api/v1/ai')) {
    // The AI service owns the daily message quota; this is only an edge traffic limit.
    return { bucket: 'ai', scope: 'user', capacity: 60, refillPerSecond: 1 };
  }
  return { bucket: 'read', scope: 'user', capacity: 300, refillPerSecond: 5 };
}

export function proxyTimeoutMs(method: string, path: string): number {
  return isSubmitPath(method, path) ? 15_000 : 5_000;
}
