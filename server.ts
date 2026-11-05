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

  const normUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanedName = String(name).trim().replace(/\s+/g, ' ');

  if (normUsername.length < 3) {
    res.status(400).json({ ok: false, message: 'Username minimal 3 karakter.' });
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
      // 1. Check existing in teacher_profiles table
      const { data: existingProf } = await sb
        .from('teacher_profiles')
        .select('id, username')
        .eq('username', normUsername)
        .maybeSingle();

      if (existingProf) {
        res.status(400).json({
          ok: false,
          message: `Username guru "${normUsername}" sudah terdaftar. Silakan pilih username lain atau lakukan Login!`,
        });
        return;
      }

      // 2. Create user account in Supabase Authentication
      const teacherEmail = `tch_${normUsername}@aquamath.org`;
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

      const teacherPayload: Record<string, any> = {
        id: newTeacherId,
        auth_user_id: authUserId,
        name: cleanedName,
        display_name: cleanedName,
        username: normUsername,
        role: 'teacher',
        championship_data: null,
        created_at: now,
        last_active_at: now,
      };

      let { data: insertedProf, error: insertErr } = await sb
        .from('teacher_profiles')
        .insert(teacherPayload)
        .select()
        .maybeSingle();

      // Retry with core fields if schema cache rejects optional columns
      if (insertErr && insertErr.message.includes('column')) {
        const coreTeacherPayload = {
          id: newTeacherId,
          auth_user_id: authUserId,
          name: cleanedName,
          display_name: cleanedName,
          username: normUsername,
          last_active_at: now,
        };
        const retryRes = await sb
          .from('teacher_profiles')
          .insert(coreTeacherPayload)
          .select()
          .maybeSingle();

        if (!retryRes.error) {
          insertedProf = retryRes.data;
          insertErr = null;
        }
      }

      if (insertErr) {
        // Rollback created Auth user if profile insertion failed
        await sb.auth.admin.deleteUser(authUserId).catch(() => null);

        res.status(500).json({
          ok: false,
          message: `Akun autentikasi terbuat, tetapi profil gagal disimpan di teacher_profiles: ${insertErr.message}`,
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
    res.status(400).json({ ok: false, message: 'Username dan password wajib diisi.' });
    return;
  }

  const normUser = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const teacherEmail = `tch_${normUser}@aquamath.org`;

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
          message: `Username atau password guru salah: ${authErr?.message || 'Kredensial tidak valid.'}`,
        });
        return;
      }

      // 2. Query teacher_profiles by auth_user_id or username
      const { data: profile, error: profileErr } = await sb
        .from('teacher_profiles')
        .select('*')
        .or(`auth_user_id.eq.${authData.user.id},username.eq.${normUser}`)
        .maybeSingle();

      const teacherName = profile?.name || authData.user.user_metadata?.name || 'Ibu/Bapak Guru';
      const now = new Date().toISOString();

      if (profile?.id) {
        await sb.from('teacher_profiles').update({ last_active_at: now }).eq('id', profile.id);
      }

      const token = createAdminToken(normUser);
      res.json({
        ok: true,
        token,
        teacherName,
        username: profile?.username || normUser,
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

// Server-side access code verification endpoint for students
app.post('/api/student/verify-access', async (req, res) => {
  const { accessCode } = req.body || {};
  if (!accessCode) {
    res.status(400).json({ ok: false, message: 'Kode Akses Kelas wajib diisi.' });
    return;
  }

  const cleanedCode = String(accessCode).trim().toUpperCase();
  const sb = await getSupabaseClient();

  if (sb) {
    try {
      const { data, error } = await sb
        .from('class_settings')
        .select('*')
        .eq('id', 'default_class')
        .maybeSingle();

      if (!error && data) {
        if (!data.access_code_active) {
          res.status(403).json({ ok: false, message: 'Kode Akses Kelas sedang nonaktif. Mohon hubungi Guru!' });
          return;
        }
        if (data.access_code.trim().toUpperCase() === cleanedCode) {
          res.json({ ok: true, className: data.class_name, teacherName: data.teacher_name });
          return;
        } else {
          res
            .status(401)
            .json({ ok: false, message: 'Kode Akses Kelas tidak sesuai. Mohon periksa kembali kode dari Guru!' });
          return;
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback default access code check
  const defaultCode = (process.env.DEFAULT_CLASS_ACCESS_CODE || 'AQUA2026').trim().toUpperCase();
  if (cleanedCode === defaultCode) {
    res.json({ ok: true, className: 'Kelas Petualang Aqua City', teacherName: 'Guru Aqua City' });
  } else {
    res.status(401).json({ ok: false, message: 'Kode Akses Kelas tidak sesuai. Mohon tanyakan ke Guru!' });
  }
});

// Student Permanent Account Registration (Username + Password)
app.post('/api/student/register', async (req, res) => {
  const { accessCode, name, username, password, confirmPassword, characterId } = req.body || {};

  if (!accessCode || !name || !username || !password || !characterId) {
    res.status(400).json({ ok: false, message: 'Seluruh kolom pendaftaran wajib diisi.' });
    return;
  }

  const cleanedCode = String(accessCode).trim().toUpperCase();
  const normUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanedName = String(name).trim().replace(/\s+/g, ' ');

  if (normUsername.length < 3) {
    res.status(400).json({
      ok: false,
      message: 'Username minimal 3 karakter (hanya huruf, angka, dan garis bawah).',
    });
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
      // 1. Verify access code against class_settings
      const { data: settings } = await sb
        .from('class_settings')
        .select('*')
        .eq('id', 'default_class')
        .maybeSingle();

      const expectedCode = settings?.access_code
        ? settings.access_code.trim().toUpperCase()
        : (process.env.DEFAULT_CLASS_ACCESS_CODE || 'AQUA2026').toUpperCase();

      if (settings && !settings.access_code_active) {
        res.status(403).json({ ok: false, message: 'Kode Akses Kelas sedang ditutup oleh Guru.' });
        return;
      }

      if (cleanedCode !== expectedCode) {
        res.status(401).json({ ok: false, message: 'Kode Akses Kelas salah.' });
        return;
      }

      // 2. Check if username already exists in student_profiles
      const { data: existingUser } = await sb
        .from('student_profiles')
        .select('id, name, username')
        .or(`username.eq.${normUsername},normalized_name.eq.${normUsername}`)
        .maybeSingle();

      if (existingUser) {
        res.status(400).json({
          ok: false,
          message: `Username "${normUsername}" sudah terdaftar. Silakan pilih username lain atau lakukan Login!`,
        });
        return;
      }

      // 3. Create user in Supabase Auth using internal mapping email
      const internalEmail = `${normUsername}@aquamath.org`;
      let authUserId = `auth_${Date.now()}_${normUsername}`;

      // Attempt admin creation first
      const adminRes = await sb.auth.admin.createUser({
        email: internalEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: { name: cleanedName, username: normUsername },
      }).catch(() => null);

      if (adminRes?.data?.user) {
        authUserId = adminRes.data.user.id;
      } else {
        // Fallback standard signup
        const signUpRes = await sb.auth.signUp({
          email: internalEmail,
          password: String(password),
          options: { data: { name: cleanedName, username: normUsername } },
        }).catch(() => null);

        if (signUpRes?.data?.user) {
          authUserId = signUpRes.data.user.id;
        }
      }

      // 4. Create row in student_profiles
      const newStudentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const initialSolo = {
        unlockedLevel: 1,
        academicGrade: 'A',
        bestTotalScore: 0,
        latestTotalScore: 0,
        locations: {},
      };

      const initialChampionship = {
        unlockedLevel: 1,
        academicGrade: 'A',
        totalChampionshipScore: 0,
        locations: {},
      };

      const studentPayload: Record<string, any> = {
        id: newStudentId,
        auth_user_id: authUserId,
        name: cleanedName,
        username: normUsername,
        normalized_name: normUsername,
        character_id: characterId,
        created_at: now,
        last_active_at: now,
        championship_data: null,
      };

      // Try inserting core profile data into student_profiles table
      let { data: inserted, error: insertErr } = await sb
        .from('student_profiles')
        .insert(studentPayload)
        .select()
        .single();

      // Fallback if solo_data column exists and insert succeeded or needed retry
      if (insertErr && insertErr.message.includes('column')) {
        // Attempt with minimal core fields
        const minimalPayload = {
          id: newStudentId,
          auth_user_id: authUserId,
          name: cleanedName,
          username: normUsername,
          character_id: characterId,
        };
        const retryRes = await sb
          .from('student_profiles')
          .insert(minimalPayload)
          .select()
          .single();
        if (!retryRes.error && retryRes.data) {
          inserted = retryRes.data;
          insertErr = null;
        }
      }

      if (insertErr) {
        res.status(500).json({ ok: false, message: `Gagal membuat profil siswa di Supabase: ${insertErr.message}` });
        return;
      }

      const profile = {
        id: inserted?.id || newStudentId,
        name: inserted?.name || cleanedName,
        username: inserted?.username || normUsername,
        normalizedName: inserted?.normalized_name || normUsername,
        characterId: inserted?.character_id || characterId,
        createdAt: inserted?.created_at || now,
        lastActiveAt: inserted?.last_active_at || now,
        solo: inserted?.solo_data || initialSolo,
        championship: initialChampionship,
      };

      res.json({ ok: true, profile, message: 'Akun siswa berhasil dibuat! Selamat berpetualang!' });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `Kesalahan server: ${e?.message || 'Database error'}` });
      return;
    }
  }

  // Fallback local memory / storage response if Supabase not configured
  const newStudentId = `stu_${Date.now()}`;
  const profile = {
    id: newStudentId,
    name: cleanedName,
    username: normUsername,
    normalizedName: normUsername,
    characterId,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    solo: { unlockedLevel: 1, academicGrade: 'A', bestTotalScore: 0, latestTotalScore: 0, locations: {} },
    championship: { unlockedLevel: 1, academicGrade: 'A', totalChampionshipScore: 0, locations: {} },
  };

  res.json({ ok: true, profile, message: 'Akun siswa berhasil dibuat!' });
});

// Student Permanent Account Login (Username + Password via Supabase Auth)
app.post('/api/student/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ ok: false, message: 'Username dan password wajib diisi.' });
    return;
  }

  const normUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const internalEmail = `${normUsername}@aquamath.org`;
  const sb = await getSupabaseClient();

  if (sb) {
    try {
      // 1. Authenticate against Supabase Auth
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: internalEmail,
        password: String(password),
      });

      if (authError && authError.message.includes('Invalid login credentials')) {
        res.status(401).json({
          ok: false,
          message: 'Username atau password siswa tidak sesuai. Mohon periksa kembali!',
        });
        return;
      }

      // 2. Fetch student profile from student_profiles by auth_user_id or username
      let profileQuery = sb.from('student_profiles').select('*');
      if (authData?.user?.id) {
        profileQuery = profileQuery.or(`auth_user_id.eq.${authData.user.id},username.eq.${normUsername},normalized_name.eq.${normUsername}`);
      } else {
        profileQuery = profileQuery.or(`username.eq.${normUsername},normalized_name.eq.${normUsername}`);
      }

      const { data: profileRow, error: profileErr } = await profileQuery.maybeSingle();

      if (profileErr || !profileRow) {
        res.status(404).json({
          ok: false,
          message: 'Profil siswa tidak ditemukan. Pastikan Anda sudah mendaftarkan akun.',
        });
        return;
      }

      // Update last_active_at timestamp
      const now = new Date().toISOString();
      await sb.from('student_profiles').update({ last_active_at: now }).eq('id', profileRow.id);

      const profile = {
        id: profileRow.id,
        name: profileRow.name,
        username: profileRow.username || normUsername,
        normalizedName: profileRow.normalized_name,
        characterId: profileRow.character_id,
        createdAt: profileRow.created_at,
        lastActiveAt: now,
        solo: profileRow.solo_data,
        championship: profileRow.championship_data,
      };

      res.json({
        ok: true,
        profile,
        token: authData?.session?.access_token || 'session_active',
        message: `Selamat datang kembali, ${profile.name}!`,
      });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `Gagal proses login: ${e?.message}` });
      return;
    }
  }

  res.status(400).json({ ok: false, message: 'Supabase Database belum terhubung.' });
});

