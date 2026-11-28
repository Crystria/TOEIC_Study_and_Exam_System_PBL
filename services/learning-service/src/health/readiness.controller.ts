import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public, RedisService, probe } from '@toeic/common';
import { PrismaService } from '../prisma/prisma.service';
@Controller()
export class ReadinessController {
  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
  ) {}
  @Public() @Get('ready') async ready() {
    const r = await probe({
      postgres: () => this.db.$queryRaw`SELECT 1`,
      redis: () => this.redis.getClient().ping(),
    });
    if (!r.ready) throw new ServiceUnavailableException({ checks: r.checks });
    return { status: 'ready', checks: r.checks };
  }
}
