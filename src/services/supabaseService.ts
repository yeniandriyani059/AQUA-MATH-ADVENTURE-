import { isSupabaseConfigured, supabase } from './supabaseClient';
import {
  CharacterId,
  GameMode,
  StudentProfile,
} from '../types/game';
import {
  createEmptyStudentProfile,
  normalizePlayerName,
} from '../game/rules';

export interface SaveGameAttemptParams {
  studentId: string;
  mode: GameMode;
  levelNumber: number; // 1 to 5
  locationId: number; // 1 to 10
  correctCount: number; // 0 to 10
  wrongCount: number; // 0 to 10
  durationSeconds: number;
  sessionId?: string | null;
  idempotencyKey?: string;
}

export interface SaveGameAttemptResult {
  success: boolean;
  score: number;
  syncedToSupabase: boolean;
  message?: string;
  attemptId?: string;
}

export interface PendingSyncAttempt extends SaveGameAttemptParams {
  timestamp: number;
  score: number;
}

const OFFLINE_QUEUE_KEY = 'aqua_math_offline_attempts_queue_v1';

// Idempotency cache to prevent duplicate in-memory or rapid double clicks
const processedKeysCache = new Set<string>();

/**
 * Gets offline attempts queued when internet/Supabase was disconnected.
 */
export function getOfflineSyncQueue(): PendingSyncAttempt[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves an attempt to local queue when Supabase RPC is unavailable or offline.
 */
function queueAttemptLocally(attempt: PendingSyncAttempt): void {
  try {
    const queue = getOfflineSyncQueue();
    // Check if key already exists
    if (!queue.some((q) => q.idempotencyKey === attempt.idempotencyKey)) {
      queue.push(attempt);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Flushes pending offline sync queue to Supabase when network connection is re-established.
 */
export async function flushOfflineSyncQueue(): Promise<{ syncedCount: number; remainingCount: number }> {
  if (!isSupabaseConfigured || !supabase) {
    return { syncedCount: 0, remainingCount: getOfflineSyncQueue().length };
  }

  const queue = getOfflineSyncQueue();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  const remaining: PendingSyncAttempt[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const p_mode = item.mode === 'championship' ? 'CHAMPIONSHIP' : 'SOLO';
      const { data, error } = await supabase.rpc('save_game_attempt', {
        p_mode,
        p_level_number: item.levelNumber,
        p_location_id: item.locationId,
        p_correct_count: item.correctCount,
        p_wrong_count: item.wrongCount,
        p_duration_seconds: item.durationSeconds,
        p_session_id: item.sessionId || null,
        p_student_id: item.studentId,
      });

      if (!error && data) {
        synced++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // ignore
  }

  return { syncedCount: synced, remainingCount: remaining.length };
}

/**
 * Verifies class access code via backend endpoint or Supabase class_settings table.
 */
export async function verifyClassAccessCode(
  accessCode: string,
): Promise<{
  ok: boolean;
  message?: string;
  className?: string;
  teacherName?: string;
  students?: Array<{ id: string; name: string; username: string; characterId: CharacterId; hasPin: boolean }>;
}> {
  if (!accessCode || !accessCode.trim()) {
    return { ok: false, message: 'Kode Akses Kelas wajib diisi.' };
  }

  const cleanedCode = accessCode.trim().toUpperCase();

  try {
    const res = await fetch('/api/student/verify-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: cleanedCode }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ok: data.ok,
        className: data.className,
        teacherName: data.teacherName,
        students: data.students || [],
        message: data.message,
      };
    }
    const errData = await res.json().catch(() => ({}));
    return { ok: false, message: errData.message || 'Kode Akses Kelas tidak sesuai. Mohon tanyakan ke Guru!' };
  } catch {
    if (cleanedCode === 'AQUA2026') {
      return { ok: true, className: 'Kelas 5 SD', teacherName: 'Guru Aqua City', students: [] };
    }
    return { ok: false, message: 'Kode Akses Kelas tidak sesuai. Mohon periksa kembali kode dari Guru!' };
  }
}

/**
 * Connects student to their selected Class 5 identity without requiring an individual email/password account.
 */
export async function selectStudentIdentity(
  studentId: string,
  characterId: CharacterId = 'sinta',
  pinCode?: string,
): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  try {
    const res = await fetch('/api/student/select-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, characterId, pinCode }),
    });
    const data = await res.json();
    if (res.ok && data.ok && data.profile) {
      return { ok: true, profile: data.profile, message: data.message };
    }
    return { ok: false, message: data.message || 'Gagal memilih nama siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Tidak dapat terhubung ke server.' };
  }
}

/**
 * Teacher Admin: Add Single Student to Class 5 Roster in Supabase.
 */
export async function adminAddSingleStudent(
  name: string,
  pinCode?: string,
  characterId: CharacterId = 'sinta',
): Promise<{ ok: boolean; student?: any; message?: string }> {
  const cleanedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (cleanedName.length < 2) {
    return { ok: false, message: 'Nama siswa minimal 2 huruf.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const now = new Date().toISOString();
      const normUsername = cleanedName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const newStudentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const emptyProfile = createEmptyStudentProfile(newStudentId, cleanedName, characterId);

      const { data: inserted, error: insertErr } = await supabase
        .from('student_profiles')
        .insert({
          id: newStudentId,
          auth_user_id: null,
          name: cleanedName,
          username: normUsername,
          normalized_name: normUsername,
          character_id: characterId,
          solo_data: emptyProfile.solo,
          championship_data: emptyProfile.championship,
          created_at: now,
          last_active_at: now,
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        return {
          ok: true,
          student: inserted,
          message: `Siswa "${cleanedName}" berhasil ditambahkan ke Kelas 5!`,
        };
      }
      if (insertErr) {
        return { ok: false, message: `Gagal menambahkan siswa ke Supabase: ${insertErr.message}` };
      }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Kesalahan saat menyimpan siswa ke Supabase.' };
    }
  }

  try {
    const token =
      sessionStorage.getItem('aqua_math_admin_token_v1') ||
      sessionStorage.getItem('aqua_admin_token') ||
      '';
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: cleanedName, pinCode, characterId }),
    });
    const result = await res.json();
    if (res.ok && result.ok) {
      return { ok: true, student: result.student, message: result.message };
    }
    return { ok: false, message: result.message || 'Gagal menambahkan siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Gagal terhubung ke server.' };
  }
}

