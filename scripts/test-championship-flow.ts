import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddaudswxkxzmpqvoiuss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYXVkc3d4a3h6bXBxdm9pdXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTczNTEsImV4cCI6MjEwNTA3MzM1MX0.agwd-zj-stiF5we-liIDXlVQ23RRQ_ssEcQrzm6ccME';

async function testCols() {
  const client = createClient(supabaseUrl, supabaseAnonKey);

  // Try inserting with only session_name
  const { data: res1, error: err1 } = await client
    .from('championship_sessions')
    .insert({ session_name: 'Turnamen Uji Coba' })
    .select();

  console.log('Result insert session_name:', res1, 'err:', err1);

  // Try querying championship_sessions with rpc or select
  const { data: res2, error: err2 } = await client.from('championship_sessions').select('*');
  console.log('Select * from championship_sessions:', res2, 'err:', err2);
}

testCols().catch(console.error);
