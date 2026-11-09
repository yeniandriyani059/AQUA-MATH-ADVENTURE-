import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createEmptyStudentProfile } from '../game/rules';
import { championshipDashboardStudents } from './championshipDashboard';
import { loadStudents, saveStudents } from './gameStorage';
import { OFFICIAL_14_STUDENTS } from './supabaseService';
import { containsRetiredCredential } from '../../scripts/check-public-artifacts.mjs';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
test('every dashboard projection isolates two sessions and preserves SOLO/reference source', () => {
 const student = createEmptyStudentProfile('student', 'Synthetic', 'bima');
 student.solo.bestTotalScore = 80; student.championship.totalChampionshipScore = 999;
 const before = JSON.stringify(student);
 const attempts = [A, B].map((session_id, i) => ({ id: session_id, session_id, student_id: student.id, mode: 'CHAMPIONSHIP', location_id: '1', level_number: 1, score: i ? 40 : 100, correct_count: i ? 4 : 10, wrong_count: i ? 6 : 0, completed_at: '2026-11-09' }));
 for (const [id, score] of [[A, 100], [B, 40]] as const) {
  const view = championshipDashboardStudents([student], { session: { id, status: 'CLOSED', session_name: id, created_by: 'teacher' }, attempts, participants: [{ student_id: student.id, session_id: id, official_score: score }] })[0];
  assert.equal(view.championship.totalChampionshipScore, score);
  assert.equal(view.championship.locations['1'].championshipScore, score);
  assert.equal(view.solo, student.solo);
 }
 assert.equal(JSON.stringify(student), before);
 assert.equal(championshipDashboardStudents([student], null)[0].championship.totalChampionshipScore, 0);
});
test('roster keeps 14 login identities without embedded credentials; legacy SQL removed', () => {
 assert.equal(OFFICIAL_14_STUDENTS.length, 14);
 assert.ok(OFFICIAL_14_STUDENTS.every(s => !('defaultPassword' in s)));
 assert.ok(!readFileSync('src/services/supabaseClient.ts', 'utf8').includes('SUPABASE_SCHEMA_SQL'));
});
test('public build guard rejects synthetic retired credential without requiring plaintext fixtures', () => {
 const synthetic = 'synthetic-example-only';
 const checks = [{ length: synthetic.length, sha256: createHash('sha256').update(synthetic).digest('hex') }];
 assert.equal(containsRetiredCredential(`prefix ${synthetic} suffix`, checks), true);
 assert.equal(containsRetiredCredential('safe bundle', checks), false);
});

test('legacy cached password hints are scrubbed without changing scores, identity, auth or queue', () => {
 const data = new Map<string, string>();
 const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
 Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) } });
 try {
  const profile = createEmptyStudentProfile('student', 'Synthetic', 'bima'); profile.solo.bestTotalScore = 80;
  data.set('aqua_math_students_v1', JSON.stringify([{ ...profile, tempPasswordHint: 'synthetic-only', defaultPassword: 'synthetic-only' }]));
  data.set('aqua_math_offline_attempts_queue_v1', 'preserve queue'); data.set('auth', 'preserve auth');
  const loaded = loadStudents(); assert.equal(loaded[0].solo.bestTotalScore, 80); assert.equal(loaded[0].id, profile.id);
  assert.equal('tempPasswordHint' in loaded[0], false);
  saveStudents(loaded);
  assert.equal(data.get('aqua_math_students_v1')?.includes('synthetic-only'), false);
  assert.equal(data.get('auth'), 'preserve auth'); assert.equal(data.get('aqua_math_offline_attempts_queue_v1'), 'preserve queue');
 } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});