/**
 * Teacher Admin: Add Bulk Batch Students to Class 5 Roster in Supabase.
 */
export async function adminAddBatchStudents(
  names: string[],
  characterId: CharacterId = 'sinta',
): Promise<{ ok: boolean; count?: number; message?: string }> {
  const validNames = (names || [])
    .map((rawName) => String(rawName).trim().replace(/\s+/g, ' '))
    .filter((n) => n.length >= 2);

  if (validNames.length === 0) {
    return { ok: false, message: 'Daftar nama siswa tidak valid.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const now = new Date().toISOString();
      const rowsToInsert = validNames.map((cleanedName, idx) => {
        const normName = `${cleanedName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${idx}`;
        const uid = `stu_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`;
        const emptyProfile = createEmptyStudentProfile(uid, cleanedName, characterId);
        return {
          id: uid,
          auth_user_id: null,
          name: cleanedName,
          username: normName,
          normalized_name: normName,
          character_id: characterId,
          solo_data: emptyProfile.solo,
          championship_data: emptyProfile.championship,
          created_at: now,
          last_active_at: now,
        };
      });

      const { data: insertedList, error: insertErr } = await supabase
        .from('student_profiles')
        .insert(rowsToInsert)
        .select();

      if (!insertErr) {
        const count = insertedList?.length || rowsToInsert.length;
        return {
          ok: true,
          count,
          message: `Berhasil menambahkan ${count} siswa baru ke Kelas 5!`,
        };
      }
      return { ok: false, message: `Gagal menambah daftar siswa ke Supabase: ${insertErr.message}` };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Kesalahan saat menyimpan daftar siswa ke Supabase.' };
    }
  }

  try {
    const token =
      sessionStorage.getItem('aqua_math_admin_token_v1') ||
      sessionStorage.getItem('aqua_admin_token') ||
      '';
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ names: validNames, characterId }),
    });
    const result = await res.json();
    if (res.ok && result.ok) {
      return { ok: true, count: result.count, message: result.message };
    }
    return { ok: false, message: result.message || 'Gagal menambah daftar siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Gagal terhubung ke server.' };
  }
}

