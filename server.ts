import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Server-side secret key & credentials (never sent to frontend)
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'guru_aqua').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AquaGuru2026!';

function createAdminToken(username: string): string {
  const payload = JSON.stringify({
    username,
    role: 'teacher_admin',
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 12, // 12 hours
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

function verifyAdminToken(token: string): { valid: boolean; username?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [base64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Payload)
      .digest('base64url');
    if (signature !== expectedSig) return { valid: false };
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (decoded.exp < Date.now()) return { valid: false };
    return { valid: true, username: decoded.username };
  } catch {
    return { valid: false };
  }
}

// Teacher Admin Registration (Name + Username + Password)
app.post('/api/admin/register', async (req, res) => {
  const { name, username, password, confirmPassword } = req.body || {};

  if (!name || !username || !password) {
    res.status(400).json({ ok: false, message: 'Seluruh kolom pendaftaran guru wajib diisi.' });
    return;
  }

  const rawInput = String(username).trim().toLowerCase();
  const isEmailInput = rawInput.includes('@');
  const normUsername = isEmailInput
    ? rawInput
    : rawInput.replace(/[^a-z0-9_]/g, '');
  const cleanedName = String(name).trim().replace(/\s+/g, ' ');

  if (normUsername.length < 3) {
    res.status(400).json({ ok: false, message: 'Username atau Email minimal 3 karakter.' });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({ ok: false, message: 'Password minimal 6 karakter demi keamanan akun.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ ok: false, message: 'Konfirmasi password tidak cocok dengan password.' });
    return;
  }

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      // 1. Check existing in Supabase Authentication (via email or derived from username)
      const teacherEmail = isEmailInput ? rawInput : `tch_${normUsername}@aquamath.org`;
      
      // We'll skip the profile table check and go straight to Auth creation/sign-in.
      // If the user already exists in Auth, we can handle it.
      
      // 2. Create user account in Supabase Authentication
      let authUser: any = null;
      let authErrorMsg: string | null = null;

      // Attempt 1: Admin API
      try {
        const adminRes = await sb.auth.admin.createUser({
          email: teacherEmail,
          password: String(password),
          email_confirm: true,
          user_metadata: { name: cleanedName, username: normUsername, role: 'teacher' },
        });
        if (adminRes.data?.user) {
          authUser = adminRes.data.user;
        } else if (adminRes.error) {
          authErrorMsg = adminRes.error.message;
        }
      } catch (e: any) {
        authErrorMsg = e?.message;
      }

      // Attempt 2: Standard SignUp if Admin API was restricted or disabled
      if (!authUser) {
        try {
          const signUpRes = await sb.auth.signUp({
            email: teacherEmail,
            password: String(password),
            options: { data: { name: cleanedName, username: normUsername, role: 'teacher' } },
          });
          if (signUpRes.data?.user) {
            authUser = signUpRes.data.user;
          } else if (signUpRes.error) {
            authErrorMsg = signUpRes.error.message;
          }
        } catch (e: any) {
          authErrorMsg = e?.message;
        }
      }

      // CRITICAL REQUIREMENT: Fail if Auth user could not be created
      if (!authUser || !authUser.id) {
        res.status(400).json({
          ok: false,
          message: `Gagal membuat akun di Supabase Authentication: ${authErrorMsg || 'Email/username mungkin sudah terdaftar.'}`,
        });
        return;
      }

      const authUserId = authUser.id;

      // 3. Create profile row in teacher_profiles table
      const now = new Date().toISOString();
      const newTeacherId = `tch_${authUserId}`;

      const teacherPayload = {
        id: newTeacherId,
        auth_user_id: authUserId,
        display_name: cleanedName,
        role: 'teacher',
        created_at: now,
      };

      const { data: insertedProf, error: insertErr } = await sb
        .from('teacher_profiles')
        .upsert(teacherPayload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (insertErr) {
        res.status(500).json({
          ok: false,
          message: `Akun autentikasi berhasil dibuat, tetapi profil gagal disimpan di teacher_profiles: ${insertErr.message}`,
        });
        return;
      }

      const token = createAdminToken(normUsername);
      res.json({
        ok: true,
        token,
        teacherName: cleanedName,
        username: normUsername,
        authUserId,
        message: 'Akun Guru dan Profil teacher_profiles berhasil dibuat di Supabase!',
      });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `Gagal mendaftarkan guru: ${e?.message}` });
      return;
    }
  }

  // Fallback token if Supabase not configured in env
  const token = createAdminToken(normUsername);
  res.json({
    ok: true,
    token,
    teacherName: cleanedName,
    username: normUsername,
    message: 'Akun Guru berhasil terdaftar!',
  });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ ok: false, message: 'Email/Username dan password wajib diisi.' });
    return;
  }

  const rawUser = String(username).trim().toLowerCase();
  const isEmailLogin = rawUser.includes('@');
  const normUser = isEmailLogin ? rawUser : rawUser.replace(/[^a-z0-9_]/g, '');
  const teacherEmail = isEmailLogin ? rawUser : `tch_${normUser}@aquamath.org`;

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      // 1. Authenticate against Supabase Auth
      const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
        email: teacherEmail,
        password: String(password),
      });

      if (authErr || !authData?.user) {
        res.status(401).json({
          ok: false,
          message: `Email/Username atau password guru salah: ${authErr?.message || 'Kredensial tidak valid.'}`,
        });
        return;
      }

      const now = new Date().toISOString();

      // 2. Query teacher_profiles by auth_user_id
      const { data: profile } = await sb
        .from('teacher_profiles')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();

      // 3. Recovery Logic: If profile missing, create it from Auth metadata
      if (!profile) {
        const recoverName = authData.user.user_metadata?.name || authData.user.user_metadata?.display_name || 'Ibu/Bapak Guru';
        const recoverPayload = {
          id: `tch_${authData.user.id}`,
          auth_user_id: authData.user.id,
          display_name: recoverName,
          role: 'teacher',
          created_at: authData.user.created_at || now,
        };
        
        await sb.from('teacher_profiles').upsert(recoverPayload, { onConflict: 'id' });
      }

      const finalProfile = profile || { display_name: authData.user.user_metadata?.name || 'Ibu/Bapak Guru' };
      const teacherName = finalProfile.display_name || 'Ibu/Bapak Guru';
      const token = createAdminToken(normUser);
      res.json({
        ok: true,
        token,
        teacherName,
        username: normUser,
        authUserId: authData.user.id,
      });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `Kesalahan server login: ${e?.message}` });
      return;
    }
  }

  // Fallback ENV credentials check if Supabase is not configured
  const expectedUser = ADMIN_USERNAME.toLowerCase();
  const passBuf = Buffer.from(String(password));
  const expectedBuf = Buffer.from(ADMIN_PASSWORD);
  const passwordMatch =
    passBuf.length === expectedBuf.length && crypto.timingSafeEqual(passBuf, expectedBuf);

  if ((normUser === expectedUser || normUser === 'guru_aqua') && passwordMatch) {
    const token = createAdminToken(ADMIN_USERNAME);
    res.json({
      ok: true,
      token,
      teacherName: 'Ibu/Bapak Guru Pembimbing',
      username: ADMIN_USERNAME,
    });
  } else {
    res.status(401).json({
      ok: false,
      message: 'Username atau password guru tidak valid.',
    });
  }
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const result = verifyAdminToken(token);
  if (!result.valid) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true, username: result.username, teacherName: 'Ibu/Bapak Guru Kelas 2' });
});

