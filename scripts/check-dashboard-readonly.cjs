// Local browser regression only. All Supabase/API replies are synthetic.
// Requires Playwright and local Chromium; never points at a deployed site.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:3037';
  const origin = new URL(base);
  assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Local origin required');
  const STUDENT = '11111111-1111-4111-8111-111111111111';
  const OWNER = '22222222-2222-4222-8222-222222222222';
  const SESSION = '33333333-3333-4333-8333-333333333333';
  const TEACHER = '44444444-4444-4444-8444-444444444444';
  let attempts = [];
  let failed = false;
  const writes = [];
  const errors = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.addInitScript(({ STUDENT, OWNER, SESSION, TEACHER }) => {
      const expires_at = Math.floor(Date.now() / 1000) + 7200;
      const session = (id, email) => {
        const user = { id, email, aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} };
        const access_token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: id, exp: expires_at, aud: 'authenticated' }))}.mock-signature`;
        return { access_token, refresh_token: 'synthetic-refresh-not-a-credential', token_type: 'bearer', expires_at, expires_in: 7200, user };
      };
      localStorage.setItem('sb-ddaudswxkxzmpqvoiuss-auth-token', JSON.stringify(session(TEACHER, 'teacher@example.test')));
      localStorage.setItem('aqua_math_student_auth_v1', JSON.stringify(session(OWNER, 'synthetic@student.aquamath.id')));
      localStorage.setItem('aqua_math_students_v1', JSON.stringify([{
        id: STUDENT, authUserId: OWNER, name: 'Synthetic Student', normalizedName: 'synthetic student', characterId: 'bima', isActive: true,
        solo: { bestTotalScore: 987, latestTotalScore: 987, unlockedLevel: 5, academicGrade: 98, completedLevels: [1,2,3,4,5], locations: {} },
        championship: { totalChampionshipScore: 876, unlockedLevel: 5, academicGrade: 87, totalTimeSeconds: 30, completedLevels: [1,2,3,4,5], locations: {} },
      }]));
      localStorage.setItem('aqua_math_offline_attempts_queue_v1', JSON.stringify([{
        studentId: STUDENT, authUserId: OWNER, mode: 'championship', sessionId: SESSION,
        levelNumber: 1, locationId: 1, correctCount: 10, wrongCount: 0, durationSeconds: 30,
        score: 100, timestamp: 1, idempotencyKey: 'old-before-reset',
      }]));
    }, { STUDENT, OWNER, SESSION, TEACHER });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'content-range' };
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        writes.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      }
      if (url.origin === origin.origin && url.pathname === '/api/admin/verify')
        return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, teacherName: 'Synthetic Teacher' }) });
      if (url.origin === origin.origin) {
        if (url.pathname.startsWith('/api/')) return route.abort();
        return route.continue();
      }
      // NEVER send actual requests to Supabase, Auth, fonts or other remote hosts.
      if (url.hostname.endsWith('.supabase.co')) {
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.pathname === '/auth/v1/user') return route.fulfill({ status: 200, headers, body: JSON.stringify({ id: TEACHER, email: 'teacher@example.test' }) });
        const table = url.pathname.split('/').pop();
        if (table === 'game_attempts' && failed) return route.fulfill({ status: 403, headers, body: JSON.stringify({ message: 'Synthetic read failure' }) });
        let rows = [];
        if (table === 'student_profiles') rows = [{ id: STUDENT, auth_user_id: OWNER, display_name: 'Synthetic Student', character: 'BIMA', is_active: true, created_at: '2026-11-08T00:00:00Z', championship_data: { verifiedAttempts: [{ id: 'stale', mode: 'CHAMPIONSHIP', session_id: SESSION, score: 876, location_id: 1 }], verifiedProgress: [{ mode: 'SOLO', unlocked_level: 5 }] } }];
        if (table === 'game_attempts') rows = attempts;
        if (table === 'teacher_profiles') rows = [{ auth_user_id: TEACHER, role: 'teacher', display_name: 'Synthetic Teacher' }];
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Number(url.searchParams.get('limit') || 200);
        const page = rows.slice(offset, offset + limit);
        const range = rows.length ? `${offset}-${offset + page.length - 1}/${rows.length}` : '*/0';
        return route.fulfill({ status: 200, headers: { ...headers, 'content-range': range }, body: JSON.stringify(page) });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin.href, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Portal Guru' }).click();
    await page.getByText(/Data berhasil disinkronkan dari Supabase!/).waitFor();
    const cache = () => page.evaluate(id => JSON.parse(localStorage.getItem('aqua_math_students_v1') || '[]').find(s => s.id === id), STUDENT);
    let student = await cache();
    assert.equal(student.solo.bestTotalScore, 0); assert.equal(student.solo.unlockedLevel, 1);
    assert.equal(student.championship.totalChampionshipScore, 0); assert.equal(student.championship.unlockedLevel, 1);
    assert.ok(!(await page.locator('body').innerText()).includes('876'));
    await page.screenshot({ path: '/tmp/aqua-dashboard-reset-desktop.png', fullPage: true });
    console.log('PASS browser: stale snapshot/cache replaced by 0 and Level 1');
    attempts = [
      { id: 'solo', student_id: STUDENT, mode: 'SOLO', session_id: null, location_id: 1, score: 40 },
      { id: 'champ', student_id: STUDENT, mode: 'CHAMPIONSHIP', session_id: SESSION, location_id: 1, score: 90 },
    ];
    // Check automatic polling, not merely a manual button click.
    await page.waitForFunction(id => {
      const p = JSON.parse(localStorage.getItem('aqua_math_students_v1') || '[]').find(s => s.id === id);
      return p?.solo.bestTotalScore === 40 && p?.championship.totalChampionshipScore === 90;
    }, STUDENT, { timeout: 25000 });
    console.log('PASS browser: polling receives SOLO 40 and Championship 90 separately');
    const history = page.locator('[aria-label="Riwayat siswa per mode"]');
    await history.getByText('SOLO: Pernah Bermain', { exact: true }).waitFor();
    await history.getByText('Championship: Belum Terverifikasi', { exact: true }).waitFor();
    assert.ok(!/Sedang Bermain|AKTIF BERMAIN|Baru Bergabung/.test(await page.locator('body').innerText()));
    console.log('PASS browser: historical SOLO result is not live activity; unverified Championship remains separate');
    failed = true;
    await page.getByRole('button', { name: 'Sinkron Data', exact: true }).click();
    await page.getByText(/Data terakhir belum terverifikasi/).waitFor();
    student = await cache(); assert.equal(student.solo.bestTotalScore, 40); assert.equal(student.championship.totalChampionshipScore, 90);
    console.log('PASS browser: read failure warns instead of fabricating zero');
    failed = false; attempts = [];
    await page.getByRole('button', { name: 'Sinkron Data', exact: true }).click();
    await page.getByText(/Data berhasil disinkronkan dari Supabase!/).waitFor();
    student = await cache(); assert.equal(student.solo.bestTotalScore, 0); assert.equal(student.championship.totalChampionshipScore, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/aqua-dashboard-reset-mobile.png', fullPage: true });
    assert.equal(await page.getByRole('dialog', { name: 'Dashboard Guru Pengendali Utama' }).count(), 1);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('aqua_math_offline_attempts_queue_v1')).length)), 1);
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    console.log('PASS browser: reset refresh, mobile render, legacy queue retained; zero write requests or page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