/**
 * Teacher Admin: Delete Student from Class 5 Roster in Supabase.
 */
export async function adminDeleteStudent(
  studentId: string,
): Promise<{ ok: boolean; message?: string }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('student_profiles').delete().eq('id', studentId);
      if (!error) {
        return { ok: true, message: 'Data siswa berhasil dihapus.' };
      }
      return { ok: false, message: `Gagal menghapus siswa: ${error.message}` };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Gagal menghapus data siswa.' };
    }
  }

  try {
    const token =
      sessionStorage.getItem('aqua_math_admin_token_v1') ||
      sessionStorage.getItem('aqua_admin_token') ||
      '';
    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await res.json();
    if (res.ok && result.ok) {
      return { ok: true, message: result.message };
    }
    return { ok: false, message: result.message || 'Gagal menghapus data siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Gagal terhubung ke server.' };
  }
}

/**
 * Registers permanent student account (Username + Password) via backend API & Supabase Auth.
 */
export async function registerStudentAccount(data: {
  accessCode: string;
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  characterId: CharacterId;
}): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  try {
    const res = await fetch('/api/student/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok && result.ok && result.profile) {
      return { ok: true, profile: result.profile, message: result.message };
    }
    return { ok: false, message: result.message || 'Gagal mendaftarkan akun siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Tidak dapat terhubung ke server pendaftaran.' };
  }
}

/**
 * Authenticates permanent student account (Username + Password) via Supabase Auth.
 */
export async function loginStudentAccount(
  username: string,
  password: string,
): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  try {
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await res.json();
    if (res.ok && result.ok && result.profile) {
      if (result.token) {
        sessionStorage.setItem('aqua_student_token', result.token);
      }
      return { ok: true, profile: result.profile, message: result.message };
    }
    return { ok: false, message: result.message || 'Username atau password salah.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Tidak dapat terhubung ke server login.' };
  }
}

/**
 * Resets student password from Teacher Dashboard via backend admin API.
 */
export async function resetStudentPasswordByTeacher(
  studentId: string,
  username: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const token = sessionStorage.getItem('aqua_admin_token') || '';
    const res = await fetch('/api/admin/reset-student-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ studentId, username, newPassword }),
    });
    const result = await res.json();
    if (res.ok && result.ok) {
      return { ok: true, message: result.message };
    }
    return { ok: false, message: result.message || 'Gagal mereset password siswa.' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Gagal menghubungi server reset password.' };
  }
}

/**
 * 1. registerStudentProfile()
 * Registers or retrieves student profile in Supabase student_profiles table.
 */
