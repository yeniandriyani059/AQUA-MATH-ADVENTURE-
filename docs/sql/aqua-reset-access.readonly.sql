-- READ ONLY. Review production reset permissions; do not try a real DELETE/reset.
-- SQL Editor's admin role is NOT evidence of what the browser JWT can delete.
SELECT r.rolname,r.rolsuper,r.rolbypassrls
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated');

SELECT c.relname AS table_name,pg_get_userbyid(c.relowner) AS table_owner,
 c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,
 has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete,
 has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
 has_table_privilege('authenticated',c.oid,'TRUNCATE') AS authenticated_truncate,
 CASE WHEN c.relname='student_profiles' AND EXISTS (
   SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='championship_data' AND NOT a.attisdropped
 ) THEN has_column_privilege('authenticated',c.oid,'championship_data','UPDATE')
 ELSE NULL END AS authenticated_snapshot_update
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('game_attempts','game_progress','championship_participants','championship_sessions','student_profiles')
ORDER BY c.relname;

-- DELETE and ALL determine which rows a permitted browser DELETE can affect.
-- UPDATE/ALL on student_profiles also matters: legacy reset clears championship_data.
SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('game_attempts','game_progress','championship_participants','championship_sessions','student_profiles')
 AND cmd IN ('ALL','DELETE','UPDATE')
ORDER BY tablename,policyname;

-- Potential privileged SQL reset paths, metadata only (no function bodies/secrets).
-- Text search is a lead for review, not a complete audit of dynamic/indirect writers.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef AS security_definer,pg_get_userbyid(p.proowner) AS owner,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 md5(p.prosrc) AS source_fingerprint
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND (p.proname ILIKE '%reset%' OR (
   p.prosrc ~* '(delete|truncate)' AND p.prosrc ~* '(game_attempts|game_progress|championship_participants|championship_sessions)'))
ORDER BY n.nspname,p.proname;

-- Foreign-key actions before/after installation. No CASCADE is introduced.
SELECT n.nspname,c.relname,con.conname,CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS delete_action,pg_get_constraintdef(con.oid,true) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE con.contype='f' AND (
 (n.nspname='aqua_championship_private' AND c.relname IN ('sessions_v1','attempt_requests_v1'))
 OR (n.nspname='public' AND c.relname IN ('game_attempts','championship_participants')))
ORDER BY n.nspname,c.relname,con.conname;
