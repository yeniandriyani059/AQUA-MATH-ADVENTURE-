-- AFTER an approved installation ONLY. Metadata/read-only; no test resets/DML.
-- Expected: 10 named triggers; tgenabled = A (ALWAYS), security_definer = false.
SELECT n.nspname AS table_schema,c.relname AS table_name,t.tgname,t.tgenabled,
 p.proname AS function_name,p.prosecdef AS security_definer,
 pg_get_triggerdef(t.oid,true) AS trigger_definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
WHERE n.nspname='public' AND t.tgname IN
 ('aqua_protect_profiles_v1','aqua_reject_web_delete_v1','aqua_reject_truncate_v1')
ORDER BY c.relname,t.tgname;

-- No profiles/scores were rewritten. Check identity/count without exposing snapshots.
SELECT count(*) AS protected_profiles,count(DISTINCT auth_user_id) AS distinct_auth_links
FROM public.student_profiles WHERE id IN (
 '215f7ad8-fb6c-4f4c-b414-db28b0021939'::uuid,'759a1e65-2800-4e47-9257-a9f5d1d9e86a'::uuid,
 '45b1d488-a0ec-4bc7-9761-f1a27ce9b8e2'::uuid,'09645e36-6b69-47f2-9df0-684ea7cde426'::uuid,
 '560dfd85-5e99-4f73-b37b-199c5f9c6115'::uuid,'67015c29-f25b-4a67-89cf-b8cb957ffbc5'::uuid,
 'bb04c91a-981d-402d-abfb-09dd1fd3d2f7'::uuid,'dd007663-1363-4623-8cf7-7adc141067b4'::uuid,
 '46ef83bd-b476-43cc-9860-1b55e06f62f3'::uuid,'9d1a675f-05a2-4749-b1bd-d4efbd33552f'::uuid,
 '9038139e-b72d-4232-98ab-82d175c9a714'::uuid,'77d7aec6-21f7-479d-a9ad-7cb48d171238'::uuid,
 '87592235-ebb6-4244-9460-e5d421ad8632'::uuid,'86f94146-38de-4047-8127-475792b5e5fc'::uuid
);
-- Use aqua-championship-verification.readonly.sql for recorded before/after SOLO hashes.
