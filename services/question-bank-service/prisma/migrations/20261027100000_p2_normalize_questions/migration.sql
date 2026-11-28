-- Preserve question IDs and derive the canonical answer key before retiring scaffold fields.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM question_options GROUP BY question_id, option_key HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve duplicate option codes before deploying P2';
  END IF;
END $$;
ALTER TABLE questions RENAME COLUMN stem TO question_text;
ALTER TABLE questions ALTER COLUMN question_text DROP NOT NULL;
ALTER TABLE questions ADD COLUMN correct_option TEXT;
UPDATE questions q SET correct_option = (
  SELECT min(option_key) FROM question_options o WHERE o.question_id = q.id AND o.is_correct
);
-- Ambiguous legacy answers remain archived for administrator recovery.
UPDATE questions q SET deleted_at = COALESCE(deleted_at, updated_at)
WHERE (SELECT count(*) FROM question_options o WHERE o.question_id = q.id AND o.is_correct) <> 1;
UPDATE questions SET correct_option = '' WHERE correct_option IS NULL;
ALTER TABLE questions ALTER COLUMN correct_option SET NOT NULL;
ALTER TABLE questions DROP COLUMN status, DROP COLUMN media_url;
DROP TYPE "QuestionStatus";
ALTER TABLE question_options RENAME COLUMN option_key TO option_code;
ALTER TABLE question_options RENAME COLUMN content TO option_text;
ALTER TABLE question_options DROP CONSTRAINT question_options_pkey;
ALTER TABLE question_options DROP COLUMN id, DROP COLUMN media_url, DROP COLUMN is_correct;
DROP INDEX question_options_question_id_idx;
ALTER TABLE question_options ADD CONSTRAINT question_options_pkey PRIMARY KEY (question_id, option_code);
ALTER TABLE outbox_events ADD COLUMN next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN dead_lettered_at TIMESTAMP(3);
CREATE INDEX outbox_events_published_at_dead_lettered_at_next_attempt_at_idx ON outbox_events(published_at, dead_lettered_at, next_attempt_at);
