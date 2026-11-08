import { verifyTeacherSession } from './teacherSession';
import {
  applyMissionResultToProfile,
  createEmptyStudentProfile,
  normalizePlayerName,
} from '../game/rules';
import { getQuestionsByLocation } from '../data/questions';
import {
  CharacterId,
  ClassSettings,
  GameMode,
  MissionResultSummary,
  OptionLetter,
  StudentProfile,
} from '../types/game';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import {
  generateStudentUuid,
  isValidUuid,
  mapCharacterIdToDbCharacter,
  registerStudentProfile,
  saveGameAttempt,
} from './supabaseService';

const STORAGE_KEYS = {
  SETTINGS: 'aqua_math_class_settings_v1',
  STUDENTS: 'aqua_math_students_v1',
  ACTIVE_STUDENT_ID: 'aqua_math_active_student_id_v1',
  ACTIVE_MODE: 'aqua_math_active_mode_v1',
  ADMIN_TOKEN: 'aqua_math_admin_token_v1',
};

export const DEFAULT_CLASS_SETTINGS: ClassSettings = {
  accessCode: 'AQUA2026',
  accessCodeActive: true,
  soloAdventureOpen: true,
  championshipOpen: true,
  championshipSessionName: 'Turnamen Penyelamat Air Aqua City',
  teacherName: 'Guru Pembimbing Aqua City',
  className: 'Kelas Petualang Aqua City',
  updatedAt: new Date().toISOString(),
};

function buildHelperAnswers(locationId: number, targetCorrectCount: number): Record<string, OptionLetter> {
  const questions = getQuestionsByLocation(locationId);
  const answers: Record<string, OptionLetter> = {};
  questions.forEach((q, idx) => {
    if (idx < targetCorrectCount) {
      answers[q.id] = q.correctOption;
    } else {
      answers[q.id] = q.correctOption === 'A' ? 'B' : 'A';
    }
  });
  return answers;
}

export function createSeedStudents(): StudentProfile[] {
  return [];
}

export function loadClassSettings(): ClassSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_CLASS_SETTINGS));
      return DEFAULT_CLASS_SETTINGS;
    }
    const parsed = { ...DEFAULT_CLASS_SETTINGS, ...JSON.parse(raw) };
    if (/Kelas\s*2/i.test(parsed.className)) {
      parsed.className = DEFAULT_CLASS_SETTINGS.className;
    }
    if (/Kelas\s*2/i.test(parsed.teacherName)) {
      parsed.teacherName = DEFAULT_CLASS_SETTINGS.teacherName;
    }
    if (/Kelas\s*2/i.test(parsed.championshipSessionName)) {
      parsed.championshipSessionName = DEFAULT_CLASS_SETTINGS.championshipSessionName;
    }
    return parsed;
  } catch {
    return DEFAULT_CLASS_SETTINGS;
  }
}

export function saveClassSettings(next: ClassSettings): ClassSettings {
  const updated = { ...next, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
  return updated;
}

export function loadStudents(): StudentProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out legacy dummy / seed records
    const cleaned = parsed.filter((s) => {
      if (!s || !s.name) return false;
      if (typeof s.id === 'string' && s.id.startsWith('stu_demo')) return false;
      const lower = String(s.name).trim().toLowerCase();
      if (['nabila putri', 'dimas aditya', 'meylani sari', 'yennia', 'yennie'].includes(lower)) return false;
      return true;
    });

    if (cleaned.length !== parsed.length) {
      saveStudents(cleaned);
    }

    return cleaned;
  } catch {
    return [];
  }
}

export function saveStudents(students: StudentProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  } catch {
    // ignore
  }
}

export function findStudentByName(name: string, students = loadStudents()): StudentProfile | undefined {
  const norm = normalizePlayerName(name);
  return students.find((s) => s.normalizedName === norm);
}

