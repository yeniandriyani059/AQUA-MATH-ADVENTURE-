import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function testTeacherSessionInsert() {
  console.log('=== CREATING/SIGNING IN TEACHER ACCOUNT ===');
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const teacherEmail = 'yeniandriyani059@gmail.com';
  const teacherPass = 'AquaGuru2026!';

  // Try sign up or sign in
  let authUser: any = null;
  const { data: signIn, error: sErr } = await client.auth.signInWithPassword({
    email: teacherEmail,
    password: teacherPass,
  });

  if (!sErr && signIn?.user) {
    authUser = signIn.user;
    console.log('Teacher signed in:', authUser.id);
  } else {
    console.log('Sign in failed:', sErr?.message, 'trying signUp...');
    const { data: signUp, error: uErr } = await client.auth.signUp({
      email: teacherEmail,
      password: teacherPass,
      options: {
        data: { name: 'Ibu Yeni Andriyani', role: 'teacher' }
      }
    });
    if (!uErr && signUp?.user) {
      authUser = signUp.user;
      console.log('Teacher signed up:', authUser.id);
    } else {
      console.error('Teacher sign up failed:', uErr?.message);
    }
  }

  if (!authUser) return;

  // Ensure teacher profile exists in teacher_profiles
  const { data: prof, error: pErr } = await client
    .from('teacher_profiles')
    .upsert({
      id: authUser.id,
      auth_user_id: authUser.id,
      display_name: 'Ibu Yeni Andriyani',
      role: 'teacher',
    })
    .select();

  console.log('teacher_profiles upsert:', prof, 'err:', pErr?.message);

  // Now test inserting into championship_sessions as teacher!
  const { data: sess, error: sessErr } = await client
    .from('championship_sessions')
    .insert({
      session_name: 'Turnamen Resmi Class Championship 2026',
    })
    .select();

  console.log('championship_sessions insert as teacher:', sess, 'err:', sessErr?.message);
  if (sess && sess.length > 0) {
    console.log('Session columns:', Object.keys(sess[0]));
    console.log('REAL CHAMPIONSHIP SESSION UUID:', sess[0].id);
  }
}

testTeacherSessionInsert().catch(console.error);
