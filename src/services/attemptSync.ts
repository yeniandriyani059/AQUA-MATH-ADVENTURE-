import { parseGameMode, validSessionId, confirmAttempt } from './championshipContract';
import type { SaveGameAttemptParams, SaveGameAttemptResult, PendingSyncAttempt } from './supabaseService';

export const ATTEMPT_PROTOCOL = 'snapshot-free-v1';
export const QUEUE_KEY = 'aqua_math_offline_attempts_queue_v1';
const RECEIPTS_KEY = 'aqua_math_confirmed_attempts_v1';
export interface AttemptContext {
  authUserId: string;
  studentId: string;
  // Must be a client pinned to this user's token, never the mutable shared Auth client.
  client: any;
}
export function createAttemptSync(deps: {
  storage: () => Storage;
  context: () => Promise<AttemptContext | null>;
  onConfirmed?: (context: AttemptContext, item: PendingSyncAttempt, id: string) => Promise<Partial<SaveGameAttemptResult>>;
}) {
  const inFlight = new Map<string, Promise<SaveGameAttemptResult>>();
  let flushing: Promise<{ syncedCount: number; remainingCount: number }> | undefined;
  const read = (): PendingSyncAttempt[] => {
    const rows = JSON.parse(deps.storage().getItem(QUEUE_KEY) || '[]');
    if (!Array.isArray(rows)) throw new Error('Invalid queue; preserve stored contents');
    return rows;
  };
  const write = (rows: PendingSyncAttempt[]) => deps.storage().setItem(QUEUE_KEY, JSON.stringify(rows));
  const pending = (message: string, score: number): SaveGameAttemptResult => ({ success: false, syncedToSupabase: false, score, message });
  const keyOf = (item: PendingSyncAttempt) => `${item.authUserId || 'legacy'}:${item.idempotencyKey}`;
  const fingerprint = (item: SaveGameAttemptParams) => JSON.stringify([item.studentId, item.authUserId, item.mode, item.sessionId || null, item.levelNumber, item.locationId, item.correctCount, item.wrongCount, item.durationSeconds]);
  const receipt = (item: PendingSyncAttempt) => {
    try { return JSON.parse(deps.storage().getItem(RECEIPTS_KEY) || '{}')[keyOf(item)]; } catch { return undefined; }
  };
  async function transmit(item: PendingSyncAttempt, ctx: AttemptContext): Promise<SaveGameAttemptResult> {
    const score = item.score;
    if (!item.authUserId || item.authUserId !== ctx.authUserId || item.studentId !== ctx.studentId)
      return pending('Antrean ditahan sampai siswa pemilik yang benar login.', score);
    if (item.protocolVersion !== ATTEMPT_PROTOCOL)
      return pending('Antrean dari versi sebelum perbaikan ditahan untuk pemeriksaan; tidak dihapus atau dikirim ulang otomatis.', score);
    const mode = parseGameMode(item.mode);
    if (!mode || (mode === 'solo' && item.sessionId != null)) return pending('Mode atau sesi ambigu; hasil ditahan tanpa mengubah mode.', score);
    const saved = receipt(item);
    if (saved && saved.fingerprint !== fingerprint(item)) return pending('ID percobaan sudah dipakai untuk hasil berbeda.', score);
    if (saved?.fingerprint === fingerprint(item)) {
      if (!await confirmAttempt(ctx.client, saved.id, ctx.studentId, mode, item.sessionId))
        return pending('Konfirmasi ulang database belum sesuai mode/sesi; hasil tidak dikirim ulang.', score);
      write(read().filter(row => keyOf(row) !== keyOf(item)));
      return { success: true, syncedToSupabase: true, score, attemptId: saved.id, studentId: item.studentId };
    }
    if (item.syncState === 'sending' || item.syncState === 'uncertain')
      return pending('Status penyimpanan belum pasti. Antrean ditahan untuk rekonsiliasi agar tidak menggandakan nilai.', score);
    if (mode === 'championship') {
      if (!validSessionId(item.sessionId)) return pending('Sesi Championship belum terikat pada hasil ini; antrean tetap disimpan.', score);
      const { data, error } = await ctx.client.from('championship_sessions').select('id, status').eq('id', item.sessionId).eq('status', 'OPEN').maybeSingle();
      if (error || data?.status !== 'OPEN' || data.id !== item.sessionId) return pending('Sesi Championship tidak tersedia atau tidak aktif; antrean tetap disimpan.', score);
    }
    // Persist before sending. A crash or timeout must never silently trigger a second write.
    write(read().map(row => keyOf(row) === keyOf(item) ? { ...row, syncState: 'sending' } : row));
    let response: any;
    try {
      response = await ctx.client.rpc('save_game_attempt', {
        p_mode: mode === 'championship' ? 'CHAMPIONSHIP' : 'SOLO',
        p_level_number: item.levelNumber, p_location_id: item.locationId,
        p_correct_count: item.correctCount, p_wrong_count: item.wrongCount,
        p_duration_seconds: item.durationSeconds, p_session_id: mode === 'championship' ? item.sessionId : null,
      });
    } catch {
      return pending('Koneksi terputus saat menyimpan. Antrean ditahan karena hasil database belum diketahui.', score);
    }
    const { data, error } = response;
    const id = typeof data === 'string' ? data : data?.attempt_id || data?.id;
    if (error || typeof id !== 'string' || !id || data?.ok === false || data?.success === false || (data?.student_id && data.student_id !== ctx.studentId)) {
      // SQLSTATE means the transaction was rejected; a transport/unknown failure is ambiguous.
      const state = error && /^[0-9A-Z]{5}$/.test(error.code || '') ? 'pending' : 'uncertain';
      write(read().map(row => keyOf(row) === keyOf(item) ? { ...row, syncState: state } : row));
      return pending('Database belum mengonfirmasi hasil. Antrean tetap disimpan.', score);
    }
    if (!await confirmAttempt(ctx.client, id, ctx.studentId, mode, item.sessionId)) {
      write(read().map(row => keyOf(row) === keyOf(item) ? { ...row, syncState: 'uncertain' } : row));
      return pending('Mode atau sesi hasil database belum sesuai. Antrean ditahan untuk pemeriksaan.', score);
    }
    const receipts = JSON.parse(deps.storage().getItem(RECEIPTS_KEY) || '{}');
    receipts[keyOf(item)] = { id, fingerprint: fingerprint(item) };
    deps.storage().setItem(RECEIPTS_KEY, JSON.stringify(receipts));
    write(read().filter(row => keyOf(row) !== keyOf(item)));
    let extra = {};
    try { extra = await deps.onConfirmed?.(ctx, item, id) || {}; } catch { /* confirmed attempt remains confirmed */ }
    return { ...extra, success: true, syncedToSupabase: true, score, attemptId: id, studentId: item.studentId, message: 'Nilai dikonfirmasi tersimpan oleh database.' };
  }
  let localLock: Promise<unknown> = Promise.resolve();
  async function locked<T>(action: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('aqua-math-attempt-sync', action);
    const result = localLock.then(action);
    localLock = result.catch(() => {});
    return result;
  }
  function save(params: SaveGameAttemptParams): Promise<SaveGameAttemptResult> {
    const flightKey = JSON.stringify([params.authUserId, params.studentId, params.idempotencyKey, fingerprint(params)]);
    const existing = inFlight.get(flightKey);
    if (existing) return existing;
    const task = locked(async () => {
      const score = Math.min(100, Math.max(0, params.correctCount * 10));
      try {
        let ctx: AttemptContext | null = null;
        try { ctx = await deps.context(); } catch { /* retain offline result */ }
        const item: PendingSyncAttempt = { ...params,
          authUserId: params.authUserId || (ctx?.studentId === params.studentId ? ctx.authUserId : undefined),
          idempotencyKey: params.idempotencyKey || crypto.randomUUID(), timestamp: Date.now(), score, syncState: 'pending', protocolVersion: ATTEMPT_PROTOCOL,
        };
        const previous = read().find(row => keyOf(row) === keyOf(item));
        if (previous && fingerprint(previous) !== fingerprint(item)) return pending('ID percobaan dipakai untuk hasil berbeda; hasil lama dipertahankan.', score);
        if (!previous) write([...read(), item]);
        if (!ctx) return pending('Hasil tersimpan dalam antrean; login sebagai pemilik untuk sinkronisasi.', score);
        return await transmit(previous || item, ctx);
      } catch { return pending('Sinkronisasi belum selesai. Periksa penyimpanan perangkat dan status antrean.', score); }
    });
    inFlight.set(flightKey, task);
    void task.finally(() => { if (inFlight.get(flightKey) === task) inFlight.delete(flightKey); });
    return task;
  }
  function flush() {
    if (flushing) return flushing;
    flushing = locked(async () => {
      let syncedCount = 0;
      try {
        // Re-resolve for every row. Each resulting request client is pinned to one token.
        for (const item of read()) {
          const ctx = await deps.context();
          if (ctx && (await transmit(item, ctx)).syncedToSupabase) syncedCount++;
        }
      } catch { /* preserve all unconfirmed rows */ }
      return { syncedCount, remainingCount: read().length };
    }).finally(() => { flushing = undefined; });
    return flushing;
  }
  return { read, save, flush };
}
