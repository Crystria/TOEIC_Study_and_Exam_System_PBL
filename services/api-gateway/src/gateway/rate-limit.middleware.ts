import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, RedisService } from '@toeic/common';
import { Request, RequestHandler, Response } from 'express';
import { sendGatewayError } from './http-error';
import { ipRateLimitPolicy, RateLimitPolicy, userRateLimitPolicy } from './route-policy';

const logger = new Logger('GatewayRateLimit');

type AuthenticatedRequest = Request & { user?: JwtPayload };

function hasBearerToken(req: Request): boolean {
  return (
    typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
  );
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function consume(
  redis: RedisService,
  req: Request,
  res: Response,
  policy: RateLimitPolicy,
  identifier: string,
): Promise<boolean> {
  const key = `ratelimit:${policy.scope}:${identifier}:${policy.bucket}`;

  try {
    const allowed = await redis.consumeToken(key, policy.capacity, policy.refillPerSecond);
    if (!allowed) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(1 / policy.refillPerSecond))));
      sendGatewayError(req, res, 429, 'RATE_LIMITED', 'Too Many Requests');
      return false;
    }
    return true;
  } catch (error) {
    logger.warn(
      `Rate limit Redis unavailable for ${key}; failing open: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return true;
  }
}

export function createIpRateLimitMiddleware(
  redis: RedisService,
  config: ConfigService,
): RequestHandler {
  const anonymousCapacity = Number(config.get<string>('RATE_LIMIT_CAPACITY') ?? 60);
  const anonymousRefill = Number(config.get<string>('RATE_LIMIT_REFILL_PER_SEC') ?? 1);

  return async (req, res, next) => {
    const policy = ipRateLimitPolicy(req.method, req.path, hasBearerToken(req));
    if (!policy) {
      return next();
    }

    const effectivePolicy =
      policy.bucket === 'anonymous'
        ? {
            ...policy,
            capacity: anonymousCapacity,
            refillPerSecond: anonymousRefill,
          }
        : policy;

    const allowed = await consume(redis, req, res, effectivePolicy, clientIp(req));
    return allowed ? next() : undefined;
  };
}

export function createUserRateLimitMiddleware(
  redis: RedisService,
  config: ConfigService,
): RequestHandler {
  const readCapacity = Number(config.get<string>('RATE_LIMIT_USER_CAPACITY') ?? 300);
  const readRefill = Number(config.get<string>('RATE_LIMIT_USER_REFILL_PER_SEC') ?? 5);

  return async (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user?.sub) {
      return next();
    }

    const policy = userRateLimitPolicy(req.method, req.path);
    const effectivePolicy =
      policy.bucket === 'read'
        ? { ...policy, capacity: readCapacity, refillPerSecond: readRefill }
        : policy;

    const allowed = await consume(redis, req, res, effectivePolicy, user.sub);
    return allowed ? next() : undefined;
  };
}
