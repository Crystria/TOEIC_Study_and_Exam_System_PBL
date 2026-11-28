-- AlterTable
ALTER TABLE "score_history" ALTER COLUMN "score" DROP NOT NULL;
ALTER TABLE "score_history" ALTER COLUMN "test_type" DROP NOT NULL;

ALTER TABLE "score_history"
ADD COLUMN "mode" TEXT,
ADD COLUMN "accuracy" DOUBLE PRECISION,
ADD COLUMN "parts" JSONB;

-- Full rows keep mode=FULL; legacy MINI rows stay mode=NULL for explicit legacy handling.
UPDATE "score_history" SET "mode" = 'FULL' WHERE "test_type" = 'FULL';

-- CreateIndex
CREATE INDEX "score_history_user_id_taken_at_idx" ON "score_history"("user_id", "taken_at");
CREATE INDEX "score_history_mode_idx" ON "score_history"("mode");
