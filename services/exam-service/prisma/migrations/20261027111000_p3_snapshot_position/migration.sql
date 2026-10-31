-- Preserve the blank/member mapping independently from global test position.
ALTER TABLE attempt_question_snapshots ADD COLUMN position_in_group INTEGER;
