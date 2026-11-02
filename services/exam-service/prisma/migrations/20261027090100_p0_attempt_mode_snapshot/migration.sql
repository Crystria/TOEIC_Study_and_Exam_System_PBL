-- AlterTable: archive legacy Mini/archived tests before removing TestType
ALTER TABLE "tests" ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "tests"
SET "deleted_at" = CURRENT_TIMESTAMP
WHERE "type" = 'MINI' OR "status" = 'ARCHIVED';

ALTER TABLE "tests" DROP COLUMN "type";
DROP TYPE "TestType";
ALTER TABLE "tests" DROP COLUMN "status";

CREATE INDEX "tests_deleted_at_idx" ON "tests"("deleted_at");

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('FULL', 'PART');

-- AlterTable: attempt metadata, deadline, scoring fields
ALTER TABLE "attempts"
ADD COLUMN "mode" "AttemptMode" NOT NULL DEFAULT 'FULL',
ADD COLUMN "duration_seconds" INTEGER,
ADD COLUMN "deadline_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "score_listening" INTEGER,
ADD COLUMN "score_reading" INTEGER,
ADD COLUMN "total_questions" INTEGER,
ADD COLUMN "accuracy" DOUBLE PRECISION;

ALTER TABLE "attempts" RENAME COLUMN "total_correct" TO "correct_count";

UPDATE "attempts" a
SET "duration_seconds" = t."duration_seconds"
FROM "tests" t
WHERE a."test_id" = t."id";

UPDATE "attempts" SET "duration_seconds" = 7200 WHERE "duration_seconds" IS NULL;
ALTER TABLE "attempts" ALTER COLUMN "duration_seconds" SET NOT NULL;

UPDATE "attempts"
SET "deadline_at" = "started_at" + ("duration_seconds" * INTERVAL '1 second')
WHERE "deadline_at" IS NULL;
ALTER TABLE "attempts" ALTER COLUMN "deadline_at" SET NOT NULL;

UPDATE "attempts"
SET "completed_at" = "submitted_at"
WHERE "completed_at" IS NULL AND "submitted_at" IS NOT NULL;

CREATE INDEX "attempts_user_id_started_at_idx" ON "attempts"("user_id", "started_at");
CREATE INDEX "attempts_status_deadline_at_idx" ON "attempts"("status", "deadline_at");
CREATE INDEX "attempts_test_id_status_idx" ON "attempts"("test_id", "status");

-- CreateTable
CREATE TABLE "attempt_parts" (
    "attempt_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "order_no" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "attempt_parts_pkey" PRIMARY KEY ("attempt_id", "part")
);

-- CreateTable
CREATE TABLE "attempt_group_snapshots" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "order_no" INTEGER NOT NULL,
    "type" TEXT,
    "instruction" TEXT,
    "audio_key" TEXT,
    "transcript" TEXT,
    "passage_text" TEXT,
    "assets" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_group_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_question_snapshots" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "group_snapshot_id" TEXT,
    "question_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "order_no" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "transcript" TEXT,
    "audio_key" TEXT,
    "image_key" TEXT,
    "explanation" TEXT,
    "options" JSONB NOT NULL,
    "correct_option" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_question_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attempt_parts_attempt_id_idx" ON "attempt_parts"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_group_snapshots_attempt_id_group_id_key" ON "attempt_group_snapshots"("attempt_id", "group_id");

-- CreateIndex
CREATE INDEX "attempt_group_snapshots_attempt_id_part_idx" ON "attempt_group_snapshots"("attempt_id", "part");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_question_snapshots_attempt_id_question_id_key" ON "attempt_question_snapshots"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_question_snapshots_attempt_id_order_no_key" ON "attempt_question_snapshots"("attempt_id", "order_no");

-- CreateIndex
CREATE INDEX "attempt_question_snapshots_attempt_id_part_idx" ON "attempt_question_snapshots"("attempt_id", "part");

-- CreateIndex
CREATE INDEX "attempt_question_snapshots_group_snapshot_id_idx" ON "attempt_question_snapshots"("group_snapshot_id");

-- AddForeignKey
ALTER TABLE "attempt_parts" ADD CONSTRAINT "attempt_parts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_group_snapshots" ADD CONSTRAINT "attempt_group_snapshots_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_question_snapshots" ADD CONSTRAINT "attempt_question_snapshots_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_question_snapshots" ADD CONSTRAINT "attempt_question_snapshots_group_snapshot_id_fkey" FOREIGN KEY ("group_snapshot_id") REFERENCES "attempt_group_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: legacy answers keep question_id; new answers may link to a snapshot
ALTER TABLE "attempt_answers" ADD COLUMN "attempt_question_snapshot_id" TEXT;

CREATE UNIQUE INDEX "attempt_answers_attempt_id_attempt_question_snapshot_id_key" ON "attempt_answers"("attempt_id", "attempt_question_snapshot_id");
CREATE INDEX "attempt_answers_attempt_question_snapshot_id_idx" ON "attempt_answers"("attempt_question_snapshot_id");

ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_question_snapshot_id_fkey" FOREIGN KEY ("attempt_question_snapshot_id") REFERENCES "attempt_question_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TestQuestion: enforce one question per test (dedupe legacy duplicates first)
DELETE FROM "test_questions" a
USING "test_questions" b
WHERE a."test_id" = b."test_id"
  AND a."question_id" = b."question_id"
  AND a."order_no" > b."order_no";

CREATE UNIQUE INDEX "test_questions_test_id_question_id_key" ON "test_questions"("test_id", "question_id");

-- AlterTable: outbox metadata
ALTER TABLE "outbox_events"
ADD COLUMN "aggregate_type" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_error" TEXT;

CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");
