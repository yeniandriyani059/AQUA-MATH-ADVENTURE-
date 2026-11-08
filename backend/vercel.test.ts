import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { createBackendApp } from './app';
import { createVercelApiHandler, API_PATH_PARAMETER } from './vercelAdapter';
import defaultHandler from '../api/index';
import { validatePreviewEnvironment } from '../scripts/preview-safety.mjs';
import { teacherRecoveryRedirect } from '../src/services/supabaseService';

async function serve(handler: RequestListener, run: (origin: string) => Promise<void>) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
function rewritten(path: string) { return `/api/index?${API_PATH_PARAMETER}=${encodeURIComponent(path.replace(/^\/api\/?/, ''))}`; }
const TEACHER = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
function mockClient(token?: string): any {
  let actor = token === 'synthetic-teacher-token' ? TEACHER : STUDENT;
  let attempt: any;
  const user = () => ({ id: actor, email: actor === TEACHER ? 'teacher@example.test' : 'synthetic@student.aquamath.id', is_anonymous: false });
  const profile = () => ({ id: PROFILE, auth_user_id: STUDENT, display_name: 'Synthetic Student', character: 'BIMA', is_active: true });
  return {
    auth: {
      getUser: async (value: string) => ['synthetic-teacher-token', 'synthetic-student-token'].includes(value) ? { data: { user: user() } } : { error: new Error('invalid') },
      signInWithPassword: async ({ email }: any) => {
        actor = email.endsWith('@student.aquamath.id') ? STUDENT : TEACHER;
        return { data: { user: user(), session: { access_token: actor === TEACHER ? 'synthetic-teacher-token' : 'synthetic-student-token' } } };
      },
    },
    from(table: string) {
      const q: any = { select() { return q; }, eq() { return q; }, order() { return q; },
        maybeSingle: async () => ({ data: table === 'teacher_profiles' ? { auth_user_id: TEACHER, role: 'teacher', display_name: 'Synthetic Teacher' } : table === 'championship_sessions' ? { id: SESSION, status: 'OPEN' } : table === 'game_attempts' ? attempt : profile() }),
        then(resolve: any) { return Promise.resolve({ data: [profile()] }).then(resolve); },
      }; return q;
    },
    rpc: async (_name: string, args: any) => {
      assert.equal(typeof args.p_location_id, 'string');
      attempt = { id: 'attempt', student_id: PROFILE, mode: args.p_mode, session_id: args.p_session_id };
      return { data: { success: true, attempt_id: attempt.id, student_id: PROFILE, mode: args.p_mode } };
    },
  };
}

test('real Function entrypoint preserves unauthenticated API JSON responses after rewrite', async () => {
  await serve(defaultHandler, async base => {
    const cases: [string,string,number][] = [
      ['GET','/api/admin/verify',401], ['GET','/api/admin/students',401],
      ['POST','/api/admin/login',400], ['POST','/api/admin/register',403],
      ['POST','/api/admin/provision-students',401], ['POST','/api/admin/students',401],
      ['PUT','/api/admin/students/synthetic',401], ['DELETE','/api/admin/students/synthetic',401],
      ['POST','/api/admin/reset-student-password',401], ['POST','/api/student/verify-access',400],
      ['POST','/api/student/login',400], ['POST','/api/student/select-identity',401],
      ['POST','/api/student/save-attempt',401], ['GET','/api/missing',404],
    ];
    for (const [method, path, code] of cases) {
      const response = await fetch(base + rewritten(path), { method, ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: '{}' }) });
      assert.equal(response.status, code, `${method} ${path}`);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      assert.equal((await response.json()).ok, false);
    }
  });
});

test('adapter preserves teacher/student login, authorization and both-mode RPC saves using mocks', async () => {
  const app = createBackendApp(async token => mockClient(token), [TEACHER]);
  await serve(createVercelApiHandler(app), async base => {
    for (const [path, body] of [
      ['/api/admin/login', { username: 'teacher@example.test', password: 'synthetic-not-a-real-password' }],
      ['/api/student/login', { username: 'synthetic', password: 'synthetic-not-a-real-password' }],
    ] as const) {
      const response = await fetch(base + rewritten(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
    }
    const verified = await fetch(base + rewritten('/api/admin/verify'), { headers: { Authorization: 'Bearer synthetic-teacher-token' } });
    assert.equal(verified.status, 200); assert.equal((await verified.json()).teacherName, 'Synthetic Teacher');
    for (const mode of ['solo', 'championship']) {
      const response = await fetch(base + rewritten('/api/student/save-attempt'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-student-token' }, body: JSON.stringify({ studentId: PROFILE, mode, locationId: 1, levelNumber: 1, correctCount: 8, wrongCount: 2, durationSeconds: 30, sessionId: mode === 'championship' ? SESSION : null }) });
      assert.equal(response.status, 200); assert.equal((await response.json()).syncedToSupabase, true);
    }
    const forged = await fetch(base + rewritten('/api/admin/verify'), { headers: { Authorization: 'Bearer sb_tch_forged' } });
    assert.equal(forged.status, 403);
  });
});

test('adapter preserves body stream, method, query and Auth header without leaking internal query', async () => {
  await serve(createVercelApiHandler((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ url: req.url, method: req.method, auth: req.headers.authorization, body }));
    });
  }), async base => {
    const response = await fetch(base + rewritten('/api/admin/students/synthetic') + '&filter=a&filter=b', { method: 'PUT', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: '{"name":"Synthetic"}' });
    assert.deepEqual(await response.json(), { url: '/api/admin/students/synthetic?filter=a&filter=b', method: 'PUT', auth: 'Bearer synthetic', body: '{"name":"Synthetic"}' });
  });
});