export async function registerStudentProfile(
  name: string,
  characterId: CharacterId,
): Promise<{ profile: StudentProfile | null; error?: string }> {
  const normName = normalizePlayerName(name);

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Try Supabase Anonymous Auth if available
      let authUserId: string | null = null;
      try {
        const { data: authData } = await supabase.auth.signInAnonymously();
        if (authData?.user) {
          authUserId = authData.user.id;
        }
      } catch {
        // Anonymous auth optional/disabled
      }

      // 2. Check if profile exists in Supabase by normalized_name
      const { data: existing, error: selectErr } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('normalized_name', normName)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!selectErr && existing) {
        // Re-use existing profile! Prevent duplicates!
        const updatedChar = characterId || existing.character_id || 'sinta';

        await supabase
          .from('student_profiles')
          .update({
            character_id: updatedChar,
            last_active_at: now,
            ...(authUserId ? { auth_user_id: authUserId } : {}),
          })
          .eq('id', existing.id);

        const profile: StudentProfile = {
          id: existing.id,
          name: existing.name || name,
          normalizedName: existing.normalized_name || normName,
          characterId: updatedChar as CharacterId,
          createdAt: existing.created_at || now,
          lastActiveAt: now,
          solo: existing.solo_data || createEmptyStudentProfile(existing.id, name, updatedChar as CharacterId).solo,
          championship:
            existing.championship_data ||
            createEmptyStudentProfile(existing.id, name, updatedChar as CharacterId).championship,
        };

        return { profile };
      }

      // 3. Create new student profile in Supabase
      const newId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const emptyProfile = createEmptyStudentProfile(newId, name, characterId);

      const { data: inserted, error: insertErr } = await supabase
        .from('student_profiles')
        .insert({
          id: newId,
          auth_user_id: authUserId,
          name: name,
          normalized_name: normName,
          character_id: characterId,
          created_at: emptyProfile.createdAt,
          last_active_at: emptyProfile.lastActiveAt,
          championship_data: null,
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        return { profile: emptyProfile };
      }
    } catch (e: any) {
      console.warn('Supabase registerStudentProfile network fallback:', e?.message);
    }
  }

  return { profile: null, error: 'Supabase offline atau kredensial belum terpasang' };
}

/**
 * 2. getStudentProfile()
 * Fetches latest student profile from Supabase.
 */
export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      normalizedName: data.normalized_name,
      characterId: data.character_id as CharacterId,
      createdAt: data.created_at,
      lastActiveAt: data.last_active_at,
      solo: data.solo_data || createEmptyStudentProfile(data.id, data.name, (data.character_id || 'sinta') as CharacterId).solo,
      championship: data.championship_data || createEmptyStudentProfile(data.id, data.name, (data.character_id || 'sinta') as CharacterId).championship,
    };
  } catch {
    return null;
  }
}

/**
 * 3. saveGameAttempt()
 * Invokes Supabase RPC save_game_attempt and handles offline queueing & double-submit prevention.
 */
