import { validSessionId } from './championshipContract';
import { readResultRows } from './authoritativeResults';

export const AQUA_TEACHER_AUTH_ID = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb';
export const AQUA_ROSTER_IDS = [
  '215f7ad8-fb6c-4f4c-b414-db28b0021939',
  '759a1e65-2800-4e47-9257-a9f5d1d9e86a',
  '45b1d488-a0ec-4bc7-9761-f1a27ce9b8e2',
  '09645e36-6b69-47f2-9df0-684ea7cde426',
  '560dfd85-5e99-4f73-b37b-199c5f9c6115',
  '67015c29-f25b-4a67-89cf-b8cb957ffbc5',
  'bb04c91a-981d-402d-abfb-09dd1fd3d2f7',
  'dd007663-1363-4623-8cf7-7adc141067b4',
  '46ef83bd-b476-43cc-9860-1b55e06f62f3',
  '9d1a675f-05a2-4749-b1bd-d4efbd33552f',
  '9038139e-b72d-4232-98ab-82d175c9a714',
  '77d7aec6-21f7-479d-a9ad-7cb48d171238',
  '87592235-ebb6-4244-9460-e5d421ad8632',
  '86f94146-38de-4047-8127-475792b5e5fc',
] as const;
export interface ChampionshipSession { id: string; session_name: string; status: 'OPEN' | 'CLOSED'; created_by: string }
export interface ChampionshipState { session: ChampionshipSession | null; participants: any[]; attempts: any[] }
export function databaseError(error: any): Error {
  return new Error(error?.message || 'Respons Supabase tidak valid.');
}
async function checked(query: any) {
  const response = await query;
  if (response.error) throw databaseError(response.error);
  return response;
}
async function rows(query: () => any) {
  return readResultRows(() => {
    const builder = query();
    return { range: async (from: number, to: number) => checked(builder.range(from, to)) };
  });
}
export async function readTeacherChampionship(client: any): Promise<ChampionshipState> {
  if (!client) throw new Error('Koneksi Supabase belum aktif.');
  const { data: auth } = await checked(client.auth.getUser());
  if (auth?.user?.id !== AQUA_TEACHER_AUTH_ID) throw new Error('Guru AQUA tidak berwenang.');
  const { data: teacher } = await checked(client.from('teacher_profiles').select('id, role')
    .eq('auth_user_id', auth.user.id).eq('role', 'teacher').single());
  if (!teacher?.id || teacher.role !== 'teacher') throw new Error('Profil guru AQUA tidak valid.');
  const { data: sessions } = await checked(client.from('championship_sessions')
    .select('id, session_name, status, created_by').eq('created_by', teacher.id)
    .in('status', ['OPEN', 'CLOSED']).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(2));
  if (!Array.isArray(sessions)) throw new Error('Daftar sesi tidak valid.');
  // A later CLOSED session must not hide an older OPEN session.
  const { data: open } = await checked(client.from('championship_sessions')
    .select('id, session_name, status, created_by').eq('created_by', teacher.id).eq('status', 'OPEN').limit(2));
  if (!Array.isArray(open) || open.length > 1) throw new Error('Sesi OPEN ambigu. Hubungi pengelola.');
  const session = open[0] || sessions[0] || null;
  if (!session) return { session: null, participants: [], attempts: [] };
  if (!validSessionId(session.id)) throw new Error('ID sesi tidak valid.');
  const participants = await rows(() => client.from('championship_participants')
    .select('id, session_id, student_id, official_score, completion_status', { count: 'exact' })
    .eq('session_id', session.id).order('id'));
  if (participants.length !== AQUA_ROSTER_IDS.length || new Set(participants.map(p => p.student_id)).size !== AQUA_ROSTER_IDS.length ||
    participants.some(p => p.session_id !== session.id || !AQUA_ROSTER_IDS.includes(p.student_id) || !Number.isFinite(Number(p.official_score)) || Number(p.official_score) < 0))
    throw new Error('Roster sesi tidak lengkap atau tidak sesuai 14 siswa AQUA.');
  const attempts = await rows(() => client.from('game_attempts').select('*', { count: 'exact' })
    .eq('session_id', session.id).eq('mode', 'CHAMPIONSHIP').order('completed_at').order('id'));
  return { session, participants, attempts };
}
export async function changeTeacherChampionship(client: any, action: 'open' | 'close', name: string, sessionId?: string): Promise<ChampionshipState> {
  if (!client) throw new Error('Koneksi Supabase belum aktif.');
  if (action === 'close' && !validSessionId(sessionId)) throw new Error('ID sesi tidak valid.');
  const { data: id } = await checked(client.rpc(action === 'open' ? 'aqua_open_championship_v1' : 'aqua_close_championship_v1',
    action === 'open' ? { p_session_name: name } : { p_session_id: sessionId }));
  if (!validSessionId(id)) throw new Error('RPC belum mengonfirmasi ID sesi. Muat ulang sebelum mencoba lagi.');
  const state = await readTeacherChampionship(client);
  if (state.session?.id !== id || state.session.status !== (action === 'open' ? 'OPEN' : 'CLOSED'))
    throw new Error('Status database belum sesuai. Muat ulang sebelum mencoba lagi.');
  return state;
}
export async function readStudentChampionship(client: any, studentId: string) {
  if (!client) throw new Error('Sesi siswa tidak tersedia.');
  const { data: auth } = await checked(client.auth.getUser());
  if (!auth?.user?.id) throw new Error('Sesi siswa tidak valid.');
  const { data: profile } = await checked(client.from('student_profiles').select('id, is_active')
    .eq('auth_user_id', auth.user.id).eq('id', studentId).single());
  if (profile?.id !== studentId || profile.is_active !== true) throw new Error('Profil siswa tidak aktif atau tidak sesuai.');
  const { data } = await checked(client.rpc('aqua_student_championship_v1'));
  if (!Array.isArray(data) || data.length !== 1) throw new Error('Kepesertaan pada satu sesi AQUA OPEN belum tersedia.');
  const participant = data[0];
  if (participant.student_id !== studentId || !validSessionId(participant.session_id) || participant.status !== 'OPEN' ||
    !['REGISTERED', 'PLAYING', 'COMPLETED'].includes(participant.completion_status)) throw new Error('Kepesertaan Championship tidak valid.');
  return { id: participant.session_id as string, session_name: String(participant.session_name) };
}
