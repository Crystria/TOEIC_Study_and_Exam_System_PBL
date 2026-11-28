BEGIN;
-- CreateTable
CREATE TABLE "learning_progress_heads" (
    "user_id" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "learning_progress_heads_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sync_resolutions" (
    "user_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "sync_version" BIGINT NOT NULL,
    "action_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "envelope" JSONB NOT NULL,

    CONSTRAINT "sync_resolutions_pkey" PRIMARY KEY ("user_id","operation_id","sync_version")
);

INSERT INTO learning_progress_heads(user_id,version) SELECT user_id,sum(revision)::bigint FROM (SELECT user_id,revision FROM user_vocabulary_progress UNION ALL SELECT user_id,revision FROM user_lesson_progress) p GROUP BY user_id;
ALTER TABLE learning_progress_heads ADD CONSTRAINT learning_progress_version_bounds CHECK(version>=0);
COMMIT;
