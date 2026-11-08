import type { GameMode } from '../types/game';

export function parseGameMode(value: unknown): GameMode | null {
  if (typeof value !== 'string') return null;
  const mode = value.trim().toLowerCase();
  return mode === 'solo' || mode === 'championship' ? mode : null;
}
export function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export interface MissionRun {
  readonly studentId: string;
  readonly authUserId?: string;
  readonly locationId: number;
  readonly mode: GameMode;
  readonly sessionId: string | null;
  readonly idempotencyKey: string;
}
export async function captureMissionRun(
  input: { studentId: string; authUserId?: string; locationId: number; mode: GameMode },
  getSession: () => Promise<{ id: string } | null>,
): Promise<MissionRun> {
  const mode = parseGameMode(input.mode);
  if (!mode) throw new Error('Mode permainan tidak valid.');
  const session = mode === 'championship' ? await getSession() : null;
  if (mode === 'championship' && !validSessionId(session?.id)) throw new Error('Sesi Championship aktif belum dapat diverifikasi. Hubungi Guru atau coba kembali saat tersambung.');
  return Object.freeze({ ...input, mode, sessionId: session?.id || null, idempotencyKey: crypto.randomUUID() });
}

// An RPC acknowledgement alone cannot establish which mode/session was actually stored.
export async function confirmAttempt(client: any, id: string, studentId: string, mode: GameMode, sessionId?: string | null): Promise<boolean> {
  const { data, error } = await client.from('game_attempts').select('id, student_id, mode, session_id')
    .eq('id', id).eq('student_id', studentId).maybeSingle();
  return !error && data?.id === id && data.student_id === studentId && parseGameMode(data.mode) === mode &&
    (mode === 'championship' ? validSessionId(sessionId) && data.session_id === sessionId : data.session_id == null);
}
