# Exam Service — P3

Tests are complete 7-Part forms: exactly 200 questions, 100 Listening + 100
Reading, consecutive positions, duration 7200 seconds. Content writes require
`CONTENT_ADMIN`/`SYSTEM_ADMIN`; reads and attempts require an access JWT. USER
may only read, save or submit their own attempts.

## API

- `GET/POST /api/v1/tests`, `GET/PATCH/DELETE /api/v1/tests/:id`.
- `GET /api/v1/tests/:testId/parts`: all 7 parts with active counts, group count,
  availability and validation errors.
- `POST /api/v1/tests/:testId/attempts`: Full Test; reuses this user's live Full
  attempt. An expired Full attempt is finalized before creating the next one.
- `POST /api/v1/tests/:testId/part-attempts`: `{ parts: [5, 7], durationSeconds: 1800 }`.
  A selection of all 7 Parts remains `mode=PART`. Duration is 300–10800 seconds;
  deployment settings may narrow the range.
- `PUT /api/v1/attempts/:id/draft`: `{ answers: [{ questionId, selectedOption }] }`.
- `PUT /api/v1/attempts/:id/answers/:questionId`: `{ selectedOption: "A" }`.
- `POST /api/v1/attempts/:id/submit`: optional `{ answers: [...] }`.
- `GET /api/v1/attempts/:id`: owner resume/review.
- `GET /api/v1/attempts?testId=...&mode=PART&page=1&size=20`: owner history.

`selectedOption: null` explicitly clears a choice. Draft updates merge by ID.
Submitting merges Redis draft and submitted answers, with submitted values
winning. Answers outside the snapshot, duplicates, and Part 2 option D are
rejected. Every snapshot question gets one DB answer on finalization; blanks
become null/incorrect. No answer DB rows are written while saving draft.

Start endpoints accept `Idempotency-Key` (up to 200 characters). The mapping is
durable and scoped to the user. Reusing a key with different test/mode/parts or
duration returns 409. The same request returns its original attempt, even after
completion. A Part request without a key intentionally creates a new attempt.
Submit is idempotent through the locked attempt state regardless of the header.

## Snapshot, deadline and scoring

Starting validates all selected questions, groups, options and membership via
the canonical Question Bank gRPC proto. A group must be included in full.
Question/answer RPC revisions must match; concurrent edits return 409 so the
client can retry. Deploy the updated Question Bank together with Exam.

One transaction persists deadline, selected parts, question snapshots (including
answer key and group position), and deduplicated group/assets. Test updates are
serialized against snapshot creation; existing attempts continue using their
snapshots after edits or archives. Legacy attempts are `snapshotVersion=0` and
remain read-only; their question snapshots are not fabricated or backfilled.

Before completion, HTTP responses omit correct options, explanations, grading
and transcripts. Review responses reveal these from the stored snapshot and
generate media URLs from `MEDIA_PUBLIC_BASE_URL`. `serverTime` and
`remainingSeconds` are server-derived. Test title is the current title; question
and group content is immutable.

Draft Redis hashes expire at deadline + 1 hour. Redis time prevents late writes.
Save and submit serialize on `SELECT ... FOR UPDATE`. At/after deadline, submit
ignores new body choices and finalizes `EXPIRED` using the stored draft. A worker
runs every 60 seconds, with a configurable default grace of 5 seconds for its
scan. Manual save/submit never extend the deadline. An empty draft means blanks;
an unavailable Redis means 503/deferred expiry rather than silently discarding
saved answers. Redis waits are bounded to 1 second.

Full results use the two validated 101-row ETS reference tables and include
Listening/Reading/total, raw counts, per-Part details and the required reference
score disclaimer. Part results have only accuracy/counts/per-Part statistics;
all scaled score fields are null. Tables validate at startup. Production never
uses the optional `ETS_ALLOW_DEV_FALLBACK=true` formula.

## Outbox and Analytics

Finalization, all answer rows, scores, statistics and one outbox event commit
together. No publish happens in the request path. The relay polls every 500 ms,
locks rows with `SKIP LOCKED`, publishes with stable event IDs, and retries with
backoff. After 10 failures it uses the durable `exam-outbox-dlq` queue.

Full emits `test.submitted` / `TestSubmittedEvent`; Part emits
`part-practice.submitted` / `PartPracticeSubmittedEvent`, including on expiry.
Delivery is at least once. Analytics records processed event IDs in the same
transaction as history/activity updates, serializes events per user, and derives
weighted weak areas from real correct/total counts. Part history has null score
and keeps accuracy/parts. Only scored attempts contribute to score summaries.

## Verification

`GET /api/v1/ready` probes PostgreSQL and Redis with a bounded timeout. The
[P4 Gateway QA suite](../../scripts/qa/README.md) runs compiled Docker services
with a full 200-question fixture, real Auth/MinIO/search/Analytics, and smoke p95
measurements. The service integration suite below remains useful in isolation.

```powershell
npm run prisma:generate -w @toeic/exam-service
npm run build -w @toeic/common
npm run build -w @toeic/exam-service
npm run lint -w @toeic/exam-service
npm run test -w @toeic/exam-service -- --runInBand
```

Default tests require no external services. Integration is opt-in and requires
local PostgreSQL/Redis/RabbitMQ and **separate migrated databases** whose names
contain `p3_verify`. Generate the Question Bank and Analytics Prisma clients too.
The suite creates 200 source questions, starts real gRPC/HTTP servers, grades
Full/Part attempts, and verifies RabbitMQ → Analytics updates. Cleanup deletes
only its own IDs.

```powershell
$env:P3_EXAM_DATABASE_URL='postgresql://toeic:toeic@localhost:5432/exam_p3_verify?schema=public'
$env:P3_QUESTION_DATABASE_URL='postgresql://toeic:toeic@localhost:5432/question_bank_p3_verify?schema=public'
$env:P3_ANALYTICS_DATABASE_URL='postgresql://toeic:toeic@localhost:5432/analytics_p3_verify?schema=public'
npm run test:integration -w @toeic/exam-service
```

Migration keeps test/attempt IDs and legacy answers, normalizes SQL identifiers,
adds durable start keys and outbox retry metadata, and preserves legacy attempts
with snapshot version 0. The extra snapshot position is needed for Part 6 blanks.
