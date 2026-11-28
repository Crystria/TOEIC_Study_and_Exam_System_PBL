-- P0 preflight for the CURRENT legacy auth schema. Aggregate results only; no PII.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_schema() AS schema_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name;
SELECT status, count(*) AS users FROM users GROUP BY status ORDER BY status;
SELECT count(*) AS normalized_email_collision_groups FROM (
  SELECT lower(trim(email)) FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1
) AS collisions;
SELECT count(*) FILTER (WHERE password_hash !~ '^\$2[aby]\$12\$') AS unexpected_password_hashes,
       count(*) FILTER (WHERE avatar_url IS NOT NULL) AS avatar_urls_to_classify,
       count(*) FILTER (WHERE locked_until IS NOT NULL) AS locks_to_classify
FROM users;
SELECT code, count(ur.user_id) AS assignments FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id GROUP BY code ORDER BY code;
SELECT count(*) AS orphan_assignments FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.id IS NULL OR r.id IS NULL;
SELECT count(*) AS refresh_tokens, count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now()) AS active_legacy_refresh FROM refresh_tokens;
SELECT count(*) AS duplicate_refresh_hash_groups FROM (SELECT token_hash FROM refresh_tokens GROUP BY token_hash HAVING count(*) > 1) AS hashes;
SELECT count(*) AS legacy_sync_rows_without_payload, max(version) AS maximum_legacy_device_version FROM user_sync_states;
SELECT count(*) AS audit_logs FROM audit_logs;
SELECT count(*) AS outbox_rows, count(*) FILTER (WHERE published_at IS NULL) AS unpublished FROM outbox_events;
COMMIT;
