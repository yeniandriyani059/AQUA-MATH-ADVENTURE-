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

