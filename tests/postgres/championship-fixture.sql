-- SYNTHETIC PostgreSQL fixture. This is NOT the production function definition.
-- Used only inside a new network-isolated disposable container by the Python runner.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TABLE public.teacher_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid UNIQUE NOT NULL,role text NOT NULL,display_name text);
CREATE TABLE public.student_profiles(id uuid PRIMARY KEY,auth_user_id uuid UNIQUE NOT NULL,display_name text,is_active boolean NOT NULL DEFAULT true,character text DEFAULT 'BIMA',championship_data jsonb DEFAULT '{}'::jsonb);
CREATE TABLE public.championship_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_name text NOT NULL,status text NOT NULL CHECK(status IN ('OPEN','CLOSED')),created_by uuid NOT NULL REFERENCES public.teacher_profiles(id),created_at timestamptz DEFAULT now());
CREATE TABLE public.championship_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES public.championship_sessions(id),student_id uuid NOT NULL REFERENCES public.student_profiles(id),completion_status text NOT NULL DEFAULT 'REGISTERED' CHECK(completion_status IN ('REGISTERED','PLAYING','COMPLETED')),official_score integer NOT NULL DEFAULT 0,UNIQUE(session_id,student_id));
CREATE TABLE public.game_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.student_profiles(id),mode text NOT NULL CHECK(mode IN ('SOLO','CHAMPIONSHIP')),
 session_id uuid REFERENCES public.championship_sessions(id),participant_id uuid REFERENCES public.championship_participants(id),
 level_number integer NOT NULL CHECK(level_number BETWEEN 1 AND 5),location_id text NOT NULL,correct_count integer NOT NULL,wrong_count integer NOT NULL,
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100),duration_seconds integer DEFAULT 0,attempt_number integer NOT NULL DEFAULT 1,
 completed_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),
 CHECK(correct_count+wrong_count=10),CHECK(score=correct_count*10),
 CONSTRAINT valid_mode_session CHECK((mode='SOLO' AND session_id IS NULL AND participant_id IS NULL) OR (mode='CHAMPIONSHIP' AND session_id IS NOT NULL AND participant_id IS NOT NULL))
);
CREATE INDEX idx_attempts_student ON public.game_attempts(student_id);
CREATE INDEX idx_attempts_session ON public.game_attempts(session_id);
-- Deliberately no UNIQUE(student,session,mission,attempt_number), matching audit.
CREATE TABLE public.game_progress(student_id uuid PRIMARY KEY REFERENCES public.student_profiles(id),score integer NOT NULL,level_number integer NOT NULL,updated_at timestamptz DEFAULT now());
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
CREATE POLICY teacher_self ON public.teacher_profiles FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
CREATE POLICY student_self ON public.student_profiles FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
CREATE POLICY teacher_students ON public.student_profiles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.teacher_profiles WHERE auth_user_id=auth.uid() AND role='teacher'));
CREATE POLICY "Students read own attempts" ON public.game_attempts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.student_profiles sp WHERE sp.id=game_attempts.student_id AND sp.auth_user_id=auth.uid()));
CREATE POLICY "Students read own progress" ON public.game_progress FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.student_profiles sp WHERE sp.id=game_progress.student_id AND sp.auth_user_id=auth.uid()));
CREATE POLICY "Authenticated users read open sessions" ON public.championship_sessions FOR SELECT TO authenticated USING(status='OPEN');
CREATE POLICY "Students read own participation" ON public.championship_participants FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.student_profiles sp WHERE sp.id=championship_participants.student_id AND sp.auth_user_id=auth.uid()));

-- Legacy synthetic implementation intentionally has the audited weaknesses.
-- The migration must preserve this exact body for SOLO/non-AQUA calls.
CREATE FUNCTION public.save_game_attempt(p_mode text,p_level_number integer,p_location_id text,p_correct_count integer,p_wrong_count integer,p_duration_seconds integer DEFAULT 0,p_session_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_student uuid;v_participant uuid;v_attempt uuid;v_number integer;v_score integer:=p_correct_count*10;
BEGIN
 SELECT id INTO STRICT v_student FROM public.student_profiles WHERE auth_user_id=auth.uid() AND is_active=true;
 IF p_mode NOT IN ('SOLO','CHAMPIONSHIP') OR p_correct_count+p_wrong_count<>10 THEN RAISE EXCEPTION 'invalid synthetic payload';END IF;
 IF p_mode='CHAMPIONSHIP' THEN
  SELECT cp.id INTO STRICT v_participant FROM public.championship_participants cp JOIN public.championship_sessions cs ON cs.id=cp.session_id WHERE cp.student_id=v_student AND cs.id=p_session_id AND cs.status='OPEN';
 END IF;
 SELECT coalesce(max(attempt_number),0)+1 INTO v_number FROM public.game_attempts WHERE student_id=v_student AND mode=p_mode AND session_id IS NOT DISTINCT FROM p_session_id AND location_id=p_location_id;
 INSERT INTO public.game_attempts(student_id,mode,session_id,participant_id,level_number,location_id,correct_count,wrong_count,score,duration_seconds,attempt_number)
 VALUES(v_student,p_mode,p_session_id,v_participant,p_level_number,p_location_id,p_correct_count,p_wrong_count,v_score,p_duration_seconds,v_number) RETURNING id INTO v_attempt;
 IF p_mode='SOLO' THEN
  INSERT INTO public.game_progress(student_id,score,level_number) VALUES(v_student,v_score,p_level_number) ON CONFLICT(student_id) DO UPDATE SET score=excluded.score,level_number=excluded.level_number;
 ELSE UPDATE public.championship_participants SET official_score=official_score+v_score WHERE id=v_participant;END IF;
 RETURN jsonb_build_object('success',true,'attempt_id',v_attempt,'student_id',v_student,'mode',p_mode,'score',v_score,'correct_count',p_correct_count,'wrong_count',p_wrong_count,'attempt_number',v_number);
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_game_attempt(text,integer,text,integer,integer,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_game_attempt(text,integer,text,integer,integer,integer,uuid) TO authenticated;
-- Model the already-approved teacher score-read policies; migration must preserve them.
CREATE POLICY aqua_teacher_select_attempts ON public.game_attempts FOR SELECT TO authenticated USING(
 auth.uid()='6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND EXISTS(SELECT 1 FROM public.teacher_profiles WHERE auth_user_id=auth.uid() AND role='teacher'));
CREATE POLICY aqua_teacher_select_progress ON public.game_progress FOR SELECT TO authenticated USING(
 auth.uid()='6568ffbf-91c4-4ccb-9d00-980c2ffb64fb'::uuid AND EXISTS(SELECT 1 FROM public.teacher_profiles WHERE auth_user_id=auth.uid() AND role='teacher'));

-- User-confirmed current production permissions: ordinary DML follows RLS,
-- TRUNCATE does not. Preserve the teacher FOR ALL policy during guard install.
GRANT DELETE,UPDATE,TRUNCATE ON public.game_attempts,public.game_progress,public.championship_sessions,public.championship_participants TO authenticated;
GRANT INSERT,UPDATE,DELETE,TRUNCATE ON public.student_profiles TO authenticated;
CREATE POLICY teacher_manage_student_profiles ON public.student_profiles FOR ALL TO authenticated
USING(EXISTS(SELECT 1 FROM public.teacher_profiles WHERE auth_user_id=auth.uid() AND role='teacher'))
WITH CHECK(EXISTS(SELECT 1 FROM public.teacher_profiles WHERE auth_user_id=auth.uid() AND role='teacher'));
