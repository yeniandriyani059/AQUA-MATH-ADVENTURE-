import express from 'express';
import { getSupabaseClient as defaultGetClient, verifyTeacher } from './backend/auth';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createBackendApp(getSupabaseClient = defaultGetClient, allowedTeacherIds = (process.env.TRUSTED_TEACHER_AUTH_IDS || '').split(',').map(x => x.trim()).filter(Boolean)) {
  const app = express();
  app.use(express.json());

  // Authenticate all protected routes before any data access. Never trust token shape.
  app.use(async (req, res, next) => {
    const routePath = req.path.toLowerCase().replace(/\/+$/, '');
    const admin = routePath.startsWith('/api/admin/');
    const student = ['/api/student/select-identity', '/api/student/save-attempt'].includes(routePath);
    if ((!admin && !student) || ['/api/admin/login', '/api/admin/register'].includes(routePath)) return next();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return void res.status(401).json({ ok: false, message: 'Sesi autentikasi diperlukan.' });
    try {
      const client = await getSupabaseClient(token);
      if (!client) return void res.status(503).json({ ok: false, message: 'Konfigurasi autentikasi server belum tersedia.' });
      res.locals.accessToken = token;
      if (admin) {
        const teacher = await verifyTeacher(client, token, allowedTeacherIds);
        if (!teacher) return void res.status(403).json({ ok: false, message: 'Guru tidak berwenang.' });
        res.locals.teacher = teacher;
      } else {
        const { data, error } = await client.auth.getUser(token);
        if (error || !data?.user?.id || data.user.is_anonymous) return void res.status(401).json({ ok: false });
        const { data: profile, error: profileError } = await client.from('student_profiles')
          .select('id, auth_user_id, is_active').eq('auth_user_id', data.user.id).maybeSingle();
        if (profileError || !profile || profile.auth_user_id !== data.user.id || profile.is_active !== true || req.body?.studentId !== profile.id)
          return void res.status(403).json({ ok: false, message: 'Identitas siswa tidak sesuai.' });
        res.locals.student = profile;
      }
      next();
    } catch { res.status(503).json({ ok: false, message: 'Verifikasi autentikasi gagal.' }); }
  });

  app.post('/api/admin/register', (_req, res) => {
    res.status(403).json({ ok: false, message: 'Pendaftaran guru memerlukan pemberian kewenangan oleh pengelola.' });
  });

  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
      return void res.status(400).json({ ok: false });
    const raw = username.trim().toLowerCase();
    const emails = raw.includes('@') ? [raw] : [`tch_${raw.replace(/[^a-z0-9_]/g, '')}@aquamath.org`, `${raw.replace(/[^a-z0-9_]/g, '')}@aquamath.org`];
    try {
      for (const email of emails) {
        const client = await getSupabaseClient(res.locals.accessToken);
        if (!client) return void res.status(503).json({ ok: false, message: 'Konfigurasi Supabase server belum tersedia.' });
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error || !data?.session?.access_token) continue;
        const token = data.session.access_token;
        const teacher = await verifyTeacher(await getSupabaseClient(token), token, allowedTeacherIds);
        if (!teacher) return void res.status(403).json({ ok: false, message: 'Guru belum diberi kewenangan.' });
        return void res.json({ ok: true, token, authUserId: teacher.user.id, username: raw, teacherName: teacher.profile.display_name });
      }
      res.status(401).json({ ok: false, message: 'Kredensial tidak valid.' });
    } catch { res.status(503).json({ ok: false, message: 'Autentikasi tidak tersedia.' }); }
  });

  app.get('/api/admin/verify', (_req, res) => {
    res.json({ ok: true, username: res.locals.teacher.user.email, teacherName: res.locals.teacher.profile.display_name });
  });

  function toDbCharacter(raw?: string | null): 'BIMA' | 'SINTA' {
    return String(raw || '').trim().toUpperCase() === 'BIMA' ? 'BIMA' : 'SINTA';
  }

  function fromDbCharacter(raw?: string | null): 'bima' | 'sinta' {
    return String(raw || '').trim().toUpperCase() === 'BIMA' ? 'bima' : 'sinta';
  }

  // Server-side access code verification & Class 5 Roster List for students
  app.post('/api/student/verify-access', async (req, res) => {
    const { accessCode } = req.body || {};
    if (!accessCode) {
      res.status(400).json({ ok: false, message: 'Kode Akses Kelas wajib diisi.' });
      return;
    }

    const cleanedCode = String(accessCode).trim().toUpperCase();
    const validCode = (process.env.DEFAULT_CLASS_ACCESS_CODE || 'AQUA2026').trim().toUpperCase();
    const sb = await getSupabaseClient(res.locals.accessToken);

    if (sb) {
      try {
        if (cleanedCode === validCode) {
          // Fetch enrolled Class 5 student roster list from student_profiles using valid schema columns
          const { data: roster } = await sb
            .from('student_profiles')
            .select('id, auth_user_id, display_name, character, is_active, created_at')
            .eq('is_active', true)
            .order('display_name', { ascending: true });

          const students = (roster || []).map((s: any) => {
            const displayName = String(s.display_name || 'Siswa').trim();
            const norm = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            return {
              id: s.id,
              name: displayName,
              username: norm || s.id,
              characterId: fromDbCharacter(s.character),
              hasPin: false,
            };
          });

          res.json({
            ok: true,
            className: 'Kelas Petualang Aqua City',
            teacherName: 'Ibu/Bapak Guru Kelas 5',
            students,
          });
          return;
        } else {
          res.status(401).json({ ok: false, message: 'Kode Akses Kelas tidak sesuai. Mohon tanyakan ke Guru!' });
          return;
        }
      } catch {
        // Fallback
      }
    }

    if (cleanedCode === validCode) {
      res.json({
        ok: true,
        className: 'Kelas 5 SD',
        teacherName: 'Guru Aqua City',
        students: [],
      });
    } else {
      res.status(401).json({ ok: false, message: 'Kode Akses Kelas tidak sesuai. Mohon tanyakan ke Guru!' });
    }
  });

  // Student identity changes require the authenticated owner.
  app.post('/api/student/select-identity', async (req, res) => {
    const { studentId, characterId } = req.body || {};

    if (!studentId) {
      res.status(400).json({ ok: false, message: 'Pilih nama siswamu terlebih dahulu.' });
      return;
    }

    const sb = await getSupabaseClient(res.locals.accessToken);
    if (sb) {
      try {
        const { data: studentRow, error } = await sb
          .from('student_profiles')
          .select('id, auth_user_id, display_name, character, is_active, created_at')
          .eq('id', studentId)
          .maybeSingle();

        if (error || !studentRow) {
          res.status(404).json({ ok: false, message: 'Data siswa tidak ditemukan di database.' });
          return;
        }

        const now = new Date().toISOString();
        const dbChar = toDbCharacter(characterId || studentRow.character);
        const frontendChar = fromDbCharacter(dbChar);
        const displayName = String(studentRow.display_name || 'Siswa').trim();
        const normName = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        const { data: updatedIdentity, error: updateError } = await sb
          .from('student_profiles')
          .update({ character: dbChar })
          .eq('id', studentId).select('id').maybeSingle();
        if (updateError || !updatedIdentity) return void res.status(500).json({ ok: false, message: 'Profil gagal diperbarui.' });

        const initialSolo = { unlockedLevel: 1, academicGrade: 0, bestTotalScore: 0, latestTotalScore: 0, completedLevels: [], locations: {} };
        const initialChampionship = { unlockedLevel: 1, academicGrade: 0, totalChampionshipScore: 0, totalTimeSeconds: 0, completedLevels: [], locations: {} };

        const profile = {
          id: studentRow.id,
          name: displayName,
          username: normName,
          normalizedName: normName,
          characterId: frontendChar,
          createdAt: studentRow.created_at || now,
          lastActiveAt: now,
          solo: initialSolo,
          championship: initialChampionship,
        };

        res.json({ ok: true, profile, message: `Selamat berpetualang, ${profile.name}!` });
        return;
      } catch (e: any) {
        res.status(500).json({ ok: false, message: `Gagal memuat profil siswa: ${e?.message}` });
        return;
      }
    }

    res.status(400).json({ ok: false, message: 'Database Supabase tidak terhubung.' });
  });

  // Teacher Admin: Fetch Roster List of Class 5 Students
  app.get('/api/admin/students', async (req, res) => {
    const sb = await getSupabaseClient(res.locals.accessToken);
    if (sb) {
      try {
        const { data, error } = await sb
          .from('student_profiles')
          .select('id, auth_user_id, display_name, character, is_active, created_at')
          .order('created_at', { ascending: false });

        if (error) {
          res.status(500).json({ ok: false, message: error.message });
          return;
        }

        res.json({ ok: true, students: data || [] });
        return;
      } catch (e: any) {
        res.status(500).json({ ok: false, message: e?.message });
        return;
      }
    }

    res.json({ ok: true, students: [] });
  });

  // Teacher Admin: Provision / Sync 14 Official Class 5 Student Accounts
  app.post('/api/admin/provision-students', async (_req, res) => {
    res.status(503).json({ ok: false, message: 'Operasi admin Auth memerlukan mekanisme terpisah yang disetujui pengelola.' });
  });

  // Teacher Admin: Add Single Student Account (Auth + student_profiles with real auth_user_id)
  app.post('/api/admin/students', async (_req, res) => {
    res.status(503).json({ ok: false, message: 'Operasi admin Auth memerlukan mekanisme terpisah yang disetujui pengelola.' });
  });

  // Teacher Admin: Reset Student Password via Supabase Admin API
  app.post('/api/admin/reset-student-password', async (_req, res) => {
    res.status(503).json({ ok: false, message: 'Operasi admin Auth memerlukan mekanisme terpisah yang disetujui pengelola.' });
  });

  // Student Login via Username + Password
  app.post('/api/student/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, message: 'Username dan password siswa wajib diisi.' });
      return;
    }

    const normUsername = String(username)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    const internalEmail = `${normUsername}@student.aquamath.id`;

    const sb = await getSupabaseClient(res.locals.accessToken);
    if (!sb) {
      res.status(400).json({ ok: false, message: 'Database Supabase tidak terhubung.' });
      return;
    }

    try {
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
        email: internalEmail,
        password: String(password),
      });

      if (authErr || !authData?.user || !authData.session?.access_token) {
        res.status(401).json({ ok: false, message: 'Username atau password siswa salah.' });
        return;
      }

      const authUser = authData.user;
      const { data: studentRow, error: studentError } = await sb
        .from('student_profiles')
        .select('id, auth_user_id, display_name, character, is_active, created_at')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      if (studentError || !studentRow || studentRow.auth_user_id !== authUser.id || studentRow.is_active !== true) {
        res.status(403).json({
          ok: false,
          message: 'Akun siswa ini sedang dinonaktifkan oleh Guru.',
        });
        return;
      }

      const displayName =
        studentRow?.display_name ||
        authUser.user_metadata?.display_name ||
        authUser.user_metadata?.name ||
        normUsername;
      const frontendChar = fromDbCharacter(
        studentRow?.character || authUser.user_metadata?.character,
      );
      const now = new Date().toISOString();

      const profile = {
        id: studentRow?.id || authUser.id,
        authUserId: authUser.id,
        name: displayName,
        username: normUsername,
        normalizedName: displayName.toLowerCase().replace(/\s+/g, ' '),
        characterId: frontendChar,
        isActive: true,
        profileLinked: Boolean(studentRow?.id),
        createdAt: studentRow?.created_at || authUser.created_at || now,
        lastActiveAt: now,
        solo: {
          unlockedLevel: 1,
          academicGrade: 0,
          bestTotalScore: 0,
          latestTotalScore: 0,
          completedLevels: [],
          locations: {},
        },
        championship: {
          unlockedLevel: 1,
          academicGrade: 0,
          totalChampionshipScore: 0,
          totalTimeSeconds: 0,
          completedLevels: [],
          locations: {},
        },
      };

      res.json({
        ok: true,
        token: authData.session?.access_token,
        profile,
        message: `Selamat datang kembali, ${displayName}!`,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message || 'Gagal melakukan login siswa.' });
    }
  });

  // Teacher Admin: Update Student Name / Character
  app.put('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    const { name, characterId, isActive } = req.body || {};
    const sb = await getSupabaseClient(res.locals.accessToken);

    if (!sb) {
      res.status(400).json({ ok: false, message: 'Database tidak terhubung.' });
      return;
    }

    try {
      const updatePayload: Record<string, any> = {};
      if (name) {
        updatePayload.display_name = String(name).trim().replace(/\s+/g, ' ');
      }
      if (characterId) {
        updatePayload.character = toDbCharacter(characterId);
      }
      if (isActive !== undefined) {
        updatePayload.is_active = Boolean(isActive);
      }

      const { data: updated, error } = await sb
        .from('student_profiles')
        .update(updatePayload)
        .eq('id', id)
        .select('id, auth_user_id, display_name, character, is_active, created_at')
        .maybeSingle();

      if (error || !updated) {
        res.status(error ? 500 : 404).json({ ok: false, message: 'Profil tidak berhasil diperbarui.' });
        return;
      }

      res.json({ ok: true, student: updated, message: 'Data siswa berhasil diperbarui!' });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message });
      return;
    }
  });

  // Teacher Admin: Delete Student
  app.delete('/api/admin/students/:id', async (req, res) => {
    const { id } = req.params;
    const sb = await getSupabaseClient(res.locals.accessToken);

    if (!sb) {
      res.status(400).json({ ok: false, message: 'Database tidak terhubung.' });
      return;
    }

    try {
      const { data: deleted, error } = await sb.from('student_profiles').delete().eq('id', id).select('id').maybeSingle();
      if (error || !deleted) {
        res.status(error ? 500 : 404).json({ ok: false, message: 'Penghapusan tidak dikonfirmasi database.' });
        return;
      }

      res.json({ ok: true, message: 'Data siswa berhasil dihapus.' });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: e?.message });
      return;
    }
  });

  // Save through the existing RPC under the authenticated student RLS context.
  app.post('/api/student/save-attempt', async (req, res) => {
    const { studentId, mode, levelNumber, locationId, correctCount, wrongCount, durationSeconds, sessionId } = req.body || {};

    if (!studentId || !locationId) {
      res.status(400).json({ ok: false, message: 'Data percobaan permainan tidak lengkap.' });
      return;
    }

    const sb = await getSupabaseClient(res.locals.accessToken);
    if (!sb) {
      res.status(503).json({ ok: false, syncedToSupabase: false, message: 'Database tidak tersedia.' });
      return;
    }

    try {
      const score = Math.min(100, Math.max(0, Number(correctCount || 0) * 10));

      if (!['solo', 'championship'].includes(mode) || !Number.isInteger(locationId) || locationId < 1 || locationId > 10 ||
        !Number.isInteger(correctCount) || !Number.isInteger(wrongCount) || correctCount < 0 || wrongCount < 0 || correctCount + wrongCount !== 10 ||
        !Number.isFinite(durationSeconds) || durationSeconds < 0 || levelNumber !== Math.ceil(locationId / 2))
        return void res.status(400).json({ ok: false, syncedToSupabase: false, message: 'Hasil permainan tidak valid.' });
      if (mode === 'championship') {
        if (typeof sessionId !== 'string') return void res.status(400).json({ ok: false, syncedToSupabase: false });
        const { data: session, error: sessionError } = await sb.from('championship_sessions').select('id, is_active').eq('id', sessionId).eq('is_active', true).maybeSingle();
        if (sessionError || !session?.is_active) return void res.status(400).json({ ok: false, syncedToSupabase: false, message: 'Sesi Championship tidak aktif.' });
      }
      const { data: attempt, error: attemptError } = await sb.rpc('save_game_attempt', {
        p_mode: mode === 'championship' ? 'CHAMPIONSHIP' : 'SOLO',
        p_level_number: levelNumber, p_location_id: locationId, p_correct_count: correctCount,
        p_wrong_count: wrongCount, p_duration_seconds: durationSeconds,
        p_session_id: mode === 'championship' ? sessionId : null,
      });
      const confirmedAttemptId = typeof attempt === 'string' ? attempt : attempt?.attempt_id || attempt?.id;
      if (attemptError || typeof confirmedAttemptId !== 'string' || !confirmedAttemptId || attempt?.ok === false || attempt?.success === false || (attempt?.student_id && attempt.student_id !== res.locals.student.id))
        return void res.status(500).json({ ok: false, syncedToSupabase: false, message: 'Database belum mengonfirmasi penyimpanan.' });

      res.json({
        ok: true,
        syncedToSupabase: true,
        score,
        attemptId: confirmedAttemptId,
        message: 'Skor permainan berhasil tersimpan di Supabase!',
      });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, syncedToSupabase: false, message: 'Penyimpanan gagal.' });
      return;
    }
  });

  return app;
}

async function startServer() {
  const app = createBackendApp();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
    });
    return;
  }

  // Start Vite initialization immediately and bind port 3000 without blocking cold-start probes
  let viteMiddleware: any = null;
  const viteReady = (async () => {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares;
    return viteMiddleware;
  })();

  app.use(async (req, res, next) => {
    try {
      const mw = viteMiddleware || (await viteReady);
      mw(req, res, next);
    } catch (err) {
      next(err);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) startServer();
