import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@toeic/common';

@ApiTags('health')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('status')
  status(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
