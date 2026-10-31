-- Aggregate-only inventory for the catalog verified on 2026-10-31.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'database', current_database(), 'capturedAt', transaction_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'rowCounts', jsonb_build_object(
    'vocabulary_topics', (SELECT count(*) FROM vocabulary_topics), 'vocabularies', (SELECT count(*) FROM vocabularies),
    'grammar_lessons', (SELECT count(*) FROM grammar_lessons), 'user_progress', (SELECT count(*) FROM user_progress),
    'lesson_progress', (SELECT count(*) FROM lesson_progress), 'learning_sessions', (SELECT count(*) FROM learning_sessions),
    'outbox_events', (SELECT count(*) FROM outbox_events)
  ),
  'lessonStatusGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY status), '[]'::jsonb) FROM (SELECT status, count(*) AS rows FROM grammar_lessons GROUP BY status) s),
  'lessonProgressStatusGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY status), '[]'::jsonb) FROM (SELECT status, count(*) AS rows FROM lesson_progress GROUP BY status) s),
  'checks', jsonb_build_object(
    'wordCollisionGroups', (SELECT count(*) FROM (SELECT topic_id, lower(trim(word)) FROM vocabularies GROUP BY topic_id, lower(trim(word)) HAVING count(*) > 1) s),
    'topicsWithFewerThanFiveWords', (SELECT count(*) FROM (SELECT t.id FROM vocabulary_topics t LEFT JOIN vocabularies v ON v.topic_id = t.id GROUP BY t.id HAVING count(DISTINCT lower(trim(v.word))) < 5) s),
    'topicsWithFewerThanFourDistinctMeanings', (SELECT count(*) FROM (SELECT t.id FROM vocabulary_topics t LEFT JOIN vocabularies v ON v.topic_id = t.id GROUP BY t.id HAVING count(DISTINCT lower(trim(v.meaning))) < 4) s),
    'emptyWordOrMeaning', (SELECT count(*) FROM vocabularies WHERE trim(word) = '' OR trim(meaning) = ''),
    'audioReferencesToClassify', (SELECT count(*) FROM vocabularies WHERE audio_url IS NOT NULL),
    'imageReferencesToClassify', (SELECT count(*) FROM vocabularies WHERE image_url IS NOT NULL),
    'progressWithoutQualityOrFirstLearnedEvidence', (SELECT count(*) FROM user_progress),
    'invalidSm2Ranges', (SELECT count(*) FROM user_progress WHERE easiness_factor < 1.3 OR easiness_factor > 99.99 OR easiness_factor IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8) OR repetition < 0 OR interval < 0),
    'nullNextReviewDates', (SELECT count(*) FROM user_progress WHERE next_review_at IS NULL),
    'orphanVocabularies', (SELECT count(*) FROM vocabularies v LEFT JOIN vocabulary_topics t ON t.id = v.topic_id WHERE t.id IS NULL),
    'orphanVocabularyProgress', (SELECT count(*) FROM user_progress p LEFT JOIN vocabularies v ON v.id = p.vocabulary_id WHERE v.id IS NULL),
    'orphanLessonProgress', (SELECT count(*) FROM lesson_progress p LEFT JOIN grammar_lessons l ON l.id = p.lesson_id WHERE l.id IS NULL),
    'completedLessonsWithoutTimestamp', (SELECT count(*) FROM lesson_progress WHERE status = 'COMPLETED' AND completed_at IS NULL),
    'negativeSessionDuration', (SELECT count(*) FROM learning_sessions WHERE duration_seconds < 0),
    'lessonsNeedingCategoryMapping', (SELECT count(*) FROM grammar_lessons)
  ),
  'outbox', (SELECT jsonb_build_object('unpublished', count(*) FILTER (WHERE published_at IS NULL), 'oldestUnpublishedAt', min(created_at) FILTER (WHERE published_at IS NULL)) FROM outbox_events),
  'migrations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', migration_name, 'checksum', checksum, 'finishedAt', finished_at, 'rolledBackAt', rolled_back_at, 'appliedSteps', applied_steps_count) ORDER BY started_at), '[]'::jsonb) FROM _prisma_migrations)
);
COMMIT;
