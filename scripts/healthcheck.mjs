const port = process.env.PORT ?? '3000';
const path = process.env.HEALTHCHECK_PATH ?? '/api/v1/health';
try {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(2500),
  });
  await response.body?.cancel();
  process.exitCode = response.ok ? 0 : 1;
} catch {
  process.exitCode = 1;
}
