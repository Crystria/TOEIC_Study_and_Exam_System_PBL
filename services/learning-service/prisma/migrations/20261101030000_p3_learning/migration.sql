-- Learning P3. Never fabricate quality, firstLearned, quiz or category for legacy data.
BEGIN;
CREATE FUNCTION pg_temp.p3_normalize(text) RETURNS text LANGUAGE SQL IMMUTABLE AS $norm$ SELECT lower(btrim(normalize($1,NFC),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) $norm$;
LOCK TABLE vocabulary_topics,vocabularies,grammar_lessons,user_progress,lesson_progress,learning_sessions IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM user_progress) OR EXISTS(SELECT 1 FROM lesson_progress) THEN RAISE EXCEPTION 'P3_LEGACY_PROGRESS_REQUIRES_REVIEW: quality/provenance mapping is required'; END IF;
 IF EXISTS(SELECT 1 FROM grammar_lessons) THEN RAISE EXCEPTION 'P3_LEGACY_LESSON_CATEGORY_REQUIRED: supply a reviewed category mapping before cutover'; END IF;
 IF EXISTS(SELECT 1 FROM vocabularies GROUP BY topic_id,pg_temp.p3_normalize(word) HAVING count(*)>1) THEN RAISE EXCEPTION 'P3_DUPLICATE_VOCABULARY: resolve normalized words'; END IF;
 IF EXISTS(SELECT 1 FROM vocabularies WHERE char_length(pg_temp.p3_normalize(word))=0 OR char_length(pg_temp.p3_normalize(meaning))=0) THEN RAISE EXCEPTION 'P3_INVALID_LEGACY_CONTENT'; END IF;
END $$;
ALTER TABLE vocabularies RENAME COLUMN pronunciation TO phonetic;
ALTER TABLE vocabularies RENAME COLUMN meaning TO definition;
ALTER TABLE grammar_lessons RENAME COLUMN title TO lesson_title;
ALTER TABLE grammar_lessons RENAME COLUMN content TO content_markdown;
-- CreateEnum
CREATE TYPE "VocabularySessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "vocabularies" DROP CONSTRAINT "vocabularies_topic_id_fkey";

-- DropForeignKey
ALTER TABLE "user_progress" DROP CONSTRAINT "user_progress_vocabulary_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lesson_id_fkey";

-- AlterTable
ALTER TABLE "vocabulary_topics" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vocabularies" ADD COLUMN     "audio_key" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "image_key" TEXT,
ADD COLUMN     "normalized_definition" TEXT,
ADD COLUMN     "normalized_word" TEXT;

-- AlterTable
ALTER TABLE "grammar_lessons" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_vocabulary_progress" (
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

    CONSTRAINT "user_vocabulary_progress_pkey" PRIMARY KEY ("user_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "user_lesson_progress" (
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "completed_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revision" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "user_lesson_progress_pkey" PRIMARY KEY ("user_id","lesson_id")
);

-- CreateTable
CREATE TABLE "vocabulary_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "VocabularySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "operation_id" TEXT,
    "submit_hash" TEXT,
    "result" JSONB,

    CONSTRAINT "vocabulary_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_session_items" (
    "session_id" TEXT NOT NULL,
    "vocabulary_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "expected_revision" BIGINT NOT NULL,
    "quality" INTEGER,
    "snapshot" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "correct_option" TEXT NOT NULL,
    "selected_option" TEXT,
    "quiz_correct" BOOLEAN,

    CONSTRAINT "vocabulary_session_items_pkey" PRIMARY KEY ("session_id","vocabulary_id")
);

-- CreateTable
CREATE TABLE "operation_ledger" (
    "user_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "action_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "reason" TEXT,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_ledger_pkey" PRIMARY KEY ("user_id","operation_id")
);

-- CreateTable
CREATE TABLE "content_idempotency" (
    "actor_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_idempotency_pkey" PRIMARY KEY ("actor_id","scope","key")
);

-- CreateTable
CREATE TABLE "content_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "correlation_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_uploads" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "vocabulary_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "learning_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_storage_garbage" (
    "object_key" TEXT NOT NULL,
    "delete_after" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_storage_garbage_pkey" PRIMARY KEY ("object_key")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "user_vocabulary_progress_user_id_next_review_date_idx" ON "user_vocabulary_progress"("user_id", "next_review_date");

-- CreateIndex
CREATE INDEX "vocabulary_sessions_user_id_started_at_idx" ON "vocabulary_sessions"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_session_items_question_id_key" ON "vocabulary_session_items"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_session_items_session_id_position_key" ON "vocabulary_session_items"("session_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "learning_uploads_object_key_key" ON "learning_uploads"("object_key");

-- CreateIndex
CREATE INDEX "learning_uploads_expires_at_idx" ON "learning_uploads"("expires_at");

-- AddForeignKey
ALTER TABLE "vocabularies" ADD CONSTRAINT "vocabularies_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "vocabulary_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "grammar_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vocabulary_progress" ADD CONSTRAINT "user_vocabulary_progress_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lesson_progress" ADD CONSTRAINT "user_lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "grammar_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_sessions" ADD CONSTRAINT "vocabulary_sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "vocabulary_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_session_items" ADD CONSTRAINT "vocabulary_session_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "vocabulary_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_session_items" ADD CONSTRAINT "vocabulary_session_items_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_uploads" ADD CONSTRAINT "learning_uploads_vocabulary_id_fkey" FOREIGN KEY ("vocabulary_id") REFERENCES "vocabularies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


UPDATE vocabularies SET normalized_word=pg_temp.p3_normalize(word),normalized_definition=pg_temp.p3_normalize(definition);
ALTER TABLE vocabularies ALTER COLUMN normalized_word SET NOT NULL,ALTER COLUMN normalized_definition SET NOT NULL;
CREATE UNIQUE INDEX vocabularies_active_word_key ON vocabularies(topic_id,normalized_word) WHERE deleted_at IS NULL;
ALTER TABLE user_vocabulary_progress ADD CONSTRAINT vocabulary_progress_bounds CHECK(quality BETWEEN 0 AND 5 AND interval_days>=0 AND repetition_number>=0 AND easiness_factor>=1.3 AND revision>0);
ALTER TABLE user_lesson_progress ADD CONSTRAINT lesson_progress_bounds CHECK(status='COMPLETED' AND revision>0);
COMMIT;
