# Analytics Service

JWT-protected reads under `/api/v1/analytics` expose progress, score history,
streaks, weak areas and score prediction for the current user. Health/status
remain public. `/api/v1/ready` checks PostgreSQL with a bounded timeout.
PostgreSQL holds projections; RabbitMQ supplies events.

The durable `analytics-service.v2` queue receives Full Test, Part practice, shared
vocabulary review, personal vocabulary review, lesson completion and flashcard quiz
completion events. A committed review contributes one activity. A completed quiz
contributes one session and its correct/total question counts. The quiz summary
uses the sum of correct answers divided by the sum of questions.

Full exam history keeps the scaled score. Part practice keeps mode, parts,
accuracy and counts with `score: null`, including when all seven Parts were
selected. Score summaries/prediction use only non-null scores. Weak areas use
the weighted correct/total counts from events, rather than averaging percentages.
Event IDs enter `processed_events` in the same transaction as projection updates;
per-user advisory locks prevent duplicate/concurrent delivery from double counting.

```bash
npm run prisma:generate -w @toeic/analytics-service
npm run build -w @toeic/common
npm run build -w @toeic/analytics-service
npm run lint -w @toeic/analytics-service
npm run test -w @toeic/analytics-service -- --runInBand
```

[P4 QA](../../scripts/qa/README.md) checks both event types through the real
Gateway → Exam outbox → RabbitMQ → Analytics → Gateway path on isolated QA storage.

## Account analytics and historical recovery

Deploy the Analytics Prisma migration and consumer before starting the updated
Learning producer. Build the student web app with `NEXT_PUBLIC_DATA_MODE=api`
and open **Thống kê tiến độ** after signing in. The page refreshes every 30
seconds while visible. Check the Learning/Exam outboxes, Analytics queue retries
and `analytics_quarantine` if recent reviews or results are missing.

After building Analytics and generating the three service clients, run from the
repository root:

```sh
npm run history -w @toeic/analytics-service -- --dry-run
npm run history -w @toeic/analytics-service -- --apply
```

The command reads Learning and Exam and writes to Analytics in apply mode.
It takes connection URLs from each service's .env or the explicit
LEARNING_DATABASE_URL, EXAM_DATABASE_URL and ANALYTICS_DATABASE_URL overrides.
It examines records up to the migration timestamp, validates original V2
envelopes first, then recovers graded quiz/exam results, review snapshots and
first-learned dates. A first-learned date alone contributes no review or streak
day. Progress checkpoints are under node_modules/.cache. Inspect the
unrecoverable and conflict counts before interpreting historical totals.