export function upsertStudentInLocalStorage(profile: StudentProfile): StudentProfile[] {
  const students = loadStudents();
  const idx = students.findIndex(
    (s) =>
      s.id === profile.id ||
      (profile.authUserId && s.authUserId === profile.authUserId) ||
      (profile.username && s.username === profile.username) ||
      s.normalizedName === profile.normalizedName,
  );
  let nextList: StudentProfile[];
  if (idx >= 0) {
    nextList = [...students];
    nextList[idx] = {
      ...nextList[idx],
      ...profile,
      lastActiveAt: new Date().toISOString(),
    };
  } else {
    nextList = [...students, { ...profile, lastActiveAt: new Date().toISOString() }];
  }
  saveStudents(nextList);
  setActiveStudentId(profile.id);
  return nextList;
}

export function registerOrUpdateStudent(
  name: string,
  characterId: CharacterId,
): { student: StudentProfile; allStudents: StudentProfile[]; isExisting: boolean } {
  const students = loadStudents();
  const existing = findStudentByName(name, students);
  if (existing) {
    existing.characterId = characterId;
    existing.lastActiveAt = new Date().toISOString();
    saveStudents(students);
    setActiveStudentId(existing.id);
    return { student: existing, allStudents: students, isExisting: true };
  }

  const newProfile = createEmptyStudentProfile(
    generateStudentUuid(),
    name,
    characterId,
  );
  const nextList = [...students, newProfile];
  saveStudents(nextList);
  setActiveStudentId(newProfile.id);
  return { student: newProfile, allStudents: nextList, isExisting: false };
}

export function recordMissionCompletion(
  studentId: string,
  mode: GameMode,
  locationId: number,
  selectedAnswers: Record<string, OptionLetter>,
  timeSpentSeconds: number,
): {
  updatedStudent: StudentProfile;
  allStudents: StudentProfile[];
  summary: MissionResultSummary;
} {
  const students = loadStudents();
  const idx = students.findIndex(
    (s) => s.id === studentId || (s.authUserId && s.authUserId === studentId),
  );
  if (idx === -1) {
    throw new Error('Profil siswa tidak ditemukan.');
  }

  const { updatedProfile, summary } = applyMissionResultToProfile(
    students[idx],
    mode,
    locationId,
    selectedAnswers,
    timeSpentSeconds,
  );

  students[idx] = updatedProfile;
  saveStudents(students);

  return {
    updatedStudent: updatedProfile,
    allStudents: students,
    summary,
  };
}

export async function recordMissionCompletionAsync(
  studentId: string,
  mode: GameMode,
  locationId: number,
  selectedAnswers: Record<string, OptionLetter>,
  timeSpentSeconds: number,
): Promise<{
  updatedStudent: StudentProfile;
  allStudents: StudentProfile[];
  summary: MissionResultSummary;
}> {
  const result = recordMissionCompletion(
    studentId,
    mode,
    locationId,
    selectedAnswers,
    timeSpentSeconds,
  );

  const levelNumber = Math.ceil(locationId / 2);

  try {
    const saveRes = await saveGameAttempt({
      studentId: result.updatedStudent.id,
      authUserId: result.updatedStudent.authUserId || undefined,
      mode,
      levelNumber,
      locationId,
      correctCount: result.summary.correctCount,
      wrongCount: result.summary.wrongCount,
      durationSeconds: timeSpentSeconds,
    });
    result.summary.syncedToSupabase = saveRes.syncedToSupabase;
    result.summary.syncStatusMessage = saveRes.message;

    if (saveRes.updatedProfile) {
      const nextStudents = upsertStudentInLocalStorage(saveRes.updatedProfile);
      result.updatedStudent = saveRes.updatedProfile;
      result.allStudents = nextStudents;
    }
  } catch {
    result.summary.syncedToSupabase = false;
    result.summary.syncStatusMessage = 'Tersimpan lokal (Penundaan jaringan)';
  }

  return result;
}

export function deleteStudentProfile(studentId: string): StudentProfile[] {
  const next = loadStudents().filter((s) => s.id !== studentId);
  saveStudents(next);
  return next;
}

export function resetAllChampionshipScores(): StudentProfile[] {
  const next = loadStudents().map((s) => ({
    ...s,
    championship: {
      locations: {},
      totalChampionshipScore: 0,
      academicGrade: 0,
      totalTimeSeconds: 0,
      unlockedLevel: 1,
      completedLevels: [],
    },
  }));
  saveStudents(next);
  return next;
}

