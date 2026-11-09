import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMissionRun, parseGameMode, confirmAttempt } from './championshipContract';
import { createAttemptSync, QUEUE_KEY } from './attemptSync';
import { applySupabaseAttemptsAndProgressToProfile, getActiveChampionshipSession, projectChampionshipSession } from './supabaseService';
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
  const rpcNames: string[] = [];
  const receipts = new Map<string, any>();
  let timeoutAfterCommit = false;
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
          ? { data: { id, status: id === activeSession ? 'OPEN' : 'CLOSED' } }
          : readDenied ? { error: new Error('read denied') } : { data: rows.find(row => row.id === id) } };
      return q;
    },
    rpc: async (_name: string, args: any) => {
      calls.push(args); rpcNames.push(_name);
      if (args.p_request_id && receipts.has(args.p_request_id)) return { data: receipts.get(args.p_request_id) };
      if (fail) return { error: { code: '42501' } };
      const row = { id: `id-${calls.length}`, student_id: 'student', mode: returnedMode || args.p_mode,
        session_id: returnedSession || args.p_session_id, location_id: args.p_location_id, score: args.p_correct_count * 10 };
      rows.push(row);
      const data = { success: true, attempt_id: row.id, student_id: 'student', mode: args.p_mode, score: row.score, correct_count: args.p_correct_count, wrong_count: args.p_wrong_count, attempt_number: 1 };
      if (args.p_request_id) receipts.set(args.p_request_id, data);
      if (timeoutAfterCommit) { timeoutAfterCommit = false; throw new Error('Synthetic lost response after commit'); }
      return { data };
    },
  };
  const engine = createAttemptSync({ storage: () => storage, context: async () => ({ authUserId: 'owner', studentId: 'student', client }) });
  return { engine, storage, rows, calls, client, rpcNames, timeout: () => { timeoutAfterCommit = true; }, setActive: (id: string) => { activeSession = id; }, setFail: (v: boolean) => { fail = v; }, wrongMode: () => { returnedMode = 'SOLO'; }, wrongSession: () => { returnedSession = S2; }, denyRead: () => { readDenied = true; } };
}
const result = { protocolVersion: 'snapshot-free-v1', studentId: 'student', authUserId: 'owner', mode: 'championship' as const, sessionId: S1, locationId: 1, levelNumber: 1, correctCount: 9, wrongCount: 1, durationSeconds: 30, idempotencyKey: 'mission' };

test('mission freezes mode, owner, session and retry key at start, not submission', async () => {
  let active = S1;
  const run = await captureMissionRun({ studentId: 'student', authUserId: 'owner', mode: 'championship', locationId: 1 }, async () => ({ id: active }));
  active = S2;
  assert.ok(Object.isFrozen(run)); assert.equal(run.sessionId, S1); assert.equal(run.mode, 'championship');
  const h = harness(); const saved = await h.engine.save({ ...result, ...run });
  assert.equal(saved.syncedToSupabase, true);
  assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP'); assert.equal(h.calls[0].p_session_id, S1);
  assert.equal(h.calls[0].p_location_id, '1'); assert.ok(Number.isInteger(h.calls[0].p_duration_seconds));
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
    assert.equal(h.engine.read()[0].syncState, 'blocked');
    await h.engine.flush(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP');
  }
});

test('uppercase Championship queue is explicit Championship; unknown modes are retained without RPC', async () => {
  for (const mode of ['CHAMPIONSHIP', 'mystery', '', null]) {
    const h = harness(); h.storage.setItem(QUEUE_KEY, JSON.stringify([{ ...result, mode, score: 90, timestamp: 1, championshipContract: 'best-per-mission-v1', championshipRequestId: crypto.randomUUID() }]));
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
  assert.equal(profile.solo.bestTotalScore, 120); assert.equal(profile.solo.unlockedLevel, 1);
  assert.equal(profile.championship.totalChampionshipScore, 170); assert.equal(profile.championship.unlockedLevel, 2);
  assert.equal(JSON.stringify(attempts), original);
  assert.equal(buildChampionshipLeaderboard([profile])[0].championshipScore, 170);
});

test('empty authoritative rows never revive snapshot-only results after reset', () => {
  const p = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), [], [], {
    verifiedAttempts: [{ id: 'champ', mode: 'CHAMPIONSHIP', session_id: S1, score: 90, location_id: 1 }, { id: 'unknown', score: 100, location_id: 2 }],
    verifiedProgress: [{ mode: 'CHAMPIONSHIP', unlocked_level: 2 }],
  });
  assert.equal(p.solo.bestTotalScore, 0); assert.equal(p.solo.unlockedLevel, 1); assert.equal(p.championship.totalChampionshipScore, 0);
  assert.equal(p.championship.unlockedLevel, 1);
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

test('active-session lookup never falls back to cached ID without current authenticated student context', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage(); storage.setItem('aqua_math_active_championship_session_id', S1);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const oldSession = studentSupabase!.auth.getSession;
  (studentSupabase!.auth as any).getSession = async () => ({ data: { session: null } });
  try {
    await assert.rejects(getActiveChampionshipSession(), /Sesi siswa tidak tersedia/);
    await assert.rejects(getActiveChampionshipSession('student'), /Sesi siswa tidak tersedia/);
    assert.equal(storage.getItem('aqua_math_active_championship_session_id'), S1);
  } finally {
    studentSupabase!.auth.getSession = oldSession;
    if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage;
  }
});

