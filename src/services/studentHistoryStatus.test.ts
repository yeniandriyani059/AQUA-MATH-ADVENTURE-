import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyStudentProfile } from '../game/rules';
import { soloHistoryStatus, championshipHistoryStatus, matchesHistoryFilter, HISTORY_LABELS } from './studentHistoryStatus';
import type { ChampionshipState } from './championshipSessions';

const SESSION = '11111111-1111-4111-8111-111111111111';
const OLD = '22222222-2222-4222-8222-222222222222';
function profile() { return createEmptyStudentProfile('synthetic-student', 'Synthetic Student', 'bima'); }
function state(): ChampionshipState {
  return { session: { id: SESSION, session_name: 'Synthetic', created_by: 'teacher-profile', status: 'OPEN' },
    participants: [{ student_id: 'synthetic-student', session_id: SESSION, official_score: 0, completion_status: 'REGISTERED' }], attempts: [] };
}
function soloLocation(id: number, score = 0) {
  return { locationId: id, completed: true, latestScore: score, bestScore: score, latestCorrectCount: score / 10,
    bestCorrectCount: score / 10, bestTimeSeconds: 30, attemptsCount: 1, medal: 'none' as const, lastPlayedAt: '2020-01-01T00:00:00Z' };
}
test('historical SOLO scores for idle students mean ever played, never current activity', () => {
  for (const name of ['Synthetic Afina', 'Synthetic Afiz']) {
    const student = profile(); student.name = name;
    student.solo.locations[1] = soloLocation(1, 80); student.solo.bestTotalScore = 80;
    student.lastActiveAt = '2020-01-01T00:00:00Z';
    assert.equal(soloHistoryStatus(student), 'played');
    assert.equal(HISTORY_LABELS[soloHistoryStatus(student)], 'Pernah Bermain');
    assert.equal(championshipHistoryStatus(student.id, state()), 'not_started');
  }
});
test('recent login, account active and Championship history do not establish SOLO results', () => {
  const student = profile(); student.isActive = true; student.lastActiveAt = new Date().toISOString();
  student.championship.totalChampionshipScore = 900; student.championship.completedLevels = [1,2,3,4,5];
  assert.equal(soloHistoryStatus(student), 'not_started');
});
test('zero-score completed mission is history; completion requires ten distinct completed locations', () => {
  const student = profile(); student.solo.locations[1] = soloLocation(1);
  assert.equal(soloHistoryStatus(student), 'played');
  student.solo.completedLevels = [1,2,3,4,5];
  assert.equal(soloHistoryStatus(student), 'played');
  for (let id = 1; id <= 10; id++) student.solo.locations[id] = soloLocation(id);
  const before = JSON.stringify(student);
  assert.equal(soloHistoryStatus(student), 'finished'); assert.equal(JSON.stringify(student), before);
  student.solo.locations[10].completed = false;
  assert.equal(soloHistoryStatus(student), 'played');
});
test('Championship only uses selected-session owner/mode results, not old or SOLO attempts', () => {
  const data = state();
  data.attempts = Array.from({ length: 10 }, (_, i) => ({ student_id: 'synthetic-student', session_id: OLD, mode: 'CHAMPIONSHIP', location_id: String(i + 1) }));
  data.attempts.push({ student_id: 'other-student', session_id: SESSION, mode: 'CHAMPIONSHIP', location_id: '1' });
  data.attempts.push({ student_id: 'synthetic-student', session_id: SESSION, mode: 'SOLO', location_id: '1' });
  assert.equal(championshipHistoryStatus('synthetic-student', data), 'not_started');
  data.attempts.push({ student_id: 'synthetic-student', session_id: SESSION, mode: 'CHAMPIONSHIP', location_id: '1', score: 0 });
  assert.equal(championshipHistoryStatus('synthetic-student', data), 'played');
  data.attempts.push(...Array.from({ length: 10 }, () => ({ student_id: 'synthetic-student', session_id: SESSION, mode: 'CHAMPIONSHIP', location_id: '1' })));
  assert.equal(championshipHistoryStatus('synthetic-student', data), 'played');
  data.attempts.push(...Array.from({ length: 10 }, (_, i) => ({ student_id: 'synthetic-student', session_id: SESSION, mode: 'CHAMPIONSHIP', location_id: String(i + 1) })));
  const before = JSON.stringify(data);
  assert.equal(championshipHistoryStatus('synthetic-student', data), 'finished'); assert.equal(JSON.stringify(data), before);
});
test('persistent PLAYING participant flag and OPEN/CLOSED session never imply live presence', () => {
  const data = state(); data.participants[0].completion_status = 'PLAYING';
  for (const status of ['OPEN','CLOSED'] as const) {
    data.session!.status = status;
    assert.equal(championshipHistoryStatus('synthetic-student', data), 'played');
  }
});
test('unverified Championship, absent session and missing membership stay distinct from no results', () => {
  assert.equal(championshipHistoryStatus('synthetic-student', null), 'unverified');
  assert.equal(championshipHistoryStatus('synthetic-student', { session: null, participants: [], attempts: [] }), 'no_session');
  assert.equal(championshipHistoryStatus('unregistered-student', state()), 'not_registered');
});
test('history filters include finished students as ever played but never confuse unknown with empty history', () => {
  assert.equal(matchesHistoryFilter('finished', 'played'), true);
  assert.equal(matchesHistoryFilter('played', 'finished'), false);
  assert.equal(matchesHistoryFilter('not_started', 'played'), false);
  assert.equal(matchesHistoryFilter('unverified', 'not_started'), false);
  assert.equal(matchesHistoryFilter('no_session', 'not_started'), false);
});
