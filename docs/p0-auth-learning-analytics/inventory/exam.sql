-- P0 producer preflight for the CURRENT legacy exam schema. No answers or user IDs exported.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name;
SELECT type, count(*) AS tests FROM tests GROUP BY type ORDER BY type;
SELECT status, count(*) AS attempts, count(*) FILTER (WHERE score = total_correct) AS score_equals_raw_correct FROM attempts GROUP BY status ORDER BY status;
SELECT count(*) AS outbox_rows, count(*) FILTER (WHERE published_at IS NULL) AS unpublished FROM outbox_events;
SELECT part, count(*) AS linked_questions FROM test_questions GROUP BY part ORDER BY part;
COMMIT;