export function resetToDemoSeedData(): { settings: ClassSettings; students: StudentProfile[] } {
  const settings = saveClassSettings(DEFAULT_CLASS_SETTINGS);
  saveStudents([]);
  return { settings, students: [] };
}

export function setActiveStudentId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_STUDENT_ID, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_STUDENT_ID);
  } catch {
    // ignore
  }
}

export function getActiveStudentId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_STUDENT_ID);
  } catch {
    return null;
  }
}

export function setActiveGameMode(mode: GameMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MODE, mode);
  } catch {
    // ignore
  }
}

export function getActiveGameMode(): GameMode {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.ACTIVE_MODE);
    return val === 'championship' ? 'championship' : 'solo';
  } catch {
    return 'solo';
  }
}

/**
 * Authenticates Teacher Admin directly via Supabase Auth (signInWithPassword)
 * and verifies authorization with the backend.
 * Requires the authorized backend verification endpoint.
 */
export async function loginTeacherAdmin(
  usernameOrEmail: string,
  password: string,
): Promise<{ ok: boolean; message?: string; teacherName?: string }> {
  const rawInput = (usernameOrEmail || '').trim().toLowerCase();
  if (!rawInput || typeof password !== 'string' || password.length === 0) {
    return { ok: false, message: 'Email/Username dan password guru wajib diisi.' };
  }

  const isEmailInput = rawInput.includes('@');
  const normUser = isEmailInput ? rawInput : rawInput.replace(/[^a-z0-9_]/g, '');
  const candidateEmails = isEmailInput
    ? [rawInput]
    : [`tch_${normUser}@aquamath.org`, `${normUser}@aquamath.org`];

  // Primary Path: Direct Supabase Authentication (Works on Vercel Production & Local)
  if (isSupabaseConfigured && supabase) {
    let lastAuthError = '';

    for (const emailToTry of candidateEmails) {
      try {
        // IMPORTANT: Do not trim or modify password; pass exact user input.
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: emailToTry,
          password: password,
        });

        if (!authErr && authData?.user) {
          const authUser = authData.user;

          // Verify user identity before querying teacher_profiles
          if (
            !authUser.id ||
            authUser.is_anonymous === true ||
            authUser.app_metadata?.provider === 'anonymous' ||
            !authUser.email
          ) {
            await supabase.auth.signOut().catch(() => {});
            return {
              ok: false,
              message: 'Identitas akun tidak valid atau merupakan sesi anonim.',
            };
          }

          if (authUser.email.trim().toLowerCase() !== emailToTry.trim().toLowerCase()) {
            await supabase.auth.signOut().catch(() => {});
            return {
              ok: false,
              message: 'Identitas email sesi tidak sesuai dengan email yang digunakan untuk login.',
            };
          }

          const verified = await verifyTeacherSession(authUser.id);
          if (!verified) {
            return { ok: false, message: 'Sesi guru atau kewenangan backend belum dapat diverifikasi.' };
          }
          const resolvedTeacherName = verified.teacherName || 'Ibu/Bapak Guru';

          return {
            ok: true,
            teacherName: resolvedTeacherName,
            message: `Selamat datang kembali, ${resolvedTeacherName}!`,
          };
        }

        if (authErr) {
          lastAuthError = authErr.message;
        }
      } catch (err: any) {
        lastAuthError = err?.message || 'Kesalahan jaringan ke Supabase Auth.';
      }
    }

    return {
      ok: false,
      message: `Login gagal: ${
        lastAuthError === 'Invalid login credentials'
          ? 'Email atau password salah. Pastikan Anda memasukkan alamat email lengkap yang terdaftar di Supabase (contoh: nama@gmail.com) beserta password yang benar.'
          : lastAuthError || 'Kredensial tidak valid.'
      }`,
    };
  }

  return {
    ok: false,
    message: 'Konfigurasi Supabase belum aktif. Tidak dapat melakukan autentikasi guru.',
  };
}

export async function registerTeacherAdmin(data: {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; message?: string; teacherName?: string }> {
  return { ok: false, message: 'Pendaftaran guru memerlukan pemberian kewenangan oleh pengelola.' };
}

export async function isTeacherAdminLoggedIn(): Promise<boolean> {
  return Boolean(await verifyTeacherSession());
}

export function logoutTeacherAdmin(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }
}