test('UI mode selection changing after mission start cannot change the captured submission mode', async () => {
  const selection = { studentId: 'student', authUserId: 'owner', locationId: 1, mode: 'championship' as 'championship' | 'solo' };
  const run = await captureMissionRun(selection, async () => ({ id: S1 }));
  selection.mode = 'solo';
  const h = harness(); await h.engine.save({ ...result, ...run });
  assert.equal(h.calls[0].p_mode, 'CHAMPIONSHIP'); assert.equal(h.calls[0].p_session_id, S1);
  assert.equal(h.calls[0].p_location_id, '1'); assert.ok(Number.isInteger(h.calls[0].p_duration_seconds));
});

test('confirmed SOLO plus failed Championship leaves SOLO total unchanged through Dashboard hydration', async () => {
  const h = harness();
  assert.equal((await h.engine.save({ ...result, mode: 'solo', sessionId: null, correctCount: 4, wrongCount: 6, idempotencyKey: 'solo' })).syncedToSupabase, true);
  h.setFail(true); assert.equal((await h.engine.save(result)).syncedToSupabase, false);
  const profile = applySupabaseAttemptsAndProgressToProfile(createEmptyStudentProfile('student', 'Synthetic', 'bima'), h.rows);
  assert.equal(profile.solo.bestTotalScore, 40); assert.equal(profile.championship.totalChampionshipScore, 0);
  assert.equal(h.calls[0].p_mode, 'SOLO'); assert.equal(h.calls[1].p_mode, 'CHAMPIONSHIP');
});


test('audited integer/count contract rejects malformed pending payloads without an RPC call', async () => {
  for (const changes of [{ durationSeconds: 0.5 }, { correctCount: 8, wrongCount: 1 }, { levelNumber: 6 }, { locationId: 0 }]) {
    const h = harness();
    assert.equal((await h.engine.save({ ...result, ...changes })).syncedToSupabase, false);
    await h.engine.flush(); assert.equal(h.calls.length, 0); assert.equal(h.engine.read().length, 1);
  }
});


test('new Championship sends stable request ID to keyed RPC, including replay after lost response and CLOSED session', async () => {
  const h = harness(); h.timeout();
  const key = crypto.randomUUID();
  assert.equal((await h.engine.save({ ...result, idempotencyKey: key })).syncedToSupabase, false);
  assert.equal(h.engine.read()[0].championshipRequestId, key);
  h.setActive(S2); // original session now closed; receipt replay remains valid.
  const flushed = await h.engine.flush();
  assert.equal(flushed.syncedCount, 1); assert.equal(h.rows.length, 1);
  assert.deepEqual(h.rpcNames, ['aqua_save_championship_attempt_v1', 'aqua_save_championship_attempt_v1']);
  assert.deepEqual(h.calls.map(c => [c.p_request_id, c.p_mode, c.p_session_id]), [[key, 'CHAMPIONSHIP', S1], [key, 'CHAMPIONSHIP', S1]]);
});

test('pre-keyed Championship queues are retained without upgrading or replaying', async () => {
  const h = harness();
  h.storage.setItem(QUEUE_KEY, JSON.stringify([{ ...result, score: 90, timestamp: 1, syncState: 'uncertain' }]));
  const before = h.storage.getItem(QUEUE_KEY);
  await h.engine.flush();
  assert.equal(h.calls.length, 0); assert.equal(h.storage.getItem(QUEUE_KEY), before);
});

test('legitimate new Championship play receives a new request ID; account mismatch never submits the old queue', async () => {
  const h = harness();
  await h.engine.save({ ...result, idempotencyKey: crypto.randomUUID() });
  await h.engine.save({ ...result, idempotencyKey: crypto.randomUUID() });
  assert.equal(h.calls.length, 2); assert.notEqual(h.calls[0].p_request_id, h.calls[1].p_request_id);
  h.storage.setItem(QUEUE_KEY, JSON.stringify([{ ...result, studentId: 'other-profile', authUserId: 'other-owner', score: 90, timestamp: 1, championshipContract: 'best-per-mission-v1', championshipRequestId: crypto.randomUUID(), syncState: 'uncertain' }]));
  await h.engine.flush(); assert.equal(h.calls.length, 2); assert.equal(h.engine.read().length, 1);
});


test('Championship projection is session/owner scoped and preserves SOLO state', () => {
  const base = createEmptyStudentProfile('student', 'Synthetic', 'bima');
  base.solo.bestTotalScore = 80; base.solo.latestTotalScore = 80;
  base.championship.totalChampionshipScore = 999; base.championship.unlockedLevel = 5;
  const before = JSON.stringify(base);
  const projection = projectChampionshipSession(base, [
    { student_id: 'student', mode: 'CHAMPIONSHIP', session_id: S1, score: 60, location_id: 1 },
    { student_id: 'student', mode: 'CHAMPIONSHIP', session_id: S1, score: 90, location_id: 1 },
    { student_id: 'student', mode: 'CHAMPIONSHIP', session_id: S1, score: 70, location_id: 1 },
    { student_id: 'student', mode: 'CHAMPIONSHIP', session_id: S2, score: 100, location_id: 2 },
    { student_id: 'other', mode: 'CHAMPIONSHIP', session_id: S1, score: 100, location_id: 2 },
    { student_id: 'student', mode: 'SOLO', session_id: null, score: 100, location_id: 2 },
  ], S1);
  assert.equal(projection.championship.totalChampionshipScore, 90);
  assert.equal(projection.championship.unlockedLevel, 1);
  assert.equal(projection.solo, base.solo); assert.equal(JSON.stringify(base), before);
  const fresh = projectChampionshipSession(base, [], S2);
  assert.equal(fresh.championship.totalChampionshipScore, 0); assert.equal(fresh.championship.unlockedLevel, 1);
  assert.equal(fresh.solo.bestTotalScore, 80);
});
