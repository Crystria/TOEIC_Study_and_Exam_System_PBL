import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { jwtMiddlewareOptions } from './gateway-config';
const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
describe('gateway RSA configuration', () => {
  it('requires a public key', () =>
    expect(() => jwtMiddlewareOptions(isolatedConfig({ JWT_ACCESS_PUBLIC_KEY: '' }))).toThrow());
  it('pins RS256 and default issuer/audience', () =>
    expect(jwtMiddlewareOptions(isolatedConfig({ JWT_ACCESS_PUBLIC_KEY: publicKey }))).toEqual({
      secret: publicKey,
      algorithm: 'RS256',
      issuer: 'toeic-auth',
      audience: 'toeic-api',
    }));
});

function isolatedConfig(values: Record<string, unknown>): ConfigService {
  return { get: (name: string) => values[name] } as unknown as ConfigService;
}
