import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from './constants';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext): JwtPayload | unknown => {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
