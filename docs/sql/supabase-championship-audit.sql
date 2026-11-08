-- READ ONLY: metadata only, no gameplay rows or Auth credentials.
-- Run each SELECT in Supabase SQL Editor on the intended project.
-- Do not execute any returned function definition or trigger definition.

-- 1. Every overload: exact names, types, defaults, return shape, security and EXECUTE access.
SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_get_function_arguments(p.oid) AS arguments_and_defaults,
       pg_get_function_result(p.oid) AS return_type,
       p.proretset AS returns_set, p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner, p.proconfig AS function_settings,
       p.proacl AS function_acl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'save_game_attempt'
ORDER BY p.oid;

-- 2. Actual columns/defaults, including mode/session types and progress conflict keys.
SELECT table_name, ordinal_position, column_name, data_type, udt_schema, udt_name,
       is_nullable, column_default, is_generated, generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('game_attempts', 'game_progress', 'championship_sessions',
                     'championship_participants', 'student_profiles', 'teacher_profiles')
ORDER BY table_name, ordinal_position;

-- 3. Enum labels used by these tables (if mode is an enum rather than text).
SELECT DISTINCT ns.nspname AS type_schema, t.typname, e.enumsortorder, e.enumlabel
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace ns ON ns.oid = t.typnamespace
JOIN pg_attribute a ON a.atttypid = t.oid
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace cn ON cn.oid = c.relnamespace
WHERE cn.nspname = 'public' AND c.relname IN
  ('game_attempts', 'game_progress', 'championship_sessions', 'championship_participants')
ORDER BY type_schema, typname, enumsortorder;

-- 4. PK, FK (including delete actions), UNIQUE and CHECK; validated status matters.
SELECT c.relname AS table_name, con.conname, con.contype, con.convalidated,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
  ('game_attempts', 'game_progress', 'championship_sessions',
   'championship_participants', 'student_profiles', 'teacher_profiles')
ORDER BY c.relname, con.conname;

-- 5. Indexes, including partial uniqueness of active sessions and upsert keys.
SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public' AND tablename IN
  ('game_attempts', 'game_progress', 'championship_sessions', 'championship_participants')
ORDER BY tablename, indexname;

-- 6. RLS enabled/forced, policy commands, USING and WITH CHECK.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN
  ('game_attempts', 'game_progress', 'championship_sessions',
   'championship_participants', 'student_profiles', 'teacher_profiles');

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename IN
  ('game_attempts', 'game_progress', 'championship_sessions',
   'championship_participants', 'student_profiles', 'teacher_profiles')
ORDER BY tablename, policyname;

-- 7. Effective table access (RLS still applies to allowed table operations).
SELECT c.relname AS table_name, r.role_name,
       has_table_privilege(r.role_name, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.role_name, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.role_name, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.role_name, c.oid, 'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role_name)
WHERE n.nspname = 'public' AND c.relname IN
  ('game_attempts', 'game_progress', 'championship_sessions',
   'championship_participants', 'student_profiles', 'teacher_profiles')
ORDER BY c.relname, r.role_name;

-- 8. Triggers may rewrite mode/session or update the wrong progress record.
SELECT c.relname AS table_name, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid, true) AS trigger_definition,
       pg_get_functiondef(p.oid) AS trigger_function_definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname IN
  ('game_attempts', 'game_progress', 'championship_sessions', 'championship_participants')
ORDER BY c.relname, t.tgname;
