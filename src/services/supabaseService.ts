import { readStudentChampionship, changeTeacherChampionship } from './championshipSessions';
import { readResultRows } from './authoritativeResults';
import { parseGameMode, validSessionId } from './championshipContract';
import { createAttemptSync } from './attemptSync';
import { getTeacherAccessToken } from './teacherSession';
import {
  createEphemeralSupabaseClient,
  createStudentRequestClient,
  isSupabaseConfigured,
  studentSupabase,
  supabase,
} from './supabaseClient';
import {
  ChampionshipLocationRecord,
  CharacterId,
  GameMode,
  SoloLocationProgress,
  StudentProfile,
} from '../types/game';
import {
  calculateAdventureAcademicGrade,
  calculateMedal,
  computeLevelUnlockState,
  createEmptyStudentProfile,
  normalizePlayerName,
} from '../game/rules';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STUDENT_INTERNAL_EMAIL_DOMAIN = 'student.aquamath.id';

export interface OfficialStudentAccountSpec {
  no: number;
  displayName: string;
  username: string;
  defaultPassword: string;
  character: 'BIMA' | 'SINTA';
  characterId: CharacterId;
  authUserId: string;
}

/**
 * Daftar Resmi 14 Akun Siswa Kelas 5 AQUA MATH ADVENTURE.
 * Setiap akun telah terdaftar di Supabase Auth (auth.users) dengan UUID asli di bawah ini.
 */
export const OFFICIAL_14_STUDENTS: OfficialStudentAccountSpec[] = [
  {
    no: 1,
    displayName: 'Afina Felisia Putri',
    username: 'afina01',
    defaultPassword: 'Aqua@2601',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: 'cae44b10-9331-4e44-bc28-7e737a62a49c',
  },
  {
    no: 2,
    displayName: 'Afiz El Haddadi',
    username: 'afiz02',
    defaultPassword: 'Aqua@2602',
    character: 'BIMA',
    characterId: 'bima',
    authUserId: 'be935b72-73a2-4429-955e-965168bed5ce',
  },
  {
    no: 3,
    displayName: 'ARJUNA SURYA WIKRAMA',
    username: 'arjuna03',
    defaultPassword: 'Aqua@2603',
    character: 'BIMA',
    characterId: 'bima',
    authUserId: 'f8e45914-dd24-45df-aed7-dcf34be05912',
  },
  {
    no: 4,
    displayName: 'DINDA ISMAWATI',
    username: 'dinda04',
    defaultPassword: 'Aqua@2604',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: '77b1cd3d-af92-45c8-b709-cb66ab6a9bbf',
  },
  {
    no: 5,
    displayName: 'Faniya Nur Hafisah',
    username: 'faniya05',
    defaultPassword: 'Aqua@2605',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: '570ba376-4134-4845-847f-e408ea786d81',
  },
  {
    no: 6,
    displayName: 'Gista Novita Nur Amaliana',
    username: 'gista06',
    defaultPassword: 'Aqua@2606',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: 'f1052608-bcf9-4071-9c01-89800c55273f',
  },
  {
    no: 7,
    displayName: 'HANAFI MUSLIMAH',
    username: 'hanafi07',
    defaultPassword: 'Aqua@2607',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: 'a669b5c4-62c2-4441-8f8b-484e2d85323a',
  },
  {
    no: 8,
    displayName: 'Muhammad Fiqri',
    username: 'fiqri08',
    defaultPassword: 'Aqua@2608',
    character: 'BIMA',
    characterId: 'bima',
    authUserId: 'd305d926-0db6-428c-ac50-315a0dd1c940',
  },
  {
    no: 9,
    displayName: 'PUTRI DWI SEPTIANI',
    username: 'putri09',
    defaultPassword: 'Aqua@2609',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: '3812cbe6-4d83-40f5-aa60-02be3c175a37',
  },
  {
    no: 10,
    displayName: 'Revan Safi Saputra',
    username: 'revan10',
    defaultPassword: 'Aqua@2610',
    character: 'BIMA',
    characterId: 'bima',
    authUserId: '05ca3caa-4f22-4514-80db-fff5edcc3861',
  },
  {
    no: 11,
    displayName: 'Saskia Aprilianti',
    username: 'saskia11',
    defaultPassword: 'Aqua@2611',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: '47efc5df-09b3-4362-837b-7b41223d0fb2',
  },
  {
    no: 12,
    displayName: 'SHAREEFA JEHAN AMIRA',
    username: 'shareefa12',
    defaultPassword: 'Aqua@2612',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: 'b3ad69ad-b592-405e-ae79-abea8cde7be0',
  },
  {
    no: 13,
    displayName: 'Suci Mulia Sari',
    username: 'suci13',
    defaultPassword: 'Aqua@2613',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: 'b063ade8-5267-4c36-88fb-5b485f54c228',
  },
  {
    no: 14,
    displayName: 'Tiwi Safitri',
    username: 'tiwi14',
    defaultPassword: 'Aqua@2614',
    character: 'SINTA',
    characterId: 'sinta',
    authUserId: '261109d3-2fa2-4cb1-94f1-953c540738a5',
  },
];

/**
 * Normalizes a student username (lowercase alphanumeric + underscore) and converts it
 * to the internal email format: <username>@student.aquamath.id
 */
export function normalizeStudentUsername(rawUsername: string): string {
  const cleaned = String(rawUsername || '')
    .trim()
    .toLowerCase();
  if (cleaned.endsWith(`@${STUDENT_INTERNAL_EMAIL_DOMAIN}`)) {
    return cleaned
      .slice(0, -(STUDENT_INTERNAL_EMAIL_DOMAIN.length + 1))
      .replace(/[^a-z0-9_]/g, '');
  }
  return cleaned.replace(/[^a-z0-9_]/g, '');
}

export function studentUsernameToInternalEmail(username: string): string {
  const norm = normalizeStudentUsername(username);
  return `${norm}@${STUDENT_INTERNAL_EMAIL_DOMAIN}`;
}

