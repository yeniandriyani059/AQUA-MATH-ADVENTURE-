import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMissionRun, parseGameMode, confirmAttempt } from './championshipContract';
import { createAttemptSync, QUEUE_KEY } from './attemptSync';
import { applySupabaseAttemptsAndProgressToProfile, getActiveChampionshipSession } from './supabaseService';
import { createEmptyStudentProfile, buildChampionshipLeaderboard } from '../game/rules';
import { getActiveGameMode, recordMissionCompletion } from './gameStorage';
import { studentSupabase } from './supabaseClient';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
}
function harness() {
  const storage = new MemoryStorage();
  const calls: any[] = [];
  let activeSession = S1;
  let fail = false;
  let returnedMode: string | null = null;
  let returnedSession: string | null = null;
  let readDenied = false;
  const rows: any[] = [];
  const client = {
    from(table: string) {
      let id: string;
      const q: any = { select() { return q; }, eq(k: string, v: string) { if (k === 'id') id = v; return q; },
        maybeSingle: async () => table === 'championship_sessions'
          ? { data: { id, is_active: id === activeSession } }
          : readDenied ? { error: new Error('read denied') } : { data: rows.find(row => row.id === id) } };
      return q;
    },
    rpc: async (_name: string, args: any) => {
      calls.push(args);
      if (fail) return { error: { code: '42501' } };
      const row = { id: `id-${calls.length}`, student_id: 'student', mode: returnedMode || args.p_mode,
        session_id: returnedSession || args.p_session_id, location_id: args.p_location_id, score: args.p_correct_count * 10 };
      rows.push(row); return { data: { attempt_id: row.id, student_id: 'student' } };
    },
  };
  const engine = createAttemptSync({ storage: () => storage, context: async () => ({ authUserId: 'owner', studentId: 'student', client }) });
  return { engine, storage, rows, calls, client, setActive: (id: string) => { activeSession = id; }, setFail: (v: boolean) => { fail = v; }, wrongMode: () => { returnedMode = 'SOLO'; }, wrongSession: () => { returnedSession = S2; }, denyRead: () => { readDenied = true; } };
}
const result = { studentId: 'student', authUserId: 'owner', mode: 'championship' as const, sessionId: S1, locationId: 1, levelNumber: 1, correctCount: 9, wrongCount: 1, durationSeconds: 30, idempotencyKey: 'mission' };

test('mission freezes mode, owner, session and retry key at start, not submission', async () => {
  let active = S1;
  const run = await captureMissionRun({ studentId: 'student', authUserId: 'owner', mode: 'championship', locationId: 1 }, async () => ({ id: active }));
  active = S2;
  assert.ok(Object.isFrozen(run)); assert.equal(run.sessionId, S1); assert.equal(run.mode, 'championship');
  const h = harness(); const saved = await h.engine.save({ ...result, ...run });
  assert.equal(saved.syncedToSupabase, true);
  assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP'); assert.equal(h.calls[0].p_session_id, S1);
  const dashboard = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), h.rows);
  assert.equal(dashboard.solo.bestTotalScore, 0); assert.equal(dashboard.championship.totalChampionshipScore, 90);
  assert.equal(buildChampionshipLeaderboard([dashboard])[0].championshipScore, 90);
});

test('SOLO mission never reads or carries a Championship session', async () => {
  const run = await captureMissionRun({ studentId: 'student', mode: 'solo', locationId: 1 }, async () => { throw new Error('must not read session'); });
  assert.equal(run.sessionId, null); assert.equal(run.mode, 'solo');
});

test('Championship cannot start with absent/invalid session or unknown mode', async () => {
  for (const session of [null, { id: 'invalid' }]) {
    await assert.rejects(captureMissionRun({ studentId: 'student', mode: 'championship', locationId: 1 }, async () => session));
  }
  await assert.rejects(captureMissionRun({ studentId: 'student', mode: 'invalid' as any, locationId: 1 }, async () => ({ id: S1 })));
});

test('RPC rejection and retry preserve CHAMPIONSHIP and original session without any SOLO fallback', async () => {
  const h = harness(); h.setFail(true);
  assert.equal((await h.engine.save(result)).syncedToSupabase, false);
  h.setActive(S2); h.setFail(false); await h.engine.flush(); assert.equal(h.calls.length, 1);
  assert.equal(h.engine.read()[0].sessionId, S1);
  h.setActive(S1); await h.engine.flush();
  assert.deepEqual(h.calls.map(row => [row.p_mode, row.p_session_id]), [['CHAMPIONSHIP', S1], ['CHAMPIONSHIP', S1]]);
});

