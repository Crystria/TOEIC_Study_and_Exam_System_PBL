-- P0 preflight for the CURRENT legacy analytics schema. Score validity is NOT inferred from range.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name;
SELECT test_type, count(*) AS facts, min(score) AS min_stored_score, max(score) AS max_stored_score FROM score_history GROUP BY test_type ORDER BY test_type;
SELECT count(*) AS duplicate_attempt_groups FROM (SELECT attempt_id FROM score_history GROUP BY attempt_id HAVING count(*) > 1) AS duplicates;
SELECT activity_type, count(*) AS activities FROM learning_activity GROUP BY activity_type ORDER BY activity_type;
SELECT count(*) AS repeated_entity_activity_groups FROM (
  SELECT user_id, activity_type, ref_id FROM learning_activity GROUP BY user_id, activity_type, ref_id HAVING count(*) > 1
) AS repeated;
SELECT count(*) AS legacy_weak_areas, count(*) FILTER (WHERE part = 0) AS placeholder_part_zero FROM weak_areas;
SELECT (SELECT count(*) FROM user_learning_stats) AS legacy_statistics,
       (SELECT count(*) FROM daily_streaks) AS legacy_streaks,
       (SELECT count(*) FROM processed_events) AS inbox_rows;
COMMIT;
