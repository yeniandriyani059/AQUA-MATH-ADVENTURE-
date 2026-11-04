import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

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
 * SQL Schema Reference for Supabase Integration when migrating from Local Demo Mode to Cloud DB.
 */
export const SUPABASE_SCHEMA_SQL = `-- AQUA MATH ADVENTURE - SUPABASE SQL SCHEMA
CREATE TABLE IF NOT EXISTS class_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_class',
  access_code TEXT NOT NULL DEFAULT 'AQUA2026',
  access_code_active BOOLEAN NOT NULL DEFAULT true,
  solo_adventure_open BOOLEAN NOT NULL DEFAULT true,
  championship_open BOOLEAN NOT NULL DEFAULT true,
  championship_session_name TEXT NOT NULL DEFAULT 'Piala Wali Kota Aqua City - Kelas 2',
  teacher_name TEXT NOT NULL DEFAULT 'Ibu/Bapak Guru Kelas 2',
  class_name TEXT NOT NULL DEFAULT 'Kelas 2 SD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT UNIQUE NOT NULL,
  character_id TEXT NOT NULL,
  solo_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  championship_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
