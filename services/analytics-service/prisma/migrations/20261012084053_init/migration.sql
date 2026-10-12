-- CreateTable
CREATE TABLE "user_learning_stats" (
    "user_id" TEXT NOT NULL,
    "total_study_days" INTEGER NOT NULL DEFAULT 0,
    "total_lessons" INTEGER NOT NULL DEFAULT 0,
    "total_vocab_learned" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "score_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "test_type" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_activity" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "ref_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "learning_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_streaks" (
    "user_id" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" TIMESTAMP(3),

    CONSTRAINT "daily_streaks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "weak_areas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_area" TEXT NOT NULL,
    "part" INTEGER NOT NULL DEFAULT 0,
    "error_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weak_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "score_history_attempt_id_key" ON "score_history"("attempt_id");

-- CreateIndex
CREATE INDEX "score_history_user_id_idx" ON "score_history"("user_id");

-- CreateIndex
CREATE INDEX "learning_activity_user_id_occurred_at_idx" ON "learning_activity"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "weak_areas_user_id_idx" ON "weak_areas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "weak_areas_user_id_skill_area_part_key" ON "weak_areas"("user_id", "skill_area", "part");
