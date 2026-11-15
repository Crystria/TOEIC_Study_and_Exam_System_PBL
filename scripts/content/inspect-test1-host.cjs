/* Sanitized host configuration and read-only HTTP probes. Never emits raw errors/env. */
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../..');
function safeUrl(value, database = false) {
  if (!value) return null;
  const u = new URL(value.includes('://') ? value : `http://${value}`);
  return {
    scheme: u.protocol.slice(0, -1), host: u.hostname,
    port: Number(u.port || (database ? 5432 : u.protocol === 'https:' ? 443 : 80)),
    ...(database ? { name: u.pathname.slice(1) } : { path: u.pathname }),
  };
}
async function main() {
  const services = [
    ['api-gateway', 3000], ['auth-service', 3001],
    ['question-bank-service', 3002], ['exam-service', 3003],
    ['learning-service', 3004], ['analytics-service', 3005],
  ];
  const results = [];
  for (const [service, defaultPort] of services) {
    const file = path.join(root, 'services', service, '.env');
    const env = dotenv.parse(fs.readFileSync(file));
    const port = Number(env.PORT || defaultPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error();
    const endpoint = `http://127.0.0.1:${port}${service === 'api-gateway' ? '/ready' : '/api/v1/ready'}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    await response.body?.cancel();
    if (!response.ok) throw Error();
    const urls = {};
    for (const key of ['MEDIA_PUBLIC_BASE_URL', 'MINIO_PUBLIC_ENDPOINT', 'MINIO_ENDPOINT',
      'AUTH_SERVICE_URL', 'QUESTION_BANK_SERVICE_URL', 'EXAM_SERVICE_URL',
      'LEARNING_SERVICE_URL', 'ANALYTICS_SERVICE_URL', 'QUESTION_BANK_GRPC_URL']) {
      if (env[key]) urls[key] = safeUrl(env[key]);
    }
    results.push({ service, port, readiness: { endpoint, status: response.status },
      database: safeUrl(env.DATABASE_URL, true), urls,
      settings: Object.fromEntries(['MINIO_BUCKET', 'MINIO_REGION'].filter(k => env[k]).map(k => [k, env[k]])),
      configurationSource: `services/${service}/.env`,
      runtimeEnvironmentVerified: false,
      note: 'Configuration is from the env file, not the running process. Shell overrides, process working directory, DB identity and storage require separate verification before granting importer scopes.',
    });
  }
  process.stdout.write(JSON.stringify(results));
}
main().catch(() => { process.stderr.write('Host inspection failed: check service env files, ports and readiness. No credentials printed.\n'); process.exitCode = 1; });
