import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function testRoles() {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: authData } = await client.auth.signInWithPassword({
    email: 'tch_guru_aqua@aquamath.org',
    password: 'AquaGuru2026!',
  });

  const token = authData.session?.access_token;
  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const teacherUid = authData.user!.id;

  // Try insert with different values of role: 'teacher', 'TEACHER', or omitting role if default
  for (const r of ['teacher', 'TEACHER', 'Teacher']) {
    const { data: prof, error: pErr } = await authedClient
      .from('teacher_profiles')
      .insert({
        id: teacherUid,
        auth_user_id: teacherUid,
        display_name: 'Ibu Yeni Andriyani',
        role: r,
      })
      .select();

    console.log(`Role '${r}' insert:`, prof, 'err:', pErr?.message);
    if (prof) break;
  }
}

testRoles().catch(console.error);
