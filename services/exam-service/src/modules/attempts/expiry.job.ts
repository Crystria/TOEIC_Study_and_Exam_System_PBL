import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttemptsService } from './attempts.service';
@Injectable()
export class ExpiryJob implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<unknown>;
  private readonly logger = new Logger(ExpiryJob.name);
  constructor(
    private readonly attempts: AttemptsService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    const grace = Number(this.config.get('ATTEMPT_EXPIRY_GRACE_SECONDS') ?? 5);
    if (!Number.isInteger(grace) || grace < 0 || grace > 60)
      throw new Error('Invalid ATTEMPT_EXPIRY_GRACE_SECONDS');
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = this.attempts
        .expireDue(grace)
        .catch((error: Error) => this.logger.error(error.message))
        .finally(() => {
          this.running = undefined;
        });
    }, 60_000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
