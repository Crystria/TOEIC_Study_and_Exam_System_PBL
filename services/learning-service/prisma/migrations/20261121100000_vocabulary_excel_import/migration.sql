ALTER TABLE "vocabulary_topics"
ADD COLUMN "import_source" TEXT,
ADD COLUMN "import_list_key" TEXT;

CREATE UNIQUE INDEX "vocabulary_topics_import_source_import_list_key_key"
ON "vocabulary_topics"("import_source", "import_list_key");

ALTER TABLE "vocabularies"
ADD COLUMN "part_of_speech" TEXT,
ADD COLUMN "english_definition" TEXT;
