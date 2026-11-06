import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Only initialize Supabase client when real credentials are configured in environment variables.
 * Never invent placeholder credentials.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('MY_SUPABASE'),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Creates an isolated, non-persisted Supabase client in memory.
 * Used when attempting Supabase Anonymous Auth for student records so that an active
 * Teacher Admin session in localStorage/sessionStorage is never overwritten or signed out.
 */
export function createEphemeralSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `aqua_ephemeral_stu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

export const SUPABASE_SCHEMA_SQL = `-- AQUA MATH ADVENTURE - COMPLETE SUPABASE BACKEND SCHEMA & FUNCTIONS

-- 1. Class Settings
CREATE TABLE IF NOT EXISTS class_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_class',
  access_code TEXT NOT NULL DEFAULT 'AQUA2026',
  access_code_active BOOLEAN NOT NULL DEFAULT true,
  solo_adventure_open BOOLEAN NOT NULL DEFAULT true,
  championship_open BOOLEAN NOT NULL DEFAULT true,
  championship_session_name TEXT NOT NULL DEFAULT 'Turnamen Penyelamat Air Aqua City',
  teacher_name TEXT NOT NULL DEFAULT 'Ibu/Bapak Guru Pembimbing',
  class_name TEXT NOT NULL DEFAULT 'Kelas Petualang Aqua City',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default class settings if empty
INSERT INTO class_settings (id, access_code, access_code_active, solo_adventure_open, championship_open, championship_session_name, teacher_name, class_name)
VALUES ('default_class', 'AQUA2026', true, true, true, 'Turnamen Penyelamat Air Aqua City', 'Ibu/Bapak Guru Pembimbing', 'Kelas Petualang Aqua City')
ON CONFLICT (id) DO NOTHING;

-- 2. Teacher Profiles
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  display_name TEXT,
  role TEXT DEFAULT 'teacher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies for teacher_profiles
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own profile"
ON teacher_profiles FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

CREATE POLICY "Teachers can insert own profile"
ON teacher_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Teachers can update own profile"
ON teacher_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id);

-- 3. Student Profiles
CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID,
  display_name TEXT NOT NULL,
  character TEXT NOT NULL CHECK (character IN ('BIMA', 'SINTA')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Game Attempts (History of individual mission attempts)
CREATE TABLE IF NOT EXISTS game_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE,
  student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  championship_session_id TEXT,
  level_number INT NOT NULL,
  location_id INT NOT NULL,
  correct_count INT NOT NULL DEFAULT 0,
  wrong_count INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Game Progress (Per student per mode progress tracking)
CREATE TABLE IF NOT EXISTS game_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  unlocked_level INT NOT NULL DEFAULT 1,
  total_score INT NOT NULL DEFAULT 0,
  academic_grade NUMERIC NOT NULL DEFAULT 0,
  locations_completed JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Championship Sessions
CREATE TABLE IF NOT EXISTS championship_sessions (
  id TEXT PRIMARY KEY,
  session_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Championship Participants
CREATE TABLE IF NOT EXISTS championship_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  official_score INT NOT NULL DEFAULT 0,
  total_time_seconds INT NOT NULL DEFAULT 0,
  rank INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. RPC Function: save_game_attempt
CREATE OR REPLACE FUNCTION save_game_attempt(
  p_mode TEXT,
  p_level_number INT,
  p_location_id INT,
  p_correct_count INT,
  p_wrong_count INT,
  p_duration_seconds INT,
  p_session_id TEXT,
  p_student_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_score INT;
  v_attempt_id UUID;
BEGIN
  v_score := LEAST(100, GREATEST(0, p_correct_count * 10));
  
  INSERT INTO game_attempts (
    student_id,
    mode,
    championship_session_id,
    level_number,
    location_id,
    correct_count,
    wrong_count,
    score,
    duration_seconds
  ) VALUES (
    p_student_id,
    p_mode,
    p_session_id,
    p_level_number,
    p_location_id,
    p_correct_count,
    p_wrong_count,
    v_score,
    p_duration_seconds
  ) RETURNING id INTO v_attempt_id;
  
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;
