import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { probe, Public } from '@toeic/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('ready')
  async ready() {
    const result = await probe({ postgres: () => this.prisma.$queryRaw`SELECT 1` });
    if (!result.ready)
      throw new ServiceUnavailableException({ status: 'unavailable', checks: result.checks });
    return { status: 'ready', checks: result.checks };
  }
}
