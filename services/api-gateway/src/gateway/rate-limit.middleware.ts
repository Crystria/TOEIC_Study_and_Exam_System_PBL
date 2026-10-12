import { ConfigService } from '@nestjs/config';
import { RequestHandler } from 'express';
import { RedisService } from '@toeic/common';

/**
 * Rate limit Token Bucket cho API công khai (register/login/refresh, ...).
 * Key = IP + nhóm route.
 */
export function createRateLimitMiddleware(
  redis: RedisService,
  config: ConfigService,
): RequestHandler {
  const capacity = Number(config.get<number>('RATE_LIMIT_CAPACITY') ?? 60);
  const refill = Number(config.get<number>('RATE_LIMIT_REFILL_PER_SEC') ?? 1);

  return async (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const ip = req.ip ?? 'unknown';
    const group = req.path.split('/').slice(0, 4).join('/');
    const allowed = await redis.consumeToken(`ratelimit:${ip}:${group}`, capacity, refill);
    if (!allowed) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({ statusCode: 429, message: 'Too Many Requests' });
      return;
    }
    next();
  };
}