// Teacher Admin: Reset Student Password
app.post('/api/admin/reset-student-password', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const authCheck = verifyAdminToken(token);

  if (!authCheck.valid) {
    res.status(401).json({ ok: false, message: 'Akses ditolak. Sesi guru tidak valid.' });
    return;
  }

  const { studentId, username, newPassword } = req.body || {};

  if ((!studentId && !username) || !newPassword) {
    res.status(400).json({ ok: false, message: 'Username/ID siswa dan Password Baru wajib diisi.' });
    return;
  }

  if (String(newPassword).length < 6) {
    res.status(400).json({ ok: false, message: 'Password baru minimal 6 karakter.' });
    return;
  }

  const sb = await getSupabaseClient();
  if (sb) {
    try {
      // 1. Locate student profile
      let query = sb.from('student_profiles').select('*');
      if (studentId) {
        query = query.eq('id', studentId);
      } else if (username) {
        const norm = String(username).trim().toLowerCase();
        query = query.or(`username.eq.${norm},normalized_name.eq.${norm}`);
      }

      const { data: student, error: findErr } = await query.maybeSingle();
      if (findErr || !student) {
        res.status(404).json({ ok: false, message: 'Siswa tidak ditemukan di database.' });
        return;
      }

      const targetUsername = student.username || student.normalized_name;
      const internalEmail = `${targetUsername}@aquamath.org`;

      // 2. Update password in Supabase Auth
      if (student.auth_user_id) {
        await sb.auth.admin.updateUserById(student.auth_user_id, {
          password: String(newPassword),
        }).catch(() => null);
      }

      // Also ensure internal email login password updated
      await sb.auth.admin.updateUserById(student.id, { password: String(newPassword) }).catch(() => null);

      res.json({
        ok: true,
        message: `Password untuk siswa "${student.name}" (@${targetUsername}) berhasil diperbarui! Siswa dapat login kembali menggunakan password baru.`,
      });
      return;
    } catch (e: any) {
      res.status(500).json({ ok: false, message: `Gagal reset password: ${e?.message}` });
      return;
    }
  }

  res.json({ ok: true, message: 'Password siswa berhasil di-reset!' });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