export async function saveGameAttempt(
  params: SaveGameAttemptParams,
): Promise<SaveGameAttemptResult> {
  // Score formula: 10 points per correct answer (max 100 per location)
  const score = Math.min(100, Math.max(0, params.correctCount * 10));

  const key =
    params.idempotencyKey ||
    `att_${params.studentId}_${params.mode}_${params.locationId}_${params.correctCount}_${Math.floor(
      Date.now() / 5000,
    )}`;

  // Idempotency check: prevent duplicate submissions within 5 seconds
  if (processedKeysCache.has(key)) {
    return {
      success: true,
      score,
      syncedToSupabase: true,
      message: 'Percobaan telah tersimpan (Idempotent call)',
    };
  }

  processedKeysCache.add(key);
  setTimeout(() => processedKeysCache.delete(key), 10000);

  const pendingAttempt: PendingSyncAttempt = {
    ...params,
    idempotencyKey: key,
    timestamp: Date.now(),
    score,
  };

  if (!isSupabaseConfigured || !supabase) {
    queueAttemptLocally(pendingAttempt);
    return {
      success: true,
      score,
      syncedToSupabase: false,
      message: 'Hasil tersimpan lokal (Supabase belum terkonfigurasi/offline)',
    };
  }

  try {
    const p_mode = params.mode === 'championship' ? 'CHAMPIONSHIP' : 'SOLO';

    // Try primary RPC call: save_game_attempt
    const { data, error } = await supabase.rpc('save_game_attempt', {
      p_mode,
      p_level_number: params.levelNumber,
      p_location_id: params.locationId,
      p_correct_count: params.correctCount,
      p_wrong_count: params.wrongCount,
      p_duration_seconds: params.durationSeconds,
      p_session_id: params.sessionId || null,
      p_student_id: params.studentId,
    });

    if (!error) {
      return {
        success: true,
        score,
        syncedToSupabase: true,
        message: 'Skor berhasil tersimpan di database Supabase!',
        attemptId: typeof data === 'string' ? data : undefined,
      };
    }

    console.warn('save_game_attempt RPC call returned error, trying table direct fallback:', error.message);

    // Fallback: direct table insert to game_attempts if RPC function not defined in Supabase
    const { data: directInsert, error: directErr } = await supabase
      .from('game_attempts')
      .insert({
        idempotency_key: key,
        student_id: params.studentId,
        mode: params.mode,
        championship_session_id: params.sessionId || null,
        level_number: params.levelNumber,
        location_id: params.locationId,
        correct_count: params.correctCount,
        wrong_count: params.wrongCount,
        score,
        duration_seconds: params.durationSeconds,
      })
      .select()
      .single();

    if (!directErr && directInsert) {
      return {
        success: true,
        score,
        syncedToSupabase: true,
        message: 'Skor berhasil tersimpan di tabel game_attempts Supabase!',
        attemptId: directInsert.id,
      };
    }

    // Queue for later sync if network or database RPC fails
    queueAttemptLocally(pendingAttempt);
    return {
      success: true,
      score,
      syncedToSupabase: false,
      message: `Tersimpan secara lokal. Sinkronisasi Supabase ditunda: ${directErr?.message || error.message}`,
    };
  } catch (e: any) {
    queueAttemptLocally(pendingAttempt);
    return {
      success: true,
      score,
      syncedToSupabase: false,
      message: `Tersimpan secara lokal (Jaringan terputus: ${e?.message || 'Offline'})`,
    };
  }
}

/**
 * 4. getStudentProgress()
 * Retrieves full level & location completion status for a given student.
 */
export async function getStudentProgress(studentId: string): Promise<{
  unlockedLevelSolo: number;
  unlockedLevelChampionship: number;
  completedLocationsSolo: number[];
  completedLocationsChampionship: number[];
} | null> {
  const profile = await getStudentProfile(studentId);
  if (!profile) return null;

  const completedSoloLocs = Object.keys(profile.solo.locations)
    .map(Number)
    .filter((locId) => profile.solo.locations[locId]?.completed);

  const completedChampLocs = Object.keys(profile.championship.locations)
    .map(Number)
    .filter((locId) => profile.championship.locations[locId]?.completed);

  return {
    unlockedLevelSolo: profile.solo.unlockedLevel,
    unlockedLevelChampionship: profile.championship.unlockedLevel,
    completedLocationsSolo: completedSoloLocs,
    completedLocationsChampionship: completedChampLocs,
  };
}

/**
 * 5. getSoloBestScore()
 * Calculates the highest score in Solo Adventure mode across all or specific locations.
 */
export async function getSoloBestScore(
  studentId: string,
  locationId?: number,
): Promise<number> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('game_attempts')
        .select('score')
        .eq('student_id', studentId)
        .eq('mode', 'solo');

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return Math.max(...data.map((row) => row.score || 0));
      }
    } catch {
      // Fallback
    }
  }

  const profile = await getStudentProfile(studentId);
  if (!profile) return 0;

  if (locationId) {
    return profile.solo.locations[locationId]?.bestScore || 0;
  }
  return profile.solo.bestTotalScore;
}

/**
 * 6. getSoloLatestScore()
 * Calculates the latest score in Solo Adventure mode.
 */
export async function getSoloLatestScore(
  studentId: string,
  locationId?: number,
): Promise<number> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('game_attempts')
        .select('score')
        .eq('student_id', studentId)
        .eq('mode', 'solo')
        .order('completed_at', { ascending: false })
        .limit(1);

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data[0].score || 0;
      }
    } catch {
      // Fallback
    }
  }

  const profile = await getStudentProfile(studentId);
  if (!profile) return 0;

  if (locationId) {
    return profile.solo.locations[locationId]?.latestScore || 0;
  }
  return profile.solo.latestTotalScore;
}