export function findOfficialStudentSpec(
  query: {
    authUserId?: string | null;
    username?: string | null;
    displayName?: string | null;
  },
): OfficialStudentAccountSpec | undefined {
  if (query.authUserId) {
    const byAuth = OFFICIAL_14_STUDENTS.find(
      (s) => s.authUserId.toLowerCase() === String(query.authUserId).trim().toLowerCase(),
    );
    if (byAuth) return byAuth;
  }
  if (query.username) {
    const normU = normalizeStudentUsername(query.username);
    const byUser = OFFICIAL_14_STUDENTS.find((s) => s.username.toLowerCase() === normU);
    if (byUser) return byUser;
  }
  if (query.displayName) {
    const normName = normalizePlayerName(query.displayName);
    const byName = OFFICIAL_14_STUDENTS.find(
      (s) => normalizePlayerName(s.displayName) === normName,
    );
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Checks whether a value is a valid RFC 4122 UUID string.
 */
export function isValidUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

/**
 * Generates a unique UUID v4 for local fallback use when needed.
 */
export function generateStudentUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Maps frontend CharacterId ('bima' | 'sinta') to Supabase student_profiles.character ('BIMA' | 'SINTA').
 */
export function mapCharacterIdToDbCharacter(
  characterId?: CharacterId | string | null,
): 'BIMA' | 'SINTA' {
  const upper = String(characterId || '').trim().toUpperCase();
  if (upper === 'BIMA') return 'BIMA';
  return 'SINTA';
}

/**
 * Maps Supabase student_profiles.character ('BIMA' | 'SINTA' | 'bima' | 'sinta') to frontend CharacterId ('bima' | 'sinta').
 */
export function mapDbCharacterToCharacterId(dbCharacter?: unknown): CharacterId {
  const upper = String(dbCharacter || '').trim().toUpperCase();
  if (upper === 'BIMA') return 'bima';
  return 'sinta';
}

/**
 * Strict INSERT payload for public.student_profiles:
 * - id: omitted so database default gen_random_uuid() is used
 * - created_at: omitted so database default now() is used
 * - auth_user_id: real UUID from auth.users
 * - display_name: student name
 * - character: 'BIMA' | 'SINTA'
 * - is_active: boolean
 */
export interface StudentProfileDbInsertPayload {
  auth_user_id: string;
  display_name: string;
  character: 'BIMA' | 'SINTA';
  is_active: boolean;
}

/**
 * Builds a strict payload matching the exact rules for INSERT into public.student_profiles:
 * - Omits `id` and `created_at` so PostgreSQL defaults (`gen_random_uuid()` and `now()`) apply.
 * - Requires a valid `auth_user_id` UUID from `auth.users`.
 * - Never includes non-existent columns (`character_id`, `name`, `username`, `normalized_name`, `solo_data`, `last_active_at`).
 */
export function buildStudentProfileInsertPayload(params: {
  authUserId: string;
  displayName: string;
  characterId?: CharacterId | string | null;
  isActive?: boolean;
}): StudentProfileDbInsertPayload {
  const cleanedName = String(params.displayName || '').trim().replace(/\s+/g, ' ');
  const rawAuthUid = String(params.authUserId || '').trim();
  if (!isValidUuid(rawAuthUid)) {
    throw new Error(
      'auth_user_id wajib menggunakan UUID asli yang valid dari Supabase Auth (auth.users).',
    );
  }
  return {
    auth_user_id: rawAuthUid,
    display_name: cleanedName,
    character: mapCharacterIdToDbCharacter(params.characterId),
    is_active: params.isActive !== undefined ? Boolean(params.isActive) : true,
  };
}

/**
 * Maps a database row from public.student_profiles into a frontend StudentProfile object.
 */
export function mapDbRowToStudentProfile(
  row: any,
  existingLocal?: StudentProfile,
): StudentProfile {
  const officialSpec = findOfficialStudentSpec({
    authUserId: row?.auth_user_id,
    username: row?.username || existingLocal?.username,
    displayName: row?.display_name || row?.name || existingLocal?.name,
  });

  const id = String(
    row?.id || existingLocal?.id || officialSpec?.authUserId || generateStudentUuid(),
  );
  const authUserId = isValidUuid(row?.auth_user_id)
    ? String(row.auth_user_id).trim()
    : existingLocal?.authUserId || officialSpec?.authUserId || undefined;
  const displayName = String(
    row?.display_name || row?.name || officialSpec?.displayName || existingLocal?.name || 'Siswa Aqua City',
  )
    .trim()
    .replace(/\s+/g, ' ');
  const characterId = mapDbCharacterToCharacterId(
    row?.character ?? row?.character_id ?? officialSpec?.character ?? existingLocal?.characterId,
  );
  const normName = normalizePlayerName(displayName);
  const username =
    row?.username ||
    officialSpec?.username ||
    existingLocal?.username ||
    normName.replace(/[^a-z0-9_]/g, '');
  const createdAt = row?.created_at || existingLocal?.createdAt || new Date().toISOString();
  const isActive =
    row?.is_active !== undefined
      ? Boolean(row.is_active)
      : existingLocal?.isActive !== undefined
        ? existingLocal.isActive
        : true;
  const profileLinked = Boolean(row?.id && isValidUuid(row?.auth_user_id));
  const empty = createEmptyStudentProfile(id, displayName, characterId);

  return {
    id,
    authUserId,
    name: displayName,
    username,
    normalizedName: normName,
    characterId,
    isActive,
    profileLinked,
    tempPasswordHint: officialSpec?.defaultPassword || existingLocal?.tempPasswordHint,
    createdAt,
    lastActiveAt: existingLocal?.lastActiveAt || createdAt,
    solo: existingLocal?.solo || empty.solo,
    championship: existingLocal?.championship || empty.championship,
  };
}

/**
 * Deprecated helper retained for backward reference.
 * Temporary Anonymous Auth sessions are NEVER used to bypass RLS when inserting student profiles.
 */
export async function acquireIsolatedAnonymousAuthSession(): Promise<{
  authUserId: null;
  ephemeralClient: null;
}> {
  return { authUserId: null, ephemeralClient: null };
}

export interface VerifiedTeacherProfileSession {
  ok: boolean;
  teacherUserId?: string;
  teacherEmail?: string;
  teacherDisplayName?: string;
  message?: string;
}

/**
 * Builds a valid payload for public.teacher_profiles where both `id` and `auth_user_id` are valid UUIDs.
 */
export function buildTeacherProfilePayload(params: {
  authUserId: string;
  displayName: string;
  createdAt?: string;
}): {
  id: string;
  auth_user_id: string;
  display_name: string;
  role: 'teacher';
  created_at: string;
} {
  const validUid = isValidUuid(params.authUserId)
    ? params.authUserId.trim()
    : generateStudentUuid();
  const cleanedName =
    String(params.displayName || '').trim().replace(/\s+/g, ' ') || 'Ibu/Bapak Guru';
  return {
    id: validUid,
    auth_user_id: validUid,
    display_name: cleanedName,
    role: 'teacher',
    created_at: params.createdAt || new Date().toISOString(),
  };
}

/**
 * Helper: Validates whether a Supabase Auth user object represents a real, non-anonymous teacher account with a valid email.
 * Strictly rejects student accounts (@student.aquamath.id or role='student').
 */
export function isVerifiedTeacherAuthUser(user: any): boolean {
  if (!user || typeof user.id !== 'string' || !user.id.trim()) return false;
  if (user.is_anonymous === true) return false;
  if (user.app_metadata?.provider === 'anonymous') return false;
  if (user.user_metadata?.role === 'student') return false;
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) return false;
  if (email.endsWith(`@${STUDENT_INTERNAL_EMAIL_DOMAIN}`)) return false;
  return true;
}

/**
 * Verifies that the active Supabase session belongs to a real authenticated Teacher (non-anonymous, valid email)
 * AND requires that a corresponding row already exists in `public.teacher_profiles` with `auth_user_id = auth.uid()` and `role = 'teacher'`.
 * Never signs out or overwrites the active teacher session.
 */
export async function ensureVerifiedTeacherSessionAndProfile(): Promise<VerifiedTeacherProfileSession> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: 'Koneksi Supabase belum aktif.',
    };
  }

  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return {
        ok: false,
        message:
          'Sesi login guru tidak ditemukan atau telah berakhir. Silakan login kembali ke Dashboard Guru menggunakan email dan password Anda.',
      };
    }

    const user = userData.user;
    if (!isVerifiedTeacherAuthUser(user)) {
      return {
        ok: false,
        message:
          'Akses ditolak: Sesi aktif saat ini bukan akun guru yang terverifikasi (sesi anonim atau siswa tidak diizinkan menambahkan data siswa).',
      };
    }

    const teacherUid = user.id.trim();
    const teacherEmail = user.email!.trim().toLowerCase();
    const fallbackName =
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      teacherEmail.split('@')[0] ||
      'Ibu/Bapak Guru';

    // Check existing profile in public.teacher_profiles
    const { data: existingProfile, error: selectErr } = await supabase
      .from('teacher_profiles')
      .select('id, auth_user_id, display_name, role, created_at')
      .eq('auth_user_id', teacherUid)
      .maybeSingle();

    if (selectErr || !existingProfile || existingProfile.role !== 'teacher') {
      return { ok: false, message: 'Profil guru berwenang belum tersedia. Hubungi pengelola.' };
    }
    const token = await getTeacherAccessToken(teacherUid);
    if (!token) return { ok: false, message: 'Sesi guru tidak tersedia.' };
    const response = await fetch('/api/admin/verify', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || !(await response.json()).ok) return { ok: false, message: 'Guru belum diberi kewenangan.' };
    return { ok: true, teacherUserId: teacherUid, teacherEmail, teacherDisplayName: existingProfile.display_name || fallbackName };

  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Gagal memverifikasi sesi dan profil guru.',
    };
  }
}

