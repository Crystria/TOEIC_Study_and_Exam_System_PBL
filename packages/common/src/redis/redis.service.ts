import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * Token Bucket rate limiter (dùng cho AI: 20 tin nhắn/ngày/user).
   * Trả về true nếu request được phép.
   */
  async consumeToken(
    key: string,
    maxTokens: number,
    refillPerSecond: number,
  ): Promise<boolean> {
    const now = Date.now();
    const lua = `
      local key = KEYS[1]
      local maxTokens = tonumber(ARGV[1])
      local refill = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local data = redis.call('HMGET', key, 'tokens', 'ts')
      local tokens = tonumber(data[1]) or maxTokens
      local ts = tonumber(data[2]) or now
      local delta = math.max(0, now - ts) / 1000.0
      tokens = math.min(maxTokens, tokens + delta * refill)
      local allowed = tokens >= 1
      if allowed then tokens = tokens - 1 end
      redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
      redis.call('EXPIRE', key, 86400)
      return allowed and 1 or 0
    `;
    const result = (await this.client.eval(lua, 1, key, maxTokens, refillPerSecond, now)) as number;
    return result === 1;
  }
}
