import { ConfigService } from '@nestjs/config';
import { jwtMiddlewareOptions } from './gateway-config';

function isolatedConfig(secret?: string): ConfigService {
  return { get: (key: string) => key === 'JWT_ACCESS_SECRET' ? secret : undefined } as ConfigService;
}

describe('gateway JWT configuration', () => {
  it.each([undefined, '', '   '])('rejects a missing or blank access secret (%s)', (secret) => {
    const config = isolatedConfig(secret);
    expect(() => jwtMiddlewareOptions(config)).toThrow('JWT_ACCESS_SECRET is required');
  });

  it('uses the same default issuer and audience as auth', () => {
    expect(jwtMiddlewareOptions(isolatedConfig('test-secret'))).toEqual({
      secret: 'test-secret',
      issuer: 'toeic-auth',
      audience: 'toeic-api',
    });
  });
});
