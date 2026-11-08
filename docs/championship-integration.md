# Championship integration audit

No database writes, RPC calls, deployment or production credentials are required for this audit. Run only the SELECT statements in `docs/sql/supabase-championship-audit.sql` through an authorized operator in Supabase SQL Editor. The current public client does not establish access to PostgreSQL catalogs. Metadata access has not been verified, and the production RPC definition is not in this repository. The SQL file has not been run against production. Inspect output before sharing: redact any credentials embedded in historical function definitions; never execute those definitions.

## Expected RPC contract to verify

- `public.save_game_attempt(p_mode, p_level_number, p_location_id, p_correct_count, p_wrong_count, p_duration_seconds, p_session_id)` must accept the exact names and types used by the callers. Verify all overloads/defaults, mode enum/text labels, and return type. Callers accept a scalar attempt ID or object with `attempt_id`/`id`; a SETOF array is not assumed compatible.
- `p_mode` is explicitly `SOLO` or `CHAMPIONSHIP`, never silently defaulted/cast to SOLO on invalid input or failure. Read back the persisted row and verify ID, owner, mode and session before acknowledging success. Read-back denial/failure holds the pending result; it does not authorize a retry or prove rollback.
- Resolve the student from `auth.uid()` and a unique existing active student profile. Do not trust a supplied student ID or user-editable role. Reject anonymous, inactive or unrelated users.
- Championship requires an existing active session and authorization to participate. SOLO must not carry a Championship session. A foreign key proves existence, not active status or participant authorization; these need RPC/policy enforcement in the same transaction.
- Attempt insert, correct-mode progress upsert and participant score update must be atomic. Conflict targets and triggers must preserve mode/session separation; no failure branch may insert a SOLO attempt for Championship. Audit exception handlers, nested functions and triggers too.
- RLS/grants must allow the owner to read their confirmed attempt (including mode/session), their profile/progress, and a permitted active Championship session. Authorized teachers need appropriate read access for the Dashboard. Do not add permissive rules or disable RLS to satisfy these checks.
- Check function owner, `SECURITY DEFINER`, trusted `search_path`, EXECUTE grants and explicit authorization. Definer functions may bypass table RLS; policies alone do not prove safety.
- Verify PK/FK/CHECK/UNIQUE constraints, nullability/defaults, indexes and existing mode labels. In particular check student+mode progress uniqueness, student+session participant uniqueness, session foreign keys and handling of multiple active sessions. Do not infer undocumented columns on game_progress.
- Exactly-once delivery across devices remains unverified: no server-side idempotency argument has been approved. Uncertain writes remain held for reconciliation, not replayed automatically.

## Code behavior and intentional compatibility limits

Mode and Championship session are captured before opening a mission and kept in a frozen run context. A mission cannot start in Championship using only a stale localStorage session. If the database is unreachable or active sessions are ambiguous, entry is refused with the existing toast. After a mission has started, offline results retain that original session. A closed/invalid session holds the queue without selecting a replacement. Unknown queue modes are retained, not sent as SOLO. Uppercase valid modes are recognized explicitly.

Dashboard hydration accepts only explicit known modes. Unknown modes, Championship attempts without valid session IDs, and SOLO attempts conflicting with session/snapshot Championship hints are excluded from score aggregation without modifying the stored data. This can reduce displayed totals for inconsistent legacy records; investigate them read-only rather than rewriting historical assessments. Query selections include session_id so the same classifier can run after login, sync and Dashboard loading. Snapshot hints never convert a SOLO row into a Championship row.

The Dashboard still aggregates historical Championship sessions; active-session-only ranking and Game Season are not implemented here. Existing progress rows are distinguished by explicit mode, but their production conflict keys and trigger behavior remain unverified.

## Vercel recommendation — no hosting changes applied

The repository builds a Vite frontend to dist. There is no vercel.json or api entrypoint establishing `/api/*`, and server.ts exports a factory rather than a ready Vercel handler. Existing netlify.toml SPA redirects are not Vercel Functions configuration. The actual Vercel project's framework and route settings have not been inspected, so compatibility is not established.

Preferred option for review: serve dist and the Express API on the same origin using Vercel's supported Express/Functions integration, with an explicit application entrypoint that creates/exports the app and API routing ahead of the SPA fallback. Do not invoke the standalone long-running listener in a Function. Pin a supported Node version, ensure backend files are bundled, and test cold starts, JSON errors, request limits and Auth header forwarding. Verify current Vercel runtime support before writing configuration; this is an architecture recommendation, not a tested deployment recipe.

Alternative: run Express on a managed Node host and proxy `/api/*` from the frontend domain. This preserves relative fetch URLs but adds a service, routing/timeout configuration and operational overhead. A separate browser API origin would additionally require an explicit API base URL, restrictive CORS and Auth callback review. Select an approach before implementation.

Frontend build variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Backend runtime variables: SUPABASE_URL (or VITE_SUPABASE_URL), VITE_SUPABASE_ANON_KEY, TRUSTED_TEACHER_AUTH_IDS. Keep all environments on their intended Supabase project; never expose the teacher allowlist with a VITE_ prefix. No service-role key is used or requested.

## Isolated integration acceptance scenarios

Use synthetic teachers/students and sessions in an approved nonproduction project, with production egress blocked. No production data is copied or modified.

1. SOLO completion changes only SOLO totals/progress; Championship completion changes only Championship totals/progress.
2. Start Championship in S1, then activate S2 while the mission is open. Completion still submits S1; if S1 is closed the result is held, never reassigned or converted to SOLO.
3. Reject RPC, simulate timeout after commit, deny read-back, and return an unexpected mode/session. Never acknowledge a false confirmation or issue a fallback SOLO write.
4. Retry after a definitive SQL rejection and test concurrent submissions using the same mission key. Uncertain writes remain held; account B cannot send A's pending results.
5. Reload/login on a second device, refresh tokens and load the teacher Dashboard; verify known totals against database reads, not localStorage snapshots.
6. Validate actual overload/return shape and atomic progress/participant updates using the approved test RPC. Verify RLS as anon, each student, unrelated user and authorized teacher. Do not execute reset functions.
7. Confirm unchanged game visuals with browser checks after hosting integration is approved; source-only checks are not a visual browser test.

## Local verification command

```sh
node --import tsx --import ./backend/offline-tests.ts --test backend/auth.test.ts src/game/rules.test.ts src/services/teacherAuth.test.ts src/services/compatibility.test.ts src/services/championship.test.ts
npm run lint
npm run build
```

The local tests use mocks and deny external fetches. They verify application mode/session propagation and aggregation, not the production RPC or browser interaction. If the database rewrites a Championship attempt into SOLO while also dropping all session/origin evidence, an independent Dashboard cannot infer the lost origin from that row. Production isolation therefore requires the RPC/trigger/constraint audit; read-back detection prevents false acknowledgements but cannot roll back a transaction already committed by the database.
