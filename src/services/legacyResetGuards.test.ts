import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

// Execute the actual OLD reset function against mocks, not a rewritten model.
// No old module imports, network, DB connection or production credentials.
const legacy = execFileSync('git', ['show', '69f9e5d:src/services/supabaseService.ts'], { encoding: 'utf8' });
function compileFunction(name: string, context: Record<string, any>) {
  const declaration = legacy.indexOf(`function ${name}(`);
  assert.ok(declaration >= 0);
  const start = legacy.lastIndexOf('\n', declaration) + 1;
  const end = legacy.indexOf('\n}\n', declaration) + 3;
  assert.ok(end > declaration);
  let source = legacy.slice(start, end);
  if (!source.startsWith('export ')) source = `export ${source}`;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs', target: 'node22' }).code,
    { module, exports: module.exports, ...context }, { timeout: 1000 });
  return module.exports[name];
}
function resetHarness(webDeleteGuard: boolean) {
  const storage = new Map([
    ['aqua_math_students_v1', 'synthetic-student-cache'],
    ['aqua_math_offline_attempts_queue_v1', 'synthetic-unsynced-attempt'],
  ]);
  const calls: string[] = [];
  const context = {
    isSupabaseConfigured: true,
    ensureVerifiedTeacherSessionAndProfile: async () => ({ ok: true }),
    getTeacherDashboardData: async () => { calls.push('dashboard'); return { students: [] }; },
    localStorage: { removeItem(key: string) { calls.push(`remove:${key}`); storage.delete(key); } },
    supabase: { from(table: string) {
      let action = '';
      const response = () => ({ data: [], error: action === 'update' || webDeleteGuard
        ? { code: '42501', message: 'Synthetic guard denial' } : null });
      const q: any = { delete() { action = 'delete'; calls.push(`delete:${table}`); return q; },
        update() { action = 'update'; calls.push(`update:${table}`); return q; },
        eq() { return q; }, in() { return q; }, neq() { return q; },
        select: async () => response(),
        then(resolve: any, reject: any) { return Promise.resolve(response()).then(resolve, reject); },
      }; return q;
    } },
  };
  return { reset: compileFunction('executeResetStudentScoresAndProgress', context), storage, calls };
}
test('negative control: old reset ignores snapshot UPDATE denial and erases queue after zero-row DELETE success', async () => {
  const h = resetHarness(false);
  const result = await h.reset({ studentId: 'ALL', modeScope: 'ALL' });
  assert.equal(result.ok, true); assert.equal(h.storage.size, 0);
  assert.ok(h.calls.includes('update:student_profiles'));
});
test('statement DELETE denial stops real old reset before profile updates and queue/cache cleanup in every scope', async () => {
  for (const modeScope of ['ALL', 'SOLO', 'CHAMPIONSHIP']) for (const studentId of ['ALL', 'synthetic']) {
    const h = resetHarness(true);
    const before = [...h.storage.entries()];
    const result = await h.reset({ studentId, modeScope });
    assert.equal(result.ok, false); assert.deepEqual([...h.storage.entries()], before);
    assert.ok(!h.calls.some(c => c.startsWith('update:') || c.startsWith('remove:') || c === 'dashboard'));
  }
});
test('old score snapshot mirror ignores denied cache update and still returns committed assessment rows', async () => {
  let denied = false;
  const sync = compileFunction('syncVerifiedSupabaseProgressToStudentProfileRow', {});
  const client = { from(table: string) {
    let update = false;
    const q: any = {
      select() { return q; }, eq() { return q; }, order() { return q; },
      update() { update = true; return q; },
      maybeSingle: async () => ({ data: { championship_data: { preserve: true } } }),
      then(resolve: any, reject: any) {
        if (update) denied = true;
        return Promise.resolve(update ? { error: { code: '42501' } }
          : { data: table === 'game_attempts' ? [{ id: 'synthetic-committed-solo', mode: 'SOLO', score: 80 }] : [] }).then(resolve, reject);
      },
    }; return q;
  } };
  const result = await sync(client, 'synthetic-profile');
  assert.equal(denied, true); assert.equal(result.attemptsRows[0].score, 80);
});
