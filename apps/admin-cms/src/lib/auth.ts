export type AdminRole = 'SYSTEM_ADMIN' | 'CONTENT_ADMIN';

export const AUTH_TOKEN_STORAGE_KEY = 'toeic_admin_token';
export const AUTH_ROLE_STORAGE_KEY = 'toeic_admin_role';

const isBrowser = (): boolean => typeof window !== 'undefined';

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function getRole(): AdminRole | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(AUTH_ROLE_STORAGE_KEY) as AdminRole | null;
}

export function setRole(role: AdminRole): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(AUTH_ROLE_STORAGE_KEY, role);
}

export function clearAuth(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function hasRole(allowed: AdminRole[]): boolean {
  const role = getRole();
  return role !== null && allowed.includes(role);
}

export function isSystemAdmin(): boolean {
  return getRole() === 'SYSTEM_ADMIN';
}
