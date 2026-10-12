import { Controller, Get } from '@nestjs/common';
import { Public } from '@toeic/common';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'question-bank-service', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('status')
  status(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
