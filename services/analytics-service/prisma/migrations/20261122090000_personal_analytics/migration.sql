ALTER TABLE first_learned_entities ADD COLUMN scope TEXT NOT NULL DEFAULT 'SHARED',
  DROP CONSTRAINT first_learned_entities_pkey,
  ADD PRIMARY KEY (user_id, scope, vocabulary_id);
CREATE TABLE analytics_history_coverage (key TEXT PRIMARY KEY, live_from TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO analytics_history_coverage(key) VALUES ('personal-and-quiz');
CREATE TABLE historical_learned_words (user_id TEXT NOT NULL, scope TEXT NOT NULL, vocabulary_id TEXT NOT NULL, first_at TIMESTAMP(3) NOT NULL, PRIMARY KEY(user_id, scope, vocabulary_id));
