import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeacherDashboardData, hydrateStudentProgressFromSupabase, applySupabaseAttemptsAndProgressToProfile, PendingSyncAttempt } from './supabaseService';
import { createEmptyStudentProfile, buildChampionshipLeaderboard } from '../game/rules';
import { readResultRows } from './authoritativeResults';
import { createDashboardRefresh, DashboardRead } from './dashboardRefresh';
import { createAttemptSync, QUEUE_KEY } from './attemptSync';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const solo = { id: 'solo', student_id: STUDENT, mode: 'SOLO', session_id: null, location_id: 1, score: 40, completed_at: '2026-11-08T00:00:00Z' };
const champ = { id: 'champ', student_id: STUDENT, mode: 'CHAMPIONSHIP', session_id: SESSION, location_id: 1, score: 90, completed_at: '2026-11-08T00:01:00Z' };
const stale = { verifiedAttempts: [solo, champ], verifiedProgress: [{ id: 'old', mode: 'SOLO', unlocked_level: 5, completed_locations: [1,2,3,4,5,6,7,8,9,10] }], championshipAttemptIds: ['solo'] };
const profile = { id: STUDENT, auth_user_id: OWNER, display_name: 'Synthetic Student', character: 'BIMA', is_active: true, championship_data: stale };
function fakeClient(tables: Record<string, any[]>, failedTable?: string) {
  const calls: string[] = [];
  const client: any = { from(table: string) {
    calls.push(`read:${table}`);
    const q: any = {
      select(_fields: string, options: any) { assert.equal(options?.count, 'exact'); return q; },
      eq() { return q; }, order() { return q; },
      range: async (start: number, end: number) => table === failedTable
        ? { error: new Error('database read denied') }
        : { data: (tables[table] || []).slice(start, end + 1), count: (tables[table] || []).length },
      update() { throw new Error('Profile writes prohibited during read'); },
      insert() { throw new Error('Insert prohibited during read'); },
      delete() { throw new Error('Delete prohibited during read'); },
    };
    return q;
  }, rpc() { throw new Error('RPC writes prohibited during dashboard read'); } };
  return { client, calls };
}
function tableSet(attempts: any[] = [], progress: any[] = []) {
  return { student_profiles: [profile], game_attempts: attempts, game_progress: progress };
}
function own(data: DashboardRead) { return data.students.find(s => s.id === STUDENT)!; }

test('empty attempts and progress after reset beat stale profile snapshots for both modes', async () => {
  const { client, calls } = fakeClient(tableSet());
  const before = JSON.stringify(profile);
  const data = await getTeacherDashboardData(client);
  assert.equal(data.supabaseConnected, true); assert.equal(data.totalAttemptsCount, 0);
  const p = own(data);
  assert.equal(p.solo.bestTotalScore, 0); assert.equal(p.solo.latestTotalScore, 0); assert.equal(p.solo.unlockedLevel, 1);
  assert.equal(p.championship.totalChampionshipScore, 0); assert.equal(p.championship.unlockedLevel, 1);
  assert.deepEqual(p.solo.locations, {}); assert.deepEqual(p.championship.locations, {});
  assert.deepEqual(buildChampionshipLeaderboard(data.students), []);
  assert.equal(JSON.stringify(profile), before);
  assert.deepEqual(calls.sort(), ['read:game_attempts', 'read:game_progress', 'read:student_profiles']);
});

test('new SOLO and Championship results replace stale snapshots without mixing scores', async () => {
  const { client } = fakeClient(tableSet([solo, champ]));
  const data = await getTeacherDashboardData(client);
  assert.equal(data.totalAttemptsCount, 2);
  assert.equal(own(data).solo.bestTotalScore, 40); assert.equal(own(data).championship.totalChampionshipScore, 90);
});

test('empty progress table does not revive old unlocks while new attempts remain', async () => {
  const { client } = fakeClient(tableSet([solo]));
  const p = own(await getTeacherDashboardData(client));
  assert.equal(p.solo.unlockedLevel, 1); assert.equal(p.championship.unlockedLevel, 1);
  assert.equal(p.championship.totalChampionshipScore, 0);
});

