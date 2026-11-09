import test from 'node:test';
import assert from 'node:assert/strict';
import { AQUA_ROSTER_IDS, AQUA_TEACHER_AUTH_ID, changeTeacherChampionship, listTeacherChampionshipSessions, readStudentChampionship, readTeacherChampionship } from './championshipSessions';

const S = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
function harness() {
  const calls: any[] = [];
  const state = { user: AQUA_TEACHER_AUTH_ID, role: 'teacher', profileId: AQUA_ROSTER_IDS[0] as string, active: true,
    sessions: [] as any[], unmanaged: [] as string[], participants: [] as any[], attempts: [] as any[], studentResponse: [] as any[], error: '', rpcError: '', rpcId: S, readbackWrong: false };
  const client = { auth: { getUser: async () => ({ data: { user: { id: state.user } } }) },
    from(table: string) {
      const filters: ((r: any) => boolean)[] = [];
      let max = Infinity;
      const result = () => {
        if (state.error) return { error: { message: state.error } };
        let rows = table === 'teacher_profiles' ? [{ id: 'profile-teacher-not-auth-id', role: state.role, auth_user_id: state.user }]
          : table === 'student_profiles' ? [{ id: state.profileId, auth_user_id: state.user, is_active: state.active }]
          : table === 'championship_sessions' ? state.sessions : table === 'championship_participants' ? state.participants : state.attempts;
        rows = rows.filter(r => filters.every(fn => fn(r))).slice(0, max);
        return { data: rows, count: rows.length };
      };
      const q: any = { select() { return q; }, order() { return q; },
        eq(key: string, value: any) { calls.push([table, key, value]); filters.push(r => r[key] === value); return q; },
        in(key: string, values: any[]) { filters.push(r => values.includes(r[key])); return q; },
        limit(value: number) { max = value; return q; },
        single: async () => { const response = result(); return response.error ? response : { data: response.data?.length === 1 ? response.data[0] : null }; },
        range: async (start: number, end: number) => { const response = result(); return { ...response, data: response.data?.slice(start, end + 1) }; },
        then(resolve: any, reject: any) { return Promise.resolve(result()).then(resolve, reject); },
        insert() { throw new Error('Direct writes prohibited'); }, update() { throw new Error('Direct writes prohibited'); }, delete() { throw new Error('Direct writes prohibited'); },
      }; return q;
    },
    async rpc(name: string, args?: any) {
      calls.push([name, args]);
      if (state.rpcError) return { error: { message: state.rpcError } };
      if (name === 'aqua_teacher_championship_sessions_v1') return { data: state.sessions.filter(s => s.created_by === 'profile-teacher-not-auth-id' && !state.unmanaged.includes(s.id)).slice(0, 2) };
      if (name === 'aqua_can_read_championship_session_v1') return { data: state.sessions.some(s => s.id === args.p_session_id && s.created_by === 'profile-teacher-not-auth-id' && !state.unmanaged.includes(s.id)) };
      if (name === 'aqua_student_championship_v1') return { data: state.studentResponse };
      if (!state.readbackWrong) {
        if (name === 'aqua_open_championship_v1') {
          state.sessions = [{ id: S, status: 'OPEN', session_name: args.p_session_name, created_by: 'profile-teacher-not-auth-id' }];
          state.participants = AQUA_ROSTER_IDS.map((id, i) => ({ id: `participant-${i}`, student_id: id, session_id: S, official_score: 0, completion_status: 'REGISTERED' }));
        } else state.sessions.forEach(s => { s.status = 'CLOSED'; });
      }
      return { data: state.rpcId };
    },
  };
  return { state, client, calls };
}
test('official roster is explicit, unique and contains exactly 14 profile IDs', () => {
  assert.equal(AQUA_ROSTER_IDS.length, 14); assert.equal(new Set(AQUA_ROSTER_IDS).size, 14);
  assert.equal(AQUA_ROSTER_IDS[0], '215f7ad8-fb6c-4f4c-b414-db28b0021939');
});
test('open and close require confirmed RPC and complete database readback', async () => {
  const h = harness();
  const opened = await changeTeacherChampionship(h.client, 'open', 'Synthetic Championship');
  assert.equal(opened.session?.status, 'OPEN'); assert.equal(opened.participants.length, 14);
  assert.ok(h.calls.some(c => c[0] === 'aqua_teacher_championship_sessions_v1'));
  assert.equal(opened.session?.created_by, 'profile-teacher-not-auth-id');
  const closed = await changeTeacherChampionship(h.client, 'close', '', S);
  assert.equal(closed.session?.status, 'CLOSED');
  assert.ok(h.calls.some(c => c[0] === 'aqua_close_championship_v1' && c[1].p_session_id === S));
});
test('RPC failures preserve original database message; success without readback is rejected', async () => {
  const h = harness(); h.state.rpcError = 'Synthetic permission denied';
  await assert.rejects(changeTeacherChampionship(h.client, 'open', 'Synthetic'), /Synthetic permission denied/);
  h.state.rpcError = ''; h.state.readbackWrong = true;
  await assert.rejects(changeTeacherChampionship(h.client, 'open', 'Synthetic'), /Status database belum sesuai/);
});
test('unauthorized teacher, incomplete roster, foreign roster, and ambiguous OPEN sessions fail closed', async () => {
  const h = harness(); h.state.user = OTHER;
  await assert.rejects(readTeacherChampionship(h.client), /tidak berwenang/);
  h.state.user = AQUA_TEACHER_AUTH_ID;
  await changeTeacherChampionship(h.client, 'open', 'Synthetic');
  h.state.participants.pop(); await assert.rejects(readTeacherChampionship(h.client), /Roster/);
  await h.client.rpc('aqua_open_championship_v1', { p_session_name: 'Synthetic' });
  h.state.participants[0].student_id = OTHER; await assert.rejects(readTeacherChampionship(h.client), /Roster/);
  await h.client.rpc('aqua_open_championship_v1', { p_session_name: 'Synthetic' });
  h.state.sessions.push({ ...h.state.sessions[0], id: OTHER });
  await assert.rejects(readTeacherChampionship(h.client), /ambigu/);
});
test('official score and attempts are restricted to the selected session and Championship mode', async () => {
  const h = harness(); await changeTeacherChampionship(h.client, 'open', 'Synthetic');
  h.state.participants[0].official_score = 180;
  h.state.attempts = [
    { id: 'champ', session_id: S, mode: 'CHAMPIONSHIP', score: 90 },
    { id: 'solo', session_id: null, mode: 'SOLO', score: 100 },
    { id: 'old-session', session_id: OTHER, mode: 'CHAMPIONSHIP', score: 100 },
  ];
  const data = await readTeacherChampionship(h.client);
  assert.equal(data.participants[0].official_score, 180);
  assert.deepEqual(data.attempts.map(a => a.id), ['champ']);
});
test('student discovery checks owner, active profile, OPEN session and membership; no teacher profile read', async () => {
  const h = harness(); h.state.user = OTHER;
  h.state.studentResponse = [{ student_id: AQUA_ROSTER_IDS[0], session_id: S, session_name: 'Synthetic', status: 'OPEN', completion_status: 'REGISTERED' }];
  assert.equal((await readStudentChampionship(h.client, AQUA_ROSTER_IDS[0])).id, S);
  assert.ok(!h.calls.some(c => c[0] === 'teacher_profiles'));
  h.state.active = false; await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /tidak aktif/);
  h.state.active = true;
  await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[1]), /tidak aktif/);
  h.state.studentResponse[0].status = 'CLOSED'; await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /tidak valid/);
  h.state.studentResponse = []; await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /belum tersedia/);
});
test('student discovery rejects foreign identity and multiple eligible sessions and preserves RPC errors', async () => {
  const h = harness(); h.state.studentResponse = [{ student_id: OTHER, session_id: S, status: 'OPEN', completion_status: 'PLAYING' }];
  await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /tidak valid/);
  h.state.studentResponse.push(h.state.studentResponse[0]);
  await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /belum tersedia/);
  h.state.rpcError = 'Synthetic discovery error'; await assert.rejects(readStudentChampionship(h.client, AQUA_ROSTER_IDS[0]), /Synthetic discovery error/);
});

