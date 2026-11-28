import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { probe, Public, RedisService } from '@toeic/common';
import { PrismaService } from '../prisma/prisma.service';
@Controller()
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}
  @Public()
  @Get('ready')
  async ready() {
    const result = await probe({ postgres: () => this.prisma.$queryRaw`SELECT 1` });
    if (!result.ready)
      throw new ServiceUnavailableException({ status: 'unavailable', checks: result.checks });
    // Search and idempotency cache degrade without preventing DB-backed reads/writes.
    return {
      status: 'ready',
      checks: result.checks,
      cache: this.redis.getClient().status === 'ready' ? 'ok' : 'degraded',
    };
  }
}