/**
 * Formats Supabase PostgREST / RLS errors during student_profiles INSERT into clear Indonesian diagnostics.
 */
export function formatStudentInsertError(err: any): string {
  const rawMsg = String(err?.message || err || 'Kesalahan tidak diketahui').trim();
  const code = String(err?.code || '').trim();

  if (
    code === '42501' ||
    rawMsg.toLowerCase().includes('row-level security policy') ||
    rawMsg.toLowerCase().includes('permission denied')
  ) {
    return `Gagal menambahkan profil ke tabel "student_profiles" karena kebijakan Row-Level Security (RLS) (${rawMsg}). Jalankan SQL Policy "Teachers can insert student profiles" atau blok INSERT 14 siswa pada Supabase SQL Editor.`;
  }

  return `Gagal menambahkan siswa ke Supabase: ${rawMsg}`;
}

/**
 * Creates an isolated ephemeral Supabase client (no session persistence) so creating or verifying
 * a student account in Supabase Auth NEVER touches or overwrites the logged-in Teacher's session.
 */
function createEphemeralAuthClient() {
  return createEphemeralSupabaseClient();
}

/**
 * Creates or signs into a Student Auth account in Supabase Auth using an isolated client
 * (without affecting the Teacher's active session) and returns the real `auth.users.id` UUID.
 */
/**
 * Synchronizes all 14 official Class 5 student accounts between auth.users and public.student_profiles.
 */
export async function syncOfficial14StudentAccounts(): Promise<{
  ok: boolean;
  syncedCount: number;
  authReadyCount: number;
  students: StudentProfile[];
  rlsBlocked: boolean;
  message: string;
}> {
  return { ok: false, syncedCount: 0, authReadyCount: 0, students: [], rlsBlocked: false,
    message: 'Provisioning siswa belum tersedia sampai mekanisme administratif yang aman disetujui.' };
}

/**
 * Fetches the current active championship session from public.championship_sessions in Supabase.
 */
export async function getActiveChampionshipSession(studentId?: string): Promise<{ id: string; session_name: string } | null> {
  if (!studentId || !studentSupabase) throw new Error('Sesi siswa tidak tersedia.');
  const { data, error } = await studentSupabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesi siswa tidak tersedia.');
  const client = createStudentRequestClient(token);
  return readStudentChampionship(client, studentId);
}

/** Official opening is confirmed by RPC and authoritative roster read-back. */
export async function ensureActiveChampionshipSession(sessionName = 'Turnamen Penyelamat Air Aqua City') {
  const teacherCheck = await ensureVerifiedTeacherSessionAndProfile();
  if (!teacherCheck.ok) throw new Error(teacherCheck.message || 'Guru tidak berwenang.');
  return changeTeacherChampionship(supabase, 'open', sessionName);
}

/**
 * Pure helper: Computes a student's Solo & Championship progress strictly from
 * verified Supabase `game_attempts` and `game_progress` rows (never from unverified localStorage).
 */
export function applySupabaseAttemptsAndProgressToProfile(
  baseProfile: StudentProfile,
  attemptsRows: any[],
  _progressRows: any[] = [],
  _championshipSnapshot?: any,
): StudentProfile {
  const empty = createEmptyStudentProfile(
    baseProfile.id,
    baseProfile.name,
    baseProfile.characterId,
  );
  const profile: StudentProfile = {
    ...JSON.parse(JSON.stringify(baseProfile)),
    solo: empty.solo,
    championship: empty.championship,
  };

  // Successful empty reads are authoritative after reset. Legacy snapshots are
  // never a fallback for scores/progress or evidence to reclassify a database row.
  const effectiveAttempts = Array.isArray(attemptsRows) ? attemptsRows : [];

  const soloLocs: Record<number, SoloLocationProgress> = {};
  const champLocs: Record<number, ChampionshipLocationRecord> = {};
  let champTotalTime = 0;

  if (effectiveAttempts.length > 0) {
    for (const row of effectiveAttempts) {
      const locId = Number(row.location_id);
      if (!locId || locId < 1 || locId > 10) continue;
      const mode = parseGameMode(row.mode);
      if (!mode || (mode === 'solo' && row.session_id != null) ||
        (mode === 'championship' && !validSessionId(row.session_id))) continue;
      const isChamp = mode === 'championship';
      const score = Number(row.score ?? Number(row.correct_count || 0) * 10);
      const correctCount = Number(row.correct_count || 0);
      const duration = Number(row.duration_seconds || 0);
      const playedAt = row.completed_at || row.created_at || new Date().toISOString();

      if (isChamp) {
        const prevChamp = champLocs[locId];
        const bestChampScore = prevChamp
          ? Math.max(prevChamp.championshipScore, score)
          : score;
        champLocs[locId] = {
          locationId: locId,
          completed: true,
          championshipScore: bestChampScore,
          correctCount: prevChamp ? Math.max(prevChamp.correctCount, correctCount) : correctCount,
          timeSpentSeconds: duration,
          medal: calculateMedal(bestChampScore),
          completedAt: playedAt,
        };
        champTotalTime += duration;
      } else {
        const prevSolo = soloLocs[locId];
        const bestSoloScore = prevSolo ? Math.max(prevSolo.bestScore, score) : score;
        soloLocs[locId] = {
          locationId: locId,
          completed: true,
          latestScore: score,
          bestScore: bestSoloScore,
          latestCorrectCount: correctCount,
          bestCorrectCount: prevSolo
            ? Math.max(prevSolo.bestCorrectCount, correctCount)
            : correctCount,
          bestTimeSeconds: prevSolo
            ? Math.min(prevSolo.bestTimeSeconds, duration)
            : duration,
          attemptsCount: (prevSolo?.attemptsCount || 0) + 1,
          medal: calculateMedal(bestSoloScore),
          lastPlayedAt: playedAt,
        };
      }
    }
  }

  // Legacy game_progress is UNIQUE(student_id), so it cannot independently
  // represent both modes. Never let its overwritten/mixed row grant completions
  // to another mode. The existing unlock rules use verified per-mode attempts.

  const soloBestTotal = Object.values(soloLocs).reduce(
    (acc, l) => acc + (l.bestScore || 0),
    0,
  );
  const soloLatestTotal = Object.values(soloLocs).reduce(
    (acc, l) => acc + (l.latestScore || 0),
    0,
  );
  const soloDoneIds = new Set(
    Object.values(soloLocs)
      .filter((l) => l.completed)
      .map((l) => l.locationId),
  );
  const soloUnlocked = computeLevelUnlockState(soloDoneIds);

  profile.solo = {
    locations: soloLocs,
    bestTotalScore: soloBestTotal,
    latestTotalScore: soloLatestTotal,
    academicGrade: calculateAdventureAcademicGrade(soloBestTotal),
    unlockedLevel: soloUnlocked.unlockedLevel,
    completedLevels: soloUnlocked.completedLevels,
  };

  // Strictly separate Championship score from Solo
  const champBestTotal = Object.values(champLocs).reduce(
    (acc, l) => acc + (l.championshipScore || 0),
    0,
  );
  const champDoneIds = new Set(
    Object.values(champLocs)
      .filter((l) => l.completed)
      .map((l) => l.locationId),
  );
  const champUnlocked = computeLevelUnlockState(champDoneIds);

  profile.championship = {
    locations: champLocs,
    totalChampionshipScore: champBestTotal,
    academicGrade: calculateAdventureAcademicGrade(champBestTotal),
    totalTimeSeconds: champTotalTime,
    unlockedLevel: champUnlocked.unlockedLevel,
    completedLevels: champUnlocked.completedLevels,
  };

  return profile;
}

