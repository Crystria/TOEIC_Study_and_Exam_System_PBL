import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

function key(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.replace(/\\n/g, '\n');
  const file = config.get<string>(`${name}_FILE`);
  if (value && file) throw new Error(`Configure either ${name} or ${name}_FILE`);
  if (!value && !file) throw new Error(`${name} or ${name}_FILE is required`);
  return value || readFileSync(file!, 'utf8');
}

export function accessJwtOptions(config: ConfigService, signing = false): JwtModuleOptions {
  const publicKey = key(config, 'JWT_ACCESS_PUBLIC_KEY');
  if (publicKey.includes('PRIVATE KEY'))
    throw new Error('Verifier configuration must contain a public key only');
  const parsed = createPublicKey(publicKey);
  if (
    parsed.asymmetricKeyType !== 'rsa' ||
    (parsed.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  )
    throw new Error('Access key must be RSA with at least 2048 bits');
  const issuer = config.get<string>('JWT_ISSUER')?.trim() || 'toeic-auth';
  const audience = config.get<string>('JWT_AUDIENCE')?.trim() || 'toeic-api';
  const result: JwtModuleOptions = {
    publicKey,
    verifyOptions: { algorithms: ['RS256'], issuer, audience },
    signOptions: { algorithm: 'RS256', expiresIn: '15m', issuer, audience },
  };
  if (signing) {
    result.privateKey = key(config, 'JWT_ACCESS_PRIVATE_KEY');
    const actual = createPublicKey(createPrivateKey(result.privateKey as string));
    if (
      !actual
        .export({ type: 'spki', format: 'der' })
        .equals(parsed.export({ type: 'spki', format: 'der' }))
    )
      throw new Error('Access public/private keys do not match');
  }
  return result;
}
