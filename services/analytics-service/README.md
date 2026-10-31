# Analytics Service

JWT-protected reads under `/api/v1/analytics` expose progress, score history,
streaks, weak areas and score prediction for the current user. Health/status
remain public. `/api/v1/ready` checks PostgreSQL with a bounded timeout.
PostgreSQL holds projections; RabbitMQ supplies events.

The durable `ANALYTICS_CONSUMER_QUEUE` (default `analytics-service`) subscribes
to `test.submitted`, `part-practice.submitted`, `vocabulary.learned` and
`lesson.completed` on `RABBITMQ_EXCHANGE` (default `toeic.events`). Projection
failures retry and then enter the exchange DLQ; malformed envelopes are logged
and ignored.

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
