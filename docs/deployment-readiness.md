# Final deployment readiness review — after b0d7202

**Decision: NOT READY for the complete SOLO + Class Championship learning workflow.** Local checks pass, but required Championship records are absent, production routing/settings cannot yet be inspected from this executor, and authenticated real-service integration has not been exercised. No push, merge, deployment, reset, migration or production write was performed.

## Evidence levels

- Operator-supplied production facts: 14 student_profiles, 2 teacher_profiles, 0 game_attempts, 0 game_progress, 0 championship_sessions and 0 championship_participants. These counts are reported by the operator, not re-queried by this review.
- Operator-supplied audited RPC contract: public.save_game_attempt(text, integer, text, integer, integer, integer DEFAULT 0, uuid DEFAULT NULL) -> jsonb, SECURITY DEFINER, search_path ''. It derives student identity from auth.uid(), validates mode/level/counts, requires OPEN session + registered participant for Championship, updates official_score for Championship and game_progress for SOLO. This review does not claim independent execution or inspection of the function body.
- Real read-only network probe: Supabase auth/v1/health returned HTTP 200 using the public client key already present in the repository. No login/RPC write was attempted. This is connectivity evidence only.
- Real Vercel probes: GET /, /api/admin/verify, /api/admin/students and /api/student/save-attempt at https://aqua-adventure-nine.vercel.app were blocked by the Codex proxy (curl CONNECT tunnel failure, HTTP 403). This is NOT a Vercel/application response and does not establish route health or failure. The environment currently allows the Supabase domain, not this Vercel domain. Do not bypass the proxy; allow the exact hostname through environment settings or obtain an operator read-only routing check.
- Available cloud process/configuration: no SUPABASE_URL/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TRUSTED_TEACHER_AUTH_IDS or Vercel control-plane bindings. Only .env.example is present. This does NOT prove the remote Vercel environment lacks them. No Vercel connector, linked .vercel/project.json, api entrypoint, vercel.json or workflow was found.

## Minimal code corrections in this review

