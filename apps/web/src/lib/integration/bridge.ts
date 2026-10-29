import { createHash } from 'node:crypto';
import { ContractError, parseTokens, parseUser } from './contracts';

export interface BridgeConfig {
  app: 'web' | 'cms';
  enabled: boolean;
  environment?: string;
  gatewayUrl?: string;
  metadataVerified?: boolean;
  writesEnabled?: boolean;
  fetcher?: typeof fetch;
}
type Tokens = ReturnType<typeof parseTokens>;
class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super('Gateway request failed');
  }
}
// A short handoff window avoids rotating the same token twice in concurrent requests.
// Single Node process only; multi-instance deployments need a shared session coordinator.
const rotating = new Map<string, { task: Promise<Tokens>; expires: number }>();
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function permitted(app: BridgeConfig['app'], path: string, method: string): boolean {
  if (method === 'GET') {
    if (/^users\/me$/.test(path)) return true;
    if (
      /^learning\/(vocabulary-topics|vocabularies|lessons(?:\/[^/]+)?|review-today|progress)$/.test(
        path,
      )
    )
      return true;
    if (/^tests(?:\/[^/]+)?$/.test(path)) return true;
    if (app === 'cms' && /^tests\/cms-metadata(?:\/[^/]+)?$/.test(path)) return true;
    if (app === 'cms' && /^(questions(?:\/[^/]+)?|admin\/(users|audit-logs))$/.test(path))
      return true;
    return (
      app === 'web' &&
      /^(analytics\/(progress|scores|streak|weak-areas|prediction)|attempts\/[^/]+)$/.test(path)
    );
  }
  if (method === 'PATCH' && path === 'users/me') return true;
  if (
    app === 'web' &&
    method === 'POST' &&
    /^learning\/(flashcards\/[^/]+\/review|lessons\/[^/]+\/complete)$/.test(path)
  )
    return true;
  if (app !== 'cms') return false;
  return (
    (method === 'POST' && /^(questions|tests)$/.test(path)) ||
    (method === 'PATCH' &&
      /^(questions\/[^/]+|tests\/[^/]+|admin\/users\/[^/]+\/(roles|status))$/.test(path)) ||
    (method === 'DELETE' && /^questions\/[^/]+$/.test(path))
  );
}
export function requiredRoles(path: string, method: string): readonly string[] {
  if (path.startsWith('admin/')) return ['SYSTEM_ADMIN'];
  if (path.startsWith('tests/cms-metadata')) return ['CONTENT_ADMIN'];
  if (path.startsWith('questions') || (path.startsWith('tests') && method !== 'GET'))
    return ['CONTENT_ADMIN', 'SYSTEM_ADMIN'];
  return [];
}