/**
 * 7. getChampionshipScore()
 * Calculates official championship score for a student.
 */
export async function getChampionshipScore(
  studentId: string,
  sessionId?: string,
): Promise<number> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('championship_participants')
        .select('official_score')
        .eq('student_id', studentId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data[0].official_score || 0;
      }
    } catch {
      // Fallback
    }
  }

  const profile = await getStudentProfile(studentId);
  return profile?.championship.totalChampionshipScore || 0;
}

/**
 * 8. getTeacherDashboardData()
 * Fetches real aggregate data for the Teacher Dashboard from Supabase.
 */
export async function getTeacherDashboardData(): Promise<{
  students: StudentProfile[];
  totalAttemptsCount: number;
  classSettings: any | null;
  supabaseConnected: boolean;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      students: [],
      totalAttemptsCount: 0,
      classSettings: null,
      supabaseConnected: false,
    };
  }

  try {
    const [studentsRes, attemptsRes, settingsRes] = await Promise.all([
      supabase.from('student_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('game_attempts').select('id', { count: 'exact', head: true }),
      supabase.from('class_settings').select('*').eq('id', 'default_class').maybeSingle(),
    ]);

    const students: StudentProfile[] = (studentsRes.data || []).map((data) => ({
      id: data.id,
      name: data.name,
      normalizedName: data.normalized_name,
      characterId: data.character_id as CharacterId,
      createdAt: data.created_at,
      lastActiveAt: data.last_active_at,
      solo: data.solo_data || createEmptyStudentProfile(data.id, data.name, (data.character_id || 'sinta') as CharacterId).solo,
      championship: data.championship_data || createEmptyStudentProfile(data.id, data.name, (data.character_id || 'sinta') as CharacterId).championship,
    }));

    return {
      students,
      totalAttemptsCount: attemptsRes.count || 0,
      classSettings: settingsRes.data || null,
      supabaseConnected: true,
    };
  } catch (e) {
    return {
      students: [],
      totalAttemptsCount: 0,
      classSettings: null,
      supabaseConnected: false,
    };
  }
}

/**
 * 9. requestTeacherPasswordReset(email)
 * Sends password recovery email via Supabase Auth with redirectTo set to https://aqua-adventure-nine.vercel.app
 * Never uses Local Demo Mode.
 */
export async function requestTeacherPasswordReset(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanedEmail = (email || '').trim().toLowerCase();
  if (!cleanedEmail || !cleanedEmail.includes('@')) {
    return {
      ok: false,
      message: 'Masukkan alamat email guru yang valid (contoh: nama@email.com).',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: 'Koneksi Supabase belum aktif. Tidak dapat mengirim email pemulihan password.',
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo: 'https://aqua-adventure-nine.vercel.app',
    });

    if (error) {
      return {
        ok: false,
        message: `Gagal mengirim tautan pemulihan password: ${error.message}`,
      };
    }

    return {
      ok: true,
      message:
        'Tautan pemulihan password telah dikirim ke email Anda! Silakan periksa kotak masuk (atau folder Spam) dan klik tautan tersebut untuk mengatur password baru.',
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Terjadi kesalahan jaringan saat mengirim tautan pemulihan password.',
    };
  }
}

export interface VerifiedRecoveryIdentity {
  ok: boolean;
  userId?: string;
  email?: string;
  displayName?: string;
  message?: string;
}

/**
 * Helper: Validates whether a Supabase Auth user object represents a real, non-anonymous teacher account with a valid email.
 */
export function isVerifiedTeacherAuthUser(user: any): boolean {
  if (!user || typeof user.id !== 'string' || !user.id.trim()) return false;
  if (user.is_anonymous === true) return false;
  if (user.app_metadata?.provider === 'anonymous') return false;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (!email || !email.includes('@')) return false;
  return true;
}

