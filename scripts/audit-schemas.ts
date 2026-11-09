import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function main() {
  console.log('=== AUDITING SCHEMAS OF ALL TABLES ===');
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Sign in as Dinda to have authenticated context
  await client.auth.signInWithPassword({
    email: 'dinda04@student.aquamath.id',
    password: process.env.AQUA_TEST_STUDENT_PASSWORD || '',
  });

  const tables = ['student_profiles', 'teacher_profiles', 'championship_sessions', 'championship_participants', 'game_attempts', 'game_progress'];

  for (const table of tables) {
    const { data, error } = await client.from(table).select('*').limit(1);
    console.log(`\nTable: ${table}`);
    if (error) {
      console.log(`  Error: ${error.code} - ${error.message}`);
    } else {
      console.log(`  Columns found (from empty sample):`, data && data.length > 0 ? Object.keys(data[0]) : 'no rows, querying select headers');
    }
  }

  // Let's also check if we can insert a dummy row or select from championship_sessions
  const { data: sessSample, error: sessErr } = await client.from('championship_sessions').select('*');
  console.log('\nchampionship_sessions rows:', sessSample, 'err:', sessErr?.message);
}

main().catch(console.error);
