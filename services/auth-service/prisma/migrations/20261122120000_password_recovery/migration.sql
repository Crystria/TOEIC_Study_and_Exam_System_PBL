ALTER TABLE "email_deliveries" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'ACTIVATION';
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_purpose_check"
  CHECK ("purpose" IN ('ACTIVATION', 'PASSWORD_RESET'));

CREATE TABLE "password_resets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "authorization_version" BIGINT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_created_at_idx" ON "password_resets"("user_id", "created_at");
