import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Public, serviceAuthSecret } from '@toeic/common';
import { IsUUID } from 'class-validator';
import { AuthService } from './auth.service';
class StateQuery {
  @IsUUID() userId!: string;
  @IsUUID() sessionId!: string;
}
@Public()
@Controller('internal/v1/auth')
export class InternalAuthController {
  private readonly secret: string;
  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secret = serviceAuthSecret(config);
  }
  @Get('authorization-state')
  async state(@Headers('authorization') header: string | undefined, @Query() query: StateQuery) {
    try {
      const [scheme, token, extra] = (header || '').split(' ');
      if (scheme !== 'Bearer' || !token || extra) throw new Error();
      const claims = await new JwtService().verifyAsync(token, {
        secret: this.secret,
        algorithms: ['HS256'],
        issuer: 'toeic-services',
        audience: 'toeic-auth-internal',
      });
      if (
        claims.scope !== 'authorization:read' ||
        !claims.exp ||
        ![
          'auth-service',
          'learning-service',
          'analytics-service',
          'exam-service',
          'question-bank-service',
          'api-gateway',
        ].includes(claims.sub)
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid service credential',
      });
    }
    return this.auth.authorizationState(query.userId, query.sessionId);
  }
}
