import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createBackendApp } from '../server';
import { getSupabaseClient } from './auth';

// Entire Supabase boundary is injected: no network requests, credentials or production writes.
function mock(options: Record<string, any> = {}) {
  const calls: any[] = [];
  const user = options.user || { id: 'teacher-id', email: 'teacher@example.test' };
  const profile = options.student
    ? { id: 'student-id', auth_user_id: user.id, is_active: true, ...options.student }
    : { auth_user_id: user.id, role: 'teacher', display_name: 'Teacher' };
  const factory = async (token?: string): Promise<any> => {
    calls.push(['client', token]);
    return {
      auth: {
        getUser: async (value: string) => {
          calls.push(['getUser', value]);
          return options.invalid ? { error: new Error('invalid') } : { data: { user } };
        },
        signInWithPassword: async (credentials: any) => {
          calls.push(['login', credentials.email]);
          return options.badPassword ? { error: new Error('bad') } : { data: { user, session: { access_token: 'verified-session' } } };
        },
      },
      from(table: string) {
        calls.push(['from', table]);
        const q: any = {
          select() { return q; }, eq() { return q; }, order() { return q; },
          update(value: any) { calls.push(['update', table, value]); return q; },
          delete() { calls.push(['delete', table]); return q; },
          maybeSingle: async () => ({ data: options.missingProfile ? null : table === 'championship_sessions' ? { id: 'session', is_active: !options.closedSession } : { ...profile, ...options.profile }, error: options.profileError ? new Error('denied') : null }),
          then(resolve: any) { return Promise.resolve({ data: [], error: null }).then(resolve); },
        };
        return q;
      },
      rpc: async (name: string, args: any) => {
        calls.push(['rpc', name, args, token]);
        if (options.throwRpc) throw new Error('offline');
        return options.rpcFailure ? { error: new Error('RLS denied') } : { data: options.emptyRpc ? null : { attempt_id: 'attempt-id', student_id: 'student-id' } };
      },
    };
  };
  return { factory, calls };
}
async function request(options: Record<string, any>, path: string, body?: any, token?: string, method = body ? 'POST' : 'GET') {
  const m = mock(options);
  const server = createBackendApp(m.factory, options.allowed ?? ['teacher-id']).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), calls: m.calls };
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

for (const [method, path] of [
  ['GET', '/api/admin/verify'], ['GET', '/api/admin/students'],
  ['POST', '/api/admin/students'], ['POST', '/api/admin/provision-students'],
  ['POST', '/api/admin/reset-student-password'], ['PUT', '/api/admin/students/id'], ['DELETE', '/api/admin/students/id'],
]) test(`${method} ${path} denies missing and forged credentials before data access`, async () => {
  const absent = await request({}, path, undefined, undefined, method);
  assert.equal(absent.status, 401); assert.equal(absent.calls.length, 0);
  for (const forged of ['sb_tch_fake', 'fake.jwt.token', 'legacy.signature']) {
    const result = await request({ invalid: true }, path, undefined, forged, method);
    assert.equal(result.status, 403); assert.ok(!result.calls.some(c => ['from', 'rpc', 'update', 'delete'].includes(c[0])));
  }
});

test('teacher requires trusted server allowlist AND existing teacher profile', async () => {
  for (const options of [{ allowed: [] }, { missingProfile: true }, { profileError: true }, { profile: { role: 'student' } }, { user: { id: 'teacher-id', is_anonymous: true } }]) {
    assert.equal((await request(options, '/api/admin/verify', undefined, 'valid')).status, 403);
  }
  const valid = await request({}, '/api/admin/verify', undefined, 'valid');
  assert.equal(valid.status, 200); assert.equal(valid.body.ok, true);
  assert.ok(!valid.calls.some(c => ['update', 'delete', 'rpc'].includes(c[0])));
});

test('teacher login preserves email and both legacy username mappings; registration never writes', async () => {
  for (const username of ['teacher@example.test', 'guru']) {
    const r = await request({}, '/api/admin/login', { username, password: 'mock-password' });
    assert.equal(r.status, 200); assert.equal(r.body.token, 'verified-session');
    assert.ok(!r.calls.some(c => ['update', 'delete', 'rpc'].includes(c[0])));
  }
  assert.equal((await request({ allowed: [] }, '/api/admin/login', { username: 'guru', password: 'mock-password' })).status, 403);
  assert.equal((await request({ badPassword: true }, '/api/admin/login', { username: 'guru', password: 'mock-password' })).status, 401);
  const registration = await request({}, '/api/admin/register', {});
  assert.equal(registration.status, 403); assert.equal(registration.calls.length, 0);
});

