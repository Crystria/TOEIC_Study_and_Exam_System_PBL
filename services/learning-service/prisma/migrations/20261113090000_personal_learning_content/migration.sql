-- CreateTable
CREATE TABLE "personal_vocabulary_topics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_vocabulary_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_vocabularies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "definition" TEXT NOT NULL,
    "example" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_vocabularies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_grammar_lessons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_grammar_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_vocabulary_topics_user_id_name_idx" ON "personal_vocabulary_topics"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "personal_vocabulary_topics_id_user_id_key" ON "personal_vocabulary_topics"("id", "user_id");

-- CreateIndex
CREATE INDEX "personal_vocabularies_user_id_topic_id_idx" ON "personal_vocabularies"("user_id", "topic_id");

-- CreateIndex
CREATE INDEX "personal_vocabularies_user_id_word_idx" ON "personal_vocabularies"("user_id", "word");

-- CreateIndex
CREATE UNIQUE INDEX "personal_vocabularies_id_user_id_key" ON "personal_vocabularies"("id", "user_id");

-- CreateIndex
CREATE INDEX "personal_grammar_lessons_user_id_lesson_title_idx" ON "personal_grammar_lessons"("user_id", "lesson_title");

-- CreateIndex
CREATE INDEX "personal_grammar_lessons_user_id_category_idx" ON "personal_grammar_lessons"("user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "personal_grammar_lessons_id_user_id_key" ON "personal_grammar_lessons"("id", "user_id");

-- AddForeignKey
ALTER TABLE "personal_vocabularies" ADD CONSTRAINT "personal_vocabularies_topic_id_user_id_fkey" FOREIGN KEY ("topic_id", "user_id") REFERENCES "personal_vocabulary_topics"("id", "user_id") ON DELETE CASCADE ON UPDATE RESTRICT;

