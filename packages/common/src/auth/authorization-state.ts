export interface AuthorizationClaims {
  sub: string;
  sid: string;
  userVersion: string;
  sessionVersion: string;
}
export interface AuthorizationState {
  userId: string;
  sessionId: string;
  userVersion: string;
  sessionVersion: string;
  status: string;
  sessionRevoked: boolean;
}
export class AuthorizationStateNotFoundError extends Error {}
/** P2 injects an authenticated internal Auth transport; never trusts a URL from a JWT. */
export class AuthorizationStateVerifier {
  private readonly cache = new Map<string, { state: AuthorizationState; until: number }>();
  constructor(
    private readonly load: (
      userId: string,
      sessionId: string,
      signal: AbortSignal,
    ) => Promise<AuthorizationState>,
  ) {}
  invalidate(userId: string): void {
    for (const key of this.cache.keys()) if (key.startsWith(userId + ':')) this.cache.delete(key);
  }
  async verify(claims: AuthorizationClaims): Promise<void> {
    if (
      !claims.sub ||
      !claims.sid ||
      !/^\d+$/.test(claims.userVersion) ||
      !/^\d+$/.test(claims.sessionVersion)
    )
      throw new Error('INVALID_AUTHORIZATION_CLAIMS');
    const key = `${claims.sub}:${claims.sid}`;
    let entry = this.cache.get(key);
    if (!entry || entry.until <= Date.now()) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const startedAt = Date.now();
      try {
        const state = await Promise.race([
          this.load(claims.sub, claims.sid, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error('AUTHORIZATION_STATE_UNAVAILABLE'));
            }, 1000);
          }),
        ]);
        entry = { state, until: startedAt + 30_000 };
        // Bound local memory; evictions require a fresh authoritative check.
        if (this.cache.size >= 10000) this.cache.clear();
        this.cache.set(key, entry);
      } catch (error) {
        this.cache.delete(key);
        if (error instanceof AuthorizationStateNotFoundError) throw new Error('SESSION_REVOKED');
        throw new Error('AUTHORIZATION_STATE_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
      }
    }
    const s = entry.state;
    if (
      s.userId !== claims.sub ||
      s.sessionId !== claims.sid ||
      s.status !== 'ACTIVE' ||
      s.sessionRevoked ||
      s.userVersion !== claims.userVersion ||
      s.sessionVersion !== claims.sessionVersion
    )
      throw new Error('SESSION_REVOKED');
  }
}
