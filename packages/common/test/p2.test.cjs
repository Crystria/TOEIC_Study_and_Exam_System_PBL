const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  JwtAuthGuard,
  AuthorizationStateVerifier,
  AuthorizationStateNotFoundError,
} = require('../dist');
const { validateRequest } = require('@toeic/contracts/p0/runtime.cjs');
function context() {
  const req = { headers: { authorization: 'Bearer signed' } };
  return {
    getHandler: () => {},
    getClass: () => {},
    switchToHttp: () => ({ getRequest: () => req }),
  };
}
const claims = {
  sub: 'u',
  sid: 's',
  jti: 'j',
  userVersion: '0',
  sessionVersion: '0',
  roles: ['USER'],
  type: 'access',
  iat: 1,
  exp: 2000000000,
};
const reflector = { getAllAndOverride: () => false };
test('P2 request contracts close privilege fields and enforce password bytes/confirmation', () => {
  const value = {
    email: 'user@example.test',
    password: 'Strong1!pass',
    confirmPassword: 'Strong1!pass',
    fullName: 'User Name',
  };
  validateRequest('RegisterRequest', value);
  assert.throws(() => validateRequest('RegisterRequest', { ...value, roles: ['SYSTEM_ADMIN'] }));
  assert.throws(() =>
    validateRequest('RegisterRequest', { ...value, confirmPassword: 'Mismatch1!' }),
  );
  assert.throws(() =>
    validateRequest('RegisterRequest', {
      ...value,
      password: 'Aa1' + 'é'.repeat(36),
      confirmPassword: 'Aa1' + 'é'.repeat(36),
    }),
  );
  assert.throws(() => validateRequest('RolesPatch', { roles: ['USER', 'USER'] }));
  assert.throws(() => validateRequest('ProfilePatch', {}));
});
test('service guard requires session claims before consulting Auth', async () => {
  let called = false;
  const guard = new JwtAuthGuard(
    { verifyAsync: async () => ({ ...claims, sid: undefined }) },
    reflector,
    {
      verify: async () => {
        called = true;
      },
    },
  );
  await assert.rejects(guard.canActivate(context()), (e) => e.getStatus() === 401);
  assert.equal(called, false);
});
test('service guard maps revoked to 401 and unavailable state to 503', async () => {
  for (const [message, status] of [
    ['SESSION_REVOKED', 401],
    ['AUTHORIZATION_STATE_UNAVAILABLE', 503],
  ]) {
    const guard = new JwtAuthGuard({ verifyAsync: async () => claims }, reflector, {
      verify: async () => {
        throw new Error(message);
      },
    });
    await assert.rejects(guard.canActivate(context()), (e) => e.getStatus() === status);
  }
});
test('Auth state timeout aborts the transport and never serves stale data', async () => {
  let signal;
  const verifier = new AuthorizationStateVerifier(async (_u, _s, s) => {
    signal = s;
    return new Promise(() => {});
  });
  await assert.rejects(verifier.verify(claims), /AUTHORIZATION_STATE_UNAVAILABLE/);
  assert.equal(signal.aborted, true);
});
test('a confirmed missing Auth session is revoked rather than an infrastructure outage', async () => {
  const verifier = new AuthorizationStateVerifier(async () => {
    throw new AuthorizationStateNotFoundError();
  });
  await assert.rejects(verifier.verify(claims), /SESSION_REVOKED/);
});
