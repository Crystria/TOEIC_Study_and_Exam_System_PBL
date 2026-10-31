import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { probe, RedisService } from '@toeic/common';
@Controller()
export class ReadinessController {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}
  @Get('ready')
  async ready() {
    const checks: Record<string, () => Promise<unknown>> = {
      redis: () => this.redis.getClient().ping(),
    };
    for (const [name, key, path] of [
      ['auth', 'AUTH_SERVICE_URL', '/api/v1/ready'],
      ['questions', 'QUESTION_BANK_SERVICE_URL', '/api/v1/ready'],
      ['exam', 'EXAM_SERVICE_URL', '/api/v1/ready'],
      ['analytics', 'ANALYTICS_SERVICE_URL', '/api/v1/ready'],
    ]) {
      checks[name] = async () => {
        const target = this.config.get<string>(key);
        if (!target) throw new Error('Missing target');
        const response = await fetch(`${target}${path}`, { signal: AbortSignal.timeout(1200) });
        await response.body?.cancel();
        if (!response.ok) throw new Error('Upstream not ready');
      };
    }
    const result = await probe(checks);
    if (!result.ready)
      throw new ServiceUnavailableException({ status: 'unavailable', checks: result.checks });
    return {
      status: 'ready',
      checks: result.checks,
      qa: this.config.get<string>('QA_MODE') === 'true',
    };
  }
}
