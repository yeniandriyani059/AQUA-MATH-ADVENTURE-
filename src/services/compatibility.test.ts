import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttemptSync, QUEUE_KEY } from './attemptSync';
import { createTeacherSessionAccess } from './teacherSession';
import { adminAddSingleStudent, adminAddBatchStudents, syncOfficial14StudentAccounts, resetStudentPasswordByTeacher, registerStudentProfile } from './supabaseService';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
}
const attempt = { authUserId: 'A', studentId: 'profile-A', mode: 'solo' as const, levelNumber: 1, locationId: 1, correctCount: 8, wrongCount: 2, durationSeconds: 20, idempotencyKey: 'attempt-1' };
function harness() {
  const storage = new MemoryStorage();
  let active: string | null = 'A';
  const calls: any[] = [];
  const records = new Map<string, any>();
  let behavior: 'ok' | 'denied' | 'timeout' | 'empty' = 'ok';
  let rpcHook: (() => Promise<void>) | undefined;
  let sessionOpen = true;
  const engine = createAttemptSync({ storage: () => storage, context: async () => {
    if (!active) return null;
    const owner = active; // A pinned client cannot start using B's token.
    return { authUserId: owner, studentId: `profile-${owner}`, client: {
      rpc: async (_name: string, args: any) => {
        calls.push({ owner, args });
        await rpcHook?.();
        if (behavior === 'denied') return { error: { code: '42501' } };
        if (behavior === 'timeout') throw new Error('connection lost after sending');
        if (behavior === 'empty') return { data: {} };
        const row = { id: `db-${calls.length}`, student_id: `profile-${owner}`, mode: args.p_mode, session_id: args.p_session_id };
        records.set(row.id, row); return { data: { attempt_id: row.id, student_id: row.student_id } };
      },
      from(table: string) {
        let id: string;
        const query: any = { select() { return query; }, eq(k: string, v: string) { if (k === 'id') id = v; return query; },
          maybeSingle: async () => ({ data: table === 'championship_sessions' ? { id, is_active: sessionOpen } : records.get(id) || null }) };
        return query;
      },
    } };
  } });
  return { storage, engine, calls, records, setActive: (v: string | null) => { active = v; }, setBehavior: (v: typeof behavior) => { behavior = v; }, setHook: (v: typeof rpcHook) => { rpcHook = v; }, closeSession: () => { sessionOpen = false; } };
}

test('offline A result is held under B and sent only after A logs in', async () => {
  const h = harness(); h.setActive(null);
  assert.equal((await h.engine.save(attempt)).syncedToSupabase, false);
  assert.equal(h.engine.read()[0].authUserId, 'A');
  const original = h.storage.getItem(QUEUE_KEY);
  h.setActive('B'); assert.equal((await h.engine.flush()).syncedCount, 0);
  assert.equal(h.calls.length, 0); assert.equal(h.storage.getItem(QUEUE_KEY), original);
  h.setActive('A'); assert.equal((await h.engine.flush()).syncedCount, 1);
  assert.equal(h.calls[0].owner, 'A'); assert.equal(h.engine.read().length, 0);
});

test('legacy rows without auth owner are preserved without assigning current user', async () => {
  const h = harness(); const legacy = { ...attempt, authUserId: undefined, score: 80, timestamp: 1 };
  h.storage.setItem(QUEUE_KEY, JSON.stringify([legacy])); const raw = h.storage.getItem(QUEUE_KEY);
  await h.engine.flush(); assert.equal(h.calls.length, 0); assert.equal(h.storage.getItem(QUEUE_KEY), raw);
});

test('account switch during transmission does not change the pinned request identity', async () => {
  const h = harness(); h.setHook(async () => { h.setActive('B'); });
  assert.equal((await h.engine.save(attempt)).syncedToSupabase, true);
  assert.equal(h.calls[0].owner, 'A');
  assert.equal((await h.engine.save({ ...attempt, idempotencyKey: 'another' })).syncedToSupabase, false);
  assert.equal(h.calls.length, 1); assert.equal(h.engine.read()[0].authUserId, 'A');
});

