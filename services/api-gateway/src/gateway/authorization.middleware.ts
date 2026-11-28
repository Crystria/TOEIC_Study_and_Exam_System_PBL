import { JwtPayload } from '@toeic/common';
import { Request, RequestHandler } from 'express';
import { sendGatewayError } from './http-error';
import { requiredRoles } from './route-policy';

type AuthenticatedRequest = Request & { user?: JwtPayload };

export function createAuthorizationMiddleware(): RequestHandler {
  return (req, res, next) => {
    const roles = requiredRoles(req.method, req.path);
    if (roles.length === 0) {
      return next();
    }

    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendGatewayError(req, res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }

    const allowed = roles.some((role) => user.roles?.includes(role));
    if (!allowed) {
      sendGatewayError(req, res, 403, 'FORBIDDEN', 'Insufficient permissions');
      return;
    }

    return next();
  };
}
