-- Aggregate-only inventory for the catalog verified on 2026-10-31.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL TIME ZONE 'UTC';
SELECT jsonb_build_object(
  'database', current_database(), 'capturedAt', transaction_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'rowCounts', jsonb_build_object(
    'users', (SELECT count(*) FROM users), 'roles', (SELECT count(*) FROM roles),
    'user_roles', (SELECT count(*) FROM user_roles), 'refresh_tokens', (SELECT count(*) FROM refresh_tokens),
    'audit_logs', (SELECT count(*) FROM audit_logs), 'user_sync_states', (SELECT count(*) FROM user_sync_states),
    'outbox_events', (SELECT count(*) FROM outbox_events)
  ),
  'userStatusGroups', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY status), '[]'::jsonb) FROM (SELECT status, count(*) AS rows FROM users GROUP BY status) s),
  'roleAssignments', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY code), '[]'::jsonb) FROM (SELECT code, count(ur.user_id) AS assignments FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id GROUP BY code) r),
  'checks', jsonb_build_object(
    'normalizedEmailCollisionGroups', (SELECT count(*) FROM (SELECT lower(trim(email)) FROM users GROUP BY lower(trim(email)) HAVING count(*) > 1) s),
    'emailsNeedingNormalization', (SELECT count(*) FROM users WHERE email <> lower(trim(email))),
    'unexpectedBcryptCostOrFormat', (SELECT count(*) FROM users WHERE password_hash !~ '^\$2[aby]\$12\$'),
    'unknownRoles', (SELECT count(*) FROM roles WHERE code NOT IN ('USER','CONTENT_ADMIN','SYSTEM_ADMIN')),
    'usersWithoutRoles', (SELECT count(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id)),
    'orphanAssignments', (SELECT count(*) FROM user_roles ur LEFT JOIN users u ON u.id = ur.user_id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.id IS NULL OR r.id IS NULL),
    'activeSystemAdmins', (SELECT count(*) FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.status = 'ACTIVE' AND r.code = 'SYSTEM_ADMIN'),
    'duplicateRefreshHashGroups', (SELECT count(*) FROM (SELECT token_hash FROM refresh_tokens GROUP BY token_hash HAVING count(*) > 1) s),
    'activeLegacyRefreshTokens', (SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > transaction_timestamp()),
    'expiredUnrevokedRefreshTokens', (SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at <= transaction_timestamp()),
    'orphanRefreshTokens', (SELECT count(*) FROM refresh_tokens t LEFT JOIN users u ON u.id = t.user_id WHERE u.id IS NULL),
    'avatarReferencesToClassify', (SELECT count(*) FROM users WHERE avatar_url IS NOT NULL),
    'legacyLockedStatusToClassify', (SELECT count(*) FROM users WHERE status = 'LOCKED'),
    'nonNullLockTimesToClassify', (SELECT count(*) FROM users WHERE locked_until IS NOT NULL),
    'negativeFailedLoginCounts', (SELECT count(*) FROM users WHERE failed_login_attempts < 0),
    'syncRowsWithoutStatePayload', (SELECT count(*) FROM user_sync_states),
    'negativeDeviceVersions', (SELECT count(*) FROM user_sync_states WHERE version < 0)
  ),
  'outbox', (SELECT jsonb_build_object('unpublished', count(*) FILTER (WHERE published_at IS NULL), 'oldestUnpublishedAt', min(created_at) FILTER (WHERE published_at IS NULL)) FROM outbox_events),
  'migrations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', migration_name, 'checksum', checksum, 'finishedAt', finished_at, 'rolledBackAt', rolled_back_at, 'appliedSteps', applied_steps_count) ORDER BY started_at), '[]'::jsonb) FROM _prisma_migrations)
);
COMMIT;
