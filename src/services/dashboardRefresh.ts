import type { StudentProfile } from '../types/game';
export interface DashboardRead {
  students: StudentProfile[];
  totalAttemptsCount: number;
  supabaseConnected: boolean;
  error?: string;
}

/** Read-only refresh coordinator. It never submits pending student attempts. */
export function createDashboardRefresh(deps: {
  read: () => Promise<DashboardRead>;
  apply: (result: DashboardRead) => void;
  status: (message: string) => void;
  loading: (value: boolean) => void;
}) {
  let enabled = false;
  let revision = 0;
  let pending: Promise<void> | undefined;
  const failure = 'Sinkronisasi gagal. Nilai yang tampil adalah data terakhir dan belum terverifikasi; silakan muat ulang.';
  function setEnabled(value: boolean) {
    enabled = value;
    revision++;
    pending = undefined;
    deps.loading(false);
  }
  function refresh(): Promise<void> {
    if (!enabled) return Promise.resolve();
    if (pending) return pending;
    const version = revision;
    const current = () => enabled && version === revision;
    const task = (async () => {
      deps.loading(true);
      try {
        const data = await deps.read();
        if (!current()) return;
        if (!data.supabaseConnected) { deps.status(data.error || failure); return; }
        deps.apply(data); // Replace the whole cache, including successful all-zero results.
        deps.status(`Data berhasil disinkronkan dari Supabase! (${data.students.length} siswa, ${data.totalAttemptsCount} riwayat percobaan).`);
      } catch { if (current()) deps.status(failure); }
      finally { if (current()) deps.loading(false); }
    })();
    pending = task;
    void task.finally(() => { if (pending === task) pending = undefined; }).catch(() => {});
    return task;
  }
  return { setEnabled, refresh };
}
