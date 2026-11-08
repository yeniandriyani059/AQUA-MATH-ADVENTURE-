import { registerTeacherAdmin, loginTeacherAdmin } from '../src/services/gameStorage';
import { supabase } from '../src/services/supabaseClient';

async function testTeacherReg() {
  console.log('=== REGISTERING TEACHER ACCOUNT VIA FRONTEND HELPER ===');

  const regRes = await registerTeacherAdmin({
    name: 'Ibu Yeni Andriyani',
    username: 'guru_aqua',
    password: 'AquaGuru2026!',
    confirmPassword: 'AquaGuru2026!',
  });

  console.log('Registration result:', regRes);

  // If already exists or created, test logging in
  const loginRes = await loginTeacherAdmin('guru_aqua', 'AquaGuru2026!');
  console.log('Login result:', loginRes);

  if (supabase) {
    const { data: userData } = await supabase.auth.getUser();
    console.log('Active teacher Auth User:', userData?.user?.id, userData?.user?.email);

    // Try inserting into championship_sessions as teacher!
    const { data: sess, error: sessErr } = await supabase
      .from('championship_sessions')
      .insert({
        session_name: 'Turnamen Resmi Class Championship 2026',
      })
      .select();

    console.log('Inserted championship_session as teacher:', sess, 'err:', sessErr?.message);
  }
}

testTeacherReg().catch(console.error);
