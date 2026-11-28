# P6 — Gateway E2E and acceptance QA

Run from the repository root with Node 22, npm dependencies installed and Docker
Compose available. The overlay starts compiled Auth, Question Bank, Exam,
Analytics, Learning and Gateway; it excludes frontend and AI.

For the full native failure/load/restore run, use `npm run qa:p6:profile` after
generating/building the backends. See [the acceptance runbook](../../docs/p6-backend-acceptance.md)
for resource sizing, database isolation, coverage prerequisites and measured limits.
The Compose commands below run the functional E2E/smoke subset.

```bash
npm ci
npm run prisma:generate -w @toeic/auth-service
npm run prisma:generate -w @toeic/question-bank-service
npm run prisma:generate -w @toeic/exam-service
npm run prisma:generate -w @toeic/analytics-service
npm run prisma:generate -w @toeic/learning-service
npm run qa:build
npm run qa:up
npm run qa:e2e
```

`qa:up` waits for healthchecks. A one-shot migration creates and deploys to the
five fixed databases `auth_p6_verify`, `question_p6_verify`, `exam_p6_verify`,
`analytics_p6_verify`, `learning_p6_verify`. Reapplying is safe. The media initializer creates the QA
bucket and a dev-only public GetObject policy. RabbitMQ readiness checks listening
ports; services start after migrations and mandatory dependencies are healthy.
Gateway `/ready` checks all five upstream services. Liveness `/health` stays separate.

QA uses Elasticsearch `questions-p6-qa`, MinIO `toeic-media-p6`, private avatars
`toeic-user-p6`, RabbitMQ exchange `qa.p6.events`, search queue `qa-p6-search`
and `qa.p6.domain`/`qa.p6.authorization`/`qa.p6.sync` queue prefixes. The runner refuses a
gateway without `QA_MODE=true` and refuses non-local database hosts. It bootstraps
only QA auth accounts directly; all content, presigns, exam actions and analytics
reads go through real login tokens and HTTP at `http://localhost:3000`. The three
admin accounts split the 60 uploads within the real presign quota.

Only one QA run may use these fixed namespaces at a time. The overlay shares
ports/Compose service names with dev; stop dev backends before running QA.
It does not migrate or seed the normal `auth_db/question_db/exam_db/analytics_db/learning_db`.
After QA, `npm run qa:stop`, then `npm run apps:up` restores the dev configuration.
Infrastructure volumes are retained.

## What is verified

- Real JWT/refresh rejection, roles, forged identity headers, correlation IDs,
  public health/readiness and a 429 presign response with Retry-After.
- 200 questions with Part counts 6/25/39/30/30/16/54, 45 groups and 60 signed
  MinIO PUT uploads. Media fixtures are synthetic transport data, not exam content.
  Public media retrieval, ordered assets and event-driven search are checked.
- Full and 1/multiple/7 Part starts; durable start-key replay/mismatch, owner
  isolation, Part 2 options, Redis-only drafts, blanks, immutable snapshots,
  simultaneous submit and exactly one outbox row. Full uses reference ETS
  conversion/disclaimer; Part score fields stay null.
- Answer keys, explanations and transcripts are absent from USER content reads
  and in-progress attempts. They become available in submitted review snapshots.
- Both event types arrive in Analytics, with null Part scores and weighted weak
  areas matching the actual counts. Archive cascade blocks future starts and
  removes search results while finalized review remains available.
- Learning content, review/completion and device-two sync converge to Analytics;
  replay does not duplicate activities. Full and Part histories use the P5 APIs.
- Smoke: 5 warmup reads, then 100 mixed reads (tests/search/result) and 10 fresh
  Full submissions, concurrency 1, through the gateway. Thresholds are read p95
  <500 ms and submit p95 <2000 ms. This is a local smoke check, not a capacity SLA.

`artifacts/qa/latest.json` records checks, timings, runtime, fixture IDs and cleanup.
It contains no tokens/passwords. Failures exit nonzero. Fixtures are retained by
default for inspection. The full native P6 runner replaces only the five fixed QA
databases on its next fresh run. Never connect development apps to these databases.

## Persistent API demo seed

```bash
npm run qa:seed
```

This retains a complete `QA Demo 200 Questions` test and returns its ID in
`artifacts/qa/seed.json`. Repeating reuses the existing complete test. Login uses
`qa-demo-0@example.test` through `qa-demo-4@example.test`; accounts 0–2 have
SYSTEM_ADMIN + CONTENT_ADMIN and accounts 3–4 have USER. Default password is `QA-Local-2026!`;
set `QA_ACCOUNT_PASSWORD` on first creation to override it. Existing demo users
keep their password. Seed mode checks search/Parts readiness and retains data.

## Configuration and diagnostics

Runner defaults match the Compose ports. For changed infrastructure ports use
`QA_POSTGRES_URL`, `QA_REDIS_URL`, `QA_ELASTICSEARCH_NODE`, `QA_MINIO_ENDPOINT`
and `QA_BASE_URL`. `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` must match MinIO. If you
change the index or bucket, update the overlay and runner together using
`QA_SEARCH_INDEX`/`QA_MINIO_BUCKET` (QA namespace is required). Gateway signatures
use matching RS256 signing/verification configuration; the E2E runner logs in via Auth.
An isolated Docker network still uses the host-facing MinIO URL for signed PUTs.

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.qa.yml ps
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.qa.yml logs --tail 80
```

Backend CI includes lint/build/unit tests, fresh PostgreSQL migration deployment,
idempotent reapplication/schema-drift checks for all five Prisma services, and
this Docker E2E/smoke job with a JSON artifact. Local integration suites for P2/P3
remain documented in the individual service READMEs.
