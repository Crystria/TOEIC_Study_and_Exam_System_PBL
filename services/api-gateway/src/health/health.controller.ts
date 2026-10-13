import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() };
  }

  @Get('status')
  status(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