export async function handleBridge(
  request: Request,
  parts: string[],
  config: BridgeConfig,
): Promise<Response> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, private',
    Vary: 'Cookie',
  });
  const respond = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  const url = new URL(request.url),
    method = request.method;
  if (
    !config.enabled ||
    !['local', 'test'].includes(config.environment ?? '') ||
    !config.gatewayUrl
  )
    return respond({ code: 'API_NOT_CONFIGURED' }, 503);
  let upstream: URL;
  try {
    upstream = new URL(config.gatewayUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname);
    if (
      upstream.username ||
      upstream.password ||
      upstream.search ||
      upstream.hash ||
      upstream.pathname.replace(/\/$/, '') !== '/api/v1' ||
      (config.environment === 'local'
        ? !local || !['http:', 'https:'].includes(upstream.protocol)
        : upstream.protocol !== 'https:')
    )
      throw new Error();
  } catch {
    return respond({ code: 'INVALID_LOCAL_TEST_GATEWAY' }, 503);
  }
  if (writeMethods.has(method) && request.headers.get('origin') !== url.origin)
    return respond({ code: 'ORIGIN_REJECTED' }, 403);
  if (
    !parts.length ||
    parts.some(
      (p) =>
        !p.trim() ||
        p === '.' ||
        p === '..' ||
        /[\u0000-\u001f]/.test(p) ||
        /^(demo-|local-)/i.test(p),
    )
  )
    return respond({ code: 'PATH_REJECTED' }, 400);
  const path = parts.map(encodeURIComponent).join('/');
  const cookiePrefix = `toeic_${config.app}_`;
  const cookie = (key: string) => {
    const raw = request.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookiePrefix}${key}=`));
    try {
      return raw ? decodeURIComponent(raw.slice(raw.indexOf('=') + 1)) : '';
    } catch {
      return '';
    }
  };
  let tokens: Tokens = { accessToken: cookie('access'), refreshToken: cookie('refresh') };
  const setCookie = (key: string, value: string, age: number) =>
    headers.append(
      'Set-Cookie',
      `${cookiePrefix}${key}=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/api/frontend; Max-Age=${age}${url.protocol === 'https:' ? '; Secure' : ''}`,
    );
  const persist = () => {
    setCookie('access', tokens.accessToken, 7 * 86400);
    setCookie('refresh', tokens.refreshToken, 7 * 86400);
  };
  const clear = () => {
    setCookie('access', '', 0);
    setCookie('refresh', '', 0);
  };
  const fetcher = config.fetcher ?? fetch;
  async function call(
    target: string,
    verb: string,
    body?: unknown,
    access = tokens.accessToken,
  ): Promise<unknown> {
    const response = await fetcher(`${upstream.href.replace(/\/$/, '')}/${target}`, {
      method: verb,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload: unknown =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new HttpFailure(response.status, payload);
    return payload;
  }
  async function rotate() {
    if (!tokens.refreshToken) throw new HttpFailure(401, { code: 'SESSION_REQUIRED' });
    const key = createHash('sha256')
      .update(`${config.app}:${upstream.origin}:${tokens.refreshToken}`)
      .digest('hex');
    for (const [k, v] of rotating) if (v.expires < Date.now()) rotating.delete(k);
    let entry = rotating.get(key);
    if (!entry) {
      entry = {
        task: call('auth/refresh', 'POST', { refreshToken: tokens.refreshToken }, '').then(
          parseTokens,
        ),
        expires: Date.now() + 15_000,
      };
      rotating.set(key, entry);
    }
    try {
      tokens = await entry.task;
      persist();
    } catch (error) {
      rotating.delete(key);
      throw error;
    }
  }
  async function me() {
    if (!tokens.accessToken && !tokens.refreshToken)
      throw new HttpFailure(401, { code: 'SESSION_REQUIRED' });
    try {
      return parseUser(await call('users/me', 'GET'));
    } catch (error) {
      if (!(error instanceof HttpFailure) || error.status !== 401) throw error;
      await rotate();
      return parseUser(await call('users/me', 'GET'));
    }
  }
  try {
    let body: unknown;
    if (writeMethods.has(method)) {
      if (Number(request.headers.get('content-length') ?? 0) > 1_048_576)
        return respond({ code: 'BODY_TOO_LARGE' }, 413);
      const source = await request.text();
      if (source.length > 1_048_576) return respond({ code: 'BODY_TOO_LARGE' }, 413);
      try {
        body = source ? JSON.parse(source) : undefined;
      } catch {
        return respond({ code: 'INVALID_JSON' }, 400);
      }
    }
    if (['auth/login', 'auth/register'].includes(path) && method === 'POST') {
      if (config.app === 'cms' && path === 'auth/register')
        return respond({ code: 'CMS_REGISTRATION_DISABLED' }, 403);
      if (path === 'auth/register' && !config.writesEnabled)
        return respond({ code: 'ISOLATED_TEST_WRITES_NOT_ENABLED' }, 503);
      const result = await call(path, method, body, '');
      tokens = parseTokens(result);
      const user = parseUser(await call('users/me', 'GET'));
      if (user.status !== 'ACTIVE') {
        clear();
        return respond({ code: 'ACCOUNT_NOT_ACTIVE', status: user.status }, 403);
      }
      persist();
      return respond({ user }); // Raw tokens never reach browser JavaScript.
    }
    if (path === 'auth/logout' && method === 'POST') {
      // Always clear the local session, but do not claim server revocation on failure.
      try {
        await me();
        await call('auth/logout', 'POST', { refreshToken: tokens.refreshToken });
      } finally {
        clear();
      }
      return respond({ success: true });
    }
    if (path === 'auth/refresh' && method === 'POST') {
      await rotate();
      const user = await me();
      if (user.status !== 'ACTIVE') {
        clear();
        return respond({ code: 'ACCOUNT_NOT_ACTIVE' }, 403);
      }
      return respond({ user });
    }
    if (path === 'auth/session' && method === 'GET') {
      const user = await me();
      if (user.status !== 'ACTIVE') {
        clear();
        return respond({ code: 'ACCOUNT_NOT_ACTIVE' }, 403);
      }
      return respond({ user });
    }
    if (!permitted(config.app, path, method)) return respond({ code: 'CONTRACT_BLOCKED' }, 501);
    if (path.startsWith('tests/cms-metadata') && !config.metadataVerified)
      return respond({ code: 'METADATA_RUNTIME_VERIFICATION_REQUIRED' }, 503);
    if (writeMethods.has(method) && !config.writesEnabled)
      return respond({ code: 'ISOLATED_TEST_WRITES_NOT_ENABLED' }, 503);
    const user = await me();
    if (user.status !== 'ACTIVE') {
      clear();
      return respond({ code: 'ACCOUNT_NOT_ACTIVE' }, 403);
    }
    const roles = requiredRoles(path, method);
    if (roles.length && !roles.some((role) => user.roles.includes(role)))
      return respond({ code: 'INSUFFICIENT_PERMISSIONS' }, 403);
    // A mutation is never automatically replayed after a 401/network error.
    return respond(await call(`${path}${url.search}`, method, body));
  } catch (error) {
    if (error instanceof HttpFailure) {
      if (error.status === 401) clear();
      // Preserve validation detail; never forward arbitrary upstream headers/cookies.
      return respond({ code: 'GATEWAY_ERROR', details: error.payload }, error.status);
    }
    if (error instanceof ContractError)
      return respond({ code: 'INVALID_GATEWAY_RESPONSE', field: error.field }, 502);
    return respond(
      { code: 'GATEWAY_UNAVAILABLE' },
      error instanceof Error && /timeout/i.test(error.name) ? 504 : 502,
    );
  }
}
