import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function main() {
  const client = createClient(supabaseUrl, supabaseAnonKey);

  console.log('=== FINDING TEACHER USER ===');
  // Try signing in with default teacher email/pass
  const { data: signIn, error: sErr } = await client.auth.signInWithPassword({
    email: 'tch_guru_aqua@aquamath.org',
    password: 'AquaGuru2026!',
  });
  console.log('Sign in tch_guru_aqua@aquamath.org:', signIn?.user?.id, sErr?.message);

  if (!signIn?.user) {
    // Try guru_aqua@aquamath.org
    const { data: signIn2, error: sErr2 } = await client.auth.signInWithPassword({
      email: 'guru_aqua@aquamath.org',
      password: 'AquaGuru2026!',
    });
    console.log('Sign in guru_aqua@aquamath.org:', signIn2?.user?.id, sErr2?.message);
  }
}

main().catch(console.error);
