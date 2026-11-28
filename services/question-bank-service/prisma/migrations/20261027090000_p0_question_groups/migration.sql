-- CreateEnum
CREATE TYPE "QuestionGroupAssetKind" AS ENUM ('AUDIO', 'IMAGE', 'TEXT');

-- AlterTable
ALTER TABLE "questions"
ADD COLUMN "group_id" TEXT,
ADD COLUMN "position_in_group" INTEGER,
ADD COLUMN "transcript" TEXT,
ADD COLUMN "audio_key" TEXT,
ADD COLUMN "image_key" TEXT,
ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "question_groups" (
    "group_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "instruction" TEXT,
    "audio_key" TEXT,
    "transcript" TEXT,
    "passage_text" TEXT,
    "order_no" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "question_group_assets" (
    "asset_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "kind" "QuestionGroupAssetKind" NOT NULL,
    "storage_key" TEXT,
    "content" TEXT,
    "order_no" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_group_assets_pkey" PRIMARY KEY ("asset_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "questions_group_id_position_in_group_key" ON "questions"("group_id", "position_in_group");

-- CreateIndex
CREATE INDEX "questions_part_deleted_at_idx" ON "questions"("part", "deleted_at");

-- CreateIndex
CREATE INDEX "questions_group_id_idx" ON "questions"("group_id");

-- CreateIndex
CREATE INDEX "question_groups_part_deleted_at_idx" ON "question_groups"("part", "deleted_at");

-- CreateIndex
CREATE INDEX "question_groups_order_no_idx" ON "question_groups"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "question_group_assets_group_id_order_no_key" ON "question_group_assets"("group_id", "order_no");

-- CreateIndex
CREATE INDEX "question_group_assets_group_id_idx" ON "question_group_assets"("group_id");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "question_groups"("group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_group_assets" ADD CONSTRAINT "question_group_assets_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "question_groups"("group_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "outbox_events"
ADD COLUMN "aggregate_type" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_error" TEXT;

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");

-- Backfill archive semantics for legacy rows
UPDATE "questions" SET "deleted_at" = "updated_at" WHERE "status" = 'ARCHIVED';