/**
 * Reads authoritative attempts/progress without updating account/profile snapshots.
 */
async function loadVerifiedStudentResults(client: any, studentId: string) {
  const [attemptsRows, progressRows] = await Promise.all([
    readResultRows(() => client.from('game_attempts').select(
      'id, student_id, mode, session_id, level_number, location_id, correct_count, wrong_count, score, duration_seconds, attempt_number, completed_at, created_at',
      { count: 'exact' }).eq('student_id', studentId).order('completed_at', { ascending: true }).order('id', { ascending: true })),
    readResultRows(() => client.from('game_progress').select(
      'id, student_id, mode, unlocked_level, last_level, last_location, completed_locations, updated_at',
      { count: 'exact' }).eq('student_id', studentId).order('id', { ascending: true })),
  ]);
  return { attemptsRows, progressRows };
}

/**
 * Loads and merges a student's game progress and attempts from Supabase (`game_progress`, `game_attempts`)
 * so that logging in on any device restores the student's progress accurately without mixing accounts.
 */
export async function hydrateStudentProgressFromSupabase(
  baseProfile: StudentProfile,
  clientToUse = studentSupabase || supabase,
): Promise<StudentProfile> {
  if (!isSupabaseConfigured || !clientToUse) {
    return baseProfile;
  }

  if (!isValidUuid(baseProfile.id)) throw new Error('ID profil siswa belum terverifikasi.');
  const { attemptsRows, progressRows } = await loadVerifiedStudentResults(clientToUse, baseProfile.id);
  return applySupabaseAttemptsAndProgressToProfile(baseProfile, attemptsRows, progressRows);
}

/** Project only this session's Championship state; preserve SOLO byte-for-byte. */
export function projectChampionshipSession(base: StudentProfile, attempts: any[], sessionId: string): StudentProfile {
  if (!validSessionId(sessionId)) throw new Error('ID sesi Championship tidak valid.');
  const scoped = attempts.filter(row => row.student_id === base.id && parseGameMode(row.mode) === 'championship' && row.session_id === sessionId);
  const projection = applySupabaseAttemptsAndProgressToProfile(base, scoped);
  return { ...base, championship: projection.championship };
}

export async function hydrateStudentChampionshipSession(base: StudentProfile, sessionId: string): Promise<StudentProfile> {
  if (!studentSupabase) throw new Error('Sesi siswa tidak tersedia.');
  const { data, error } = await studentSupabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token || data.session?.user?.id !== base.authUserId) throw new Error('Sesi siswa tidak sesuai pemilik.');
  const client = createStudentRequestClient(token);
  const active = await readStudentChampionship(client, base.id);
  if (active.id !== sessionId) throw new Error('Sesi Championship berubah. Mulai ulang misi.');
  const attempts = await readResultRows(() => client!.from('game_attempts').select('*', { count: 'exact' })
    .eq('student_id', base.id).eq('mode', 'CHAMPIONSHIP').eq('session_id', sessionId)
    .order('completed_at').order('id'));
  return projectChampionshipSession(base, attempts, sessionId);
}

export interface SaveGameAttemptParams {
  authUserId?: string;
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
  studentId?: string;
  updatedProfile?: StudentProfile;
}

export interface PendingSyncAttempt extends SaveGameAttemptParams {
  timestamp: number;
  score: number;
  syncState?: 'pending' | 'sending' | 'uncertain' | 'blocked';
  protocolVersion?: string;
  championshipContract?: 'best-per-mission-v1';
  championshipRequestId?: string;
}

const OFFLINE_QUEUE_KEY = 'aqua_math_offline_attempts_queue_v1';

const attemptSync = createAttemptSync({
  storage: () => localStorage,
  context: async () => {
    const { data, error } = await studentSupabase!.auth.getSession();
    const session = data?.session;
    if (error || !session?.access_token || !session.user?.id || session.user.is_anonymous) return null;
    if (!session.expires_at || session.expires_at * 1000 <= Date.now()) return null;
    const client = createStudentRequestClient(session.access_token);
    const { data: profile, error: profileError } = await client.from('student_profiles')
      .select('id, auth_user_id, is_active').eq('auth_user_id', session.user.id).maybeSingle();
    if (profileError || !profile?.id || profile.auth_user_id !== session.user.id || profile.is_active !== true) return null;
    return { authUserId: session.user.id, studentId: profile.id, client };
  },
  onConfirmed: async (context, item, id) => {
    const synced = await loadVerifiedStudentResults(context.client, context.studentId);
    const { data: row } = await context.client.from('student_profiles').select('*').eq('id', context.studentId).maybeSingle();
    if (!row) return {};
    const profile = applySupabaseAttemptsAndProgressToProfile(mapDbRowToStudentProfile(row), synced.attemptsRows, synced.progressRows);
    return { updatedProfile: item.mode === 'championship' && item.sessionId
      ? projectChampionshipSession(profile, synced.attemptsRows, item.sessionId) : profile };
  },
});

export function getOfflineSyncQueue(): PendingSyncAttempt[] { return attemptSync.read(); }

/**
 * Returns the active Supabase client for student gameplay operations:
 * Strictly requires an authenticated student session on `studentSupabase` so `auth.uid()`
 * always matches `student_profiles.auth_user_id` and NEVER mixes with a Teacher session.
 */
