import { ConfigService } from '@nestjs/config';
import { DEFAULT_JWT_AUDIENCE, DEFAULT_JWT_ISSUER } from '@toeic/common';
import { JwtMiddlewareOptions } from '../gateway/jwt.middleware';

export function requiredConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function jwtMiddlewareOptions(config: ConfigService): JwtMiddlewareOptions {
  return {
    secret: requiredConfig(config, 'JWT_ACCESS_SECRET'),
    issuer: config.get<string>('JWT_ISSUER') ?? DEFAULT_JWT_ISSUER,
    audience: config.get<string>('JWT_AUDIENCE') ?? DEFAULT_JWT_AUDIENCE,
  };
}
