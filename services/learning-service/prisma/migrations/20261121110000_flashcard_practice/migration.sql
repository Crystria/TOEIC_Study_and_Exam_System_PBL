CREATE TABLE "user_personal_vocabulary_progress" (
    "user_id" TEXT NOT NULL,
    "vocabulary_id" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "easiness_factor" DECIMAL(4,2) NOT NULL,
    "repetition_number" INTEGER NOT NULL,
    "next_review_date" DATE NOT NULL,
    "first_learned_at" TIMESTAMP(3),
    "revision" BIGINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_personal_vocabulary_progress_pkey" PRIMARY KEY ("user_id", "vocabulary_id"),
    CONSTRAINT "user_personal_vocabulary_progress_word_fkey" FOREIGN KEY ("vocabulary_id", "user_id") REFERENCES "personal_vocabularies"("id", "user_id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE INDEX "user_personal_vocabulary_progress_user_id_next_review_date_idx"
    ON "user_personal_vocabulary_progress"("user_id", "next_review_date");

CREATE TABLE "flashcard_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "VocabularySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "result" JSONB,

    CONSTRAINT "flashcard_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flashcard_sessions_user_id_started_at_idx" ON "flashcard_sessions"("user_id", "started_at");

CREATE TABLE "flashcard_session_items" (
    "question_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "vocabulary_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "expected_revision" BIGINT NOT NULL,
    "quality" INTEGER,
    "review_progress" JSONB,
    "snapshot" JSONB NOT NULL,
    "direction" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_option" TEXT NOT NULL,

    CONSTRAINT "flashcard_session_items_pkey" PRIMARY KEY ("question_id"),
    CONSTRAINT "flashcard_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "flashcard_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "flashcard_session_items_session_id_vocabulary_id_key" ON "flashcard_session_items"("session_id", "vocabulary_id");
CREATE UNIQUE INDEX "flashcard_session_items_session_id_position_key" ON "flashcard_session_items"("session_id", "position");