async function getGameplaySupabaseClient() {
  if (studentSupabase) {
    try {
      const { data } = await studentSupabase.auth.getSession();
      if (data?.session?.user) {
        return studentSupabase;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Restores and verifies the active student session from `studentSupabase` on app mount.
 * Ensures `profile.id` is always the canonical `public.student_profiles.id` and progress
 * comes directly from `public.game_attempts` and `public.game_progress`.
 */
export async function restoreActiveStudentSessionFromSupabase(): Promise<StudentProfile | null> {
  if (!isSupabaseConfigured || !studentSupabase) return null;
  try {
    const { data: sessionData, error: sessionErr } = await studentSupabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (sessionErr || !authUser || !authUser.id) {
      return null;
    }

    if (
      authUser.user_metadata?.role === 'teacher' ||
      (authUser.email && !authUser.email.toLowerCase().endsWith(`@${STUDENT_INTERNAL_EMAIL_DOMAIN}`))
    ) {
      return null;
    }

    const { data: profileRow } = await studentSupabase
      .from('student_profiles')
      .select('id, auth_user_id, display_name, character, is_active, created_at, championship_data')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!profileRow || profileRow.is_active === false) {
      return null;
    }

    await flushOfflineSyncQueue().catch(() => {});

    const baseProfile = mapDbRowToStudentProfile(profileRow);
    baseProfile.authUserId = authUser.id;
    const hydrated = await hydrateStudentProgressFromSupabase(baseProfile, studentSupabase);
    return hydrated;
  } catch {
    return null;
  }
}

/**
 * Flushes pending offline sync queue to Supabase when network connection is re-established.
 */
export async function flushOfflineSyncQueue() { return attemptSync.flush(); }

/**
 * Verifies class access code and loads active student roster from Supabase student_profiles.
 */
export async function verifyClassAccessCode(
  accessCode: string,
): Promise<{
  ok: boolean;
  message?: string;
  className?: string;
  teacherName?: string;
  students?: Array<{
    id: string;
    name: string;
    username: string;
    characterId: CharacterId;
    hasPin: boolean;
  }>;
}> {
  if (!accessCode || !accessCode.trim()) {
    return { ok: false, message: 'Kode Akses Kelas wajib diisi.' };
  }

  const cleanedCode = accessCode.trim().toUpperCase();

  let expectedCode = 'AQUA2026';
  let className = 'Kelas Petualang Aqua City';
  let teacherName = 'Guru Pembimbing Aqua City';
  let accessCodeActive = true;

  try {
    const rawSettings = localStorage.getItem('aqua_math_class_settings_v1');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed.accessCode) expectedCode = String(parsed.accessCode).trim().toUpperCase();
      if (parsed.className) className = parsed.className;
      if (parsed.teacherName) teacherName = parsed.teacherName;
      if (typeof parsed.accessCodeActive === 'boolean') accessCodeActive = parsed.accessCodeActive;
    }
  } catch {
    // ignore
  }

  if (!accessCodeActive) {
    return { ok: false, message: 'Kode Akses Kelas sedang ditutup oleh Guru.' };
  }

  if (isSupabaseConfigured && supabase) {
    if (cleanedCode === expectedCode || cleanedCode === 'AQUA2026') {
      try {
        const { data: rosterRows, error: rosterErr } = await supabase
          .from('student_profiles')
          .select('id, auth_user_id, display_name, character, is_active, created_at')
          .eq('is_active', true)
          .order('display_name', { ascending: true });

        if (!rosterErr && Array.isArray(rosterRows) && rosterRows.length > 0) {
          const students = rosterRows.map((row) => {
            const displayName = String(row.display_name || 'Siswa').trim();
            const spec = findOfficialStudentSpec({
              authUserId: row.auth_user_id,
              displayName,
            });
            return {
              id: String(row.id),
              name: displayName,
              username: spec?.username || normalizePlayerName(displayName),
              characterId: mapDbCharacterToCharacterId(row.character),
              hasPin: true,
            };
          });

          return {
            ok: true,
            className,
            teacherName,
            students,
          };
        }
      } catch {
        // Fallback
      }
    } else {
      return {
        ok: false,
        message: 'Kode Akses Kelas tidak sesuai. Mohon tanyakan ke Guru!',
      };
    }
  }

  return {
    ok: true,
    className,
    teacherName,
    students: OFFICIAL_14_STUDENTS.map((s) => ({
      id: s.authUserId,
      name: s.displayName,
      username: s.username,
      characterId: s.characterId,
      hasPin: true,
    })),
  };
}

/**
 * Connects student to their selected Class 5 identity in student_profiles.
 */
export async function selectStudentIdentity(
  studentId: string,
  characterId: CharacterId = 'sinta',
  pinCode?: string,
): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  if (!studentId) {
    return { ok: false, message: 'Pilih nama siswamu terlebih dahulu.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: studentRow, error } = await supabase
        .from('student_profiles')
        .select('id, auth_user_id, display_name, character, is_active, created_at')
        .eq('id', studentId)
        .maybeSingle();

      if (!error && studentRow) {
        const dbCharacter = mapCharacterIdToDbCharacter(
          characterId || mapDbCharacterToCharacterId(studentRow.character),
        );

        await supabase
          .from('student_profiles')
          .update({ character: dbCharacter })
          .eq('id', studentId);

        const profile = mapDbRowToStudentProfile({
          ...studentRow,
          character: dbCharacter,
        });

        return {
          ok: true,
          profile,
          message: `Selamat berpetualang, ${profile.name}!`,
        };
      }
    } catch {
      // Fallback
    }
  }

  const official = findOfficialStudentSpec({ authUserId: studentId });
  if (official) {
    return {
      ok: true,
      profile: mapDbRowToStudentProfile({
        id: official.authUserId,
        auth_user_id: official.authUserId,
        display_name: official.displayName,
        character: official.character,
        username: official.username,
        is_active: true,
      }),
      message: `Selamat berpetualang, ${official.displayName}!`,
    };
  }

  return { ok: false, message: 'Gagal memilih identitas siswa.' };
}

/**
 * Teacher Admin: Create Single Student Account in Supabase Auth + public.student_profiles.
 * Uses real auth_user_id from auth.users and omits id/created_at on insert.
 */
export async function adminAddSingleStudent(
  name: string,
  passwordOrPin?: string,
  characterId: CharacterId = 'sinta',
  customUsername?: string,
): Promise<{
  ok: boolean;
  student?: StudentProfile;
  username?: string;
  tempPassword?: string;
  message?: string;
}> {
  return { ok: false, message: 'Penambahan akun siswa belum tersedia. Tidak ada akun atau profil yang dibuat.' };
}

/**
 * Teacher Admin: Add Bulk Batch Students to Class 5 Roster in Supabase Auth + student_profiles.
 */
export async function adminAddBatchStudents(
  names: string[],
  characterId: CharacterId = 'sinta',
): Promise<{ ok: boolean; count?: number; students?: StudentProfile[]; message?: string }> {
  const validNames = (names || [])
    .map((rawName) => String(rawName).trim().replace(/\s+/g, ' '))
    .filter((n) => n.length >= 2);

  if (validNames.length === 0) {
    return { ok: false, message: 'Daftar nama siswa tidak valid (minimal 2 huruf per nama).' };
  }

  const createdStudents: StudentProfile[] = [];
  const errors: string[] = [];

  for (let i = 0; i < validNames.length; i++) {
    const cleanedName = validNames[i];
    const officialSpec = findOfficialStudentSpec({ displayName: cleanedName });
    const res = await adminAddSingleStudent(
      cleanedName,
      officialSpec?.defaultPassword,
      officialSpec?.characterId || characterId,
      officialSpec?.username,
    );
    if (res.ok && res.student) {
      createdStudents.push(res.student);
    } else if (res.message) {
      errors.push(`${cleanedName}: ${res.message}`);
    }
  }

  if (createdStudents.length > 0) {
    return {
      ok: true,
      count: createdStudents.length,
      students: createdStudents,
      message: `Berhasil memproses ${createdStudents.length} akun siswa ke Kelas 5!${
        errors.length > 0 ? ` (${errors.length} kendala: ${errors[0]})` : ''
      }`,
    };
  }

  return {
    ok: false,
    message: errors[0] || 'Gagal menambahkan daftar siswa.',
  };
}

/**
 * Teacher Admin: Toggle Student Active Status (is_active) in public.student_profiles.
 */
export async function adminToggleStudentActive(
  studentId: string,
  nextActive: boolean,
  authUserId?: string,
): Promise<{ ok: boolean; isActive?: boolean; message?: string }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const teacherCheck = await ensureVerifiedTeacherSessionAndProfile();
      if (!teacherCheck.ok) {
        return { ok: false, message: teacherCheck.message };
      }

      let query = supabase
        .from('student_profiles')
        .update({ is_active: nextActive });

      if (authUserId && isValidUuid(authUserId)) {
        query = query.or(`id.eq.${studentId},auth_user_id.eq.${authUserId}`);
      } else {
        query = query.eq('id', studentId);
      }

      const { data, error } = await query
        .select('id, is_active')
        .maybeSingle();

      if (!error && data) {
        return {
          ok: true,
          isActive: Boolean(data.is_active),
          message: `Status akun siswa berhasil diubah menjadi ${
            nextActive ? 'AKTIF' : 'NONAKTIF'
          }.`,
        };
      }

      if (error) {
        return {
          ok: false,
          message: `Gagal mengubah status aktif siswa: ${error.message}`,
        };
      }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Gagal mengubah status akun siswa.' };
    }
  }

  return {
    ok: false,
    message: 'Profil siswa belum tersinkron di tabel student_profiles.',
  };
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
      (await getTeacherAccessToken()) || '';
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
 * Authenticates a student account using Username + Password via the isolated `studentSupabase` client.
 * - Maps `username` -> `${username}@student.aquamath.id`
 * - Never overwrites the Teacher's Supabase session
 * - Rejects teacher accounts
 * - Verifies `is_active` and loads progress from Supabase (`game_attempts`, `game_progress`)
 */
