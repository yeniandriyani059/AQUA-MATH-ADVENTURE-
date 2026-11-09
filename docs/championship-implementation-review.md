> Superseded by `docs/championship-db-finalization.md` and `docs/sql/aqua-championship.final.review.sql`. The text below records the earlier checkpoint, not the current implementation.

# AQUA Championship implementation review

Development branch: security/backend-auth-hardening, based on 38fd803.
No SQL, reset, production login/save, push, merge or deployment is performed.
All four Game Season draft files are preserved. No 3D assets, animations,
characters, questions, SOLO scoring code, Vercel routing or preview guard changed.

## Files and contracts

- `src/services/championshipSessions.ts`: authoritative teacher reads, 14 explicit
  profile IDs, owner/role validation, exact roster readback, raw DB error messages,
  lifecycle RPCs and student discovery validation. No localStorage session fallback.
- `supabaseService.ts`: removes direct session INSERT and cached session ID; pins
  student discovery client to the current student access token. Teacher opening
  retains the existing backend verification before the internally authorized RPC.
- `App.tsx`: uses current database membership before each Championship mission.
  Captured mode, owner, session and attempt ID are unchanged during the mission.
  SOLO access gate stays unchanged. Old local Championship toggle is ignored.
- `TeacherDashboard.tsx`: database-backed status, read-only focus/15-second polling,
  confirmed open/close, session-specific participants + official_score leaderboard.
  Level cards use attempts only from the selected session. No updates to shared
  student/SOLO state from Championship projections. Legacy destructive leaderboard
  reset button is disabled, not repurposed as session closure. Existing layout/CSS
  remains; status/error text reflects the new backend lifecycle.
- `attemptSync.ts`: rejected saves include original DB error; ownership/mode/session,
  ambiguous-write holds and old-queue preservation are unchanged.
- `docs/sql/aqua-championship-rpcs.review.sql`: two lifecycle RPCs, private roster
  and teacher helpers, two teacher SELECT policies; plus ONE read-only student
  discovery RPC. That extra RPC is necessary because students cannot read the
  teacher profile under its existing own-profile-only RLS. It returns only the
  caller's active profile's AQUA OPEN memberships. No new teacher-profile policy.
- `docs/sql/aqua-save-game-attempt-locking.review.md`: blocking production-function
  patch specification, best-per-mission scoring and durable retry design.

The administration SQL is idempotent for these exact definitions (CREATE OR
REPLACE / named policy replacement). Its runtime OPEN operation deliberately
rejects an existing OPEN session instead of making duplicates on click/retry.
CLOSE is repeatable for the same owned session. Lifecycle errors trigger a fresh
read before another action; the frontend never treats an unconfirmed write as
success. Roster failure rolls back opening. Existing pupil policies stay intact;
no grants for direct table writes and no RLS disable/USING(true).

## Deployment blockers and limits

1. Full production `save_game_attempt` source is still not supplied. A summary of
   SELECT/MAX/additive-score behavior cannot safely produce a replacement shared
   function. Its actual lock/idempotency/best-score patch is NOT implemented.
2. The seven-argument API cannot accept the frontend request UUID. Durable
   request receipts and a backwards-compatible, AQUA-scoped save contract are
   required before claiming technical retry idempotency. Best-per-mission is the
   user-approved rule, not yet a production or local SQL implementation.
3. Do NOT apply the administration SQL or enable Championship before the complete
   save patch is reviewed and tested in PostgreSQL. Existing deployed candidate
   still runs 38fd803; these local changes are not installed there.
4. Check actual defaults/column types and existing function-name collisions before
   installation in a shared project. Functions must be owned by the trusted
   migration role; untrusted roles must not create objects in public or alter
   teacher profiles, roster functions or participant records.
5. Teacher SELECT on attempts already works according to the operator; existing
   own-attempt student SELECT must remain. SELECT policies are OR-combined.
6. No historical scores are recalculated. The official score read is the stored
   value; if legacy additive data exists it is not silently rewritten here.
7. Existing student mode progress/unlock and game summary rules are retained;
   this change does not implement per-season resets or progression. The level
   cards retain best-per-mission interpretation, scoped to the selected session.

## Verification and candidate procedure

Run the Node mock regression suite including `championshipSessions.test.ts`,
`npm run lint`, `npm run build`; run the two local browser scripts with Playwright
and Chromium. Browser scripts reject nonlocal origins and intercept all Supabase
traffic. Synthetic RPC responses are not evidence of live PostgreSQL correctness.

After approved SQL/save patch + local DB concurrency tests, and only after
separate push/deployment approval, update aqua-adventure-test (never the main
website). First read-only check: teacher verify, existing SOLO values for Afina
and Afiz, status, roster and official leaderboard. Creating a session/participants
or submitting a score on that website WRITES THE SHARED PRODUCTION DATABASE and
requires explicit permission. Do not use real SOLO replays as regression setup.
Preserve all accounts, attempts, queues, production env/preview guards and the
main project's domain. No reset, deletion or cleanup of live scores is part of
this plan. Compare Afina/Afiz SOLO attempt IDs/scores and game_progress before and
after any separately approved Championship smoke test.

## Local results (2026-11-09)

- Node regression suite: 101 passed, 0 failed (94 existing + 7 lifecycle/discovery
  tests). Includes backend auth/routing, SOLO rules, account-switch queue ownership,
  Championship mode/session preservation, retry holds and Dashboard source reads.
- TypeScript (`npm run lint`): passed.
- Production build (`npm run build`): passed; existing Vite config/chunk-size
  warnings remain. Build does not verify production Supabase RPCs.
- `check-dashboard-readonly.cjs`: passed desktop/mobile, polling, read failures,
  legacy queue preservation and no write requests.
- `check-championship-controls.cjs`: passed stale local flag vs DB state,
  confirmed opening/14 participants, authoritative official score, raw error,
  confirmed closing, unchanged synthetic SOLO and no page errors/unmocked writes.
- SQL files have NOT been executed or compiled against PostgreSQL. Real RLS,
  transaction locks, idempotency and best-score SQL behavior remain unverified.
- No real account login or production result write was performed.