test('SQL rejection remains pending and retry only reports success after database confirmation', async () => {
  const h = harness(); h.setBehavior('denied');
  assert.equal((await h.engine.save(attempt)).syncedToSupabase, false);
  assert.equal(h.engine.read()[0].syncState, 'pending');
  h.setBehavior('ok'); assert.equal((await h.engine.save(attempt)).syncedToSupabase, true);
  assert.equal(h.calls.length, 2); assert.equal(h.engine.read().length, 0);
});

test('concurrent duplicate submissions and flush share a serialized confirmed write', async () => {
  const h = harness();
  const [a, b] = await Promise.all([h.engine.save(attempt), h.engine.save(attempt), h.engine.flush()]);
  assert.equal(a.syncedToSupabase, true); assert.deepEqual(a, b); assert.equal(h.calls.length, 1);
});

test('confirmed explicit key is rechecked against database instead of resubmitted', async () => {
  const h = harness(); await h.engine.save(attempt);
  assert.equal((await h.engine.save(attempt)).syncedToSupabase, true); assert.equal(h.calls.length, 1);
  h.records.clear(); assert.equal((await h.engine.save(attempt)).syncedToSupabase, false);
  assert.equal(h.calls.length, 1); assert.equal(h.engine.read().length, 1);
});

test('timeout, incomplete response, and interrupted sending never automatically retry an uncertain write', async () => {
  for (const behavior of ['timeout', 'empty'] as const) {
    const h = harness(); h.setBehavior(behavior);
    assert.equal((await h.engine.save(attempt)).syncedToSupabase, false);
    h.setBehavior('ok'); await h.engine.flush(); await h.engine.save(attempt);
    assert.equal(h.calls.length, 1); assert.equal(h.engine.read().length, 1);
  }
});

test('SOLO and Championship keep distinct payloads; retries never replace original session', async () => {
  const h = harness(); h.setActive(null);
  await h.engine.save(attempt);
  await h.engine.save({ ...attempt, mode: 'championship', sessionId: '11111111-1111-4111-8111-111111111111', idempotencyKey: 'champ' });
  h.setActive('A'); await h.engine.flush();
  assert.equal(h.calls[0].args.p_mode, 'SOLO'); assert.equal(h.calls[0].args.p_session_id, null);
  assert.equal(h.calls[1].args.p_mode, 'CHAMPIONSHIP'); assert.equal(h.calls[1].args.p_session_id, '11111111-1111-4111-8111-111111111111');
});

test('Championship with no session or closed session is retained without RPC call', async () => {
  const h = harness();
  await h.engine.save({ ...attempt, mode: 'championship', idempotencyKey: 'missing' });
  h.closeSession(); await h.engine.save({ ...attempt, mode: 'championship', sessionId: '22222222-2222-4222-8222-222222222222', idempotencyKey: 'closed' });
  await h.engine.flush(); assert.equal(h.calls.length, 0); assert.equal(h.engine.read().length, 2);
});

test('retry key cannot overwrite old payload; malformed queue is not overwritten', async () => {
  const h = harness(); h.setActive(null); await h.engine.save(attempt);
  assert.equal((await h.engine.save({ ...attempt, correctCount: 5 })).syncedToSupabase, false);
  assert.equal(h.engine.read()[0].correctCount, 8);
  h.storage.setItem(QUEUE_KEY, 'broken-json'); await h.engine.save({ ...attempt, idempotencyKey: 'new' });
  assert.equal(h.storage.getItem(QUEUE_KEY), 'broken-json');
});

function teacherFixture() {
  let session: any = { user: { id: 'teacher' }, access_token: 'latest', expires_at: Date.now() / 1000 + 600 };
  let refreshed: any = null;
  let approved = true;
  const sent: any[] = [];
  const access = createTeacherSessionAccess({ auth: { getSession: async () => ({ data: { session } }), refreshSession: async () => ({ data: { session: refreshed } }) } }, (async (_url: any, init: any) => {
    sent.push(init.headers.Authorization); return new Response(JSON.stringify({ ok: approved, teacherName: 'Test Teacher' }), { status: approved ? 200 : 403 });
  }) as typeof fetch);
  return { access, sent, setSession: (v: any) => { session = v; }, setRefreshed: (v: any) => { refreshed = v; }, deny: () => { approved = false; } };
}

