-- REVIEW ONLY. NOT EXECUTED IN PRODUCTION.
-- Apply BEFORE aqua-championship.final.review.sql, as the same trusted owner.
-- No policy removal, grants of write access, CASCADE, data rewrite or bypass flag.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA IF NOT EXISTS aqua_championship_private;
REVOKE ALL ON SCHEMA aqua_championship_private FROM PUBLIC, anon, authenticated;
DO $guard$
BEGIN
  IF (SELECT nspowner FROM pg_namespace WHERE nspname='aqua_championship_private') <>
     (SELECT oid FROM pg_roles WHERE rolname=current_user) THEN
    RAISE EXCEPTION 'Unexpected private schema owner; stop and review.';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION aqua_championship_private.protect_profiles_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  v_roster constant uuid[] := ARRAY[
    '215f7ad8-fb6c-4f4c-b414-db28b0021939'::uuid,
    '759a1e65-2800-4e47-9257-a9f5d1d9e86a'::uuid,
    '45b1d488-a0ec-4bc7-9761-f1a27ce9b8e2'::uuid,
    '09645e36-6b69-47f2-9df0-684ea7cde426'::uuid,
    '560dfd85-5e99-4f73-b37b-199c5f9c6115'::uuid,
    '67015c29-f25b-4a67-89cf-b8cb957ffbc5'::uuid,
    'bb04c91a-981d-402d-abfb-09dd1fd3d2f7'::uuid,
    'dd007663-1363-4623-8cf7-7adc141067b4'::uuid,
    '46ef83bd-b476-43cc-9860-1b55e06f62f3'::uuid,
    '9d1a675f-05a2-4749-b1bd-d4efbd33552f'::uuid,
    '9038139e-b72d-4232-98ab-82d175c9a714'::uuid,
    '77d7aec6-21f7-479d-a9ad-7cb48d171238'::uuid,
    '87592235-ebb6-4244-9460-e5d421ad8632'::uuid,
    '86f94146-38de-4047-8127-475792b5e5fc'::uuid
  ];
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.id=ANY(v_roster) THEN
      RAISE EXCEPTION 'Profil siswa AQUA tidak boleh dihapus.' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.id=ANY(v_roster) OR NEW.id=ANY(v_roster) THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
      RAISE EXCEPTION 'Identitas dan relasi Auth siswa AQUA dilindungi.' USING ERRCODE='42501';
    END IF;
    -- to_jsonb supports either a json or jsonb snapshot column, including SQL NULL.
    IF (to_jsonb(NEW)->'championship_data') IS DISTINCT FROM (to_jsonb(OLD)->'championship_data') THEN
      RAISE EXCEPTION 'Snapshot Championship AQUA dilindungi; gunakan hasil resmi database.' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION aqua_championship_private.protect_profiles_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS aqua_protect_profiles_v1 ON public.student_profiles;
CREATE TRIGGER aqua_protect_profiles_v1
BEFORE UPDATE OR DELETE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION aqua_championship_private.protect_profiles_v1();

-- TRUNCATE bypasses RLS and is not a row operation. A whole-table truncate cannot
-- spare AQUA rows, so block it on shared tables. Normal non-AQUA row CRUD is retained.
CREATE OR REPLACE FUNCTION aqua_championship_private.reject_game_truncate_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'TRUNCATE tabel bersama AQUA tidak diizinkan.' USING ERRCODE='42501';
END;
$fn$;
REVOKE ALL ON FUNCTION aqua_championship_private.reject_game_truncate_v1() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS aqua_reject_truncate_v1 ON public.student_profiles;
CREATE TRIGGER aqua_reject_truncate_v1 BEFORE TRUNCATE ON public.student_profiles
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_game_truncate_v1();

DROP TRIGGER IF EXISTS aqua_reject_truncate_v1 ON public.game_attempts;
CREATE TRIGGER aqua_reject_truncate_v1 BEFORE TRUNCATE ON public.game_attempts
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_game_truncate_v1();

DROP TRIGGER IF EXISTS aqua_reject_truncate_v1 ON public.game_progress;
CREATE TRIGGER aqua_reject_truncate_v1 BEFORE TRUNCATE ON public.game_progress
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_game_truncate_v1();

DROP TRIGGER IF EXISTS aqua_reject_truncate_v1 ON public.championship_sessions;
CREATE TRIGGER aqua_reject_truncate_v1 BEFORE TRUNCATE ON public.championship_sessions
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_game_truncate_v1();

DROP TRIGGER IF EXISTS aqua_reject_truncate_v1 ON public.championship_participants;
CREATE TRIGGER aqua_reject_truncate_v1 BEFORE TRUNCATE ON public.championship_participants
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_game_truncate_v1();

-- ALWAYS also fires for replica-mode sessions; no caller-configurable bypass.
ALTER TABLE public.student_profiles ENABLE ALWAYS TRIGGER aqua_protect_profiles_v1;
ALTER TABLE public.student_profiles ENABLE ALWAYS TRIGGER aqua_reject_truncate_v1;
ALTER TABLE public.game_attempts ENABLE ALWAYS TRIGGER aqua_reject_truncate_v1;
ALTER TABLE public.game_progress ENABLE ALWAYS TRIGGER aqua_reject_truncate_v1;
ALTER TABLE public.championship_sessions ENABLE ALWAYS TRIGGER aqua_reject_truncate_v1;
ALTER TABLE public.championship_participants ENABLE ALWAYS TRIGGER aqua_reject_truncate_v1;
-- Existing RLS already denies every web DELETE on these four tables. Raise a
-- statement error even for zero visible rows so OLD reset code takes its error
-- branch BEFORE clearing snapshots/cache/offline queue. Trusted definer routines
-- retain their existing role context; no JWT metadata or user-settable flag is used.
CREATE OR REPLACE FUNCTION aqua_championship_private.reject_web_game_delete_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  IF current_user IN ('anon','authenticated') THEN
    RAISE EXCEPTION 'Reset penghapusan permainan dinonaktifkan; gunakan sesi resmi.' USING ERRCODE='42501';
  END IF;
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION aqua_championship_private.reject_web_game_delete_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS aqua_reject_web_delete_v1 ON public.game_attempts;
CREATE TRIGGER aqua_reject_web_delete_v1 BEFORE DELETE ON public.game_attempts
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_web_game_delete_v1();
ALTER TABLE public.game_attempts ENABLE ALWAYS TRIGGER aqua_reject_web_delete_v1;
DROP TRIGGER IF EXISTS aqua_reject_web_delete_v1 ON public.game_progress;
CREATE TRIGGER aqua_reject_web_delete_v1 BEFORE DELETE ON public.game_progress
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_web_game_delete_v1();
ALTER TABLE public.game_progress ENABLE ALWAYS TRIGGER aqua_reject_web_delete_v1;
DROP TRIGGER IF EXISTS aqua_reject_web_delete_v1 ON public.championship_sessions;
CREATE TRIGGER aqua_reject_web_delete_v1 BEFORE DELETE ON public.championship_sessions
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_web_game_delete_v1();
ALTER TABLE public.championship_sessions ENABLE ALWAYS TRIGGER aqua_reject_web_delete_v1;
DROP TRIGGER IF EXISTS aqua_reject_web_delete_v1 ON public.championship_participants;
CREATE TRIGGER aqua_reject_web_delete_v1 BEFORE DELETE ON public.championship_participants
FOR EACH STATEMENT EXECUTE FUNCTION aqua_championship_private.reject_web_game_delete_v1();
ALTER TABLE public.championship_participants ENABLE ALWAYS TRIGGER aqua_reject_web_delete_v1;
COMMIT;
