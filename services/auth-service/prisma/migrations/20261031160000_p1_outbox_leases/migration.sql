ALTER TABLE outbox_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC',now()), ADD COLUMN last_error TEXT, ADD COLUMN lease_owner TEXT, ADD COLUMN lease_until TIMESTAMPTZ;
CREATE INDEX outbox_claim_pending_idx ON outbox_events(next_attempt_at, created_at) WHERE published_at IS NULL;
