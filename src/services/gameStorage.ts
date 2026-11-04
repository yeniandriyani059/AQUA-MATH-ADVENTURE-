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
  // 1. Nabila Putri (Sinta - Hijab) - High performer in both modes
  let s1 = createEmptyStudentProfile('stu_demo_1', 'Nabila Putri', 'sinta', '2026-11-01T08:00:00.000Z');
  s1 = applyMissionResultToProfile(s1, 'solo', 1, buildHelperAnswers(1, 10), 58).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'solo', 2, buildHelperAnswers(2, 9), 64).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'solo', 3, buildHelperAnswers(3, 9), 70).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'solo', 4, buildHelperAnswers(4, 8), 75).updatedProfile;

  s1 = applyMissionResultToProfile(s1, 'championship', 1, buildHelperAnswers(1, 10), 54).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'championship', 2, buildHelperAnswers(2, 10), 60).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'championship', 3, buildHelperAnswers(3, 9), 68).updatedProfile;
  s1 = applyMissionResultToProfile(s1, 'championship', 4, buildHelperAnswers(4, 9), 72).updatedProfile;

  // 2. Dimas Aditya (Bima) - Active explorer
  let s2 = createEmptyStudentProfile('stu_demo_2', 'Dimas Aditya', 'bima', '2026-11-01T08:05:00.000Z');
  s2 = applyMissionResultToProfile(s2, 'solo', 1, buildHelperAnswers(1, 9), 62).updatedProfile;
  s2 = applyMissionResultToProfile(s2, 'solo', 2, buildHelperAnswers(2, 8), 66).updatedProfile;

  s2 = applyMissionResultToProfile(s2, 'championship', 1, buildHelperAnswers(1, 9), 59).updatedProfile;
  s2 = applyMissionResultToProfile(s2, 'championship', 2, buildHelperAnswers(2, 9), 63).updatedProfile;
  s2 = applyMissionResultToProfile(s2, 'championship', 3, buildHelperAnswers(3, 8), 74).updatedProfile;

  // 3. Meylani Sari (Kirana) - Level 1 completed
  let s3 = createEmptyStudentProfile('stu_demo_3', 'Meylani Sari', 'kirana', '2026-11-01T08:10:00.000Z');
  s3 = applyMissionResultToProfile(s3, 'solo', 1, buildHelperAnswers(1, 8), 70).updatedProfile;
  s3 = applyMissionResultToProfile(s3, 'solo', 2, buildHelperAnswers(2, 8), 72).updatedProfile;

  s3 = applyMissionResultToProfile(s3, 'championship', 1, buildHelperAnswers(1, 10), 50).updatedProfile;
  s3 = applyMissionResultToProfile(s3, 'championship', 2, buildHelperAnswers(2, 8), 68).updatedProfile;

  return [s1, s2, s3];
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
  if (isSupabaseConfigured && supabase) {
    supabase
      .from('class_settings')
      .upsert({
        id: 'default_class',
        access_code: updated.accessCode,
        access_code_active: updated.accessCodeActive,
        solo_adventure_open: updated.soloAdventureOpen,
        championship_open: updated.championshipOpen,
        championship_session_name: updated.championshipSessionName,
        teacher_name: updated.teacherName,
        class_name: updated.className,
        updated_at: updated.updatedAt,
      })
      .then(() => {});
  }
  return updated;
}

export function loadStudents(): StudentProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      const seed = createSeedStudents();
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return createSeedStudents();
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
    `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
  const idx = students.findIndex((s) => s.id === studentId);
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

  if (isSupabaseConfigured && supabase) {
    supabase
      .from('student_profiles')
      .upsert({
        id: updatedProfile.id,
        name: updatedProfile.name,
        normalized_name: updatedProfile.normalizedName,
        character_id: updatedProfile.characterId,
        solo_data: updatedProfile.solo,
        championship_data: updatedProfile.championship,
        last_active_at: updatedProfile.lastActiveAt,
      })
      .then(() => {});
  }

  return {
    updatedStudent: updatedProfile,
    allStudents: students,
    summary,
  };
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
  const students = createSeedStudents();
  saveStudents(students);
  return { settings, students };
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
 * Authenticates Teacher Admin via server-side /api/admin/login endpoint.
 * Never exposes plaintext password in frontend code.
 */
export async function loginTeacherAdmin(
  username: string,
  password: string,
): Promise<{ ok: boolean; message?: string; teacherName?: string }> {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.token) {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.token);
        return { ok: true, teacherName: data.teacherName || 'Guru Kelas 2' };
      }
    }
    const errData = await response.json().catch(() => ({}));
    return { ok: false, message: errData.message || 'Username atau password guru tidak sesuai.' };
  } catch {
    return {
      ok: false,
      message: 'Gagal menghubungi server autentikasi guru. Pastikan server aktif.',
    };
  }
}

export function isTeacherAdminLoggedIn(): boolean {
  try {
    return Boolean(sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN));
  } catch {
    return false;
  }
}

export function logoutTeacherAdmin(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  } catch {
    // ignore
  }
}
