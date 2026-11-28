import { accessJwtOptions } from '@toeic/common';
import { ConfigService } from '@nestjs/config';

import { JwtMiddlewareOptions } from '../gateway/jwt.middleware';

export function requiredConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function jwtMiddlewareOptions(config: ConfigService): JwtMiddlewareOptions {
  const options = accessJwtOptions(config);
  return {
    secret: options.publicKey as string,
    algorithm: 'RS256',
    issuer: options.verifyOptions!.issuer as string,
    audience: options.verifyOptions!.audience as string,
  };
}