/**
 * 10. verifyTeacherRecoverySession()
 * Processes recovery tokens/codes from URL if present, then calls supabase.auth.getUser()
 * to strictly verify that the active session belongs to a valid non-anonymous email account.
 */
export async function verifyTeacherRecoverySession(): Promise<VerifiedRecoveryIdentity> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: 'Koneksi Supabase belum aktif. Tidak dapat memverifikasi sesi pemulihan password.',
    };
  }

  try {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      // 1. Handle PKCE code exchange if present in query string
      if (code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (codeErr) {
          return {
            ok: false,
            message: `Tautan pemulihan tidak valid atau sudah kedaluwarsa (${codeErr.message}). Silakan kirim ulang permintaan reset password.`,
          };
        }
      } else if (tokenHash && type === 'recovery') {
        // 2. Handle token_hash OTP recovery if present in query string
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        if (otpErr) {
          return {
            ok: false,
            message: `Token pemulihan tidak valid atau sudah kedaluwarsa (${otpErr.message}). Silakan kirim ulang permintaan reset password.`,
          };
        }
      } else if (window.location.hash && window.location.hash.includes('access_token=')) {
        // 3. Handle explicit hash fragment (#access_token=...&refresh_token=...&type=recovery)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: setSessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessErr) {
            return {
              ok: false,
              message: `Sesi tautan pemulihan tidak valid atau sudah kedaluwarsa (${setSessErr.message}). Silakan kirim ulang permintaan reset password.`,
            };
          }
        }
      }
    }

    // 4. Strictly verify active user identity directly from Supabase Auth server via getUser()
    const { data: userData, error: userErr } = await supabase.auth.getUser();

    if (userErr || !userData?.user) {
      return {
        ok: false,
        message:
          'Sesi pemulihan password tidak ditemukan atau sudah kedaluwarsa. Silakan minta tautan pemulihan baru melalui menu Lupa Password.',
      };
    }

    const user = userData.user;

    if (!isVerifiedTeacherAuthUser(user)) {
      return {
        ok: false,
        message:
          'Sesi aktif saat ini adalah sesi anonim atau tidak memiliki email guru yang valid. Pembaruan password ditolak demi keamanan akun.',
      };
    }

    return {
      ok: true,
      userId: user.id,
      email: user.email!.trim().toLowerCase(),
      displayName:
        user.user_metadata?.name ||
        user.user_metadata?.display_name ||
        user.email!.split('@')[0],
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Gagal memverifikasi identitas sesi pemulihan password.',
    };
  }
}

/**
 * 11. updateTeacherNewPassword(newPassword, expectedEmail, expectedUserId)
 * Updates the authenticated teacher user's password via Supabase Auth during PASSWORD_RECOVERY.
 * Strictly verifies user identity before and after updateUser, never trims password,
 * syncs teacher_profiles without duplicates, and preserves the valid Supabase session.
 */
