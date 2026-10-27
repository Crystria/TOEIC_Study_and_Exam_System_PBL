import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@toeic/common';
import { Request, RequestHandler } from 'express';
import { sendGatewayError } from './http-error';
import { isPublicPath, normalizePath } from './route-policy';

export interface JwtMiddlewareOptions {
  secret: string;
  issuer: string;
  audience: string;
}

type AuthenticatedRequest = Request & { user?: JwtPayload };

function stripClientUserHeaders(req: Request): void {
  for (const header of Object.keys(req.headers)) {
    if (header.startsWith('x-user-')) {
      delete req.headers[header];
    }
  }
}

function extractBearerToken(req: Request): string | undefined {
  const [type, token] = req.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' && token ? token : undefined;
}

export function createJwtMiddleware(
  jwt: JwtService,
  options: JwtMiddlewareOptions,
): RequestHandler {
  return async (req, res, next) => {
    stripClientUserHeaders(req);

    if (req.method === 'OPTIONS') {
      return next();
    }

    const path = normalizePath(req.path);
    if (isPublicPath(path) || !path.startsWith('/api/v1')) {
      return next();
    }

    const token = extractBearerToken(req);
    if (!token) {
      sendGatewayError(req, res, 401, 'UNAUTHORIZED', 'Missing access token');
      return;
    }

    try {
      const payload = await jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
        secret: options.secret,
        issuer: options.issuer,
        audience: options.audience,
      });

      const claims = payload as JwtPayload & { exp?: number };
      if (
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        typeof claims.exp !== 'number' ||
        !Number.isFinite(claims.exp) ||
        !Array.isArray(payload.roles) ||
        !payload.roles.every((role) => typeof role === 'string')
      ) {
        throw new Error('Invalid access token payload');
      }

      (req as AuthenticatedRequest).user = payload;
      req.headers['x-user-id'] = payload.sub;
      req.headers['x-user-roles'] = (payload.roles ?? []).join(',');
      return next();
    } catch {
      sendGatewayError(req, res, 401, 'UNAUTHORIZED', 'Invalid or expired access token');
      return;
    }
  };
}
