ALTER TABLE tests RENAME COLUMN id TO test_id;
ALTER TABLE tests RENAME COLUMN title TO test_title;
ALTER TABLE test_questions RENAME COLUMN order_no TO position;
ALTER TABLE test_questions DROP CONSTRAINT test_questions_pkey;
DROP INDEX test_questions_test_id_question_id_key;
ALTER TABLE test_questions ADD CONSTRAINT test_questions_pkey PRIMARY KEY (test_id, question_id);
CREATE UNIQUE INDEX test_questions_test_id_position_key ON test_questions(test_id, position);
ALTER TABLE attempts RENAME COLUMN id TO attempt_id;
-- Existing attempts stay read-only; only new attempts get version 1 snapshots.
ALTER TABLE attempts ADD COLUMN snapshot_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempt_question_snapshots ADD COLUMN type TEXT NOT NULL DEFAULT 'SINGLE_CHOICE';
CREATE TABLE attempt_start_requests (
  user_id TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  attempt_id TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attempt_start_requests_pkey PRIMARY KEY (user_id, key),
  CONSTRAINT attempt_start_requests_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES attempts(attempt_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX attempt_start_requests_attempt_id_idx ON attempt_start_requests(attempt_id);
ALTER TABLE outbox_events ADD COLUMN next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN dead_lettered_at TIMESTAMP(3);
CREATE INDEX outbox_events_published_at_dead_lettered_at_next_attempt_at_idx ON outbox_events(published_at, dead_lettered_at, next_attempt_at);
