import { generateKeyPairSync, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { accessJwtOptions, AuthorizationStateVerifier } from '@toeic/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityTx, IdentityUser } from '../../identity';
import { AuthSession } from '../../generated/prisma';
import { AuthService } from './auth.service';
import { ActivationMailService } from './activation-mail.service';
import { UserPresenter } from '../users/user-presenter';
describe('Auth session tokens', () => {
  it('signs RSA access claims and stores only a hash of the opaque refresh', async () => {
    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const config = {
      get: (key: string) =>
        (
          ({
            JWT_ACCESS_PUBLIC_KEY: pair.publicKey,
            JWT_ACCESS_PRIVATE_KEY: pair.privateKey,
          }) as Record<string, string>
        )[key],
    } as ConfigService;
    const create = jest.fn().mockResolvedValue({});
    const service = new AuthService(
      {} as PrismaService,
      new JwtService(accessJwtOptions(config, true)),
      {} as ActivationMailService,
      { present: async () => ({}) } as unknown as UserPresenter,
      {} as AuthorizationStateVerifier,
    );
    const user = {
      id: 'u',
      authorizationVersion: 7n,
      roles: [{ roleCode: 'USER' }],
    } as unknown as IdentityUser;
    const session = {
      id: 'sid',
      version: 3n,
      expiresAt: new Date(Date.now() + 604800000),
    } as AuthSession;
    const result = await service['issueTokens'](
      { refreshToken: { create } } as unknown as IdentityTx,
      user,
      session,
    );
    const claims = await new JwtService(accessJwtOptions(config)).verifyAsync(result.accessToken);
    expect(claims).toMatchObject({
      sub: 'u',
      sid: 'sid',
      type: 'access',
      userVersion: '7',
      sessionVersion: '3',
      roles: ['USER'],
    });
    expect(claims.jti).toBeTruthy();
    expect(claims.exp - claims.iat).toBe(900);
    expect(result.refreshToken).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
    expect(create.mock.calls[0][0].data.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(JSON.stringify(create.mock.calls)).not.toContain(result.refreshToken);
  });
});
