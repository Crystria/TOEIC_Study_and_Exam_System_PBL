-- Catalog only. Does not export row values or column defaults.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SELECT jsonb_build_object(
  'database', current_database(),
  'capturedAt', clock_timestamp(),
  'transactionReadOnly', current_setting('transaction_read_only'),
  'serverVersion', current_setting('server_version'),
  'columns', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', table_name, 'column', column_name, 'type', data_type,
      'underlyingType', udt_name, 'nullable', is_nullable
    ) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'public'
  ), '[]'::jsonb),
  'constraints', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname, 'name', c.conname, 'kind', c.contype,
      'definition', pg_get_constraintdef(c.oid)
    ) ORDER BY t.relname, c.conname)
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'
  ), '[]'::jsonb),
  'enums', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('type', t.typname, 'label', e.enumlabel)
      ORDER BY t.typname, e.enumsortorder)
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public'
  ), '[]'::jsonb)
);
COMMIT;
