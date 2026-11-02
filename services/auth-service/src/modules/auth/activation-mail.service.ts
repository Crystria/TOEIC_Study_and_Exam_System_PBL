import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityTx, tokenHash } from '../../identity';

/** Local Mailpit adapter. No SMTP relay or real email provider is configured by default. */
@Injectable()
export class ActivationMailService implements OnModuleInit, OnModuleDestroy {
  private readonly key: Buffer;
  private readonly mailpit: string;
  private readonly activationUrl: string;
  private readonly logger = new Logger(ActivationMailService.name);
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private closing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const inline = config.get<string>('AUTH_MAIL_ENCRYPTION_KEY'),
      file = config.get<string>('AUTH_MAIL_ENCRYPTION_KEY_FILE');
    if (inline && file) throw new Error('Configure one mail encryption key source');
    const key = (inline || (file ? readFileSync(file, 'utf8') : '')).trim();
    if (!/^[a-f0-9]{64}$/.test(key))
      throw new Error('AUTH_MAIL_ENCRYPTION_KEY must be 32 random hex bytes');
    this.key = Buffer.from(key, 'hex');
    this.mailpit = config.get<string>('MAILPIT_URL') || 'http://localhost:8025';
    this.activationUrl =
      config.get<string>('AUTH_ACTIVATION_URL') || 'http://localhost:3006/verify-email';
    for (const value of [this.mailpit, this.activationUrl])
      if (!['http:', 'https:'].includes(new URL(value).protocol))
        throw new Error('Invalid activation mail URL');
  }
  private encrypt(token: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    return Buffer.concat([
      iv,
      cipher.update(token, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64');
  }
  private decrypt(value: string): string {
    const bytes = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(
      'utf8',
    );
  }
  async enqueue(tx: IdentityTx, userId: string, isResend = false): Promise<void> {
    const token = randomBytes(32).toString('base64url'),
      expiresAt = new Date(Date.now() + 86400000);
    await tx.emailActivation.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.emailDelivery.updateMany({
      where: { userId, deliveredAt: null },
      data: { deliveredAt: new Date(), encryptedToken: null },
    });
    await tx.emailActivation.create({
      data: { userId, tokenHash: tokenHash(token), expiresAt, isResend },
    });
    await tx.emailDelivery.create({
      data: { userId, encryptedToken: this.encrypt(token), expiresAt },
    });
  }
  async onModuleInit() {
    // Fail fast on an unapplied P2 schema, before advertising healthy startup.
    await this.prisma.emailDelivery.count();
    this.timer = setInterval(() => {
      void this.drain().catch(() => this.logger.error('Activation mail polling failed'));
    }, 500);
    this.timer.unref();
  }
  drain(): Promise<void> {
    if (this.closing) return Promise.resolve();
    if (this.active) return this.active;
    this.active = this.run().finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  private async run(): Promise<void> {
    for (let n = 0; n < 20 && !this.closing; n++) {
      const owner = randomUUID();
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; user_id: string; encrypted_token: string; expires_at: Date }>
      >`
        WITH pending AS (SELECT id FROM email_deliveries WHERE delivered_at IS NULL
          AND next_attempt_at<=timezone('UTC',now()) AND (lease_until IS NULL OR lease_until<now())
          ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE email_deliveries e SET lease_owner=${owner},lease_until=now()+interval '30 seconds'
        FROM pending WHERE e.id=pending.id RETURNING e.id,e.user_id,e.encrypted_token,e.expires_at`;
      const job = rows[0];
      if (!job) return;
      try {
        const user = await this.prisma.user.findUnique({ where: { id: job.user_id } });
        if (user?.status === 'INACTIVE' && job.expires_at > new Date() && job.encrypted_token) {
          const token = this.decrypt(job.encrypted_token);
          // A newer resend/verification can supersede a claimed job. Never deliver a stale token intentionally.
          const activation = await this.prisma.emailActivation.findUnique({
            where: { tokenHash: tokenHash(token) },
          });
          if (activation && !activation.consumedAt) {
            const link = new URL(this.activationUrl);
            link.searchParams.set('token', token);
            const result = await fetch(new URL('/api/v1/send', this.mailpit), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(4000),
              redirect: 'error',
              body: JSON.stringify({
                From: {
                  Email: this.config.get<string>('MAIL_FROM') || 'noreply@toeic.local',
                  Name: 'TOEIC',
                },
                To: [{ Email: user.email }],
                Subject: 'Activate your TOEIC account',
                Text: `Activate your account: ${link.toString()}`,
              }),
            });
            await result.body?.cancel();
            if (!result.ok) throw new Error('MAIL_PROVIDER_REJECTED');
          }
        }
        await this.prisma.emailDelivery.updateMany({
          where: { id: job.id, leaseOwner: owner },
          data: {
            deliveredAt: new Date(),
            encryptedToken: null,
            leaseOwner: null,
            leaseUntil: null,
          },
        });
      } catch {
        await this.prisma.emailDelivery.updateMany({
          where: { id: job.id, leaseOwner: owner },
          data: {
            retryCount: { increment: 1 },
            nextAttemptAt: new Date(Date.now() + 5000),
            leaseOwner: null,
            leaseUntil: null,
          },
        });
        this.logger.warn(`Activation delivery ${job.id} will retry`);
      }
    }
  }
  async onModuleDestroy() {
    this.closing = true;
    clearInterval(this.timer);
    await this.active;
  }
}
