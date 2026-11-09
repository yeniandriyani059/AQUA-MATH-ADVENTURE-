// Local browser ONLY. Every Supabase/API response is synthetic; remote traffic is blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const base = new URL(process.argv[2] || 'http://127.0.0.1:3037');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
  const roster = [...fs.readFileSync('src/services/championshipSessions.ts', 'utf8').matchAll(/^  '([0-9a-f-]{36})',/gm)].map(m => m[1]);
  assert.equal(roster.length, 14);
  // Use configured non-secret identity mappings so the dashboard does not add
  // placeholder official accounts beside the 14 synthetic profile rows.
  const authIds = [...fs.readFileSync('src/services/supabaseService.ts', 'utf8').matchAll(/authUserId:\s*'([0-9a-f-]{36})'/g)].map(m => m[1]);
  assert.equal(authIds.length, 14);
  const TEACHER = '6568ffbf-91c4-4ccb-9d00-980c2ffb64fb';
  const PROFILE = '11111111-1111-4111-8111-111111111111';
  const SESSION = '22222222-2222-4222-8222-222222222222';
  let sessions = [], participants = [], failClose = true;
  const rpcCalls = [], blocked = [], errors = [];
  const profiles = roster.map((id, i) => ({ id, auth_user_id: authIds[i], display_name: `Synthetic Student ${i + 1}`, character: 'BIMA', is_active: true }));
  const attempts = [{ id: 'synthetic-solo', student_id: roster[0], mode: 'SOLO', session_id: null, score: 80, location_id: '1', correct_count: 8, duration_seconds: 30, completed_at: '2026-11-09T00:00:00Z' }];
  attempts.push({ ...attempts[0], id: 'synthetic-solo-2', student_id: roster[1], score: 60, correct_count: 6, wrong_count: 4 });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(({ TEACHER }) => {
      const expires_at = Math.floor(Date.now() / 1000) + 7200;
      const user = { id: TEACHER, email: 'teacher@example.test', aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {} };
      const access_token = `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ sub: TEACHER, exp: expires_at }))}.synthetic`;
      localStorage.setItem('sb-ddaudswxkxzmpqvoiuss-auth-token', JSON.stringify({ access_token, refresh_token: 'synthetic', expires_at, expires_in: 7200, token_type: 'bearer', user }));
      // Stale local flag must not open an absent database session.
      localStorage.setItem('aqua_math_class_settings_v1', JSON.stringify({ championshipOpen: true }));
    }, { TEACHER });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' };
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const reply = (data, status = 200, extra = {}) => route.fulfill({ status, headers: { ...headers, ...extra }, body: JSON.stringify(data) });
      if (url.origin === base.origin) {
        if (url.pathname === '/api/admin/verify') return reply({ ok: true });
        if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method())) { blocked.push(url.pathname); return route.abort(); }
        return route.continue();
      }
      if (!url.hostname.endsWith('.supabase.co')) return route.abort();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const rpc = url.pathname.split('/rpc/')[1];
      if (rpc === 'aqua_teacher_championship_sessions_v1' && req.method() === 'GET') return reply(sessions);
      if (rpc && req.method() === 'POST' && ['aqua_open_championship_v1', 'aqua_close_championship_v1'].includes(rpc)) {
        rpcCalls.push(rpc);
        if (rpc === 'aqua_open_championship_v1') {
          sessions = [{ id: SESSION, created_by: PROFILE, status: 'OPEN', session_name: 'Synthetic Championship' }];
          participants = roster.map((id, i) => ({ id: `synthetic-participant-${i}`, session_id: SESSION, student_id: id, official_score: i === 0 ? 180 : 0, completion_status: 'REGISTERED' }));
        } else {
          if (failClose) return reply({ message: 'Synthetic close permission denied', code: '42501' }, 403);
          sessions[0].status = 'CLOSED';
        }
        return reply(SESSION);
      }
      if (!['GET', 'HEAD'].includes(req.method())) { blocked.push(url.pathname); return route.abort(); }
      if (url.pathname === '/auth/v1/user') return reply({ id: TEACHER, email: 'teacher@example.test', is_anonymous: false });
      const table = url.pathname.split('/').pop();
      let rows = table === 'student_profiles' ? profiles : table === 'teacher_profiles' ? [{ id: PROFILE, auth_user_id: TEACHER, role: 'teacher', display_name: 'Synthetic Teacher' }]
        : table === 'championship_sessions' ? sessions : table === 'championship_participants' ? participants : table === 'game_attempts' ? attempts : [];
      rows = rows.filter(row => [...url.searchParams].every(([key, value]) => {
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.')) return value.slice(3, -1).split(',').includes(String(row[key]));
        return true;
      }));
      if ((req.headers().accept || '').includes('vnd.pgrst.object+json')) return rows.length === 1 ? reply(rows[0]) : reply({ message: 'Synthetic cardinality error' }, 406);
      const count = rows.length, start = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 200);
      const page = rows.slice(start, start + limit);
      return reply(page, 200, { 'content-range': count ? `${start}-${start + page.length - 1}/${count}` : '*/0' });
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Portal Guru' }).click();
    const history = page.locator('[aria-label="Riwayat siswa per mode"]');
    await history.getByText('SOLO: Pernah Bermain', { exact: true }).waitFor();
    await history.getByText('Championship: Belum Ada Sesi', { exact: true }).waitFor();
    assert.ok(!/Sedang Bermain|AKTIF BERMAIN|Baru Bergabung/.test(await page.locator('body').innerText()));
    await page.getByRole('button', { name: /2\. Kontrol Kode Akses/ }).click();
    await page.getByRole('button', { name: 'SESI DITUTUP', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reset Data Permainan', exact: true }).isDisabled(), true);
    assert.equal(rpcCalls.length, 0);
    await page.getByRole('button', { name: 'SESI DITUTUP', exact: true }).click();
    await page.getByRole('button', { name: 'SESI DIBUKA', exact: true }).waitFor();
    assert.equal(participants.length, 14);
    await page.getByRole('button', { name: /1\. Pemantauan Siswa/ }).click();
    await page.getByTestId(`student-history-${roster[1]}`).click();
    await history.getByText('SOLO: Pernah Bermain', { exact: true }).waitFor();
    await history.getByText('Championship: Belum Ada Hasil', { exact: true }).waitFor();
    await page.getByLabel('Riwayat aktivitas:').selectOption('championship');
    await page.getByRole('button', { name: 'Pernah Bermain', exact: true }).click();
    await page.getByText('1 dari 14 ditampilkan', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Belum Ada Hasil', exact: true }).click();
    await page.getByText('13 dari 14 ditampilkan', { exact: true }).waitFor();
    await page.getByLabel('Riwayat aktivitas:').selectOption('solo');
    await page.getByRole('button', { name: 'Pernah Bermain', exact: true }).click();
    await page.getByText('2 dari 14 ditampilkan', { exact: true }).waitFor();
    assert.ok(!/Sedang Bermain|AKTIF BERMAIN|Baru Bergabung/.test(await page.locator('body').innerText()));
    console.log('PASS browser: two completed SOLO tests are historical; mode filters and Championship membership do not imply live play');
    await page.getByRole('button', { name: /5\. Leaderboard Class Championship/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Reset Sesi Championship', exact: true }).isDisabled(), true);
    const first = page.locator('tbody tr').filter({ hasText: 'Synthetic Student 1' }).first();
    await first.waitFor(); assert.ok((await first.innerText()).includes('180'));
    assert.equal((await first.locator('td').nth(2).innerText()).trim(), '180 / 1000');
    await page.getByRole('button', { name: /2\. Kontrol Kode Akses/ }).click();
    await page.getByRole('button', { name: 'SESI DIBUKA', exact: true }).click();
    await page.getByText('Synthetic close permission denied', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'BELUM TERVERIFIKASI', exact: true }).waitFor();
    failClose = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('button', { name: 'SESI DIBUKA', exact: true }).waitFor();
    await page.getByRole('button', { name: 'SESI DIBUKA', exact: true }).click();
    await page.getByRole('button', { name: 'SESI DITUTUP', exact: true }).waitFor();
    const solo = await page.evaluate(id => JSON.parse(localStorage.getItem('aqua_math_students_v1') || '[]').find(s => s.id === id)?.solo, roster[0]);
    assert.equal(solo.bestTotalScore, 80);
    const secondSolo = await page.evaluate(id => JSON.parse(localStorage.getItem('aqua_math_students_v1') || '[]').find(s => s.id === id)?.solo.bestTotalScore, roster[1]);
    assert.equal(secondSolo, 60);
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    assert.deepEqual(rpcCalls, ['aqua_open_championship_v1', 'aqua_close_championship_v1', 'aqua_close_championship_v1']);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/aqua-championship-controls-mobile.png', fullPage: true });
    await page.getByRole('button', { name: /1\. Pemantauan Siswa/ }).click();
    await history.scrollIntoViewIfNeeded();
    assert.equal(await history.getByText('SOLO: Pernah Bermain', { exact: true }).isVisible(), true);
    assert.equal(await history.getByText('Championship: Belum Ada Hasil', { exact: true }).isVisible(), true);
    await page.screenshot({ path: '/tmp/aqua-student-history-mobile.png', fullPage: true });
    console.log('PASS browser mocked: DB status overrides local flag; open + 14 participants; official score; original error; close; SOLO unchanged; no remote writes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
