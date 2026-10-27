# Question Bank Service — P2

REST: `/api/v1/questions`, `/api/v1/question-groups`. Reads require an access JWT;
writes require `CONTENT_ADMIN` or `SYSTEM_ADMIN`. `POST /api/v1/questions/reindex`
requires `SYSTEM_ADMIN`.

Question payloads use `questionText`, `correctOption`, `options: [{ optionCode,
optionText }]`, `groupId`, `positionInGroup`, `audioKey`, `imageKey`, `transcript`,
`difficulty`, `tags`. The old `stem/status/mediaUrl/isCorrect` REST fields are no
longer accepted. USER responses omit answer keys, explanations and transcripts.

## Groups and upload flow

Create groups atomically with at least one nested `questions` entry (the same
question DTO, with a matching `part`; omit `groupId`; positions default to array
order). This prevents empty persisted groups. Part 3/4 require a transcript,
Part 6 placeholders must match the question positions, Part 7 requires passage
text or a TEXT/media asset. Missing upload keys produce `isComplete: false` so
an editor can create the resource before requesting its presigned URL. Such a
group cannot be used to start an exam. This follows ADR 0019's start-time rule.

1. Create a question or a group with nested questions.
2. POST `/:id/media/presign` with `{ mediaType, contentType, fileName }`.
3. PUT bytes to `uploadUrl` directly, using the stated `Content-Type`.
4. PATCH the resource with the returned `storageKey` as `audioKey`, `imageKey`
   or a group's asset `storageKey`. The server verifies resource ownership of
   the key, object existence and the stored MIME type.

Presigns expire after 300 seconds. Optional `Idempotency-Key` repeats the same
upload target for this period; a different request with the same key returns 409. Redis outages degrade this cache to a fresh presign. Set
`MEDIA_PUBLIC_BASE_URL` to the external base URL of the `toeic-media` bucket.
In Docker, use internal `MINIO_ENDPOINT=minio:9000` for object verification and
`MINIO_PUBLIC_ENDPOINT=http://localhost:19000` for browser-facing upload signatures.
`MINIO_REGION` defaults to `us-east-1`; it must match the storage server region.

PATCH a group with `questionOrder: [questionId, ...]` to reorder every member in
one transaction. `assets` replaces the asset list, ordered by unique `orderNo`.
Archive uses `deletedAt`; archiving a group cascades to all children. Removing
its final active question requires archiving the group. An archived member
makes a remaining group incomplete until its content is repaired.

## Events and search

Writes commit content and outbox together. A relay polls every 500 ms, locks up
to 50 rows with `FOR UPDATE SKIP LOCKED`, publishes confirmed RabbitMQ messages
with the stored `eventId`, and marks them published. Failure uses exponential
backoff (up to 60 seconds). After 10 failures the event goes to the durable
`question-bank-outbox-dlq` queue, with `deadLetteredAt` recorded. Operators can
inspect failed records by `lastError` and replay after fixing the cause.
Delivery is at least once: a crash after publish confirmation can repeat the
same event ID. Consumers must be idempotent.

Search reads the current DB document on every question/group event. Index
`questions-v2` includes question, transcript, explanation, tags and group text;
it never stores answer keys. External versions use `updatedAt` (including group
updates). Archived records become hidden versioned tombstones to prevent late
deliveries resurrecting them. Lists hydrate active DB rows and fall back to
PostgreSQL text matching when ES fails. Search is eventually consistent; an
admin may call `POST /api/v1/questions/reindex` after migration/index recovery.

gRPC uses the canonical proto in `packages/contracts/proto`. `GetQuestions`
returns active questions, deduplicated groups, group member IDs, completeness
and `missing_ids`, without the answer key. Legacy proto fields remain populated;
`question_text` is the new canonical field. `GetAnswerKey` returns active keys
and `missing_ids`. Keep this gRPC port on the internal network.

## Verification

```powershell
npm run prisma:generate -w @toeic/question-bank-service
npm run build -w @toeic/common
npm run build -w @toeic/question-bank-service
npm run lint -w @toeic/question-bank-service
npm run test -w @toeic/question-bank-service -- --runInBand
```

Integration tests are opt-in and require the local compose infrastructure and
a separate migrated database whose name contains `p2_verify`:

```powershell
$env:P2_INTEGRATION_DATABASE_URL='postgresql://toeic:toeic@localhost:5432/question_bank_p2_verify?schema=public'
npm run test:integration -w @toeic/question-bank-service
```

The suite uses HTTP and gRPC, real PostgreSQL transactions, signed MinIO PUT,
RabbitMQ outbox delivery and Elasticsearch indexing/fallback. It deletes only
the test-created IDs/objects. The migration normalizes the legacy question and
option columns; duplicate option codes block migration for manual correction.
Back up populated databases before deployment. Questions without an unambiguous
correct option are archived during migration.
