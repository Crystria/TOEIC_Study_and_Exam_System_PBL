-- Live score_history has additive mode/accuracy/parts fields absent from checkout Prisma.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'database', current_database(), 'capturedAt', transaction_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'rowCounts', jsonb_build_object(
    'score_history', (SELECT count(*) FROM score_history), 'learning_activity', (SELECT count(*) FROM learning_activity),
    'user_learning_stats', (SELECT count(*) FROM user_learning_stats), 'daily_streaks', (SELECT count(*) FROM daily_streaks),
    'weak_areas', (SELECT count(*) FROM weak_areas), 'processed_events', (SELECT count(*) FROM processed_events)
  ),
  'scoreGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY mode, test_type), '[]'::jsonb) FROM (SELECT mode, test_type, count(*) AS rows, min(score) AS min_stored_score, max(score) AS max_stored_score FROM score_history GROUP BY mode, test_type) s),
  'activityGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY activity_type), '[]'::jsonb) FROM (SELECT activity_type, count(*) AS rows FROM learning_activity GROUP BY activity_type) s),
  'checks', jsonb_build_object(
    'legacyScoreRowsWithoutV2SectionAndProvenanceColumns', (SELECT count(*) FROM score_history),
    'duplicateAttemptGroups', (SELECT count(*) FROM (SELECT attempt_id FROM score_history GROUP BY attempt_id HAVING count(*) > 1) s),
    'nullModeRows', (SELECT count(*) FROM score_history WHERE mode IS NULL),
    'unknownModeRows', (SELECT count(*) FROM score_history WHERE mode IS NOT NULL AND mode NOT IN ('FULL','PART')),
    'partRowsWithScaledScore', (SELECT count(*) FROM score_history WHERE mode = 'PART' AND score IS NOT NULL),
    'fullRowsWithoutStoredScore', (SELECT count(*) FROM score_history WHERE mode = 'FULL' AND score IS NULL),
    'invalidPracticeAccuracy', (SELECT count(*) FROM score_history WHERE mode = 'PART' AND (accuracy IS NULL OR accuracy < 0 OR accuracy > 1 OR accuracy IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8))),
    'repeatedEntityActivityGroupsNotNecessarilyDuplicates', (SELECT count(*) FROM (SELECT user_id, activity_type, ref_id FROM learning_activity GROUP BY user_id, activity_type, ref_id HAVING count(*) > 1) s),
    'repeatedLessonCompletionGroups', (SELECT count(*) FROM (SELECT user_id, ref_id FROM learning_activity WHERE activity_type = 'LESSON_COMPLETED' GROUP BY user_id, ref_id HAVING count(*) > 1) s),
    'placeholderPartZeroWeakAreas', (SELECT count(*) FROM weak_areas WHERE part = 0),
    'invalidWeakAreaRanges', (SELECT count(*) FROM weak_areas WHERE part < 0 OR part > 7 OR error_rate < 0 OR error_rate > 1 OR sample_count < 0),
    'invalidStreakRanges', (SELECT count(*) FROM daily_streaks WHERE current_streak < 0 OR longest_streak < current_streak)
  ),
  'migrations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', migration_name, 'checksum', checksum, 'finishedAt', finished_at, 'rolledBackAt', rolled_back_at, 'appliedSteps', applied_steps_count) ORDER BY started_at), '[]'::jsonb) FROM _prisma_migrations)
);
COMMIT;
