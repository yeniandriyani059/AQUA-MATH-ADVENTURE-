-- FINAL REVIEW ARTIFACT. DO NOT RUN WITHOUT APPROVAL.
-- One transaction; no historical data UPDATE/DELETE or SOLO rewrite.
-- Requires execution AS THE CURRENT OWNER of public.save_game_attempt.
-- Preserves original function body exactly in a non-exposed private schema.
-- Legacy calls have no request key: best-score safe, NOT archive-idempotent.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA IF NOT EXISTS aqua_championship_private;
REVOKE ALL ON SCHEMA aqua_championship_private FROM PUBLIC, anon, authenticated;

DO $guard$
DECLARE v_oid oid; v_source text; v_clone text; v_owner oid; v_saved oid; v_backup_meta jsonb; v_restored_definition text;
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='save_game_attempt') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one save_game_attempt overload; manual review required.';
  END IF;
  IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
    RAISE EXCEPTION 'Untrusted roles can CREATE in public; review schema security first.';
  END IF;
  IF (SELECT nspowner FROM pg_namespace WHERE nspname='aqua_championship_private') <> (SELECT oid FROM pg_roles WHERE rolname=current_user) THEN
    RAISE EXCEPTION 'Unexpected private schema owner.';
  END IF;
  v_oid := to_regprocedure('public.save_game_attempt(text,integer,text,integer,integer,integer,uuid)');
  IF v_oid IS NULL THEN RAISE EXCEPTION 'Unexpected save_game_attempt signature.'; END IF;
  SELECT proowner INTO v_owner FROM pg_proc WHERE oid=v_oid;
  IF v_owner <> (SELECT oid FROM pg_roles WHERE rolname=current_user) THEN
    RAISE EXCEPTION 'Run as the existing function owner; do not change its owner automatically.';
  END IF;
  IF (SELECT pg_get_function_result(v_oid)) <> 'jsonb'
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=v_oid)
     OR (SELECT proargnames FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM
        ARRAY['p_mode','p_level_number','p_location_id','p_correct_count','p_wrong_count','p_duration_seconds','p_session_id']::text[] THEN
    RAISE EXCEPTION 'Unexpected return type, security mode or argument names; review required.';
  END IF;
  v_saved := to_regprocedure('aqua_championship_private.legacy_save_game_attempt(text,integer,text,integer,integer,integer,uuid)');
  IF v_saved IS NULL THEN
    IF (SELECT position('AQUA_CHAMPIONSHIP_WRAPPER_V1' IN prosrc)>0 FROM pg_proc WHERE oid=v_oid) THEN
      RAISE EXCEPTION 'Wrapper exists but original backup is missing.';
    END IF;
    -- A self-reference would become recursion through the wrapper. Fail closed.
    IF (SELECT prosrc ~ '\msave_game_attempt\M' FROM pg_proc WHERE oid=v_oid) THEN
      RAISE EXCEPTION 'Original function references its own name; inspect dependencies before wrapping.';
    END IF;
    v_source := pg_get_functiondef(v_oid);
    v_clone := regexp_replace(v_source,
      '^CREATE OR REPLACE FUNCTION public[.]save_game_attempt[(]',
      'CREATE OR REPLACE FUNCTION aqua_championship_private.legacy_save_game_attempt(');
    IF v_clone = v_source THEN RAISE EXCEPTION 'Cannot safely preserve original function header.'; END IF;
    EXECUTE v_clone;
    IF (SELECT prosrc FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM
       (SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('aqua_championship_private.legacy_save_game_attempt(text,integer,text,integer,integer,integer,uuid)')) THEN
      RAISE EXCEPTION 'Original function body was not preserved exactly.';
    END IF;
    EXECUTE format('COMMENT ON FUNCTION aqua_championship_private.legacy_save_game_attempt(text,integer,text,integer,integer,integer,uuid) IS %L',
      jsonb_build_object('marker','AQUA_LEGACY_BACKUP_V1','definition_md5',md5(v_source),'body_md5',(SELECT md5(prosrc) FROM pg_proc WHERE oid=v_oid))::text);
  ELSE
    IF NOT (SELECT position('AQUA_CHAMPIONSHIP_WRAPPER_V1' IN prosrc)>0 FROM pg_proc WHERE oid=v_oid)
       OR (SELECT proowner FROM pg_proc WHERE oid=v_saved) <> v_owner THEN
      RAISE EXCEPTION 'Original/wrapper drift detected. Stop and review; do not overwrite backup.';
    END IF;
    v_backup_meta := obj_description(v_saved,'pg_proc')::jsonb;
    v_restored_definition := regexp_replace(pg_get_functiondef(v_saved),
      '^CREATE OR REPLACE FUNCTION aqua_championship_private[.]legacy_save_game_attempt[(]',
      'CREATE OR REPLACE FUNCTION public.save_game_attempt(');
    IF (v_backup_meta->>'marker') IS DISTINCT FROM 'AQUA_LEGACY_BACKUP_V1'
       OR (v_backup_meta->>'definition_md5') IS DISTINCT FROM md5(v_restored_definition)
       OR (v_backup_meta->>'body_md5') IS DISTINCT FROM (SELECT md5(prosrc) FROM pg_proc WHERE oid=v_saved) THEN
      RAISE EXCEPTION 'Preserved legacy definition drift detected; stop and review.';
    END IF;
  END IF;
END;
$guard$;
REVOKE ALL ON FUNCTION aqua_championship_private.legacy_save_game_attempt(text,integer,text,integer,integer,integer,uuid)
FROM PUBLIC, anon, authenticated;



-- Only sessions created by the AQUA lifecycle RPC are managed by this patch.
-- Reusing the teacher account in another app must not redirect that app's saves.
CREATE TABLE IF NOT EXISTS aqua_championship_private.sessions_v1 (
  session_id uuid PRIMARY KEY REFERENCES public.championship_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE aqua_championship_private.sessions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aqua_championship_private.sessions_v1 FROM PUBLIC, anon, authenticated;

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
  IF EXISTS (SELECT 1 FROM public.championship_sessions cs JOIN aqua_championship_private.sessions_v1 scope ON scope.session_id=cs.id WHERE cs.created_by = v_teacher AND cs.status = 'OPEN') THEN
    RAISE EXCEPTION 'Sesi AQUA OPEN sudah tersedia. Muat ulang; jangan membuka sesi kedua.' USING ERRCODE = '55000';
  END IF;
  INSERT INTO public.championship_sessions(session_name, status, created_by)
  VALUES (btrim(p_session_name), 'OPEN', v_teacher) RETURNING id INTO v_session;
  INSERT INTO aqua_championship_private.sessions_v1(session_id) VALUES(v_session);
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
    AND EXISTS (SELECT 1 FROM aqua_championship_private.sessions_v1 scope WHERE scope.session_id=cs.id)
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
  JOIN aqua_championship_private.sessions_v1 scope ON scope.session_id=cs.id
  WHERE sp.auth_user_id = auth.uid() AND sp.is_active = true
    AND sp.id = ANY(public.aqua_championship_roster_v1())
    AND tp.auth_user_id = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid
    AND tp.role = 'teacher' AND cs.status = 'OPEN'
    AND cp.completion_status IN ('REGISTERED', 'PLAYING', 'COMPLETED')
  ORDER BY cs.id LIMIT 2;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_student_championship_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_student_championship_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.aqua_can_read_championship_session_v1(p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT auth.uid()='6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND EXISTS (
    SELECT 1 FROM public.championship_sessions cs
    JOIN aqua_championship_private.sessions_v1 scope ON scope.session_id=cs.id
    JOIN public.teacher_profiles tp ON tp.id=cs.created_by
    WHERE cs.id=p_session_id AND tp.auth_user_id=auth.uid() AND tp.role='teacher'
  );
$fn$;
REVOKE ALL ON FUNCTION public.aqua_can_read_championship_session_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_can_read_championship_session_v1(uuid) TO authenticated;
DROP POLICY IF EXISTS aqua_teacher_read_own_championship_sessions ON public.championship_sessions;
CREATE POLICY aqua_teacher_read_own_championship_sessions ON public.championship_sessions
FOR SELECT TO authenticated USING (public.aqua_can_read_championship_session_v1(id));
DROP POLICY IF EXISTS aqua_teacher_read_own_championship_participants ON public.championship_participants;
CREATE POLICY aqua_teacher_read_own_championship_participants ON public.championship_participants
FOR SELECT TO authenticated USING (public.aqua_can_read_championship_session_v1(session_id));

CREATE OR REPLACE FUNCTION public.aqua_teacher_championship_sessions_v1()
RETURNS TABLE(id uuid, session_name text, status text, created_by uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_teacher uuid;
BEGIN
  v_teacher := public.aqua_championship_teacher_v1();
  RETURN QUERY SELECT cs.id,cs.session_name::text,cs.status::text,cs.created_by
    FROM public.championship_sessions cs
    JOIN aqua_championship_private.sessions_v1 scope ON scope.session_id=cs.id
    WHERE cs.created_by=v_teacher AND cs.status IN ('OPEN','CLOSED')
    ORDER BY (cs.status='OPEN') DESC,cs.created_at DESC,cs.id DESC LIMIT 2;
END;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_teacher_championship_sessions_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_teacher_championship_sessions_v1() TO authenticated;

-- Private, AQUA-only durable receipts. No policies/direct client grants.
CREATE TABLE IF NOT EXISTS aqua_championship_private.attempt_requests_v1 (
  student_id uuid NOT NULL REFERENCES public.student_profiles(id),
  request_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  attempt_id uuid NOT NULL UNIQUE REFERENCES public.game_attempts(id),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, request_id)
);
ALTER TABLE aqua_championship_private.attempt_requests_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aqua_championship_private.attempt_requests_v1 FROM PUBLIC, anon, authenticated;

DO $receipt_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='aqua_championship_private.attempt_requests_v1'::regclass
      AND contype='p' AND conkey=ARRAY[1,2]::smallint[]) THEN
    RAISE EXCEPTION 'Receipt primary key drift; stop before enabling writes.';
  END IF;
END;
$receipt_guard$;

-- All AQUA Championship writes (keyed and legacy) pass through this core.
CREATE OR REPLACE FUNCTION aqua_championship_private.save_attempt_v1(
  p_request_id uuid, p_mode text, p_level_number integer, p_location_id text,
  p_correct_count integer, p_wrong_count integer, p_duration_seconds integer, p_session_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_auth uuid := auth.uid(); v_student uuid; v_count bigint;
  v_status text; v_creator uuid; v_participant uuid;
  v_payload jsonb; v_receipt aqua_championship_private.attempt_requests_v1%ROWTYPE;
  v_attempt uuid; v_number integer; v_score integer; v_official integer; v_completed integer;
  v_result jsonb;
BEGIN
  IF v_auth IS NULL THEN RAISE EXCEPTION 'Sesi siswa diperlukan.' USING ERRCODE='42501'; END IF;
  SELECT count(*) INTO v_count FROM public.student_profiles WHERE auth_user_id=v_auth AND is_active=true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Profil siswa aktif tidak valid.' USING ERRCODE='42501'; END IF;
  SELECT id INTO STRICT v_student FROM public.student_profiles WHERE auth_user_id=v_auth AND is_active=true;
  IF NOT (v_student=ANY(public.aqua_championship_roster_v1())) THEN
    RAISE EXCEPTION 'Siswa bukan anggota roster AQUA.' USING ERRCODE='42501';
  END IF;
  IF p_mode IS DISTINCT FROM 'CHAMPIONSHIP' OR p_session_id IS NULL OR p_level_number IS NULL
     OR p_level_number NOT BETWEEN 1 AND 5 OR p_location_id IS NULL
     OR p_location_id NOT IN ('1','2','3','4','5','6','7','8','9','10')
     OR p_correct_count IS NULL OR p_wrong_count IS NULL
     OR p_correct_count NOT BETWEEN 0 AND 10 OR p_wrong_count NOT BETWEEN 0 AND 10
     OR p_correct_count+p_wrong_count <> 10
     OR p_duration_seconds IS NULL OR p_duration_seconds < 0 THEN
    RAISE EXCEPTION 'Payload Championship tidak valid.' USING ERRCODE='22023';
  END IF;
  IF p_level_number <> (p_location_id::integer+1)/2 THEN
    RAISE EXCEPTION 'Lokasi tidak sesuai level.' USING ERRCODE='22023';
  END IF;
  -- LOCK ORDER: session SHARE -> participant UPDATE -> request advisory -> attempt/receipt.
  SELECT cs.status::text, cs.created_by INTO v_status, v_creator
  FROM public.championship_sessions cs WHERE cs.id=p_session_id FOR SHARE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM aqua_championship_private.sessions_v1 scope WHERE scope.session_id=p_session_id) OR NOT EXISTS (
    SELECT 1 FROM public.teacher_profiles tp WHERE tp.id=v_creator
      AND tp.auth_user_id='6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND tp.role='teacher'
  ) THEN RAISE EXCEPTION 'Sesi bukan milik guru AQUA.' USING ERRCODE='42501'; END IF;
  SELECT cp.id INTO v_participant FROM public.championship_participants cp
  WHERE cp.session_id=p_session_id AND cp.student_id=v_student
    AND cp.completion_status IN ('REGISTERED','PLAYING','COMPLETED') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Siswa belum terdaftar dalam sesi.' USING ERRCODE='42501'; END IF;
  v_payload := jsonb_build_object('mode',p_mode,'session_id',p_session_id,'level_number',p_level_number,
    'location_id',p_location_id,'correct_count',p_correct_count,'wrong_count',p_wrong_count,'duration_seconds',p_duration_seconds);
  IF p_request_id IS NOT NULL THEN
    -- Serializes reuse of the same request ID across different sessions, too.
    PERFORM pg_advisory_xact_lock(hashtextextended('aqua-request:'||v_student::text||':'||p_request_id::text,0));
    SELECT * INTO v_receipt FROM aqua_championship_private.attempt_requests_v1
    WHERE student_id=v_student AND request_id=p_request_id;
    IF FOUND THEN
      IF v_receipt.auth_user_id IS DISTINCT FROM v_auth OR v_receipt.payload IS DISTINCT FROM v_payload THEN
        RAISE EXCEPTION 'Request ID sudah digunakan untuk payload berbeda.' USING ERRCODE='22023';
      END IF;
      -- A confirmed replay may return after CLOSED. No new attempt or score write.
      RETURN v_receipt.result;
    END IF;
  END IF;
  IF v_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION 'Sesi Championship sudah ditutup.' USING ERRCODE='55000';
  END IF;
  -- Participant row serializes the full student+session scope of this MAX.
  SELECT coalesce(max(ga.attempt_number),0)+1 INTO v_number FROM public.game_attempts ga
  WHERE ga.student_id=v_student AND ga.session_id=p_session_id
    AND ga.location_id=p_location_id AND ga.mode='CHAMPIONSHIP';
  v_score := p_correct_count*10;
  INSERT INTO public.game_attempts(student_id,mode,session_id,participant_id,level_number,location_id,
    correct_count,wrong_count,score,duration_seconds,attempt_number)
  VALUES(v_student,'CHAMPIONSHIP',p_session_id,v_participant,p_level_number,p_location_id,
    p_correct_count,p_wrong_count,v_score,p_duration_seconds,v_number)
  RETURNING id INTO v_attempt;
  SELECT coalesce(sum(best_score),0)::integer, count(*)::integer INTO v_official,v_completed
  FROM (SELECT max(ga.score) AS best_score FROM public.game_attempts ga
    WHERE ga.student_id=v_student AND ga.session_id=p_session_id AND ga.mode='CHAMPIONSHIP'
    GROUP BY ga.location_id) AS missions;
  IF v_completed >= 10 THEN
    UPDATE public.championship_participants SET official_score=v_official,completion_status='COMPLETED' WHERE id=v_participant;
  ELSE
    UPDATE public.championship_participants SET official_score=v_official,completion_status='PLAYING' WHERE id=v_participant;
  END IF;
  v_result := jsonb_build_object('success',true,'attempt_id',v_attempt,'student_id',v_student,
    'mode','CHAMPIONSHIP','session_id',p_session_id,'score',v_score,'official_score',v_official,
    'correct_count',p_correct_count,'wrong_count',p_wrong_count,'attempt_number',v_number,
    'request_id',p_request_id,'idempotency_supported',p_request_id IS NOT NULL);
  IF p_request_id IS NOT NULL THEN
    INSERT INTO aqua_championship_private.attempt_requests_v1(student_id,request_id,auth_user_id,payload,attempt_id,result)
    VALUES(v_student,p_request_id,v_auth,v_payload,v_attempt,v_result);
  END IF;
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION aqua_championship_private.save_attempt_v1(uuid,text,integer,text,integer,integer,integer,uuid)
FROM PUBLIC, anon, authenticated;

-- Distinct RPC name avoids PostgREST overload ambiguity. New frontend only.
CREATE OR REPLACE FUNCTION public.aqua_save_championship_attempt_v1(
  p_request_id uuid, p_mode text, p_level_number integer, p_location_id text,
  p_correct_count integer, p_wrong_count integer,
  p_duration_seconds integer DEFAULT 0, p_session_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID diperlukan.' USING ERRCODE='22023'; END IF;
  RETURN aqua_championship_private.save_attempt_v1(p_request_id,p_mode,p_level_number,p_location_id,
    p_correct_count,p_wrong_count,p_duration_seconds,p_session_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.aqua_save_championship_attempt_v1(uuid,text,integer,text,integer,integer,integer,uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aqua_save_championship_attempt_v1(uuid,text,integer,text,integer,integer,integer,uuid)
TO authenticated;

-- Same signature, defaults and ACL; SOLO and non-AQUA use the exact original body.
CREATE OR REPLACE FUNCTION public.save_game_attempt(
  p_mode text, p_level_number integer, p_location_id text, p_correct_count integer,
  p_wrong_count integer, p_duration_seconds integer DEFAULT 0, p_session_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  -- AQUA_CHAMPIONSHIP_WRAPPER_V1
  IF p_mode='CHAMPIONSHIP' AND EXISTS (
    SELECT 1 FROM public.championship_sessions cs JOIN public.teacher_profiles tp ON tp.id=cs.created_by
    JOIN aqua_championship_private.sessions_v1 scope ON scope.session_id=cs.id
    WHERE cs.id=p_session_id AND tp.auth_user_id='6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid
  ) THEN
    -- Legacy caller has no request identity. Preserve legitimate repeats but cap score by mission best.
    RETURN aqua_championship_private.save_attempt_v1(NULL,p_mode,p_level_number,p_location_id,
      p_correct_count,p_wrong_count,p_duration_seconds,p_session_id);
  END IF;
  RETURN aqua_championship_private.legacy_save_game_attempt(p_mode,p_level_number,p_location_id,
    p_correct_count,p_wrong_count,p_duration_seconds,p_session_id);
END;
$fn$;
-- Existing save_game_attempt owner/EXECUTE grants are intentionally preserved.
NOTIFY pgrst, 'reload schema';
COMMIT;
