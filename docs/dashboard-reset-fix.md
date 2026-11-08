# Urgent Dashboard fix after a trial-data reset

Scope: runtime code on security/backend-auth-hardening after 3b46bf2. All four docs/game-season files remain unchanged. No migration, Auth/account modification, reset, deployment, push or production data operation is part of this fix.

## Confirmed code cause and operator evidence

The operator confirmed game_attempts and game_progress were emptied. The old aggregation path fell back to student_profiles.championship_data.verifiedAttempts/verifiedProgress when authoritative result arrays were empty, reviving deleted trial scores and unlocks. It also counted snapshot attempts as if they were live database rows. Dashboard refresh previously flushed pending student writes before reading results, so a supposedly read-only refresh could recreate old data.

## Changes

- Successful empty authoritative reads now mean zero scores, Level 1, no completed locations, no Championship ranking entries. Old snapshots and local cached scores cannot fill the gap, and snapshot hints cannot override the database's explicit mode/session.
- Dashboard reads and student hydration do not update account/profile snapshots. No stale snapshot is cleared in production; it is ignored for official scoring instead.
- Levels/completions are derived from verified per-mode attempts with the existing game rules. The single legacy game_progress row cannot grant levels/completions to the other mode or resurrect old unlocks. A progress-only/manual unlock without supporting attempts is no longer treated as official completion.
- Read all visible profiles/attempts/progress with exact counts and stable paginated ordering. Any source error, duplicate page or detected changing count fails the refresh rather than claiming a reset or incomplete total. Three separate HTTP queries are not an atomic database snapshot; a concurrent change can require another refresh.
- Dashboard refresh is read-only, coalesces concurrent refreshes and ignores responses after logout. It replaces the entire cache only after successful reads, runs on entry, focus, the existing Sync button and a 15-second interval. Failures visibly label the last displayed data unverified rather than replacing it with fabricated zeros.
- Pending attempts created by this version carry the local snapshot-free-v1 protocol marker. Older queued attempts (even with a known owner) are retained unchanged but not replayed automatically. This prevents a newly loaded fixed client from repopulating reset trial results at login. The marker is not a season ID, database migration, server-side reset epoch or authorization boundary. New pending rows still require the original owner/mode/session and database confirmation. Uncertain writes remain held.
- Championship session reads use status OPEN, based on the operator's production RPC finding, rather than the old is_active assumption. All existing owner checks, participant enforcement by RPC, original-session capture and database read-back remain. No enrollment/session data is created by tests.

## Safe verification performed locally

```sh
node --import tsx --import ./backend/offline-tests.ts --test backend/auth.test.ts src/game/rules.test.ts src/services/teacherAuth.test.ts src/services/compatibility.test.ts src/services/championship.test.ts src/services/dashboardResults.test.ts
npm run lint
npm run build
```

Optional browser regression (Playwright and Chromium must already be available): start the built app locally, then run `node scripts/check-dashboard-readonly.cjs`. It refuses a nonlocal origin, intercepts Supabase and backend verification with synthetic responses, denies every write request and blocks all other remote hosts. It checks stale snapshot/cache -> zero/Level 1, automatic polling -> separate SOLO 40 and Championship 90, explicit read failure, another empty reset, mobile rendering, retained old queue, and no page exceptions. The script is a UI regression, not a real production Auth/RLS/RPC integration test. Screenshots go to /tmp; no credentials or production data are logged.

Dashboard JSX/styles and 3D assets, animation, game rules and question data are unchanged; only Dashboard synchronization hooks changed. The operator's production reset is not executed again by these checks.

## Before any approved deployment

1. Review the branch. Current Vercel /api integration and TRUSTED_TEACHER_AUTH_IDS remain requirements from the security audit. A static-only deployment cannot be assumed to support the required authorized backend verification; hosting changes need separate review.
2. Read-only verify that the intended project really has status on championship_sessions and a permitted OPEN session with existing enrolled participants. is_active-only schemas now fail closed; do not guess or add a column. Production function source/return type and RLS read-back access still need confirmation.
3. Confirm authorized teacher SELECT visibility of all relevant rows. RLS can legitimately return zero visible rows without an HTTP error; the browser cannot distinguish that from a truly empty table without an independently verified access contract.
4. Use an approved nonproduction project for real save/reload/teacher-dashboard checks. Mock success is not proof of production SQL execution. The known UNIQUE(student_id) on legacy game_progress still limits persistence there. This fix derives independent displayed progress from authoritative per-mode attempts instead; it does not change that schema/RPC or implement Game Season. RPC atomicity and successful writes of both modes still require real nonproduction validation.
5. Only after deployment approval, ensure teacher/student devices load the new release (including PWA update/reload). Clients still running the old code may continue snapshot fallback or submit old queues. No client-only change can block all legacy server writes. Do not clear old queues or run the legacy reset to force a clean screen; hold/reconcile them.
6. Expected teacher screen after successful reads of the two emptied tables: scores 0, Level 1, empty leaderboard. A newly confirmed attempt should appear by the next successful refresh (normally within 15 seconds). If a table read fails, investigate the warning and access/routing instead of treating the display as verified current data.
