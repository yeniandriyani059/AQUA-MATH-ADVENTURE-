import { createClient } from '@supabase/supabase-js';

// Public key only. Every database request retains the verified caller's RLS context.
export async function getSupabaseClient(token?: string): Promise<any> {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url.startsWith('https://') || !key) return null;
  // Reject privileged keys accidentally supplied under the public-key name.
  if (key.startsWith('sb_secret_')) return null;
  try {
    if (key.split('.').length === 3) {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (claims.role !== 'anon') return null;
    }
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
  } catch { return null; }
}

export async function verifyTeacher(client: any, token: string, allowedIds: string[]) {
  if (!client || !token) return null;
  const { data, error } = await client.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.id || user.is_anonymous || !allowedIds.includes(user.id)) return null;
  const { data: profile, error: profileError } = await client.from('teacher_profiles')
    .select('auth_user_id, role, display_name').eq('auth_user_id', user.id).maybeSingle();
  if (profileError || profile?.auth_user_id !== user.id || profile?.role !== 'teacher') return null;
  return { user, profile };
}
