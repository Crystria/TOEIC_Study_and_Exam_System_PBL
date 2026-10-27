import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, JwtPayload } from '@toeic/common';
@Injectable()
export class ExamAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await super.canActivate(context);
    const user = context.switchToHttp().getRequest<{ user?: JwtPayload & { exp?: number } }>().user;
    if (
      user &&
      (user.type !== 'access' ||
        typeof user.sub !== 'string' ||
        !user.sub ||
        typeof user.exp !== 'number' ||
        !Array.isArray(user.roles))
    )
      throw new UnauthorizedException('Invalid access token');
    return allowed;
  }
}
