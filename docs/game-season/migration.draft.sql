-- DRAFT ONLY / NOT EXECUTED / NOT AN APPROVED MIGRATION.
-- Deliberately outside automatic migration directories.
-- External ID types, grants, authority and consumers MUST be verified first.
-- This file is structural scaffolding; it does NOT implement scoring or backfill.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT BLOCKED: obtain metadata, review final SQL, test nonproduction and get explicit execution approval first';
END
$draft_guard$;

-- Do not use IF NOT EXISTS to hide a collision with another application's objects.
CREATE SCHEMA aqua_math;
REVOKE ALL ON SCHEMA aqua_math FROM PUBLIC, anon, authenticated;

CREATE TABLE aqua_math.scopes (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  enabled boolean NOT NULL DEFAULT false,
  active_season_id uuid,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE aqua_math.teacher_authorizations (
  scope_id uuid NOT NULL REFERENCES aqua_math.scopes(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT false,
  can_open_season boolean NOT NULL DEFAULT false,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (scope_id, auth_user_id)
);

-- BLOCKER: verify public.student_profiles.id type and Auth/profile mapping.
-- No new auth.users row is created; no existing account or profile is updated.
CREATE TABLE aqua_math.student_memberships (
  scope_id uuid NOT NULL REFERENCES aqua_math.scopes(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (scope_id, student_id),
  UNIQUE (scope_id, auth_user_id),
  UNIQUE (scope_id, student_id, auth_user_id)
);

CREATE TABLE aqua_math.seasons (
  id uuid PRIMARY KEY,
  scope_id uuid NOT NULL REFERENCES aqua_math.scopes(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  opened_at timestamptz,
  closed_at timestamptz,
  UNIQUE (scope_id, id),
  CHECK (status <> 'ACTIVE' OR (opened_at IS NOT NULL AND closed_at IS NULL)),
  CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX aqua_one_active_season ON aqua_math.seasons(scope_id) WHERE status = 'ACTIVE';
-- Both sides of this FK are NEW app-specific tables; never alter shared public tables.
ALTER TABLE aqua_math.scopes ADD CONSTRAINT aqua_scope_active_season_fk
  FOREIGN KEY (id, active_season_id) REFERENCES aqua_math.seasons(scope_id, id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE aqua_math.championship_sessions (
  id uuid PRIMARY KEY,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  opened_at timestamptz,
  closed_at timestamptz,
  UNIQUE (scope_id, season_id, id),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  CHECK (status <> 'OPEN' OR (opened_at IS NOT NULL AND closed_at IS NULL)),
  CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at)
);
CREATE UNIQUE INDEX aqua_one_open_championship_session
  ON aqua_math.championship_sessions(scope_id, season_id) WHERE status = 'OPEN';

CREATE TABLE aqua_math.championship_participants (
  id uuid PRIMARY KEY,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (session_id, student_id),
  UNIQUE (scope_id, season_id, session_id, student_id, id),
  FOREIGN KEY (scope_id, season_id, session_id)
    REFERENCES aqua_math.championship_sessions(scope_id, season_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id)
    REFERENCES aqua_math.student_memberships(scope_id, student_id) ON DELETE RESTRICT
);

CREATE TABLE aqua_math.attempts (
  id uuid PRIMARY KEY,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  student_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('SOLO', 'CHAMPIONSHIP')),
  session_id uuid,
  participant_id uuid,
  level_number integer NOT NULL CHECK (level_number BETWEEN 1 AND 5),
  location_id integer NOT NULL CHECK (location_id BETWEEN 1 AND 10),
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  wrong_count integer NOT NULL CHECK (wrong_count >= 0),
  score numeric NOT NULL CHECK (score >= 0),
  duration_seconds numeric NOT NULL CHECK (duration_seconds >= 0),
  normalized_request jsonb NOT NULL CHECK (jsonb_typeof(normalized_request) = 'object'),
  completed_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT aqua_request_once UNIQUE (scope_id, auth_user_id, request_id),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id, auth_user_id)
    REFERENCES aqua_math.student_memberships(scope_id, student_id, auth_user_id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, season_id, session_id, student_id, participant_id)
    REFERENCES aqua_math.championship_participants(scope_id, season_id, session_id, student_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT aqua_valid_mode_session CHECK (
    (mode = 'SOLO' AND session_id IS NULL AND participant_id IS NULL)
    OR (mode = 'CHAMPIONSHIP' AND session_id IS NOT NULL AND participant_id IS NOT NULL)
  )
  -- Final counts/score/duration/level checks await the actual existing grading contract.
);
CREATE INDEX aqua_attempts_student_season_mode
  ON aqua_math.attempts(scope_id, season_id, student_id, mode, completed_at, id);
CREATE INDEX aqua_attempts_championship_read
  ON aqua_math.attempts(scope_id, season_id, session_id, student_id, location_id, score)
  WHERE mode = 'CHAMPIONSHIP';

-- Separate progress tables avoid public.game_progress UNIQUE(student_id), and
-- avoid nullable-session uniqueness differences between PostgreSQL versions.
CREATE TABLE aqua_math.solo_progress (
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  student_id uuid NOT NULL,
  unlocked_level integer NOT NULL DEFAULT 1 CHECK (unlocked_level BETWEEN 1 AND 5),
  completed_locations smallint[] NOT NULL DEFAULT '{}'::smallint[],
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (scope_id, season_id, student_id),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id) REFERENCES aqua_math.student_memberships(scope_id, student_id) ON DELETE RESTRICT,
  CHECK (completed_locations <@ ARRAY[1,2,3,4,5,6,7,8,9,10]::smallint[])
);
CREATE TABLE aqua_math.championship_progress (
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  unlocked_level integer NOT NULL DEFAULT 1 CHECK (unlocked_level BETWEEN 1 AND 5),
  completed_locations smallint[] NOT NULL DEFAULT '{}'::smallint[],
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (scope_id, season_id, session_id, student_id),
  FOREIGN KEY (scope_id, season_id, session_id, student_id, participant_id)
    REFERENCES aqua_math.championship_participants(scope_id, season_id, session_id, student_id, id)
    ON DELETE RESTRICT,
  CHECK (completed_locations <@ ARRAY[1,2,3,4,5,6,7,8,9,10]::smallint[])
);

-- BLOCKERS: verify legacy PK types and actual owning student/session columns.
-- FK validation + an approved ownership manifest are required before any inserts.
CREATE TABLE aqua_math.legacy_attempt_seasons (
  legacy_attempt_id uuid PRIMARY KEY REFERENCES public.game_attempts(id) ON DELETE RESTRICT,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  student_id uuid NOT NULL,
  manifest_reference text NOT NULL,
  mapped_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  mapped_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id) REFERENCES aqua_math.student_memberships(scope_id, student_id) ON DELETE RESTRICT
);
CREATE INDEX aqua_legacy_attempts_archive ON aqua_math.legacy_attempt_seasons(scope_id, season_id, student_id);

CREATE TABLE aqua_math.legacy_progress_archives (
  legacy_progress_id uuid PRIMARY KEY REFERENCES public.game_progress(id) ON DELETE RESTRICT,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  student_id uuid NOT NULL,
  source_snapshot jsonb NOT NULL,
  attribution text NOT NULL DEFAULT 'UNCLASSIFIED' CHECK (attribution IN ('UNCLASSIFIED', 'VERIFIED_BY_MANIFEST')),
  manifest_reference text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id) REFERENCES aqua_math.student_memberships(scope_id, student_id) ON DELETE RESTRICT
);
CREATE TABLE aqua_math.legacy_participant_archives (
  legacy_participant_id uuid PRIMARY KEY REFERENCES public.championship_participants(id) ON DELETE RESTRICT,
  scope_id uuid NOT NULL,
  season_id uuid NOT NULL,
  student_id uuid NOT NULL,
  source_snapshot jsonb NOT NULL,
  manifest_reference text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  FOREIGN KEY (scope_id, season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, student_id) REFERENCES aqua_math.student_memberships(scope_id, student_id) ON DELETE RESTRICT
);

CREATE TABLE aqua_math.season_operations (
  scope_id uuid NOT NULL,
  actor_auth_user_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  normalized_request jsonb NOT NULL,
  previous_season_id uuid,
  new_season_id uuid NOT NULL,
  new_session_id uuid,
  resulting_revision bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (scope_id, actor_auth_user_id, operation_id),
  FOREIGN KEY (scope_id, actor_auth_user_id)
    REFERENCES aqua_math.teacher_authorizations(scope_id, auth_user_id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, previous_season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, new_season_id) REFERENCES aqua_math.seasons(scope_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (scope_id, new_season_id, new_session_id)
    REFERENCES aqua_math.championship_sessions(scope_id, season_id, id) ON DELETE RESTRICT
);

-- Only new tables: enable RLS with default deny. No permissive policies and no
-- direct authenticated reads/writes are drafted pending the authority review.
ALTER TABLE aqua_math.scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.teacher_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.student_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.championship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.championship_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.solo_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.championship_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.legacy_attempt_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.legacy_progress_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.legacy_participant_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE aqua_math.season_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA aqua_math FROM PUBLIC, anon, authenticated;

-- FAIL-CLOSED SPECIFICATION STUBS. NOT RPC IMPLEMENTATIONS.
-- Before replacing bodies: bind exact grading/authority contract and owner,
-- review all SECURITY DEFINER checks and search_path, then test in isolation.
-- No EXECUTE grants to runtime users are included. No change to v1 RPC.
CREATE FUNCTION public.aqua_math_save_attempt_v2(
  p_scope_id uuid, p_season_id uuid, p_request_id uuid, p_mode text,
  p_session_id uuid, p_level_number integer, p_location_id integer,
  p_correct_count integer, p_wrong_count integer, p_duration_seconds integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $draft$
BEGIN
  RAISE EXCEPTION 'DRAFT: atomic save/idempotency specification only; see design.md' USING ERRCODE = '0A000';
END
$draft$;
REVOKE ALL ON FUNCTION public.aqua_math_save_attempt_v2(uuid,uuid,uuid,text,uuid,integer,integer,integer,integer,integer)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.aqua_math_start_season_v2(
  p_scope_id uuid, p_expected_revision bigint, p_operation_id uuid,
  p_name text, p_open_championship boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $draft$
BEGIN
  RAISE EXCEPTION 'DRAFT: trusted-teacher atomic switch specification only; see design.md' USING ERRCODE = '0A000';
END
$draft$;
REVOKE ALL ON FUNCTION public.aqua_math_start_season_v2(uuid,bigint,uuid,text,boolean)
  FROM PUBLIC, anon, authenticated;

-- No backfill DML: IDs, ownership manifest, actual source columns and snapshot
-- consistency must first be verified. Do not copy all rows from shared tables.
-- No runtime GRANT, active-season seed, policy replacement or version-1 edits.
-- Even after bypassing the guard this draft ends in rollback, not publication.
ROLLBACK;