test('every source read failure is a failed refresh, never a successful reset or snapshot fallback', async () => {
  for (const table of ['student_profiles', 'game_attempts', 'game_progress']) {
    const { client } = fakeClient(tableSet(), table);
    const result = await getTeacherDashboardData(client);
    assert.equal(result.supabaseConnected, false); assert.ok(result.error); assert.deepEqual(result.students, []);
  }
});

test('pagination reads beyond the PostgREST page limit without dropping attempts', async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({ ...solo, id: `solo-${i}` }));
  const { client } = fakeClient(tableSet(rows));
  const data = await getTeacherDashboardData(client);
  assert.equal(data.supabaseConnected, true); assert.equal(data.totalAttemptsCount, rows.length);
  assert.equal(own(data).solo.locations[1].attemptsCount, rows.length);
});

test('incomplete or changing pagination cannot be reported as complete results', async () => {
  await assert.rejects(readResultRows(() => ({ range: async () => ({ data: [], count: 10 }) })));
  let page = 0;
  await assert.rejects(readResultRows(() => ({ range: async () => {
    page++; return page === 1 ? { data: [{ id: 'one' }], count: 2 } : { data: [{ id: 'two' }], count: 3 };
  } })));
  await assert.rejects(readResultRows(() => ({ range: async () => ({ data: [{ id: 'same' }], count: 2 }) })));
});

test('student rehydration after reset discards cached scores and never updates an account snapshot', async () => {
  const base = createEmptyStudentProfile(STUDENT, 'Synthetic', 'bima');
  base.authUserId = OWNER; base.solo.bestTotalScore = 1000; base.championship.totalChampionshipScore = 1000;
  base.solo.unlockedLevel = 5; base.championship.unlockedLevel = 5;
  const { client, calls } = fakeClient(tableSet());
  const p = await hydrateStudentProgressFromSupabase(base, client);
  assert.equal(p.solo.bestTotalScore, 0); assert.equal(p.championship.totalChampionshipScore, 0);
  assert.equal(p.solo.unlockedLevel, 1); assert.equal(p.championship.unlockedLevel, 1);
  assert.ok(!calls.includes('read:student_profiles')); assert.equal(base.solo.bestTotalScore, 1000);
});

test('failed student hydration is not silently substituted with cached assessments', async () => {
  const { client } = fakeClient(tableSet(), 'game_attempts');
  await assert.rejects(hydrateStudentProgressFromSupabase(createEmptyStudentProfile(STUDENT, 'Synthetic', 'bima'), client));
});

const empty: DashboardRead = { students: [], totalAttemptsCount: 0, supabaseConnected: true };
test('refresh replaces old displayed scores with confirmed zeros and does not require a write dependency', async () => {
  const old = createEmptyStudentProfile(STUDENT, 'Synthetic', 'bima'); old.solo.bestTotalScore = 1000;
  let displayed = [old]; let status = '';
  const reset = { ...empty, students: [createEmptyStudentProfile(STUDENT, 'Synthetic', 'bima')] };
  const controller = createDashboardRefresh({ read: async () => reset, apply: r => { displayed = r.students; }, status: s => { status = s; }, loading: () => {} });
  controller.setEnabled(true); await controller.refresh();
  assert.equal(displayed[0].solo.bestTotalScore, 0); assert.match(status, /disinkronkan/);
});

test('refresh failure preserves last result with an explicit warning, not fake zeros', async () => {
  let applied = false; let status = '';
  const controller = createDashboardRefresh({ read: async () => ({ ...empty, supabaseConnected: false }), apply: () => { applied = true; }, status: value => { status = value; }, loading: () => {} });
  controller.setEnabled(true); await controller.refresh();
  assert.equal(applied, false); assert.match(status, /belum terverifikasi/);
});

test('overlapping refresh is coalesced, and late results after logout cannot overwrite a new session', async () => {
  let finishOld!: (r: DashboardRead) => void;
  const applied: number[] = []; let reads = 0;
  const controller = createDashboardRefresh({ read: () => {
    reads++; return reads === 1 ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(empty);
  }, apply: r => { applied.push(r.totalAttemptsCount); }, status: () => {}, loading: () => {} });
  controller.setEnabled(true); const old = controller.refresh(); assert.equal(controller.refresh(), old);
  controller.setEnabled(false); controller.setEnabled(true); await controller.refresh();
  finishOld({ ...empty, totalAttemptsCount: 999 }); await old;
  assert.deepEqual(applied, [0]);
});

