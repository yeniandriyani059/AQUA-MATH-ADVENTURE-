-- READ ONLY. Operator-run in SQL Editor, before/after an approved migration.
-- Do NOT execute any returned function source as a command.

-- 1. Record BEFORE and compare AFTER. Whole-row hashes include existing values
-- without depending on the production game_progress column layout.
WITH roster(student_id) AS (
 VALUES ('215f7ad8-fb6c-4f4c-b414-db28b0021939'::uuid),
        ('759a1e65-2800-4e47-9257-a9f5d1d9e86a'::uuid)
)
SELECT 'SOLO attempts' AS source, count(*) AS row_count,
 md5(coalesce(jsonb_agg(to_jsonb(ga) ORDER BY ga.id),'[]'::jsonb)::text) AS row_fingerprint
FROM public.game_attempts ga JOIN roster r ON r.student_id=ga.student_id WHERE ga.mode='SOLO'
UNION ALL
SELECT 'game_progress', count(*),
 md5(coalesce(jsonb_agg(to_jsonb(gp) ORDER BY gp.student_id),'[]'::jsonb)::text)
FROM public.game_progress gp JOIN roster r ON r.student_id=gp.student_id;

-- 2. BEFORE: record original body hash, owner, ACL, defaults and settings.
-- AFTER: public is the wrapper; the private backup body hash must match BEFORE.
SELECT n.nspname AS schema_name,p.proname,
 md5(p.prosrc) AS body_md5,pg_get_userbyid(p.proowner) AS owner,p.proacl,
 pg_get_function_arguments(p.oid) AS arguments,p.proconfig,
 position('AQUA_CHAMPIONSHIP_WRAPPER_V1' IN p.prosrc)>0 AS is_aqua_wrapper
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname='save_game_attempt')
   OR (n.nspname='aqua_championship_private' AND p.proname='legacy_save_game_attempt');

-- 3. Existing SELECT policies/RLS must remain; no new direct write policies.
SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('game_attempts','game_progress','championship_sessions','championship_participants')
ORDER BY tablename,policyname;

SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('game_attempts','game_progress','championship_sessions','championship_participants');

-- 4. AFTER ONLY: expect false for untrusted private-schema access.
SELECT has_schema_privilege('authenticated','aqua_championship_private','USAGE') AS student_private_usage,
 has_schema_privilege('authenticated','aqua_championship_private','CREATE') AS student_private_create,
 has_schema_privilege('anon','aqua_championship_private','USAGE') AS anon_private_usage;

-- 5. AFTER ONLY, before authorized opening: expect both 0 on first installation.
-- Reapplying later must preserve existing rows, so do not require 0 then.
SELECT (SELECT count(*) FROM aqua_championship_private.sessions_v1) AS managed_sessions,
       (SELECT count(*) FROM aqua_championship_private.attempt_requests_v1) AS saved_requests;
