-- READ ONLY. SELECT metadata, no function invocation, no gameplay/Auth rows.
-- Run with the earlier docs/sql/supabase-championship-audit.sql.
-- Review definitions locally and redact any embedded credentials before sharing.

-- 1. Engine capabilities; do not assume extension installation/schema.
SELECT current_setting('server_version') AS postgres_version;
SELECT e.extname, e.extversion, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 2. Existing app-schema / RPC collisions: absence must be established, not hidden.
SELECT nspname, nspacl FROM pg_namespace WHERE nspname IN ('aqua_math', 'public', 'auth');
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'aqua_math' ORDER BY c.relname;
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'aqua_math_%'
ORDER BY p.proname;

-- 3. All incoming and outgoing FKs for the shared gameplay/profile tables.
-- Includes other schemas: a dependency may belong to another application.
SELECT sn.nspname AS source_schema, src.relname AS source_table,
       tn.nspname AS target_schema, dst.relname AS target_table,
       con.conname, con.convalidated, pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid JOIN pg_namespace sn ON sn.oid = src.relnamespace
JOIN pg_class dst ON dst.oid = con.confrelid JOIN pg_namespace tn ON tn.oid = dst.relnamespace
WHERE con.contype = 'f' AND (
  (sn.nspname = 'public' AND src.relname IN ('game_attempts','game_progress','championship_sessions','championship_participants','student_profiles','teacher_profiles'))
  OR (tn.nspname = 'public' AND dst.relname IN ('game_attempts','game_progress','championship_sessions','championship_participants','student_profiles','teacher_profiles'))
  OR (tn.nspname = 'auth' AND dst.relname = 'users')
)
ORDER BY source_schema, source_table, con.conname;

-- 4. Potential nested/related functions found by source text (NOT exhaustive).
-- Catalog dependencies alone do not detect dynamic SQL or outside applications.
WITH definitions AS (
  SELECT p.oid, n.nspname, p.proname, p.proowner, p.prosecdef, p.proconfig, p.proacl,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         CASE WHEN p.prokind IN ('f','p') THEN pg_get_functiondef(p.oid) ELSE '' END AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
)
SELECT nspname, proname, identity_arguments, pg_get_userbyid(proowner) AS owner,
       prosecdef AS security_definer, proconfig, proacl, definition
FROM definitions WHERE proname = 'save_game_attempt'
 OR definition ~* '(game_attempts|game_progress|championship_sessions|championship_participants|teacher_profiles)'
ORDER BY nspname, proname, identity_arguments;

-- 5. Registered dependencies on key shared relations/functions.
SELECT pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent_object,
       pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) AS referenced_object,
       d.deptype
FROM pg_depend d
WHERE (d.refclassid = 'pg_class'::regclass AND d.refobjid IN (
  SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('game_attempts','game_progress','championship_sessions','championship_participants','student_profiles','teacher_profiles')
)) OR (d.refclassid = 'pg_proc'::regclass AND d.refobjid IN (
  SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'save_game_attempt'
))
ORDER BY referenced_object, dependent_object;

-- 6. View/materialized-view readers and whether view options affect RLS identity.
SELECT v.schemaname, v.viewname AS object_name, 'view' AS object_kind,
       v.definition, c.reloptions
FROM pg_views v JOIN pg_namespace n ON n.nspname = v.schemaname
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = v.viewname
WHERE v.schemaname NOT IN ('pg_catalog','information_schema')
  AND v.definition ~* '(game_attempts|game_progress|championship_sessions|championship_participants|teacher_profiles)'
UNION ALL
SELECT m.schemaname, m.matviewname, 'materialized view', m.definition, c.reloptions
FROM pg_matviews m JOIN pg_namespace n ON n.nspname = m.schemaname
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = m.matviewname
WHERE m.schemaname NOT IN ('pg_catalog','information_schema')
  AND m.definition ~* '(game_attempts|game_progress|championship_sessions|championship_participants|teacher_profiles)'
ORDER BY schemaname, object_name;

-- 7. Explicit table/column/schema/default privileges, including broad defaults.
SELECT grantor, grantee, table_schema, table_name, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN ('game_attempts','game_progress','championship_sessions','championship_participants','student_profiles','teacher_profiles')
ORDER BY table_name, grantee, privilege_type;
SELECT grantor, grantee, table_schema, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('game_attempts','game_progress','championship_sessions','championship_participants','student_profiles','teacher_profiles')
ORDER BY table_name, column_name, grantee, privilege_type;
SELECT pg_get_userbyid(d.defaclrole) AS creator_role,
       COALESCE(n.nspname, '(all schemas)') AS schema_name,
       d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY creator_role, schema_name, d.defaclobjtype;

-- 8. Publication membership is catalog metadata, not a Realtime health check.
SELECT pubname, schemaname, tablename
FROM pg_publication_tables WHERE schemaname IN ('public','aqua_math')
ORDER BY pubname, schemaname, tablename;

-- 9. Operator must separately confirm PostgREST exposed schemas, app consumers,
-- migration role/tool, AQUA-only ownership manifest and backup/cutover policy.
-- Do not dump database/user role settings wholesale: they may contain secrets.
