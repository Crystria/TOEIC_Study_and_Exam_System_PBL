-- Live Exam already has Full/Part and snapshots; legacy exam.sql does not fit this catalog.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'database', current_database(), 'capturedAt', transaction_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'rowCounts', jsonb_build_object(
    'tests', (SELECT count(*) FROM tests), 'test_questions', (SELECT count(*) FROM test_questions),
    'attempts', (SELECT count(*) FROM attempts), 'attempt_answers', (SELECT count(*) FROM attempt_answers),
    'attempt_parts', (SELECT count(*) FROM attempt_parts), 'attempt_group_snapshots', (SELECT count(*) FROM attempt_group_snapshots),
    'attempt_question_snapshots', (SELECT count(*) FROM attempt_question_snapshots), 'attempt_start_requests', (SELECT count(*) FROM attempt_start_requests),
    'outbox_events', (SELECT count(*) FROM outbox_events)
  ),
  'attemptGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY mode, status), '[]'::jsonb) FROM (SELECT mode, status, count(*) AS rows FROM attempts GROUP BY mode, status) s),
  'outboxEventGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY event_type), '[]'::jsonb) FROM (SELECT event_type, count(*) AS rows FROM outbox_events GROUP BY event_type) s),
  'checks', jsonb_build_object(
    'archivedTests', (SELECT count(*) FROM tests WHERE deleted_at IS NOT NULL),
    'legacyAttemptsWithoutSnapshotVersion', (SELECT count(*) FROM attempts WHERE snapshot_version = 0),
    'newFullCompletedInvalidScoreFields', (SELECT count(*) FROM attempts WHERE mode = 'FULL' AND snapshot_version > 0 AND status IN ('SUBMITTED','EXPIRED') AND (score IS NULL OR score_listening IS NULL OR score_reading IS NULL OR score <> score_listening + score_reading OR score < 10 OR score > 990 OR score % 5 <> 0 OR score_listening < 5 OR score_listening > 495 OR score_listening % 5 <> 0 OR score_reading < 5 OR score_reading > 495 OR score_reading % 5 <> 0 OR total_questions IS DISTINCT FROM 200)),
    'completedPartWithScaledScore', (SELECT count(*) FROM attempts WHERE mode = 'PART' AND status IN ('SUBMITTED','EXPIRED') AND (score IS NOT NULL OR score_listening IS NOT NULL OR score_reading IS NOT NULL)),
    'completedAttemptsWithoutTime', (SELECT count(*) FROM attempts WHERE status IN ('SUBMITTED','EXPIRED') AND completed_at IS NULL),
    'invalidCorrectCounts', (SELECT count(*) FROM attempts WHERE correct_count < 0 OR correct_count > total_questions),
    'invalidPracticeAccuracy', (SELECT count(*) FROM attempts WHERE mode = 'PART' AND status IN ('SUBMITTED','EXPIRED') AND (accuracy IS NULL OR accuracy < 0 OR accuracy > 1 OR accuracy IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8))),
    'invalidAttemptPartCounts', (SELECT count(*) FROM attempt_parts WHERE part < 1 OR part > 7 OR correct_count < 0 OR correct_count > total_questions OR total_questions <> (ARRAY[6,25,39,30,30,16,54])[part]),
    'orphanAttemptParts', (SELECT count(*) FROM attempt_parts p LEFT JOIN attempts a ON a.attempt_id = p.attempt_id WHERE a.attempt_id IS NULL),
    'orphanAttemptAnswers', (SELECT count(*) FROM attempt_answers p LEFT JOIN attempts a ON a.attempt_id = p.attempt_id WHERE a.attempt_id IS NULL),
    'terminalAttemptsWithRawScoreEqualityNotProofOfPlaceholder', (SELECT count(*) FROM attempts WHERE status IN ('SUBMITTED','EXPIRED') AND score = correct_count)
  ),
  'outbox', (SELECT jsonb_build_object(
    'unpublished', count(*) FILTER (WHERE published_at IS NULL),
    'deadLettered', count(*) FILTER (WHERE dead_lettered_at IS NOT NULL),
    'oldestUnpublishedAt', min(created_at) FILTER (WHERE published_at IS NULL),
    'v2NamedEvents', count(*) FILTER (WHERE event_type LIKE '%.v2'),
    'payloadWithEnvelopeVersion2', count(*) FILTER (WHERE payload->>'version' = '2'),
    'payloadWithScoringProvenance', count(*) FILTER (WHERE payload ? 'scoring' OR (payload->'payload') ? 'scoring')
  ) FROM outbox_events),
  'migrations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', migration_name, 'checksum', checksum, 'finishedAt', finished_at, 'rolledBackAt', rolled_back_at, 'appliedSteps', applied_steps_count) ORDER BY started_at), '[]'::jsonb) FROM _prisma_migrations)
);
COMMIT;
