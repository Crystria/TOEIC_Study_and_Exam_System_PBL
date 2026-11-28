import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY, JwtPayload } from './constants';
import { AuthorizationStateVerifier } from './authorization-state';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationStateVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const claims = payload as JwtPayload & { exp?: number; iat?: number };
      if (
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof claims.exp !== 'number' ||
        typeof claims.iat !== 'number' ||
        !Array.isArray(payload.roles) ||
        !payload.roles.length ||
        !payload.roles.every((r) => ['USER', 'CONTENT_ADMIN', 'SYSTEM_ADMIN'].includes(r))
      )
        throw new Error('Invalid access claims');
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (
      typeof payload.sid !== 'string' ||
      !payload.sid ||
      typeof payload.jti !== 'string' ||
      !payload.jti ||
      typeof payload.userVersion !== 'string' ||
      !/^(0|[1-9]\d{0,18})$/.test(payload.userVersion) ||
      typeof payload.sessionVersion !== 'string' ||
      !/^(0|[1-9]\d{0,18})$/.test(payload.sessionVersion)
    )
      throw new UnauthorizedException('Invalid session claims');
    // Logout still verifies signature/expiry and its service checks refresh ownership.
    // Repeated logout of an already revoked session is intentionally idempotent.
    if (
      this.reflector.getAllAndOverride<boolean>('sessionLogout', [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      (request as Request & { user?: JwtPayload }).user = payload;
      return true;
    }
    try {
      await this.authorization.verify({
        sub: payload.sub,
        sid: payload.sid,
        userVersion: payload.userVersion,
        sessionVersion: payload.sessionVersion,
      });
    } catch (error) {
      if ((error as Error).message === 'AUTHORIZATION_STATE_UNAVAILABLE')
        throw new ServiceUnavailableException({
          code: 'AUTHORIZATION_STATE_UNAVAILABLE',
          message: 'Authorization dependency unavailable',
        });
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Session is no longer valid',
      });
    }
    (request as Request & { user?: JwtPayload }).user = payload;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
