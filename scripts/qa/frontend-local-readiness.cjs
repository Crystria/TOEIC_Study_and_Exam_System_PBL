/* Read-only Gateway checks. No credentials, cookies, response bodies or DB access. */
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { values } = parseArgs({
  options: {
    gateway: { type: 'string', default: 'http://127.0.0.1:3000/api/v1' },
    out: { type: 'string', default: 'tmp/frontend-integration-session33/runtime-probe.json' },
  },
});
const url = new URL(values.gateway);
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname.replace(/\/$/, '') !== '/api/v1' ||
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
  !['http:', 'https:'].includes(url.protocol)
)
  throw new Error('Use a loopback local Gateway URL without credentials, query or fragment');
const out = path.resolve(values.out);
if (!out.startsWith(path.resolve('tmp') + path.sep)) throw new Error('Evidence must be under tmp');
if (fs.existsSync(out)) throw new Error('Use a fresh output file');
(async () => {
  const requests = await Promise.all(
    ['users/me', 'learning/vocabulary-topics', 'tests', 'admin/users'].map(async (endpoint) => {
      const started = Date.now();
      try {
        const response = await fetch(`${url.href.replace(/\/$/, '')}/${endpoint}`, {
          method: 'GET',
          redirect: 'error',
          signal: AbortSignal.timeout(4000),
          headers: { Accept: 'application/json' },
        });
        await response.body?.cancel();
        return {
          endpoint,
          method: 'GET',
          status: response.status,
          elapsedMs: Date.now() - started,
          correlationIdPresent: response.headers.has('x-correlation-id'),
        };
      } catch {
        return {
          endpoint,
          method: 'GET',
          status: null,
          error: 'GATEWAY_UNREACHABLE',
          elapsedMs: Date.now() - started,
        };
      }
    }),
  );
  const report = {
    kind: 'real unauthenticated local Gateway HTTP probes; no stubs',
    checkedAt: new Date().toISOString(),
    gateway: url.href,
    requests,
    authenticatedIntegration: 'NOT_VERIFIED',
    isolatedDataset: 'NOT_ASSESSED_BY_THIS_PROBE',
    writesPerformed: 0,
    metadataVerified: false,
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (requests.some((r) => r.status === null)) process.exitCode = 2;
})();