const attempt = { studentId: 'student-id', mode: 'solo', locationId: 1, levelNumber: 1, correctCount: 8, wrongCount: 2, durationSeconds: 40 };
const student = { user: { id: 'student-auth' }, student: {} };
for (const path of ['/api/student/select-identity', '/api/student/save-attempt', '/API/STUDENT/SAVE-ATTEMPT/']) {
  test(`${path} rejects anonymous, inactive and impersonating students`, async () => {
    assert.equal((await request(student, path, attempt)).status, 401);
    for (const options of [{ ...student, invalid: true }, { ...student, student: { is_active: false } }, { ...student, missingProfile: true }]) {
      const r = await request(options, path, attempt, 'student-token');
      assert.ok([401, 403].includes(r.status)); assert.ok(!r.calls.some(c => ['update', 'rpc'].includes(c[0])));
    }
    const other = await request(student, path, { ...attempt, studentId: 'other-student' }, 'student-token');
    assert.equal(other.status, 403); assert.ok(!other.calls.some(c => ['update', 'rpc'].includes(c[0])));
  });
}

test('SOLO and Championship writes use existing RPC with verified caller, never arbitrary student ID', async () => {
  for (const mode of ['solo', 'championship']) {
    const r = await request(student, '/api/student/save-attempt', { ...attempt, mode, sessionId: 'session' }, 'student-token');
    assert.equal(r.status, 200); assert.equal(r.body.syncedToSupabase, true);
    const rpc = r.calls.find(c => c[0] === 'rpc');
    assert.equal(rpc[1], 'save_game_attempt'); assert.equal(rpc[3], 'student-token');
    assert.equal(rpc[2].p_mode, mode.toUpperCase()); assert.equal(rpc[2].student_id, undefined);
    assert.equal(rpc[2].p_session_id, mode === 'solo' ? null : 'session');
  }
});

test('database failure, no confirmation and RPC exception never report save success', async () => {
  for (const option of ['rpcFailure', 'emptyRpc', 'throwRpc']) {
    const r = await request({ ...student, [option]: true }, '/api/student/save-attempt', attempt, 'student-token');
    assert.equal(r.status, 500); assert.equal(r.body.ok, false); assert.equal(r.body.syncedToSupabase, false);
  }
});

test('invalid results and inactive Championship session cannot reach RPC', async () => {
  for (const body of [{ ...attempt, correctCount: 99 }, { ...attempt, mode: 'bad' }, { ...attempt, levelNumber: 5 }, { ...attempt, durationSeconds: -1 }, { ...attempt, mode: 'championship' }]) {
    const r = await request(student, '/api/student/save-attempt', body, 'student-token');
    assert.equal(r.status, 400); assert.ok(!r.calls.some(c => c[0] === 'rpc'));
  }
  const r = await request({ ...student, closedSession: true }, '/api/student/save-attempt', { ...attempt, mode: 'championship', sessionId: 'closed' }, 'student-token');
  assert.equal(r.status, 400); assert.ok(!r.calls.some(c => c[0] === 'rpc'));
});

test('existing 14 student username/password mappings remain usable without privileged credentials', async () => {
  const { OFFICIAL_14_STUDENTS } = await import('../src/services/supabaseService');
  for (const spec of OFFICIAL_14_STUDENTS) {
    const r = await request(student, '/api/student/login', { username: spec.username, password: 'mock-only' });
    assert.equal(r.status, 200); assert.equal(r.body.token, 'verified-session');
    assert.ok(r.calls.some(c => c[0] === 'login' && c[1] === `${spec.username}@student.aquamath.id`));
  }
});

test('privileged Auth operations stay blocked pending separate approval', async () => {
  for (const path of ['/api/admin/students', '/api/admin/provision-students', '/api/admin/reset-student-password']) {
    const r = await request({}, path, {}, 'valid');
    assert.equal(r.status, 503); assert.ok(!r.calls.some(c => ['rpc', 'update', 'delete'].includes(c[0])));
  }
});

test('unconfigured or privileged public-key configuration fails closed without network access', async () => {
  const names = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const saved = names.map(n => process.env[n]);
  try {
    for (const n of names) delete process.env[n];
    assert.equal(await getSupabaseClient(), null);
    process.env.SUPABASE_URL = 'https://example.test';
    process.env.VITE_SUPABASE_ANON_KEY = 'sb_secret_mock';
    assert.equal(await getSupabaseClient(), null);
  } finally { names.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]); }
});

test('authenticated student can update own character and caller token reaches database client', async () => {
  const r = await request(student, '/api/student/select-identity', { studentId: 'student-id', characterId: 'sinta' }, 'student-token');
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  assert.ok(r.calls.some(c => c[0] === 'update' && c[1] === 'student_profiles' && c[2].character === 'SINTA'));
  assert.ok(r.calls.filter(c => c[0] === 'client').every(c => c[1] === 'student-token'));
});

test('RLS-scoped client is also used by authorized teacher roster read', async () => {
  const r = await request({}, '/api/admin/students', undefined, 'teacher-token');
  assert.equal(r.status, 200);
  assert.ok(r.calls.filter(c => c[0] === 'client').every(c => c[1] === 'teacher-token'));
});
