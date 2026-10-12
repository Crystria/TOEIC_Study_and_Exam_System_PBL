export enum RoleCode {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  CONTENT_ADMIN = 'CONTENT_ADMIN',
  USER = 'USER',
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: RoleCode[];
  type?: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: RoleCode[];
}

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