test('adapter supports platform-attached query captures and original /api URLs', async () => {
  await serve((req, res) => {
    (req as any).query = { [API_PATH_PARAMETER]: 'admin/verify' };
    createVercelApiHandler((inner, response) => { response.end(inner.url); })(req,res);
  }, async base => { assert.equal(await (await fetch(base + '/api/admin/verify?test=1')).text(), '/api/admin/verify?test=1'); });
  await serve(defaultHandler, async base => { assert.equal((await fetch(base + '/api/admin/verify')).status, 401); });
});

test('malformed/ambiguous rewrite captures and non-API entry requests cannot reach app', async () => {
  let calls = 0;
  await serve(createVercelApiHandler((_req,res) => { calls++; res.end('unexpected'); }), async base => {
    for (const value of ['../admin/verify','admin/../verify','/admin/verify','admin?x=1','admin\\verify','%2e%2e/admin']) {
      assert.equal((await fetch(base + `/api/index?${API_PATH_PARAMETER}=${encodeURIComponent(value)}`)).status, 400);
    }
    assert.equal((await fetch(base + rewritten('/api/admin/verify') + `&${API_PATH_PARAMETER}=student/login`)).status, 400);
    assert.equal((await fetch(base + '/onboarding')).status, 404);
    assert.equal(calls, 0);
  });
});

function previewEnv() {
  const claims = Buffer.from(JSON.stringify({ role: 'anon', ref: 'syntheticpreview' })).toString('base64url');
  return { VERCEL_ENV: 'preview', VITE_SUPABASE_URL: 'https://syntheticpreview.supabase.co', SUPABASE_URL: 'https://syntheticpreview.supabase.co', VITE_SUPABASE_ANON_KEY: `header.${claims}.synthetic-signature`, TRUSTED_TEACHER_AUTH_IDS: TEACHER };
}

test('Preview requires explicit matching nonproduction config and approved UUID syntax', () => {
  assert.doesNotThrow(() => validatePreviewEnvironment(previewEnv()));
  for (const key of ['VITE_SUPABASE_URL','SUPABASE_URL','VITE_SUPABASE_ANON_KEY','TRUSTED_TEACHER_AUTH_IDS']) {
    assert.throws(() => validatePreviewEnvironment({ ...previewEnv(), [key]: '' }), new RegExp(key));
  }
  assert.throws(() => validatePreviewEnvironment({ ...previewEnv(), SUPABASE_URL: 'https://another.supabase.co' }));
  assert.throws(() => validatePreviewEnvironment({ ...previewEnv(), TRUSTED_TEACHER_AUTH_IDS: 'not-a-uuid' }));
  assert.throws(() => validatePreviewEnvironment({ VERCEL: '1' }));
  assert.doesNotThrow(() => validatePreviewEnvironment({}));
});

test('Preview rejects production host variants and privileged/mismatched keys without revealing values', () => {
  for (const host of ['ddaudswxkxzmpqvoiuss.supabase.co','DDAUDSWXKXZMPQVOIUSS.supabase.co','ddaudswxkxzmpqvoiuss.supabase.co.']) {
    assert.throws(() => validatePreviewEnvironment({ ...previewEnv(), VITE_SUPABASE_URL: `https://${host}` }));
  }
  for (const key of ['sb_secret_synthetic-never-use', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.synthetic`, `header.${Buffer.from(JSON.stringify({ role: 'anon', ref: 'wrong' })).toString('base64url')}.synthetic`]) {
    let message = ''; try { validatePreviewEnvironment({ ...previewEnv(), VITE_SUPABASE_ANON_KEY: key }); } catch (error) { message = String(error); }
    assert.ok(message); assert.ok(!message.includes(key));
  }
});

test('unsafe Preview runtime returns JSON 503 before any app access', async () => {
  let called = false;
  await serve(createVercelApiHandler((_req,res) => { called = true; res.end(); }, () => validatePreviewEnvironment({ VERCEL_ENV: 'preview' })), async base => {
    const response = await fetch(base + rewritten('/api/admin/verify'));
    assert.equal(response.status, 503); assert.equal((await response.json()).ok, false); assert.equal(called, false);
  });
});

test('Vercel manifest routes the API before SPA and retains a static Vite output', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.rewrites[0].source, `/api/:${API_PATH_PARAMETER}*`);
  assert.equal(config.rewrites[0].destination, '/api/index');
  assert.equal(config.outputDirectory, 'dist'); assert.ok(config.functions['api/index.ts']);
  const spa = new RegExp('^' + config.rewrites[1].source + '$');
  for (const path of ['/api', '/api/admin/verify', '/api/student/save-attempt']) assert.equal(spa.test(path), false);
  assert.equal(spa.test('/onboarding'), true);
});

test('password recovery uses the current deployment origin without leaking query tokens', () => {
  assert.equal(teacherRecoveryRedirect('https://synthetic-preview.vercel.app/?code=not-a-real-token'), 'https://synthetic-preview.vercel.app/');
  assert.equal(teacherRecoveryRedirect('https://aqua-adventure-nine.vercel.app/'), 'https://aqua-adventure-nine.vercel.app/');
  assert.equal(teacherRecoveryRedirect('http://127.0.0.1:3037/'), 'http://127.0.0.1:3037/');
  assert.equal(teacherRecoveryRedirect('javascript:alert(1)'), null);
});
