import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function main() {
  console.log('=== PROBING CHAMPIONSHIP_SESSIONS & CHAMPIONSHIP_PARTICIPANTS COLUMNS ===');
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Log in as teacher
  const { data: teacherAuth, error: tErr } = await client.auth.signInWithPassword({
    email: 'yeniandriyani059@gmail.com',
    password: 'AquaGuru2026!',
  });

  if (tErr) {
    console.error('Teacher sign in error:', tErr.message);
  } else {
    console.log('Teacher Auth User ID:', teacherAuth.user.id);
  }

  // Try inserting a dummy session into championship_sessions to discover column structure
  const testId = '00000000-0000-0000-0000-000000000000';
  const { data: insSess, error: insErr } = await client.from('championship_sessions').insert({
    session_name: 'Test Session',
  }).select();

  console.log('Insert championship_sessions result:', insSess, 'err:', insErr);

  // If insert error gives hints or if succeeded, print columns
  if (insSess && insSess.length > 0) {
    console.log('championship_sessions columns:', Object.keys(insSess[0]));
    // Clean up test row
    await client.from('championship_sessions').delete().eq('id', insSess[0].id);
  }

  // Probe championship_participants
  const { data: insPart, error: partErr } = await client.from('championship_participants').insert({
    student_id: testId,
  }).select();
  console.log('Insert championship_participants result:', insPart, 'err:', partErr);
  if (insPart && insPart.length > 0) {
    console.log('championship_participants columns:', Object.keys(insPart[0]));
    await client.from('championship_participants').delete().eq('id', insPart[0].id);
  }
}

main().catch(console.error);
