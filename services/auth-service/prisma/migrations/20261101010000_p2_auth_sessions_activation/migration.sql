-- P2 Auth cutover. Preserve legacy IDs, avatar URLs and audit rows.
BEGIN;
LOCK TABLE users, roles, user_roles, refresh_tokens IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM users WHERE id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'P2_INVALID_USER_ID: preserve references and resolve invalid UUIDs before cutover'; END IF;
 IF EXISTS (SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1) THEN RAISE EXCEPTION 'P2_EMAIL_COLLISION: resolve normalized emails before migration'; END IF;
 IF EXISTS (SELECT 1 FROM users WHERE status::text='LOCKED' AND locked_until IS NULL) THEN RAISE EXCEPTION 'P2_AMBIGUOUS_LOCKED_USER: classify permanent vs temporary lock'; END IF;
 IF EXISTS (SELECT 1 FROM roles WHERE code NOT IN ('USER','CONTENT_ADMIN','SYSTEM_ADMIN')) THEN RAISE EXCEPTION 'P2_UNKNOWN_ROLE: resolve role mapping'; END IF;
 IF EXISTS (SELECT 1 FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id)) THEN RAISE EXCEPTION 'P2_ROLELESS_USER: classify role assignments before cutover'; END IF;
 IF EXISTS (SELECT 1 FROM refresh_tokens GROUP BY token_hash HAVING count(*) > 1) THEN RAISE EXCEPTION 'P2_DUPLICATE_REFRESH_HASH'; END IF;
END $$;
UPDATE users SET email=lower(btrim(email));
UPDATE users SET status='ACTIVE' WHERE status::text='LOCKED';
ALTER TYPE "UserStatus" RENAME VALUE 'PENDING' TO 'INACTIVE';
ALTER TYPE "UserStatus" RENAME VALUE 'DISABLED' TO 'SUSPENDED';
ALTER TABLE users RENAME COLUMN failed_login_attempts TO failed_login_count;
ALTER TABLE roles RENAME COLUMN code TO role_code;
ALTER INDEX roles_code_key RENAME TO roles_role_code_key;
-- Old refresh JWTs cannot cross over to opaque sessions.
UPDATE refresh_tokens SET revoked_at=coalesce(revoked_at,timezone('UTC',now()));
-- AlterEnum
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "UserStatus_old";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authorization_version" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "avatar_key" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD COLUMN     "role_code" TEXT,
ALTER COLUMN "role_id" DROP NOT NULL,
ADD CONSTRAINT "user_roles_legacy_placeholder" CHECK (true);
UPDATE user_roles ur SET role_code = r.role_code FROM roles r WHERE r.id = ur.role_id;
ALTER TABLE user_roles ALTER COLUMN role_code SET NOT NULL, DROP CONSTRAINT user_roles_legacy_placeholder, ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id,role_code);

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "consumed_at" TIMESTAMP(3),
ADD COLUMN     "session_id" TEXT;

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "version" BIGINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_activations" (
    "is_resend" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_token" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_until" TIMESTAMPTZ,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "correlation_id" TEXT NOT NULL,
    "ip" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_uploads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "avatar_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_garbage" (
    "object_key" TEXT NOT NULL,
    "delete_after" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_garbage_pkey" PRIMARY KEY ("object_key")
);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_activations_token_hash_key" ON "email_activations"("token_hash");

-- CreateIndex
CREATE INDEX "email_activations_user_id_created_at_idx" ON "email_activations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "email_deliveries_delivered_at_next_attempt_at_idx" ON "email_deliveries"("delivered_at", "next_attempt_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_occurred_at_idx" ON "admin_audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_user_id_target_user_id_idx" ON "admin_audit_logs"("actor_user_id", "target_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "avatar_uploads_object_key_key" ON "avatar_uploads"("object_key");

-- CreateIndex
CREATE INDEX "avatar_uploads_expires_at_idx" ON "avatar_uploads"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("role_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_activations" ADD CONSTRAINT "email_activations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_uploads" ADD CONSTRAINT "avatar_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE UNIQUE INDEX users_email_lower_key ON users(lower(email));
ALTER TABLE roles ADD CONSTRAINT roles_known_code CHECK (role_code IN ('USER','CONTENT_ADMIN','SYSTEM_ADMIN'));
INSERT INTO roles(id,role_code,name) VALUES
 (gen_random_uuid()::text,'USER','User'),
 (gen_random_uuid()::text,'CONTENT_ADMIN','Content administrator'),
 (gen_random_uuid()::text,'SYSTEM_ADMIN','System administrator')
 ON CONFLICT(role_code) DO NOTHING;
COMMIT;