export async function updateTeacherNewPassword(
  newPassword: string,
  expectedEmail?: string,
  expectedUserId?: string,
): Promise<{
  ok: boolean;
  message: string;
  email?: string;
  userId?: string;
  teacherName?: string;
  sessionToken?: string;
  profileSyncWarning?: string;
}> {
  // IMPORTANT: Never use trim() on password. Process exact user input.
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return {
      ok: false,
      message: 'Password baru minimal harus terdiri dari 6 karakter.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: 'Koneksi Supabase belum aktif. Tidak dapat memperbarui password.',
    };
  }

  try {
    // 1. Re-verify active session identity via getUser() right before updating password
    const { data: preCheckData, error: preCheckErr } = await supabase.auth.getUser();
    if (preCheckErr || !preCheckData?.user) {
      return {
        ok: false,
        message:
          'Sesi pemulihan password tidak valid atau telah berakhir. Silakan kirim ulang tautan pemulihan password.',
      };
    }

    const preUser = preCheckData.user;
    if (!isVerifiedTeacherAuthUser(preUser)) {
      return {
        ok: false,
        message:
          'Identitas sesi tidak valid atau merupakan akun anonim. Tidak diizinkan memperbarui password.',
      };
    }

    const preEmail = preUser.email!.trim().toLowerCase();
    if (expectedEmail && preEmail !== expectedEmail.trim().toLowerCase()) {
      return {
        ok: false,
        message: `Konflik identitas sesi: Sesi aktif (${preEmail}) tidak cocok dengan akun yang sedang dipulihkan (${expectedEmail}).`,
      };
    }

    if (expectedUserId && preUser.id !== expectedUserId) {
      return {
        ok: false,
        message: 'Konflik ID sesi pengguna. Silakan buka kembali tautan pemulihan dari email Anda.',
      };
    }

    // 2. Update password in Supabase Auth with exact password string (no trim)
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        ok: false,
        message: `Gagal memperbarui password: ${error.message}`,
      };
    }

    const updatedUser = data?.user;
    if (!updatedUser || !isVerifiedTeacherAuthUser(updatedUser)) {
      return {
        ok: false,
        message:
          'Respons pembaruan password tidak mengembalikan identitas akun guru yang valid.',
      };
    }

    const updatedEmail = updatedUser.email!.trim().toLowerCase();
    if (updatedUser.id !== preUser.id || updatedEmail !== preEmail) {
      return {
        ok: false,
        message:
          'Peringatan keamanan: Identitas akun setelah update tidak sesuai dengan identitas yang diverifikasi.',
      };
    }

    // 3. Synchronize teacher_profiles by auth_user_id without creating duplicates
    const now = new Date().toISOString();
    let resolvedTeacherName =
      updatedUser.user_metadata?.name ||
      updatedUser.user_metadata?.display_name ||
      updatedEmail.split('@')[0];
    let profileSyncWarning: string | undefined;

    const { data: existingProfile, error: selectErr } = await supabase
      .from('teacher_profiles')
      .select('id, auth_user_id, display_name, role, created_at')
      .eq('auth_user_id', updatedUser.id)
      .maybeSingle();

    if (selectErr) {
      profileSyncWarning = `Catatan profil: Gagal memeriksa teacher_profiles (${selectErr.message}).`;
    } else if (existingProfile) {
      resolvedTeacherName = existingProfile.display_name || resolvedTeacherName;
    } else {
      const newProfilePayload = {
        id: `tch_${updatedUser.id}`,
        auth_user_id: updatedUser.id,
        display_name: resolvedTeacherName,
        role: 'teacher',
        created_at: updatedUser.created_at || now,
      };

      const { data: insertedProfile, error: insertErr } = await supabase
        .from('teacher_profiles')
        .upsert(newProfilePayload, { onConflict: 'id' })
        .select('id, auth_user_id, display_name, role, created_at')
        .maybeSingle();

      if (insertErr) {
        profileSyncWarning = `Password berhasil diperbarui, namun sinkronisasi profil teacher_profiles mengalami kendala: ${insertErr.message}`;
      } else if (insertedProfile?.display_name) {
        resolvedTeacherName = insertedProfile.display_name;
      }
    }

    // 4. Preserve valid Supabase session token
    const { data: sessionData } = await supabase.auth.getSession();
    const activeToken =
      sessionData?.session?.access_token || `sb_tch_${updatedUser.id}`;

    try {
      sessionStorage.setItem('aqua_math_admin_token_v1', activeToken);
    } catch {
      // ignore storage quota errors
    }

    return {
      ok: true,
      userId: updatedUser.id,
      email: updatedEmail,
      teacherName: resolvedTeacherName,
      sessionToken: activeToken,
      profileSyncWarning,
      message: `Password untuk akun ${updatedEmail} berhasil diperbarui! Membuka Dashboard Guru...`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Terjadi kesalahan saat menyimpan password baru.',
    };
  }
}


