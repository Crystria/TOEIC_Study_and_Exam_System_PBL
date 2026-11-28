BEGIN;
LOCK TABLE user_sync_states IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM user_sync_states WHERE version<>0) THEN RAISE EXCEPTION 'P4_LEGACY_SYNC_REQUIRES_REVIEW'; END IF; END $$;
-- CreateTable
CREATE TABLE "sync_heads" (
    "repair_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "sync_version" BIGINT NOT NULL DEFAULT 0,
    "resolved_version" BIGINT NOT NULL DEFAULT 0,
    "applied_version" BIGINT NOT NULL DEFAULT 0,
    "pending_operation_id" TEXT,
    "projected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bootstrap_done" BOOLEAN NOT NULL DEFAULT false,
    "bootstrap_cursor" TEXT,
    "bootstrap_watermark" BIGINT,

    CONSTRAINT "sync_heads_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "reconciliation_envelope" JSONB,
    "user_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "sync_version" BIGINT NOT NULL,
    "device_id" TEXT NOT NULL,
    "action_hash" TEXT NOT NULL,
    "operation" JSONB NOT NULL,
    "command" JSONB NOT NULL,
    "command_event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "progress" JSONB NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL,
    "activity_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "result_hash" TEXT,
    "last_reconciled_at" TIMESTAMP(3),

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("user_id","operation_id")
);

-- CreateTable
CREATE TABLE "sync_device_cursors" (
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "accepted_version" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_device_cursors_pkey" PRIMARY KEY ("user_id","device_id")
);

-- CreateTable
CREATE TABLE "sync_projections" (
    "user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,
    "state" JSONB NOT NULL,
    "projected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_projections_pkey" PRIMARY KEY ("user_id","entity_type","entity_id")
);

-- CreateTable
CREATE TABLE "sync_inbox" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_inbox_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "sync_quarantine" (
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_quarantine_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_command_event_id_key" ON "sync_operations"("command_event_id");

-- CreateIndex
CREATE INDEX "sync_operations_status_accepted_at_idx" ON "sync_operations"("status", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_user_id_sync_version_key" ON "sync_operations"("user_id", "sync_version");

CREATE UNIQUE INDEX sync_operations_one_pending ON sync_operations(user_id) WHERE status='PENDING';
ALTER TABLE sync_heads ADD CONSTRAINT sync_head_bounds CHECK(sync_version>=0 AND resolved_version>=0 AND applied_version>=0 AND resolved_version<=sync_version AND applied_version<=sync_version);
ALTER TABLE sync_operations ADD CONSTRAINT sync_operation_status CHECK(sync_version>0 AND status IN ('PENDING','APPLIED','REJECTED'));
ALTER TABLE sync_projections ADD CONSTRAINT sync_projection_revision CHECK(revision>=0);
INSERT INTO sync_heads(user_id) SELECT id FROM users;
COMMIT;
