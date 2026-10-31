# API Gateway

Gateway listens on port 3000 and forwards versioned routes to the configured
service URLs. Access JWTs require the shared secret, issuer, audience and access
token type. Content writes require CONTENT_ADMIN/SYSTEM_ADMIN; reindex requires
SYSTEM_ADMIN. Caller-supplied user identity headers are stripped.

JSON bodies are buffered once with a size limit and replayed unchanged through
one shared HTTP proxy. Connect timeout is 2 seconds; response timeout is 5 seconds
(15 seconds for submit). Upstream errors return 502/504 with a correlation ID.
The proxy registers only one close listener per HTTP server.

`GET /health` and `/status` are liveness checks. `GET /ready` probes Redis and
Auth/Question Bank/Exam/Analytics HTTP endpoints in parallel, returning 503 if a
required dependency fails. Each probe is bounded to 1.5 seconds and exposes only
status labels. These three paths bypass JWT and rate limits. Learning and AI
are not required for exam readiness.

Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front
of this gateway; default 0 uses the socket address for IP limits. Do not expose
the gateway directly with a positive hop count. `CORS_ORIGINS` is a comma-separated
allowlist; correlation and retry headers are exposed to permitted browser clients.

IP limits apply to anonymous/auth routes; authenticated requests use user buckets.
Reads allow 300/min, submit 30/min and media presign 30/hour, with continuous refill.
Redis failure degrades rate limiting with a log warning. Exam draft persistence
still requires Redis and fails with 503 when unavailable.

```bash
npm run build -w @toeic/common
npm run build -w @toeic/api-gateway
npm run lint -w @toeic/api-gateway
npm run test -w @toeic/api-gateway -- --runInBand
```

The HTTP regression suite covers body replay, permissions, quotas, CORS,
timeouts, readiness and listener lifetime. See [P4 QA](../../scripts/qa/README.md)
for the Docker E2E flow and measured smoke thresholds.
