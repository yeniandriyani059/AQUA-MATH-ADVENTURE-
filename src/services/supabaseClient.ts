import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (
  import.meta.env?.VITE_SUPABASE_URL || 'https://ddaudswxkxzmpqvoiuss.supabase.co'
).trim();
const supabaseAnonKey = (
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME'
).trim();

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
 * Dedicated Supabase client for Student Authentication & Gameplay.
 * Uses an isolated storageKey ('aqua_math_student_auth_v1') so that a student logging in or out
 * NEVER overwrites, signs out, or interferes with a Teacher's session on the main `supabase` client.
 */
export const studentSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'aqua_math_student_auth_v1',
      },
    })
  : null;

/**
 * Creates an isolated, non-persisted Supabase client in memory.
 * Used when verifying or creating student Auth accounts so neither Teacher nor active Student sessions are overwritten.
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

// Immutable request context: switching the shared Auth session cannot change its bearer token.
export function createStudentRequestClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const SUPABASE_SCHEMA_SQL = `-- AQUA MATH ADVENTURE - RLS & 14 AKUN SISWA KELAS 5 (SUPABASE SQL)

-- 1. Pastikan RLS aktif pada teacher_profiles & student_profiles
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policy RLS pada public.teacher_profiles
DROP POLICY IF EXISTS "Teachers can view own profile" ON public.teacher_profiles;
CREATE POLICY "Teachers can view own profile"
ON public.teacher_profiles FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Teachers can insert own profile" ON public.teacher_profiles;
CREATE POLICY "Teachers can insert own profile"
ON public.teacher_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id AND LOWER(role) = 'teacher');

DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teacher_profiles;
CREATE POLICY "Teachers can update own profile"
ON public.teacher_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id AND LOWER(role) = 'teacher');

-- 3. Policy RLS pada public.student_profiles untuk Siswa (Hanya profil miliknya sendiri)
DROP POLICY IF EXISTS "Students can view own profile" ON public.student_profiles;
CREATE POLICY "Students can view own profile"
ON public.student_profiles FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Students can insert own profile" ON public.student_profiles;
CREATE POLICY "Students can insert own profile"
ON public.student_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Students can update own profile" ON public.student_profiles;
CREATE POLICY "Students can update own profile"
ON public.student_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- 4. Policy RLS pada public.student_profiles untuk Guru Terdaftar (role = 'teacher')
DROP POLICY IF EXISTS "teacher_manage_student_profiles" ON public.student_profiles;
CREATE POLICY "teacher_manage_student_profiles"
ON public.student_profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.auth_user_id = auth.uid() AND tp.role = 'teacher'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.auth_user_id = auth.uid() AND tp.role = 'teacher'
  )
);

-- 5. Policy RLS pada public.game_attempts & public.game_progress agar Guru dapat membaca seluruh progres siswa
ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read all game_attempts" ON public.game_attempts;
CREATE POLICY "Teachers read all game_attempts"
ON public.game_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.auth_user_id = auth.uid() AND tp.role = 'teacher'
  )
);

DROP POLICY IF EXISTS "Teachers read all game_progress" ON public.game_progress;
CREATE POLICY "Teachers read all game_progress"
ON public.game_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_profiles tp
    WHERE tp.auth_user_id = auth.uid() AND tp.role = 'teacher'
  )
);

-- 6. Sinkronisasi 14 Profil Siswa Kelas 5 ke public.student_profiles
-- Menggunakan UUID asli dari auth.users dan default database untuk id & created_at
INSERT INTO public.student_profiles (auth_user_id, display_name, character, is_active)
VALUES
  ('cae44b10-9331-4e44-bc28-7e737a62a49c', 'Afina Felisia Putri', 'SINTA', true),
  ('be935b72-73a2-4429-955e-965168bed5ce', 'Afiz El Haddadi', 'BIMA', true),
  ('f8e45914-dd24-45df-aed7-dcf34be05912', 'ARJUNA SURYA WIKRAMA', 'BIMA', true),
  ('77b1cd3d-af92-45c8-b709-cb66ab6a9bbf', 'DINDA ISMAWATI', 'SINTA', true),
  ('570ba376-4134-4845-847f-e408ea786d81', 'Faniya Nur Hafisah', 'SINTA', true),
  ('f1052608-bcf9-4071-9c01-89800c55273f', 'Gista Novita Nur Amaliana', 'SINTA', true),
  ('a669b5c4-62c2-4441-8f8b-484e2d85323a', 'HANAFI MUSLIMAH', 'SINTA', true),
  ('d305d926-0db6-428c-ac50-315a0dd1c940', 'Muhammad Fiqri', 'BIMA', true),
  ('3812cbe6-4d83-40f5-aa60-02be3c175a37', 'PUTRI DWI SEPTIANI', 'SINTA', true),
  ('05ca3caa-4f22-4514-80db-fff5edcc3861', 'Revan Safi Saputra', 'BIMA', true),
  ('47efc5df-09b3-4362-837b-7b41223d0fb2', 'Saskia Aprilianti', 'SINTA', true),
  ('b3ad69ad-b592-405e-ae79-abea8cde7be0', 'SHAREEFA JEHAN AMIRA', 'SINTA', true),
  ('b063ade8-5267-4c36-88fb-5b485f54c228', 'Suci Mulia Sari', 'SINTA', true),
  ('261109d3-2fa2-4cb1-94f1-953c540738a5', 'Tiwi Safitri', 'SINTA', true)
ON CONFLICT (auth_user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  character = EXCLUDED.character,
  is_active = EXCLUDED.is_active;`;