test('archives read explicit authorized session without changing current lifecycle', async () => {
  const h = harness();
  await changeTeacherChampionship(h.client, 'open', 'Current');
  h.state.sessions.push({ id: OTHER, status: 'CLOSED', session_name: 'Archive', created_by: 'profile-teacher-not-auth-id' });
  h.state.participants.push(...AQUA_ROSTER_IDS.map((student_id, i) => ({ id: `old-${i}`, student_id, session_id: OTHER, official_score: 100 })));
  assert.equal((await listTeacherChampionshipSessions(h.client)).length, 2);
  assert.equal((await readTeacherChampionship(h.client, OTHER)).session?.id, OTHER);
  assert.equal((await readTeacherChampionship(h.client)).session?.id, S);
  h.state.sessions[1].created_by = 'other-app';
  await assert.rejects(readTeacherChampionship(h.client, OTHER), /berwenang|tidak valid/);
});

test('archive list includes older managed sessions beyond current RPC limit and excludes another app with same teacher', async () => {
 const h = harness(); await changeTeacherChampionship(h.client, 'open', 'Current');
 const older = '33333333-3333-4333-8333-333333333333';
 const foreign = '44444444-4444-4444-8444-444444444444';
 for (const id of [OTHER, older, foreign]) h.state.sessions.push({ id, status: 'CLOSED', session_name: id, created_by: 'profile-teacher-not-auth-id' });
 h.state.unmanaged.push(foreign);
 h.state.participants.push(...AQUA_ROSTER_IDS.map((student_id, i) => ({ id: `older-${i}`, student_id, session_id: older, official_score: 0 })));
 const list = await listTeacherChampionshipSessions(h.client);
 assert.deepEqual(list.map(s => s.id), [S, OTHER, older]);
 assert.equal((await readTeacherChampionship(h.client, older)).session?.id, older);
 await assert.rejects(readTeacherChampionship(h.client, foreign), /berwenang/);
});
