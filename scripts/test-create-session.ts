import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function testCreateSession() {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Test sign in as teacher using valid teacher email or student email
  const { data: studentAuth } = await client.auth.signInWithPassword({
    email: 'dinda04@student.aquamath.id',
    password: process.env.AQUA_TEST_STUDENT_PASSWORD || '',
  });

  console.log('Student signed in:', studentAuth.user?.id);

  // Try select championship_sessions as authenticated student
  const { data: sessList, error: selectErr } = await client
    .from('championship_sessions')
    .select('*');

  console.log('championship_sessions select as authenticated student:', sessList, 'err:', selectErr?.message);

  // Try create session if empty
  if (sessList?.length === 0) {
    const { data: created, error: createErr } = await client
      .from('championship_sessions')
      .insert({
        session_name: 'Turnamen Resmi Class Championship 2026',
      })
      .select();

    console.log('Created championship_sessions row:', created, 'err:', createErr?.message);
  }
}

testCreateSession().catch(console.error);