// Helper to initialize server-side Supabase client
async function getSupabaseClient() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch {
      return null;
    }
  }
  return null;
}

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
  const sb = await getSupabaseClient();

  if (sb) {
    try {
      if (cleanedCode === validCode) {
        // Fetch enrolled Class 5 student roster list from student_profiles using valid schema columns
        const { data: roster } = await sb
          .from('student_profiles')
          .select('id, auth_user_id, display_name, character, is_active, created_at')
          .eq('is_active', true)
          .order('display_name', { ascending: true });

        const students = (roster || []).map((s) => {
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

// Student Identity Selection (No email/password account required!)
app.post('/api/student/select-identity', async (req, res) => {
  const { studentId, characterId } = req.body || {};

  if (!studentId) {
    res.status(400).json({ ok: false, message: 'Pilih nama siswamu terlebih dahulu.' });
    return;
  }

  const sb = await getSupabaseClient();
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

      await sb
        .from('student_profiles')
        .update({ character: dbChar })
        .eq('id', studentId);

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
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authCheck = verifyAdminToken(token);

  if (!authCheck.valid) {
    res.status(401).json({ ok: false, message: 'Sesi guru tidak valid.' });
    return;
  }

  const sb = await getSupabaseClient();
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

// Teacher Admin: Add Single or Bulk Batch Students to Class 5
app.post('/api/admin/students', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authCheck = verifyAdminToken(token);

  if (!authCheck.valid) {
    res.status(401).json({ ok: false, message: 'Akses ditolak. Sesi guru tidak valid.' });
    return;
  }

  const { name, names, characterId } = req.body || {};
  const sb = await getSupabaseClient();

  if (!sb) {
    res.status(400).json({ ok: false, message: 'Database Supabase belum terhubung.' });
    return;
  }

  try {
    const now = new Date().toISOString();
    const dbChar = toDbCharacter(characterId);
    const selectCols = 'id, auth_user_id, display_name, character, is_active, created_at';

    // Batch insertion if multiple names provided
    if (Array.isArray(names) && names.length > 0) {
      const rowsToInsert = names
        .map((rawName) => String(rawName).trim().replace(/\s+/g, ' '))
        .filter((n) => n.length >= 2)
        .map((cleanedName) => ({
          id: crypto.randomUUID(),
          auth_user_id: null,
          display_name: cleanedName,
          character: dbChar,
          is_active: true,
          created_at: now,
        }));

      if (rowsToInsert.length === 0) {
        res.status(400).json({ ok: false, message: 'Daftar nama siswa tidak valid.' });
        return;
      }

      const { data: insertedList, error: insertErr } = await sb
        .from('student_profiles')
        .insert(rowsToInsert)
        .select(selectCols);

      if (insertErr) {
        res.status(500).json({ ok: false, message: `Gagal menambah daftar siswa: ${insertErr.message}` });
        return;
      }

      res.json({
        ok: true,
        count: insertedList?.length || rowsToInsert.length,
        students: insertedList || rowsToInsert,
        message: `Berhasil menambahkan ${insertedList?.length || rowsToInsert.length} siswa baru ke Kelas 5!`,
      });
      return;
    }

    // Single student insertion
    if (!name || String(name).trim().length < 2) {
      res.status(400).json({ ok: false, message: 'Nama siswa minimal 2 huruf.' });
      return;
    }

    const cleanedName = String(name).trim().replace(/\s+/g, ' ');
    const newStudentId = crypto.randomUUID();

    const { data: inserted, error: insertErr } = await sb
      .from('student_profiles')
      .insert({
        id: newStudentId,
        auth_user_id: null,
        display_name: cleanedName,
        character: dbChar,
        is_active: true,
        created_at: now,
      })
      .select(selectCols)
      .single();

    if (insertErr) {
      res.status(500).json({ ok: false, message: `Gagal menambahkan siswa: ${insertErr.message}` });
      return;
    }

    res.json({
      ok: true,
      student: inserted,
      message: `Siswa "${cleanedName}" (${dbChar}) berhasil ditambahkan ke Kelas 5!`,
    });
    return;
  } catch (e: any) {
    res.status(500).json({ ok: false, message: `Gagal memproses data siswa: ${e?.message}` });
    return;
  }
});

// Teacher Admin: Update Student Name / Character
app.put('/api/admin/students/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authCheck = verifyAdminToken(token);

  if (!authCheck.valid) {
    res.status(401).json({ ok: false, message: 'Akses ditolak.' });
    return;
  }

  const { id } = req.params;
  const { name, characterId, isActive } = req.body || {};
  const sb = await getSupabaseClient();

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

    if (error) {
      res.status(500).json({ ok: false, message: error.message });
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
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authCheck = verifyAdminToken(token);

  if (!authCheck.valid) {
    res.status(401).json({ ok: false, message: 'Akses ditolak.' });
    return;
  }

  const { id } = req.params;
  const sb = await getSupabaseClient();

  if (!sb) {
    res.status(400).json({ ok: false, message: 'Database tidak terhubung.' });
    return;
  }

  try {
    const { error } = await sb.from('student_profiles').delete().eq('id', id);
    if (error) {
      res.status(500).json({ ok: false, message: error.message });
      return;
    }

    res.json({ ok: true, message: 'Data siswa berhasil dihapus.' });
    return;
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message });
    return;
  }
});

// Secure Mission Score Attempt Saving Endpoint (No student Supabase Auth token required)
app.post('/api/student/save-attempt', async (req, res) => {
  const { studentId, mode, levelNumber, locationId, correctCount, wrongCount, durationSeconds, sessionId } = req.body || {};

  if (!studentId || !locationId) {
    res.status(400).json({ ok: false, message: 'Data percobaan permainan tidak lengkap.' });
    return;
  }

  const sb = await getSupabaseClient();
  if (!sb) {
    res.json({ ok: true, syncedToSupabase: false, message: 'Database offline, hasil disimpan secara lokal.' });
    return;
  }

  try {
    const score = Math.min(100, Math.max(0, Number(correctCount || 0) * 10));

    const { data: attempt } = await sb
      .from('game_attempts')
      .insert({
        student_id: studentId,
        mode: mode === 'championship' ? 'CHAMPIONSHIP' : 'SOLO',
        session_id: sessionId || null,
        level_number: Number(levelNumber || Math.ceil(locationId / 2)),
        location_id: Number(locationId),
        correct_count: Number(correctCount || 0),
        wrong_count: Number(wrongCount || 0),
        score,
        duration_seconds: Number(durationSeconds || 0),
      })
      .select()
      .maybeSingle();

    res.json({
      ok: true,
      syncedToSupabase: true,
      score,
      attemptId: attempt?.id,
      message: 'Skor permainan berhasil tersimpan di Supabase!',
    });
    return;
  } catch (e: any) {
    res.json({ ok: true, syncedToSupabase: false, message: `Tersimpan secara lokal: ${e?.message}` });
    return;
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aqua Math Adventure Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
