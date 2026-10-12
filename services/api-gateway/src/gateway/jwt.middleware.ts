import { JwtService } from '@nestjs/jwt';
import { RequestHandler } from 'express';

const PUBLIC_PATHS = new Set([
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/health',
  '/status',
]);

/**
 * Xác thực JWT tại edge. Bỏ qua các public path và preflight.
 * Forward nguyên Authorization header tới upstream.
 */
export function createJwtMiddleware(jwt: JwtService): RequestHandler {
  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const path = req.path;
    if (PUBLIC_PATHS.has(path) || !path.startsWith('/api/v1')) {
      return next();
    }

    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      res.status(401).json({ statusCode: 401, message: 'Missing access token' });
      return;
    }
    try {
      await jwt.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
      });
      next();
    } catch {
      res.status(401).json({ statusCode: 401, message: 'Invalid or expired access token' });
    }
  };
}
