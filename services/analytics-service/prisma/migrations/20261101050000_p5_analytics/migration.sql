BEGIN;
-- AlterTable
ALTER TABLE "processed_events" ADD COLUMN     "payload_hash" TEXT,
ADD COLUMN     "schema_version" INTEGER;

-- CreateTable
CREATE TABLE "attempt_facts" (
    "attempt_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "attempt_facts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "test_score_facts" (
    "attempt_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "score_listening" INTEGER NOT NULL,
    "score_reading" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL,
    "scoring" JSONB NOT NULL,

    CONSTRAINT "test_score_facts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "practice_facts" (
    "attempt_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "practice_facts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "attempt_part_facts" (
    "attempt_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "attempt_part_facts_pkey" PRIMARY KEY ("attempt_id","part")
);

-- CreateTable
CREATE TABLE "learning_activity_facts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "business_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation_id" TEXT,
    "revision" BIGINT,
    "activity_at" TIMESTAMP(3) NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "learning_activity_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "first_learned_entities" (
    "user_id" TEXT NOT NULL,
    "vocabulary_id" TEXT NOT NULL,
    "first_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "first_learned_entities_pkey" PRIMARY KEY ("user_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "completed_lesson_entities" (
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "first_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "completed_lesson_entities_pkey" PRIMARY KEY ("user_id","lesson_id")
);

-- CreateTable
CREATE TABLE "user_activity_days" (
    "user_id" TEXT NOT NULL,
    "activity_date" DATE NOT NULL,

    CONSTRAINT "user_activity_days_pkey" PRIMARY KEY ("user_id","activity_date")
);

-- CreateTable
CREATE TABLE "user_statistics" (
    "user_id" TEXT NOT NULL,
    "vocabularies_learned" INTEGER NOT NULL,
    "review_count" INTEGER NOT NULL,
    "grammar_lessons_completed" INTEGER NOT NULL,
    "mock_test_count" INTEGER NOT NULL,
    "practice_count" INTEGER NOT NULL,
    "study_days" INTEGER NOT NULL,
    "learning_streak_days" INTEGER NOT NULL,
    "longest_streak" INTEGER NOT NULL,
    "predicted_toeic_score" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_statistics_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_weak_areas" (
    "user_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "weakness_score" DOUBLE PRECISION,
    "is_weak" BOOLEAN,
    "calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_weak_areas_pkey" PRIMARY KEY ("user_id","part")
);

-- CreateTable
CREATE TABLE "analytics_quarantine" (
    "event_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_quarantine_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "attempt_facts_user_id_completed_at_idx" ON "attempt_facts"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "test_score_facts_user_id_completed_at_idx" ON "test_score_facts"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "practice_facts_user_id_completed_at_idx" ON "practice_facts"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_activity_facts_event_id_key" ON "learning_activity_facts"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_activity_facts_business_key_key" ON "learning_activity_facts"("business_key");

-- CreateIndex
CREATE INDEX "learning_activity_facts_user_id_activity_at_idx" ON "learning_activity_facts"("user_id", "activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "learning_activity_facts_user_id_kind_entity_id_revision_key" ON "learning_activity_facts"("user_id", "kind", "entity_id", "revision");

-- CreateIndex
CREATE INDEX "first_learned_entities_user_id_first_at_idx" ON "first_learned_entities"("user_id", "first_at");

-- CreateIndex
CREATE INDEX "completed_lesson_entities_user_id_first_at_idx" ON "completed_lesson_entities"("user_id", "first_at");

-- AddForeignKey
ALTER TABLE "test_score_facts" ADD CONSTRAINT "test_score_facts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt_facts"("attempt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_facts" ADD CONSTRAINT "practice_facts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt_facts"("attempt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_part_facts" ADD CONSTRAINT "attempt_part_facts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt_facts"("attempt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE attempt_facts ADD CONSTRAINT attempt_mode CHECK(mode IN ('FULL','PART'));
ALTER TABLE test_score_facts ADD CONSTRAINT full_score_bounds CHECK(score_listening BETWEEN 5 AND 495 AND score_reading BETWEEN 5 AND 495 AND score_listening%5=0 AND score_reading%5=0 AND total_score=score_listening+score_reading);
ALTER TABLE practice_facts ADD CONSTRAINT practice_bounds CHECK(correct_count>=0 AND correct_count<=total_questions AND total_questions>0 AND accuracy>=0 AND accuracy<=1);
ALTER TABLE attempt_part_facts ADD CONSTRAINT part_bounds CHECK(part BETWEEN 1 AND 7 AND correct>=0 AND correct<=total AND total=CASE part WHEN 1 THEN 6 WHEN 2 THEN 25 WHEN 3 THEN 39 WHEN 4 THEN 30 WHEN 5 THEN 30 WHEN 6 THEN 16 WHEN 7 THEN 54 END);
COMMIT;