export async function loginStudentAccount(
  username: string,
  password: string,
): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  const rawInput = String(username || '').trim().toLowerCase();
  if (!rawInput) {
    return { ok: false, message: 'Masukkan Username siswamu terlebih dahulu.' };
  }
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, message: 'Masukkan Password siswamu terlebih dahulu.' };
  }

  // Prevent teacher emails from logging in through the student login form
  if (rawInput.includes('@') && !rawInput.endsWith(`@${STUDENT_INTERNAL_EMAIL_DOMAIN}`)) {
    return {
      ok: false,
      message:
        'Form ini khusus untuk Akun Siswa (gunakan Username siswa seperti afina01). Untuk Guru, silakan masuk melalui menu Dashboard Guru.',
    };
  }

  const normUsername = normalizeStudentUsername(rawInput);
  if (!normUsername) {
    return { ok: false, message: 'Format username siswa tidak valid.' };
  }

  const internalEmail = studentUsernameToInternalEmail(normUsername);
  const authClient = studentSupabase || supabase;

  if (isSupabaseConfigured && authClient) {
    try {
      const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
        email: internalEmail,
        password: password,
      });

      if (authErr || !authData?.user) {
        return {
          ok: false,
          message:
            'Username atau Password salah. Periksa kembali huruf besar/kecil pada Password (contoh: Aqua@2601).',
        };
      }

      const authUser = authData.user;
      if (
        authUser.user_metadata?.role === 'teacher' ||
        (authUser.email && !authUser.email.toLowerCase().endsWith(`@${STUDENT_INTERNAL_EMAIL_DOMAIN}`))
      ) {
        await authClient.auth.signOut().catch(() => {});
        return {
          ok: false,
          message: 'Akun Guru tidak dapat digunakan pada form Login Siswa.',
        };
      }

      const officialSpec = findOfficialStudentSpec({
        authUserId: authUser.id,
        username: normUsername,
      });

      const selectCols =
        'id, auth_user_id, display_name, character, is_active, created_at, championship_data';

      // 1. Look up student_profiles by auth_user_id = authUser.id
      let { data: profileRow } = await authClient
        .from('student_profiles')
        .select(selectCols)
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      // 2. Fallback lookup by display_name if not yet linked by auth_user_id
      const expectedName =
        officialSpec?.displayName ||
        authUser.user_metadata?.display_name ||
        authUser.user_metadata?.name ||
        normUsername;

      if (!profileRow && expectedName) {
        const { data: byNameRow } = await authClient
          .from('student_profiles')
          .select(selectCols)
          .ilike('display_name', expectedName)
          .maybeSingle();

        if (byNameRow) {
          profileRow = byNameRow;
        }
      }

      // 3. Enforce is_active check
      if (profileRow && profileRow.is_active === false) {
        await authClient.auth.signOut().catch(() => {});
        return {
          ok: false,
          message:
            'Akun siswa ini sedang dinonaktifkan oleh Guru. Silakan hubungi Guru Kelas untuk mengaktifkan kembali.',
        };
      }

      // 4. Build clean base profile using canonical student_profiles.id (never polluted by unverified localStorage scores)
      const baseProfile = mapDbRowToStudentProfile(
        profileRow || {
          id: authUser.id,
          auth_user_id: authUser.id,
          display_name: expectedName,
          character:
            officialSpec?.character ||
            authUser.user_metadata?.character ||
            'SINTA',
          username: normUsername,
          is_active: true,
          created_at: authUser.created_at || new Date().toISOString(),
        },
      );
      baseProfile.username = normUsername;
      baseProfile.authUserId = authUser.id;
      baseProfile.lastActiveAt = new Date().toISOString();

      // 5. Flush any pending offline attempts now that studentSupabase has a verified student session
      await flushOfflineSyncQueue().catch(() => {});

      // 6. Hydrate progress strictly from Supabase (game_attempts & game_progress)
      const hydratedProfile = await hydrateStudentProgressFromSupabase(baseProfile, authClient);

      if (authData.session?.access_token) {
        try {
          sessionStorage.setItem('aqua_student_token', authData.session.access_token);
        } catch {
          // ignore
        }
      }

      return {
        ok: true,
        profile: hydratedProfile,
        message: `Selamat datang kembali, ${hydratedProfile.name}!`,
      };
    } catch (e: any) {
      return {
        ok: false,
        message: e?.message || 'Gagal melakukan autentikasi siswa ke Supabase.',
      };
    }
  }

  // Fallback to backend endpoint if Supabase client is not configured in browser
  try {
    const res = await fetch('/api/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normUsername, password }),
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
 * Logs out the active student account cleanly without touching the Teacher's Supabase session.
 */
export async function logoutStudentAccount(): Promise<void> {
  try {
    sessionStorage.removeItem('aqua_student_token');
    localStorage.removeItem('aqua_math_active_student_id_v1');
    if (studentSupabase) {
      await studentSupabase.auth.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Registers permanent student account (Username + Password) via Teacher / Backend API & Supabase Auth.
 */
export async function registerStudentAccount(data: {
  accessCode: string;
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  characterId: CharacterId;
}): Promise<{ ok: boolean; profile?: StudentProfile; message?: string }> {
  if (data.password !== data.confirmPassword) {
    return { ok: false, message: 'Konfirmasi password tidak cocok.' };
  }
  const addRes = await adminAddSingleStudent(
    data.name,
    data.password,
    data.characterId,
    data.username,
  );
  if (addRes.ok && addRes.student) {
    return { ok: true, profile: addRes.student, message: addRes.message };
  }
  return { ok: false, message: addRes.message || 'Gagal mendaftarkan akun siswa.' };
}

/**
 * Resets student password from Teacher Dashboard via backend Admin API (requires SUPABASE_SERVICE_ROLE_KEY on server).
 */
export async function resetStudentPasswordByTeacher(
  studentId: string,
  username: string,
  newPassword: string,
  authUserId?: string,
): Promise<{ ok: boolean; message?: string }> {
  return { ok: false, message: 'Reset password siswa belum tersedia sampai mekanisme administratif yang aman disetujui.' };
}

/**
 * 1. registerStudentProfile()
 * Retrieves or links student profile in Supabase student_profiles table.
 */
export async function registerStudentProfile(
  name: string,
  characterId: CharacterId,
): Promise<{ profile: StudentProfile | null; error?: string }> {
  return { profile: null, error: 'Pendaftaran profil belum tersedia. Gunakan login akun siswa yang sudah ada.' };
}

/**
 * 2. getStudentProfile()
 * Fetches latest student profile from Supabase student_profiles using valid columns.
 */
export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  if (!isSupabaseConfigured || !supabase || !isValidUuid(studentId)) return null;

  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('id, auth_user_id, display_name, character, is_active, created_at')
      .or(`id.eq.${studentId},auth_user_id.eq.${studentId}`)
      .maybeSingle();

    if (error || !data) return null;

    return mapDbRowToStudentProfile(data);
  } catch {
    return null;
  }
}

/**
 * 3. saveGameAttempt() / saveAttemptToSupabase()
 * Invokes Supabase RPC `save_game_attempt` using the authenticated student session (`studentSupabase`),
 * guarantees writes to `public.game_attempts` and `public.game_progress` using `student_profiles.id`,
 * and reloads authoritative Supabase results without writing profile snapshots.
 */
const pendingSaveRequests = new Map<string, Promise<SaveGameAttemptResult>>();
export function saveGameAttempt(params: SaveGameAttemptParams): Promise<SaveGameAttemptResult> {
  // Include session resolution in the same in-flight operation as the write.
  const key = JSON.stringify([params.authUserId, params.studentId, params.idempotencyKey, params.mode,
    params.sessionId, params.levelNumber, params.locationId, params.correctCount, params.wrongCount, params.durationSeconds]);
  const existing = pendingSaveRequests.get(key);
  if (existing) return existing;
  const task = (async () => {
    return attemptSync.save(params);
  })();
  pendingSaveRequests.set(key, task);
  void task.finally(() => { if (pendingSaveRequests.get(key) === task) pendingSaveRequests.delete(key); }).catch(() => {});
  return task;
}

export const saveAttemptToSupabase = saveGameAttempt;

/**
 * 4. getStudentProgress()
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
        .in('mode', ['solo', 'SOLO']).is('session_id', null);

      if (locationId) {
        query = query.eq('location_id', String(locationId));
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
        .in('mode', ['solo', 'SOLO'])
        .is('session_id', null)
        .order('completed_at', { ascending: false })
        .limit(1);

      if (locationId) {
        query = query.eq('location_id', String(locationId));
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
 * Fetches real aggregate data for the Teacher Dashboard strictly from Supabase
 * (`student_profiles`, `game_attempts`, and `game_progress` — NEVER from localStorage).
 */
export async function getTeacherDashboardData(client = supabase): Promise<{
  students: StudentProfile[];
  totalAttemptsCount: number;
  classSettings: any | null;
  supabaseConnected: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured || !client) {
    return {
      students: [],
      totalAttemptsCount: 0,
      classSettings: null,
      supabaseConnected: false,
    };
  }

  try {
    const [dbRows, allAttempts, allProgress] = await Promise.all([
      readResultRows(() => client.from('student_profiles').select(
        'id, auth_user_id, display_name, character, is_active, created_at, updated_at', { count: 'exact' })
        .order('display_name', { ascending: true }).order('id', { ascending: true })),
      readResultRows(() => client.from('game_attempts').select(
        'id, student_id, mode, session_id, level_number, location_id, correct_count, wrong_count, score, duration_seconds, attempt_number, completed_at, created_at', { count: 'exact' })
        .order('completed_at', { ascending: true }).order('id', { ascending: true })),
      readResultRows(() => client.from('game_progress').select(
        'id, student_id, mode, unlocked_level, last_level, last_location, completed_locations, updated_at', { count: 'exact' })
        .order('id', { ascending: true })),
    ]);

    // Group game_attempts and game_progress by student_id
    const attemptsByStudentId = new Map<string, any[]>();
    for (const att of allAttempts) {
      const sid = String(att.student_id || '');
      if (!sid) continue;
      if (!attemptsByStudentId.has(sid)) attemptsByStudentId.set(sid, []);
      attemptsByStudentId.get(sid)!.push(att);
    }

    const progressByStudentId = new Map<string, any[]>();
    for (const prog of allProgress) {
      const sid = String(prog.student_id || '');
      if (!sid) continue;
      if (!progressByStudentId.has(sid)) progressByStudentId.set(sid, []);
      progressByStudentId.get(sid)!.push(prog);
    }

    const matchedAuthIds = new Set<string>();
    const matchedNormNames = new Set<string>();
    const computedTotalAttempts = allAttempts.length;

    const mergedStudents: StudentProfile[] = dbRows.map((row) => {
      const norm = normalizePlayerName(row.display_name || '');
      if (row.auth_user_id) matchedAuthIds.add(String(row.auth_user_id).toLowerCase());
      matchedNormNames.add(norm);

      // Build clean profile without localStorage so Teacher Dashboard only shows real Supabase data
      const baseProfile = mapDbRowToStudentProfile(row);
      baseProfile.profileLinked = true;

      const directAttempts = attemptsByStudentId.get(row.id) || [];
      const directProgress = progressByStudentId.get(row.id) || [];
      return applySupabaseAttemptsAndProgressToProfile(
        baseProfile,
        directAttempts,
        directProgress,
      );
    });

    // Ensure all 14 official accounts appear in Teacher Dashboard even if student_profiles RLS blocked initial insert
    for (const spec of OFFICIAL_14_STUDENTS) {
      const norm = normalizePlayerName(spec.displayName);
      if (
        !matchedAuthIds.has(spec.authUserId.toLowerCase()) &&
        !matchedNormNames.has(norm)
      ) {
        const unlinkedProfile = mapDbRowToStudentProfile({
          id: spec.authUserId,
          auth_user_id: spec.authUserId,
          display_name: spec.displayName,
          character: spec.character,
          username: spec.username,
          is_active: true,
        });
        unlinkedProfile.profileLinked = false;
        mergedStudents.push(unlinkedProfile);
      }
    }

    return {
      students: mergedStudents,
      totalAttemptsCount: computedTotalAttempts,
      classSettings: null,
      supabaseConnected: true,
    };
  } catch {
    return {
      error: 'Sinkronisasi Supabase gagal atau data berubah saat dibaca. Data terakhir belum terverifikasi; coba muat ulang.',
      students: [],
      totalAttemptsCount: 0,
      classSettings: null,
      supabaseConnected: false,
    };
  }
}

/**
 * 9. requestTeacherPasswordReset(email)
 */
export function teacherRecoveryRedirect(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    return url.origin + '/';
  } catch { return null; }
}

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

  const redirectTo = typeof window !== 'undefined' ? teacherRecoveryRedirect(window.location.href) : null;
  if (!redirectTo) return { ok: false, message: 'Buka aplikasi melalui alamat browser yang valid untuk memulihkan password.' };

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanedEmail, {
      redirectTo,
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
      message:
        err?.message || 'Terjadi kesalahan jaringan saat mengirim tautan pemulihan password.',
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
 * 10. verifyTeacherRecoverySession()
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

      if (code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (codeErr) {
          return {
            ok: false,
            message: `Tautan pemulihan tidak valid atau sudah kedaluwarsa (${codeErr.message}). Silakan kirim ulang permintaan reset password.`,
          };
        }
      } else if (tokenHash && type === 'recovery') {
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
      profileSyncWarning = 'Profil guru belum tersedia. Hubungi pengelola untuk pemberian kewenangan.';
    }

    const activeToken = (await getTeacherAccessToken(updatedUser.id)) || '';

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

export interface ResetGameDataOptions {
  studentId?: string | 'ALL';
  modeScope?: 'ALL' | 'SOLO' | 'CHAMPIONSHIP';
}

export interface ResetGameDataPreview {
  targetStudentName: string;
  gameAttemptsCount: number;
  gameProgressCount: number;
  championshipParticipantsCount: number;
}

/**
 * Counts the number of game_attempts, game_progress, and championship_participants records
 * that would be affected by a reset, before actually executing the deletion.
 */
export async function getResetGameDataPreview(
  options: ResetGameDataOptions,
): Promise<{ ok: boolean; preview?: ResetGameDataPreview; message?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Koneksi Supabase belum aktif.' };
  }

  const teacherCheck = await ensureVerifiedTeacherSessionAndProfile();
  if (!teacherCheck.ok) {
    return { ok: false, message: teacherCheck.message || 'Sesi guru tidak terverifikasi.' };
  }

  try {
    const studentId = options.studentId || 'ALL';
    const modeScope = options.modeScope || 'ALL';

    let targetStudentName = 'Seluruh Siswa (Kelas 5)';
    if (studentId !== 'ALL' && isValidUuid(studentId)) {
      const { data: stRow } = await supabase
        .from('student_profiles')
        .select('display_name')
        .eq('id', studentId)
        .maybeSingle();
      if (stRow?.display_name) {
        targetStudentName = stRow.display_name;
      }
    }

    // 1. Count game_attempts
    let attQuery = supabase.from('game_attempts').select('id', { count: 'exact', head: true });
    if (studentId !== 'ALL') {
      attQuery = attQuery.eq('student_id', studentId);
    }
    if (modeScope === 'SOLO') {
      attQuery = attQuery.in('mode', ['solo', 'SOLO']);
    } else if (modeScope === 'CHAMPIONSHIP') {
      attQuery = attQuery.in('mode', ['championship', 'CHAMPIONSHIP']);
    }
    const { count: attCount, error: attErr } = await attQuery;

    // 2. Count game_progress
    let progQuery = supabase.from('game_progress').select('id', { count: 'exact', head: true });
    if (studentId !== 'ALL') {
      progQuery = progQuery.eq('student_id', studentId);
    }
    if (modeScope === 'SOLO') {
      progQuery = progQuery.in('mode', ['solo', 'SOLO']);
    } else if (modeScope === 'CHAMPIONSHIP') {
      progQuery = progQuery.in('mode', ['championship', 'CHAMPIONSHIP']);
    }
    const { count: progCount, error: progErr } = await progQuery;

    // 3. Count championship_participants
    let partCount = 0;
    if (modeScope === 'ALL' || modeScope === 'CHAMPIONSHIP') {
      let partQuery = supabase.from('championship_participants').select('id', { count: 'exact', head: true });
      if (studentId !== 'ALL') {
        partQuery = partQuery.eq('student_id', studentId);
      }
      const { count: cCount } = await partQuery;
      partCount = cCount || 0;
    }

    if (attErr || progErr) {
      return {
        ok: false,
        message: `Gagal menghitung jumlah data: ${attErr?.message || progErr?.message}`,
      };
    }

    return {
      ok: true,
      preview: {
        targetStudentName,
        gameAttemptsCount: attCount || 0,
        gameProgressCount: progCount || 0,
        championshipParticipantsCount: partCount,
      },
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal menghitung preview reset.' };
  }
}

/**
 * Downloads / Exports a backup of the target student(s) attempts, progress, and snapshot data
 * before executing the reset.
 */
export async function exportResetGameDataBackup(
  options: ResetGameDataOptions,
): Promise<{ ok: boolean; backupJson?: string; fileName?: string; message?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Koneksi Supabase belum aktif.' };
  }

  try {
    const studentId = options.studentId || 'ALL';
    const modeScope = options.modeScope || 'ALL';

    const [attRes, progRes, stRes, champPartRes] = await Promise.all([
      supabase.from('game_attempts').select('*'),
      supabase.from('game_progress').select('*'),
      supabase.from('student_profiles').select('id, auth_user_id, display_name, character, is_active, championship_data'),
      supabase.from('championship_participants').select('*'),
    ]);

    let attempts = attRes.data || [];
    let progress = progRes.data || [];
    let students = stRes.data || [];
    let participants = champPartRes.data || [];

    if (studentId !== 'ALL') {
      attempts = attempts.filter((a) => a.student_id === studentId);
      progress = progress.filter((p) => p.student_id === studentId);
      students = students.filter((s) => s.id === studentId);
      participants = participants.filter((cp) => cp.student_id === studentId);
    }

    if (modeScope === 'SOLO') {
      attempts = attempts.filter((a) => String(a.mode || '').toUpperCase() === 'SOLO');
      progress = progress.filter((p) => String(p.mode || '').toUpperCase() === 'SOLO');
      participants = [];
    } else if (modeScope === 'CHAMPIONSHIP') {
      attempts = attempts.filter((a) => String(a.mode || '').toUpperCase() === 'CHAMPIONSHIP');
      progress = progress.filter((p) => String(p.mode || '').toUpperCase() === 'CHAMPIONSHIP');
    }

    const backupData = {
      exportedAt: new Date().toISOString(),
      exportScope: options,
      summary: {
        attemptsCount: attempts.length,
        progressCount: progress.length,
        participantsCount: participants.length,
        studentsCount: students.length,
      },
      students,
      attempts,
      progress,
      championshipParticipants: participants,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const dateTag = new Date().toISOString().split('T')[0];
    const fileName = `AQUA_MATH_BACKUP_${studentId === 'ALL' ? 'ALL_STUDENTS' : studentId}_${modeScope}_${dateTag}.json`;

    return {
      ok: true,
      backupJson: jsonStr,
      fileName,
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal membuat file cadangan.' };
  }
}

/**
 * Executes the actual data reset for scores and progress (game_attempts, game_progress, championship_participants)
 * WITHOUT deleting student accounts (auth.users, student_profiles, teacher_profiles).
 * Clears local storage caches and re-syncs fresh state from Supabase.
 */
export async function executeResetStudentScoresAndProgress(
  options: ResetGameDataOptions,
): Promise<{
  ok: boolean;
  message: string;
  deletedAttemptsCount?: number;
  deletedProgressCount?: number;
  deletedParticipantsCount?: number;
  updatedStudents?: StudentProfile[];
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, message: 'Koneksi Supabase belum aktif.' };
  }

  const teacherCheck = await ensureVerifiedTeacherSessionAndProfile();
  if (!teacherCheck.ok) {
    return { ok: false, message: teacherCheck.message || 'Sesi guru tidak terverifikasi.' };
  }

  try {
    const studentId = options.studentId || 'ALL';
    const modeScope = options.modeScope || 'ALL';

    // 1. Delete game_attempts
    let attDelQuery = supabase.from('game_attempts').delete();
    if (studentId !== 'ALL') {
      attDelQuery = attDelQuery.eq('student_id', studentId);
    }
    if (modeScope === 'SOLO') {
      attDelQuery = attDelQuery.in('mode', ['solo', 'SOLO']);
    } else if (modeScope === 'CHAMPIONSHIP') {
      attDelQuery = attDelQuery.in('mode', ['championship', 'CHAMPIONSHIP']);
    }
    const { data: attDeleted, error: attErr } = await attDelQuery.select('id');

    // 2. Delete game_progress
    let progDelQuery = supabase.from('game_progress').delete();
    if (studentId !== 'ALL') {
      progDelQuery = progDelQuery.eq('student_id', studentId);
    }
    if (modeScope === 'SOLO') {
      progDelQuery = progDelQuery.in('mode', ['solo', 'SOLO']);
    } else if (modeScope === 'CHAMPIONSHIP') {
      progDelQuery = progDelQuery.in('mode', ['championship', 'CHAMPIONSHIP']);
    }
    const { data: progDeleted, error: progErr } = await progDelQuery.select('id');

    // 3. Delete championship_participants if scope involves Championship
    let partDeletedCount = 0;
    if (modeScope === 'ALL' || modeScope === 'CHAMPIONSHIP') {
      let partDelQuery = supabase.from('championship_participants').delete();
      if (studentId !== 'ALL') {
        partDelQuery = partDelQuery.eq('student_id', studentId);
      }
      const { data: partDeleted } = await partDelQuery.select('id');
      partDeletedCount = partDeleted?.length || 0;
    }

    if (attErr || progErr) {
      return {
        ok: false,
        message: `Gagal menghapus data permainan dari Supabase: ${attErr?.message || progErr?.message}`,
      };
    }

    // 4. Update student_profiles.championship_data to clear snapshot
    if (modeScope === 'ALL' || modeScope === 'CHAMPIONSHIP') {
      let profQuery = supabase.from('student_profiles').update({ championship_data: {} });
      if (studentId !== 'ALL') {
        profQuery = profQuery.eq('id', studentId);
      } else {
        profQuery = profQuery.neq('id', '00000000-0000-0000-0000-000000000000');
      }
      await profQuery;
    }

    // 5. Invalidate / Clear local storage caches so stale local data cannot restore old scores
    try {
      localStorage.removeItem('aqua_math_students_v1');
      localStorage.removeItem('aqua_math_offline_attempts_queue_v1');
    } catch {
      // ignore
    }

    // 6. Fetch fresh, verified Teacher Dashboard data from Supabase
    const freshData = await getTeacherDashboardData();

    const attemptsCount = attDeleted?.length || 0;
    const progressCount = progDeleted?.length || 0;

    return {
      ok: true,
      deletedAttemptsCount: attemptsCount,
      deletedProgressCount: progressCount,
      deletedParticipantsCount: partDeletedCount,
      updatedStudents: freshData.students,
      message: `Berhasil mereset data permainan (${attemptsCount} percobaaan, ${progressCount} progres). Seluruh akun siswa tetap aman!`,
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal menjalankan reset data permainan.' };
  }
}
