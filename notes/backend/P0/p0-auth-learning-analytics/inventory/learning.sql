-- P0 preflight for the CURRENT legacy learning schema. No content/PII export.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name;
SELECT (SELECT count(*) FROM vocabulary_topics) AS topics,
       (SELECT count(*) FROM vocabularies) AS vocabularies,
       (SELECT count(*) FROM user_progress) AS progress_rows,
       (SELECT count(*) FROM learning_sessions) AS legacy_sessions;
SELECT status, count(*) AS lessons FROM grammar_lessons GROUP BY status ORDER BY status;
SELECT count(*) AS word_collision_groups FROM (
  SELECT topic_id, lower(trim(word)) FROM vocabularies GROUP BY topic_id, lower(trim(word)) HAVING count(*) > 1
) AS collisions;
SELECT count(*) AS topics_with_fewer_than_five_words FROM (
  SELECT t.id FROM vocabulary_topics t LEFT JOIN vocabularies v ON v.topic_id = t.id GROUP BY t.id HAVING count(DISTINCT v.id) < 5
) AS small_topics;
SELECT count(*) FILTER (WHERE audio_url IS NOT NULL) AS audio_urls_to_classify,
       count(*) FILTER (WHERE image_url IS NOT NULL) AS image_urls_to_classify FROM vocabularies;
SELECT count(*) AS invalid_sm2_rows FROM user_progress WHERE easiness_factor < 1.3 OR repetition < 0 OR interval < 0 OR next_review_at IS NULL;
SELECT count(*) AS orphan_vocabulary_progress FROM user_progress p LEFT JOIN vocabularies v ON v.id = p.vocabulary_id WHERE v.id IS NULL;
SELECT status, count(*) AS lesson_progress, count(*) FILTER (WHERE completed_at IS NULL) AS missing_completion_time FROM lesson_progress GROUP BY status ORDER BY status;
SELECT count(*) AS outbox_rows, count(*) FILTER (WHERE published_at IS NULL) AS unpublished FROM outbox_events;
COMMIT;