1. Both existing save callers serialize p_location_id as text (String of the game's numeric location ID), matching the audited signature. The game still uses locations 1..10 internally. The backend and pending queue reject fractional durations and invalid count/level inputs rather than relying on coercion. Normal quiz elapsed time is already an integer counter.
2. RPC JSONB success/attempt_id/student_id/mode/score/count/attempt_number shape is represented in mocks. A body with success=false, HTTP/SQL error, missing acknowledgement or wrong persisted mode/session never reports success. No SOLO fallback is added.
3. Unknown API paths return JSON 404 instead of falling through to the SPA HTML document. Malformed JSON and oversized/failed API requests get sanitized JSON errors. This fixes local Express behavior; it is not a Vercel adapter or deployment configuration.

## Required API route inventory

All paths below belong to the same Express instance. Vercel must forward the original method/path/body/Authorization header for the complete /api prefix before SPA rewrites. No path may be assumed present just because the frontend returned index.html.

| Method | Path | Purpose / expected restriction |
| --- | --- | --- |
| GET | /api/admin/verify | Mandatory teacher login/session gate; valid Supabase user + trusted server UUID + existing teacher profile |
| POST | /api/admin/login | Backend login alternative; no default credentials |
| POST | /api/admin/register | Intentionally refused; no automatic teacher role/profile |
| GET | /api/admin/students | Authorized roster |
| PUT | /api/admin/students/:id | Authorized profile/status change; NOT exercised on production |
| DELETE | /api/admin/students/:id | Authorized deletion path; NOT exercised on production |
| POST | /api/admin/provision-students | Intentionally unavailable after authorization |
| POST | /api/admin/students | Auth account creation intentionally unavailable |
| POST | /api/admin/reset-student-password | Intentionally unavailable |
| POST | /api/student/verify-access | Class-code read flow |
| POST | /api/student/login | Existing username/password mapping; live login NOT tested |
| POST | /api/student/select-identity | Authenticated owner only |
| POST | /api/student/save-attempt | Authenticated owner + audited RPC + persisted-mode/session read-back |

Local route tests check the 13 paths, wrong method/unknown path and malformed JSON without contacting Supabase. Authorized mock tests check owner/teacher restrictions and RPC handling. The browser's primary student login/save and teacher results query still use Supabase directly; API routing alone is not a substitute for correct RLS.

## Vercel gap and proposed minimum hosting work (not applied)

npm run build produces dist via Vite. server.ts exports createBackendApp, not an instantiated Vercel handler, and its listener starts when invoked as a standalone program. netlify.toml does not configure Vercel. Actual project framework, build/output/runtime and rewrites need control-plane/operator confirmation; repository absence alone cannot prove what is deployed remotely.

After architecture/configuration approval, the minimal candidate is a Node Vercel Function adapter exporting the Express instance, an all-/api rewrite preserving original paths, and static dist/SPA fallback after API routing. Use the project's verified current Vercel-supported integration/runtime; do not claim a configuration works before testing it in Preview. An app.listen process is not proof a serverless handler is wired. No adapter/rewrite, CORS architecture change or dependency installation is applied by this review.

Configuration to verify securely in Vercel (not credential values in chat):

- Frontend build: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for the intended project.
- Backend runtime: SUPABASE_URL (or VITE_SUPABASE_URL), VITE_SUPABASE_ANON_KEY, TRUSTED_TEACHER_AUTH_IDS.
- The trusted list contains only explicitly approved AQUA teacher Auth UUIDs matching teacher_profiles.auth_user_id, not automatically both profile rows or unrelated app teachers. Keep it server-only, without a VITE_ prefix.
- Verify frontend/backend target the same project and the app's Auth callback URLs. A service-role key is neither used nor requested.

## Teacher Dashboard authorization and reset state

UI entry/status checks use the current SDK access token and backend teacher gate. getTeacherDashboardData then reads visible profiles, attempts and progress directly through the teacher's Supabase session. RLS/grants must permit the authorized teacher to read the intended 14 profiles, game_attempts and game_progress and allow the student to read their own confirmed attempt for read-back. teacher_profiles count=2 and RLS enabled do not prove those permissions. No authenticated teacher token/password is available here; no live privileged/teacher read is claimed. RLS can return an empty visible set without an HTTP error, so an independent authorized visibility check remains required.

Given successful reads and the operator's reported empty result tables, code derives 0 scores and Level 1 for both modes without snapshot fallback. New progress is derived from verified per-mode attempts, not the single-row legacy game_progress. No reset or profile-cache write is performed on refresh. The Dashboard refreshes on entry/focus/manual action and every 15 seconds.

The 14 existing account mappings are preserved and tested with mocks. No Auth users/passwords were edited or provisioned. Actual valid passwords and active Auth linkage cannot be proven by profile counts or these mocks; real 14-student login was NOT exercised. Live sign-in can update Auth metadata, so this review does not attempt production login under a no-production-writes restriction.

## Championship blocker

With 0 sessions and 0 participants, no student can satisfy the audited Championship precondition. Code must refuse to start/hold results, not relabel them SOLO. The teacher toggle or a newly inserted empty session alone cannot establish all required memberships. Provisioning/enrollment is not silently re-enabled. Preparing an OPEN session plus the 14 correct participant relationships requires separate explicit authorization and exact table metadata; no SQL or write is supplied/executed here.

SOLO has no session requirement. A SOLO-only class is a possible temporary operating plan only after teacher approval, verified hosting/auth/reads and an explicit decision to keep Championship unavailable. No unapproved global mode switch is made.

## Offline queues and legacy clients

The new client holds pre-fix/untagged queues, unknown ownership/mode/session, and uncertain writes; no old row is automatically reassigned, deleted or replayed. Tests cover same-device account switching, retry, persisted interrupted sends and wrong-mode/session read-back. Current new writes use the original context and explicit mode. This is not server-side idempotency or a global reset epoch. Old PWA/client code can still send old writes directly to Supabase; ensure devices actually load the approved release before class. No schema/RLS change to block legacy clients is made.

## Local verification and safe rollout order

Executed locally: 84 tests passing, TypeScript check and production build passing. Build retains existing Vite config/chunk-size warnings. The route matrix includes sanitized JSON failure responses. The standalone production Node server returned real local 401 JSON for admin verification without credentials, and 404 JSON for an unknown API path. Those are not production-Vercel results.

Browser regression is run against the local built frontend with synthetic Supabase/backend verification responses and all external/write requests blocked. It checks reset -> 0/Level 1, polling -> SOLO 40 / Championship 90, read-failure warning, mobile rendering, retained legacy queue and no page errors. It does not validate real password login, Supabase RLS or RPC execution.

Safe order, requiring the stated approvals:

1. Review/approve the minimal code and hosting approach; obtain read-only routing/settings visibility. Preserve the four Game Season drafts and all production accounts/data.
2. Configure/test a Preview or isolated local integration against a NONPRODUCTION Supabase project with synthetic accounts and the audited existing RPC/schema. Any deployment and nonproduction seed/write operations require the relevant approval; no Game Season migration is part of this step.
3. Verify authorized teacher reads and student login/save/reload; confirm SOLO and Championship separation, OPEN enrollment, error/timeout/retry and PWA update behavior. Do not connect Preview write tests to the production project.
4. Separately authorize/prepare required production session/participants if Championship is needed. No reset, user/password changes, global shared-app policy/grant edits or v1 RPC replacement.
5. After all gates pass and production deployment is approved, build with the correct PRODUCTION frontend/runtime bindings (a Preview built with test VITE variables must not be blindly promoted). Verify deployment source commit and API JSON routing. Prepare an approved application rollback that does not reset the database or silently reactivate legacy replay.
6. Reload/update teacher and student PWAs; read-only verify the zero baseline. Do not erase offline queues. Observe normal authorized classroom saves only after launch approval; investigate failures rather than changing shared database policies ad hoc.

No final production go-ahead is implied by this document.
