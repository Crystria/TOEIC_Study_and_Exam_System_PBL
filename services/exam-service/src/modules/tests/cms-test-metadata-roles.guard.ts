import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RoleCode } from '@toeic/common';

// Keep the shared guards unchanged; this CMS boundary requires an actual role array.
@Injectable()
export class CmsTestMetadataRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { roles?: unknown } }>();
    const roles = request.user?.roles;
    if (!Array.isArray(roles) || !roles.includes(RoleCode.CONTENT_ADMIN)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