class MemoryStorage implements Storage {
  map = new Map<string,string>(); get length() { return this.map.size; }
  clear() { this.map.clear(); } key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; } setItem(k: string,v: string) { this.map.set(k,v); } removeItem(k:string) { this.map.delete(k); }
}
test('owned legacy queues from before this reset fix are preserved without replaying old assessments', async () => {
  const storage = new MemoryStorage();
  const row: PendingSyncAttempt = { studentId: STUDENT, authUserId: OWNER, mode: 'solo', levelNumber: 1, locationId: 1, correctCount: 10, wrongCount: 0, durationSeconds: 30, score: 100, timestamp: 1, idempotencyKey: 'old' };
  storage.setItem(QUEUE_KEY, JSON.stringify([row])); const before = storage.getItem(QUEUE_KEY);
  let sent = 0;
  const engine = createAttemptSync({ storage: () => storage, context: async () => ({ studentId: STUDENT, authUserId: OWNER, client: { rpc: () => { sent++; throw new Error('must not replay'); } } }) });
  await engine.flush(); assert.equal(sent, 0); assert.equal(storage.getItem(QUEUE_KEY), before);
});

test('Championship uses production OPEN status rather than an obsolete is_active flag', async () => {
  for (const [status, is_active, expected] of [['OPEN', false, true], ['CLOSED', true, false], [undefined, true, false]] as const) {
    const storage = new MemoryStorage(); let writes = 0;
    const client: any = {
      from(table: string) {
        const q: any = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: table === 'championship_sessions'
          ? { id: SESSION, status, is_active }
          : { id: 'confirmed', student_id: STUDENT, mode: 'CHAMPIONSHIP', session_id: SESSION } }) };
        return q;
      },
      rpc: async () => { writes++; return { data: { attempt_id: 'confirmed', student_id: STUDENT } }; },
    };
    const engine = createAttemptSync({ storage: () => storage, context: async () => ({ studentId: STUDENT, authUserId: OWNER, client }) });
    const saved = await engine.save({ studentId: STUDENT, authUserId: OWNER, mode: 'championship', sessionId: SESSION,
      levelNumber: 1, locationId: 1, correctCount: 9, wrongCount: 1, durationSeconds: 30, idempotencyKey: 'new-champ' });
    assert.equal(saved.syncedToSupabase, expected); assert.equal(writes, expected ? 1 : 0);
  }
});

test('legacy shared progress row cannot give SOLO levels or completions from Championship', async () => {
  const { client } = fakeClient(tableSet([champ], [{ id: 'mixed-progress', student_id: STUDENT, mode: 'SOLO', unlocked_level: 5, completed_locations: [1,2,3,4,5,6,7,8,9,10] }]));
  const p = own(await getTeacherDashboardData(client));
  assert.equal(p.solo.bestTotalScore, 0); assert.equal(p.solo.unlockedLevel, 1); assert.deepEqual(p.solo.locations, {});
  assert.equal(p.championship.totalChampionshipScore, 90); assert.equal(p.championship.unlockedLevel, 1);
});

test('only verified attempt completions unlock each mode, despite conflicting game_progress', async () => {
  const soloSecond = { ...solo, id: 'solo-second', location_id: 2 };
  const { client } = fakeClient(tableSet([solo, soloSecond, champ], [{ id: 'champ-overwrite', student_id: STUDENT, mode: 'CHAMPIONSHIP', unlocked_level: 5, completed_locations: [1,2,3,4,5,6,7,8,9,10] }]));
  const p = own(await getTeacherDashboardData(client));
  assert.equal(p.solo.unlockedLevel, 2); assert.equal(p.championship.unlockedLevel, 1);
  assert.equal(p.solo.bestTotalScore, 80); assert.equal(p.championship.totalChampionshipScore, 90);
});
