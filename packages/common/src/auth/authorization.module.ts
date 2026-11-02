import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DynamicModule, Global, Module, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthorizationState,
  AuthorizationStateVerifier,
  AuthorizationStateNotFoundError,
} from './authorization-state';
import { MessagingService } from '../messaging/messaging.service';
import { validateRequest } from '@toeic/contracts/p0/runtime.cjs';

export function serviceAuthSecret(config: ConfigService): string {
  const inline = config.get<string>('AUTH_SERVICE_SECRET');
  const file = config.get<string>('AUTH_SERVICE_SECRET_FILE');
  if (inline && file) throw new Error('Configure one Auth service secret source');
  const value = (inline || (file ? readFileSync(file, 'utf8') : '')).trim();
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new Error('AUTH_SERVICE_SECRET must be 32 random hex bytes');
  return value;
}

export function serviceToken(secret: string, service: string): string {
  return new JwtService().sign(
    { scope: 'authorization:read' },
    {
      secret,
      algorithm: 'HS256',
      issuer: 'toeic-services',
      audience: 'toeic-auth-internal',
      subject: service,
      expiresIn: 60,
      jwtid: randomUUID(),
    },
  );
}

@Global()
@Module({})
export class AuthorizationModule {
  static forService(service: string): DynamicModule {
    return {
      module: AuthorizationModule,
      providers: [
        {
          provide: AuthorizationStateVerifier,
          inject: [ConfigService, MessagingService],
          useFactory: async (config: ConfigService, messaging: MessagingService) => {
            const secret = serviceAuthSecret(config);
            const base = config.get<string>('AUTH_INTERNAL_URL') || 'http://localhost:3001';
            const url = new URL('/internal/v1/auth/authorization-state', base);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
              throw new Error('Invalid Auth internal URL');
            const verifier = new AuthorizationStateVerifier(async (userId, sessionId, signal) => {
              const requestUrl = new URL(url);
              requestUrl.searchParams.set('userId', userId);
              requestUrl.searchParams.set('sessionId', sessionId);
              const response = await fetch(requestUrl, {
                headers: { Authorization: `Bearer ${serviceToken(secret, service)}` },
                signal,
                redirect: 'error',
              });
              if (response.status === 404) {
                const body = (await response.json()) as { code?: string };
                if (body.code === 'SESSION_NOT_FOUND') throw new AuthorizationStateNotFoundError();
              }
              if (!response.ok) throw new ServiceUnavailableException('Auth state unavailable');
              const state = await response.json();
              validateRequest('AuthorizationState', state);
              return state as AuthorizationState;
            });
            const prefix = config.get<string>('AUTHORIZATION_QUEUE_PREFIX') || 'authorization';
            await messaging.subscribe(
              `${prefix}.${service}.v2`,
              'authorization.changed.v2',
              async (message) => {
                const payload = JSON.parse(message.content.toString('utf8')).payload as {
                  userId: string;
                };
                verifier.invalidate(payload.userId);
              },
            );
            return verifier;
          },
        },
      ],
      exports: [AuthorizationStateVerifier],
    };
  }
}
