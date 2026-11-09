import type { StudentProfile } from '../types/game';
import type { ChampionshipState } from './championshipSessions';
import { applySupabaseAttemptsAndProgressToProfile, projectChampionshipSession } from './supabaseService';

/** Display-only projection. Never persist this over the canonical student cache. */
export function championshipDashboardStudents(students: StudentProfile[], state: ChampionshipState | null): StudentProfile[] {
  return students.map(student => {
    const projected = state?.session
      ? projectChampionshipSession(student, state.attempts, state.session.id)
      : { ...student, championship: applySupabaseAttemptsAndProgressToProfile(student, []).championship };
    const participant = state?.participants.find(p => p.student_id === student.id && p.session_id === state.session?.id);
    return { ...projected, championship: { ...projected.championship,
      totalChampionshipScore: Number(participant?.official_score || 0),
      academicGrade: Number(participant?.official_score || 0) / 10 } };
  });
}
