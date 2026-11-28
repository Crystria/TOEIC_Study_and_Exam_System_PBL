import { RequestHandler } from 'express';
import { sendGatewayError } from './http-error';
import { normalizePath } from './route-policy';

export const gatewayNotFoundMiddleware: RequestHandler = (req, res, next) => {
  const path = normalizePath(req.path);
  if (path.startsWith('/api/v1')) {
    sendGatewayError(req, res, 404, 'NOT_FOUND', 'Route not found');
    return;
  }
  next();
};
