import type { StudentProfile } from '../types/game';
import type { ChampionshipState } from './championshipSessions';
import { parseGameMode, validSessionId } from './championshipContract';

// Historical evidence only. No presence/heartbeat source exists in this app.
export type HistoryStatus = 'not_started' | 'played' | 'finished' | 'unverified' | 'no_session' | 'not_registered';
export type HistoryFilter = 'all' | 'not_started' | 'played' | 'finished';
export const HISTORY_LABELS: Record<HistoryStatus, string> = {
  not_started: 'Belum Ada Hasil', played: 'Pernah Bermain', finished: 'Selesai 10 Misi',
  unverified: 'Belum Terverifikasi', no_session: 'Belum Ada Sesi', not_registered: 'Belum Terdaftar',
};
function completedStatus(locations: Set<number>, hasResult: boolean): HistoryStatus {
  if (locations.size === 10) return 'finished';
  return locations.size > 0 || hasResult ? 'played' : 'not_started';
}
function validLocation(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= 10 ? id : null;
}
export function soloHistoryStatus(student: StudentProfile): HistoryStatus {
  const completed = new Set<number>();
  for (const location of Object.values(student.solo.locations)) {
    const id = validLocation(location.locationId);
    if (location.completed && id !== null) completed.add(id);
  }
  return completedStatus(completed, student.solo.latestTotalScore > 0 || student.solo.bestTotalScore > 0);
}
export function championshipHistoryStatus(studentId: string, state: ChampionshipState | null): HistoryStatus {
  if (!state) return 'unverified';
  if (!state.session) return 'no_session';
  if (!validSessionId(state.session.id)) return 'unverified';
  const participant = state.participants.find(p => p.student_id === studentId && p.session_id === state.session!.id);
  if (!participant) return 'not_registered';
  const attempts = state.attempts.filter(a => a.student_id === studentId && a.session_id === state.session!.id && parseGameMode(a.mode) === 'championship');
  const completed = new Set<number>();
  for (const attempt of attempts) {
    const id = validLocation(attempt.location_id);
    if (id !== null) completed.add(id);
  }
  // PLAYING is a durable database state, NOT evidence of current online activity.
  return completedStatus(completed, attempts.length > 0 || Number(participant.official_score) > 0 ||
    ['PLAYING', 'COMPLETED'].includes(participant.completion_status));
}
export function matchesHistoryFilter(status: HistoryStatus, filter: HistoryFilter): boolean {
  return filter === 'all' || (filter === 'played' ? status === 'played' || status === 'finished' : status === filter);
}