test('wrong persisted mode/session or denied read-back holds queue and never acknowledges or rewrites as SOLO', async () => {
  for (const setup of ['wrongMode', 'wrongSession', 'denyRead'] as const) {
    const h = harness(); h[setup]();
    assert.equal((await h.engine.save(result)).syncedToSupabase, false);
    assert.equal(h.engine.read()[0].syncState, 'uncertain');
    await h.engine.flush(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP');
  }
});

test('uppercase Championship queue is explicit Championship; unknown modes are retained without RPC', async () => {
  for (const mode of ['CHAMPIONSHIP', 'mystery', '', null]) {
    const h = harness(); h.storage.setItem(QUEUE_KEY, JSON.stringify([{ ...result, mode, score: 90, timestamp: 1 }]));
    await h.engine.flush();
    assert.equal(h.calls.length, mode === 'CHAMPIONSHIP' ? 1 : 0);
    if (h.calls.length) assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP'); else assert.equal(h.engine.read().length, 1);
  }
});

test('missing-session and SOLO-with-session queued rows are never sent as SOLO fallback', async () => {
  for (const params of [{ ...result, sessionId: null }, { ...result, mode: 'solo' as const }]) {
    const h = harness(); await h.engine.save(params); await h.engine.flush();
    assert.equal(h.calls.length, 0); assert.equal(h.engine.read().length, 1);
  }
});

test('Dashboard partitions explicit modes and ignores ambiguous historical rows without mutating them', () => {
  const attempts = [
    { id: 'solo', mode: 'SOLO', score: 20, location_id: 1 },
    { id: 'champ', mode: 'CHAMPIONSHIP', session_id: S1, score: 90, location_id: 1 },
    { id: 'lower', mode: 'championship', session_id: S1, score: 80, location_id: 2 },
    { id: 'unknown', score: 100, location_id: 3 },
    { id: 'wrong', mode: 'WRONG', score: 100, location_id: 4 },
    { id: 'conflict', mode: 'SOLO', session_id: S1, score: 100, location_id: 5 },
    { id: 'hint', mode: 'SOLO', score: 100, location_id: 6 },
    { id: 'no-session', mode: 'CHAMPIONSHIP', score: 100, location_id: 7 },
  ];
  const original = JSON.stringify(attempts);
  const progress = [{ mode: 'CHAMPIONSHIP', unlocked_level: 2, completed_locations: [1, 2] }, { mode: null, unlocked_level: 5, completed_locations: [9] }];
  const profile = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), attempts, progress, { championshipAttemptIds: ['hint'] });
  assert.equal(profile.solo.bestTotalScore, 20); assert.equal(profile.solo.unlockedLevel, 1);
  assert.equal(profile.championship.totalChampionshipScore, 170); assert.equal(profile.championship.unlockedLevel, 2);
  assert.equal(JSON.stringify(attempts), original);
  assert.equal(buildChampionshipLeaderboard([profile])[0].championshipScore, 170);
});

test('snapshot-only fallback still partitions modes strictly', () => {
  const p = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), [], [], {
    verifiedAttempts: [{ id: 'champ', mode: 'CHAMPIONSHIP', session_id: S1, score: 90, location_id: 1 }, { id: 'unknown', score: 100, location_id: 2 }],
    verifiedProgress: [{ mode: 'CHAMPIONSHIP', unlocked_level: 2 }],
  });
  assert.equal(p.solo.bestTotalScore, 0); assert.equal(p.solo.unlockedLevel, 1); assert.equal(p.championship.totalChampionshipScore, 90);
});

test('cached uppercase mode stays Championship and local completion never awards SOLO points', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    storage.setItem('aqua_math_active_mode_v1', 'CHAMPIONSHIP'); assert.equal(getActiveGameMode(), 'championship');
    const base = createEmptyStudentProfile('student', 'Synthetic', 'bima');
    storage.setItem('aqua_math_students_v1', JSON.stringify([base]));
    const { updatedStudent } = recordMissionCompletion('student', getActiveGameMode(), 1, {}, 30);
    assert.equal(updatedStudent.solo.bestTotalScore, 0); assert.deepEqual(updatedStudent.solo.locations, {});
    assert.ok(updatedStudent.championship.locations[1]);
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage; }
});

test('active-session lookup never falls back to cached ID after database failure', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage(); storage.setItem('aqua_math_active_championship_session_id', S1);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const oldSession = studentSupabase!.auth.getSession;
  const oldFrom = studentSupabase!.from;
  (studentSupabase!.auth as any).getSession = async () => ({ data: { session: { user: { id: 'owner' } } } });
  let databaseError = true;
  (studentSupabase as any).from = () => {
    const q: any = { select() { return q; }, eq() { return q; }, order() { return q; }, limit(n: number) { assert.equal(n, 2); return q; },
      maybeSingle: async () => databaseError ? { error: new Error('unavailable or ambiguous') } : { data: { id: S2, session_name: 'Synthetic' } } };
    return q;
  };
  try {
    assert.equal(await getActiveChampionshipSession(), null);
    assert.equal(storage.getItem('aqua_math_active_championship_session_id'), S1);
    databaseError = false; assert.equal((await getActiveChampionshipSession())?.id, S2);
  } finally {
    studentSupabase!.auth.getSession = oldSession; studentSupabase!.from = oldFrom;
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage;
  }
});

test('UI mode selection changing after mission start cannot change the captured submission mode', async () => {
  const selection = { studentId: 'student', authUserId: 'owner', locationId: 1, mode: 'championship' as 'championship' | 'solo' };
  const run = await captureMissionRun(selection, async () => ({ id: S1 }));
  selection.mode = 'solo';
  const h = harness(); await h.engine.save({ ...result, ...run });
  assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP'); assert.equal(h.calls[0].p_session_id, S1);
});

test('confirmed SOLO plus failed Championship leaves SOLO total unchanged through Dashboard hydration', async () => {
  const h = harness();
  assert.equal((await h.engine.save({ ...result, mode: 'solo', sessionId: null, correctCount: 4, wrongCount: 6, idempotencyKey: 'solo' })).syncedToSupabase, true);
  h.setFail(true); assert.equal((await h.engine.save(result)).syncedToSupabase, false);
  const profile = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), h.rows);
  assert.equal(profile.solo.bestTotalScore, 40); assert.equal(profile.championship.totalChampionshipScore, 0);
  assert.equal(h.calls[0].p_mode, 'SOLO'); assert.equal(h.calls[1].p_mode, 'CHAMPIONSHIP');
});
