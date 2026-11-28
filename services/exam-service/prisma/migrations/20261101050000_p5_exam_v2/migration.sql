BEGIN;
-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "scoring" JSONB;
COMMIT;
