-- REVIEW ONLY. NOT EXECUTED.
-- Release gate: review/patch the production save_game_attempt Championship locks
-- and approve retry/scoring semantics BEFORE enabling Championship.
-- Applies only to AQUA RPCs and two SELECT policies. No SOLO/data reset SQL.
BEGIN;

CREATE OR REPLACE FUNCTION public.aqua_championship_roster_v1()
RETURNS uuid[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
SELECT ARRAY[
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
$fn$;
REVOKE ALL ON FUNCTION public.aqua_championship_roster_v1() FROM PUBLIC, anon, authenticated;

-- Internal helper: never accept a caller-supplied teacher identity.
CREATE OR REPLACE FUNCTION public.aqua_championship_teacher_v1()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_id uuid; v_count bigint;
BEGIN
  IF auth.uid() IS DISTINCT FROM '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid THEN
    RAISE EXCEPTION 'Guru AQUA tidak berwenang.' USING ERRCODE = '42501';
  END IF;
  SELECT count(*) INTO v_count FROM public.teacher_profiles
  WHERE auth_user_id = auth.uid() AND role = 'teacher';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Profil guru AQUA tidak valid.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO STRICT v_id FROM public.teacher_profiles
  WHERE auth_user_id = auth.uid() AND role = 'teacher';
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_championship_teacher_v1() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.aqua_open_championship_v1(p_session_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_teacher uuid; v_roster uuid[]; v_session uuid;
BEGIN
  v_teacher := public.aqua_championship_teacher_v1();
  IF p_session_name IS NULL OR length(btrim(p_session_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Nama sesi harus 1 sampai 120 karakter.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(741203, 1);
  v_roster := public.aqua_championship_roster_v1();
  IF cardinality(v_roster) <> 14 OR (SELECT count(DISTINCT x) FROM unnest(v_roster) AS r(x)) <> 14 THEN
    RAISE EXCEPTION 'Roster AQUA tidak valid.' USING ERRCODE = '22023';
  END IF;
  -- FOR SHARE also prevents deactivation while registration commits.
  PERFORM sp.id FROM public.student_profiles AS sp
  WHERE sp.id = ANY(v_roster) AND sp.is_active = true ORDER BY sp.id FOR SHARE;
  IF (SELECT count(*) FROM public.student_profiles WHERE id = ANY(v_roster) AND is_active = true) <> 14 THEN
    RAISE EXCEPTION 'Roster AQUA harus berisi 14 profil aktif.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.championship_sessions WHERE created_by = v_teacher AND status = 'OPEN') THEN
    RAISE EXCEPTION 'Sesi AQUA OPEN sudah tersedia. Muat ulang; jangan membuka sesi kedua.' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.championship_sessions(session_name, status, created_by)
  VALUES (btrim(p_session_name), 'OPEN', v_teacher) RETURNING id INTO v_session;
  INSERT INTO public.championship_participants(session_id, student_id, completion_status)
  SELECT v_session, x, 'REGISTERED' FROM unnest(v_roster) AS r(x);
  RETURN v_session;
END;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_open_championship_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_open_championship_v1(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aqua_close_championship_v1(p_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_teacher uuid;
BEGIN
  v_teacher := public.aqua_championship_teacher_v1();
  PERFORM pg_advisory_xact_lock(741203, 1);
  -- Save must acquire FOR SHARE on this SAME row before participant/attempt writes.
  PERFORM cs.id FROM public.championship_sessions AS cs
  WHERE cs.id = p_session_id AND cs.created_by = v_teacher AND cs.status IN ('OPEN', 'CLOSED')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sesi AQUA tidak ditemukan atau tidak berwenang.' USING ERRCODE = '42501';
  END IF;
  -- Fail closed rather than touching a session belonging to another application's roster.
  IF (SELECT count(*) FROM public.championship_participants WHERE session_id = p_session_id) <> 14
    OR EXISTS (SELECT 1 FROM public.championship_participants
      WHERE session_id = p_session_id AND NOT (student_id = ANY(public.aqua_championship_roster_v1()))) THEN
    RAISE EXCEPTION 'Roster sesi tidak sesuai AQUA.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.championship_sessions SET status = 'CLOSED'
  WHERE id = p_session_id AND status = 'OPEN';
  RETURN p_session_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_close_championship_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_close_championship_v1(uuid) TO authenticated;

-- Read-only discovery: students must not need SELECT on teacher_profiles.
-- No client-supplied student/teacher identifier. At most two rows, so clients reject ambiguity.
CREATE OR REPLACE FUNCTION public.aqua_student_championship_v1()
RETURNS TABLE(session_id uuid, session_name text, student_id uuid, status text, completion_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT cs.id, cs.session_name::text, sp.id, cs.status::text, cp.completion_status::text
  FROM public.student_profiles AS sp
  JOIN public.championship_participants AS cp ON cp.student_id = sp.id
  JOIN public.championship_sessions AS cs ON cs.id = cp.session_id
  JOIN public.teacher_profiles AS tp ON tp.id = cs.created_by
  WHERE sp.auth_user_id = auth.uid() AND sp.is_active = true
    AND sp.id = ANY(public.aqua_championship_roster_v1())
    AND tp.auth_user_id = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid
    AND tp.role = 'teacher' AND cs.status = 'OPEN'
    AND cp.completion_status IN ('REGISTERED', 'PLAYING', 'COMPLETED')
  ORDER BY cs.id LIMIT 2;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_student_championship_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_student_championship_v1() TO authenticated;

DROP POLICY IF EXISTS aqua_teacher_read_own_championship_sessions ON public.championship_sessions;
CREATE POLICY aqua_teacher_read_own_championship_sessions ON public.championship_sessions
FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND EXISTS (
    SELECT 1 FROM public.teacher_profiles AS tp WHERE tp.id = championship_sessions.created_by
    AND tp.auth_user_id = (SELECT auth.uid()) AND tp.role = 'teacher'
  )
);
DROP POLICY IF EXISTS aqua_teacher_read_own_championship_participants ON public.championship_participants;
CREATE POLICY aqua_teacher_read_own_championship_participants ON public.championship_participants
FOR SELECT TO authenticated USING (
  (SELECT auth.uid()) = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND EXISTS (
    SELECT 1 FROM public.championship_sessions AS cs
    JOIN public.teacher_profiles AS tp ON tp.id = cs.created_by
    WHERE cs.id = championship_participants.session_id
    AND tp.auth_user_id = (SELECT auth.uid()) AND tp.role = 'teacher'
  )
);
COMMIT;
