import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { serviceAuthSecret, learningServiceToken, ProgressSnapshot } from '@toeic/common';
import { validateRequest } from '@toeic/contracts/p0/runtime.cjs';
export interface LedgerResult {
  userId: string;
  operationId: string;
  status: 'APPLIED' | 'REJECTED';
  reason: string | null;
  actionHash: string;
  progress: ProgressSnapshot[];
}
export interface ProjectionPage {
  items: ProgressSnapshot[];
  nextCursor: string | null;
  asOf: string;
  revisionWatermark: string;
}
@Injectable()
export class LearningClient {
  private readonly secret: string;
  private readonly base: string;
  constructor(config: ConfigService) {
    this.secret = serviceAuthSecret(config);
    this.base = (config.get<string>('LEARNING_INTERNAL_URL') || 'http://localhost:3004').replace(
      /\/$/,
      '',
    );
  }
  private async get(path: string, scope: 'learning:progress:read' | 'learning:operations:read') {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(this.base + path, {
        headers: { Authorization: 'Bearer ' + (await learningServiceToken(this.secret, scope)) },
        signal: controller.signal,
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('LEARNING_UNAVAILABLE');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async ledger(userId: string, operationId: string): Promise<LedgerResult | null> {
    const r = (await this.get(
      `/internal/v1/learning/users/${encodeURIComponent(userId)}/operations/${encodeURIComponent(operationId)}`,
      'learning:operations:read',
    )) as LedgerResult | null;
    if (r === null) return null;
    validateRequest('OperationLedgerResult', r);
    if (r.userId !== userId || r.operationId !== operationId)
      throw new Error('INVALID_LEARNING_RESULT');
    return r;
  }
  async page(userId: string, cursor: string | null): Promise<ProjectionPage> {
    const q = new URLSearchParams({ limit: '50' });
    if (cursor) q.set('cursor', cursor);
    const r = (await this.get(
      `/internal/v1/learning/users/${encodeURIComponent(userId)}/progress?${q}`,
      'learning:progress:read',
    )) as ProjectionPage | null;
    if (
      !r ||
      !Array.isArray(r.items) ||
      r.items.length > 50 ||
      !Number.isFinite(Date.parse(r.asOf)) ||
      !/^(0|[1-9]\d*)$/.test(r.revisionWatermark) ||
      BigInt(r.revisionWatermark) > 9223372036854775807n ||
      !(r.nextCursor === null || (typeof r.nextCursor === 'string' && r.nextCursor.length <= 512))
    )
      throw new Error('INVALID_LEARNING_PAGE');
    r.items.forEach((i: unknown) => validateRequest('ProgressSnapshot', i));
    return r;
  }
}