test('teacher access uses current SDK token and validates authorization with backend', async () => {
  const h = teacherFixture(); assert.ok(await h.access.verify('teacher')); assert.deepEqual(h.sent, ['Bearer latest']);
  h.setSession({ user: { id: 'teacher' }, access_token: 'refreshed', expires_at: Date.now() / 1000 + 600 });
  assert.ok(await h.access.verify('teacher')); assert.equal(h.sent[1], 'Bearer refreshed');
  h.deny(); assert.equal(await h.access.verify('teacher'), null);
});

test('expired, absent, mismatched and unrefreshable teacher sessions are never logged in', async () => {
  const h = teacherFixture(); assert.equal(await h.access.verify('other-teacher'), null);
  h.setSession({ user: { id: 'teacher' }, access_token: 'expired', expires_at: 1 });
  assert.equal(await h.access.verify(), null);
  h.setSession(null); assert.equal(await h.access.verify(), null); assert.equal(h.sent.length, 0);
  h.setRefreshed({ user: { id: 'teacher' }, access_token: 'fresh', expires_at: Date.now() / 1000 + 600 });
  assert.ok(await h.access.verify('teacher')); assert.equal(h.sent[0], 'Bearer fresh');
});

test('provisioning, batch registration and reset return unavailable without network or fallback writes', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No network permitted'); };
  try {
    assert.equal((await syncOfficial14StudentAccounts()).ok, false);
    assert.equal((await adminAddSingleStudent('Synthetic Student')).ok, false);
    assert.equal((await adminAddBatchStudents(['Synthetic One', 'Synthetic Two'])).ok, false);
    assert.equal((await resetStudentPasswordByTeacher('id', 'synthetic', 'not-used')).ok, false);
    assert.equal((await registerStudentProfile('Synthetic Student', 'bima')).profile, null);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('different owners with the same explicit attempt key never share confirmation', async () => {
  const h = harness();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const sending = new Promise<void>(resolve => { started = resolve; });
  h.setHook(async () => { started(); await gate; });
  const a = h.engine.save(attempt);
  await sending;
  h.setActive('B');
  const b = h.engine.save({ ...attempt, authUserId: 'B', studentId: 'profile-B' });
  release();
  const [resultA, resultB] = await Promise.all([a, b]);
  assert.equal(resultA.studentId, 'profile-A');
  assert.equal(resultB.studentId, 'profile-B');
  assert.equal(resultA.syncedToSupabase, true); assert.equal(resultB.syncedToSupabase, true);
  assert.deepEqual(h.calls.map(call => call.owner), ['A', 'B']);
});

test('persisted interrupted send survives a fresh runtime without automatic retransmission', async () => {
  const h = harness(); h.setActive(null); await h.engine.save(attempt);
  const rows = h.engine.read(); rows[0].syncState = 'sending';
  h.storage.setItem(QUEUE_KEY, JSON.stringify(rows));
  let calls = 0;
  const restarted = createAttemptSync({ storage: () => h.storage, context: async () => ({ authUserId: 'A', studentId: 'profile-A', client: { rpc: async () => { calls++; return { data: 'unexpected' }; } } }) });
  await restarted.flush(); assert.equal(calls, 0); assert.deepEqual(restarted.read(), rows);
});

test('teacher identity change while backend verification is pending invalidates the result', async () => {
  let token = 'A';
  const session = createTeacherSessionAccess({ auth: { getSession: async () => ({ data: { session: { user: { id: token }, access_token: token, expires_at: Date.now() / 1000 + 600 } } }) } }, (async () => {
    token = 'B'; return new Response(JSON.stringify({ ok: true }));
  }) as typeof fetch);
  assert.equal(await session.verify('A'), null);
});
