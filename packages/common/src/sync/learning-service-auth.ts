import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
export function learningServiceToken(
  secret: string,
  scope: 'learning:progress:read' | 'learning:operations:read',
): Promise<string> {
  return new JwtService().signAsync(
    { scope },
    {
      secret,
      algorithm: 'HS256',
      issuer: 'toeic-services',
      audience: 'toeic-learning-internal',
      subject: 'auth-service',
      expiresIn: 30,
    },
  );
}
export async function verifyLearningServiceToken(
  secret: string,
  header: string | undefined,
  scope: string,
): Promise<void> {
  try {
    const [scheme, token, extra] = (header || '').split(' ');
    if (scheme !== 'Bearer' || !token || extra) throw new Error();
    const claims = await new JwtService().verifyAsync(token, {
      secret,
      algorithms: ['HS256'],
      issuer: 'toeic-services',
      audience: 'toeic-learning-internal',
    });
    if (claims.sub !== 'auth-service' || claims.scope !== scope || !claims.exp) throw new Error();
  } catch {
    throw new UnauthorizedException({
      code: 'INVALID_SERVICE_TOKEN',
      message: 'Invalid service credential',
    });
  }
}
