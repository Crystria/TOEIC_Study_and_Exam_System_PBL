import { SetMetadata } from '@nestjs/common';
import { RoleCode, ROLES_KEY } from './constants';

export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
