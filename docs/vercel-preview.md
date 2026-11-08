# Vercel API + safe Preview setup

Scope: deployment wiring after 3791796; no database operation, Game Season implementation, session creation, push, merge or deployment is performed. Existing production settings/deployment have not been accessed or changed. The production URL probe was previously denied by the Codex proxy, so no live Vercel routing claim is made.

## Prepared configuration

- `api/index.ts`: one Node Function, exporting a request handler rather than opening a port.
- `backend/app.ts`: the existing Express API factory moved verbatim out of server.ts. server.ts still exports it for existing callers/tests and starts the standalone dev/production server as before. The Function does not import the Vite development server or UI code.
- `backend/vercelAdapter.ts`: restores the API path captured by Vercel routing, strips the internal query parameter, and forwards the original method, body stream and Authorization header to Express. It also supports the original URL/platform-attached query representation. Ambiguous or unsafe captures fail as JSON; authentication/authorization are still performed by Express, not by a query parameter.
- `vercel.json`: Vite static output in dist, one API Function, API rewrite before non-API SPA fallback, pinned frozen Bun install, and a 30-second Function limit. Named capture `__aqua_api_path` is forwarded to the Function by Vercel's routing transformation. Existing assets are handled by the filesystem before fallback. API misses cannot become index.html.
- Node target is pinned through package.json engines. No runtime npm dependency or lockfile changed. Install command was exercised with Bun 1.4.4 in frozen mode; it made no dependency changes. `.vercel/` is ignored for future CLI-generated project/build files.
- PWA navigation fallback excludes both /api and /api/*.
- Teacher password recovery now targets the current deployment origin, so a QA Preview does not send its callback to the production website. The QA Supabase project's redirect allowlist must permit the specific Preview URL if recovery is tested. No Auth settings are changed here.

## Required Vercel variables — names only

Set these in the intended Vercel environment scope. For a Preview, all four must belong to an independently approved NONPRODUCTION project and its test teacher. Do not copy Production bindings into Preview.

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- TRUSTED_TEACHER_AUTH_IDS

Keep TRUSTED_TEACHER_AUTH_IDS server-only; never add a VITE_ prefix. Select the test teacher's existing authorized Auth UUID, matching its teacher_profiles.auth_user_id; a syntactically valid UUID is not an authorization grant. No service-role key or default admin credential is required or requested. The two Supabase URL bindings must agree.

Vercel supplies VERCEL_ENV/VERCEL as system variables. Keep automatic exposure of Vercel system environment variables enabled. Do not manually force the production environment marker to bypass Preview validation. The app does not need a manually assigned PORT, backend base URL or NODE_ENV in Vercel: frontend API requests remain same-origin and the Function has no listener.

## Preview safety guard

Both the Vite configuration and the API handler call `validatePreviewEnvironment`:

- Missing explicit Preview bindings fail the build, preventing the frontend's old embedded production fallback from being bundled for Preview.
- Known production Supabase host (including case/trailing-dot variants), frontend/backend URL mismatch, invalid URLs, privileged keys, mismatched legacy key project references and invalid teacher UUID syntax are rejected.
- Unsafe/missing Preview runtime bindings return JSON 503 before Express or Supabase is invoked.
- Only public anon/publishable keys are accepted. Opaque publishable-key project identity and the existence/authorization of the supplied test teacher still require verification in the intended QA project. This guard cannot prove an arbitrary custom hostname is nonproduction; the operator must approve the project. It does not replace RLS or the normal teacher gate.
- Ordinary standalone/local behavior is unchanged when not running as a Vercel Preview. Production use of the legitimate production project is not blocked by this Preview-only guard.

No Preview has been deployed. The guard and configuration are locally tested, not a claim that Vercel project-level overrides, account plan/runtime or remote routing have been verified.

## API coverage

The same handler covers all existing paths and original HTTP methods:

- GET /api/admin/verify, /api/admin/students
- POST /api/admin/login, /api/admin/register, /api/admin/provision-students, /api/admin/students, /api/admin/reset-student-password
- PUT /api/admin/students/:id; DELETE /api/admin/students/:id
- POST /api/student/verify-access, /api/student/login, /api/student/select-identity, /api/student/save-attempt

Previously disabled registration/provisioning/reset operations remain disabled. A working route is not permission to re-enable them. The browser's direct Supabase login/result-read/save flow and RLS requirements remain intact; routing alone does not create accounts, profiles, sessions or participants.

## Shortest safe Preview procedure — after approval

1. Have an approved nonproduction Supabase project with the existing audited schema/RPC and authorized synthetic teacher/student accounts available. This task does not create or migrate that database. In Vercel, confirm repository root and Vite framework, the Node target declared in package.json, automatic system-variable exposure and the four **Preview-scoped** bindings above. Keep the production branch/alias unchanged. Do not override the checked-in install/build/output/rewrites with stale project settings.
2. After push/deployment approval, deploy this development branch to **Preview**, not Production; do not merge into the production branch or use a production deploy flag. The generated Preview URL is separate and does not replace the production website. A Preview built against QA is not an artifact to blindly promote to production because VITE values are embedded at build time.
3. Check / and existing assets; unauthenticated GET /api/admin/verify must be JSON 401, unknown /api paths JSON 404. Then verify real QA teacher login/authorized Dashboard reads and student login/save/reload. Use only the QA project for any approved write tests. Championship testing requires existing QA OPEN session + memberships; no production session is created by these steps. If password recovery is included, separately authorize the Preview callback URL in the QA project only.
4. Review results before any production deployment. Production bindings, teacher authority and readiness must be verified separately. Existing production Championship has no sessions/participants according to the operator; this hosting fix does not resolve or change that data prerequisite. Preserve all old offline queues and update devices only for a separately approved release.

If no QA project/teacher bindings are available, the correct result is a blocked Preview build, not using production fallbacks or fabricated authority.

## Local verification (not a remote deployment)

```sh
node --import tsx --import ./backend/offline-tests.ts --test backend/*.test.ts src/game/rules.test.ts src/services/teacherAuth.test.ts src/services/compatibility.test.ts src/services/championship.test.ts src/services/dashboardResults.test.ts
npm run lint
npm run build
```

Additional checks performed outside the checkout dependency graph:

- Official @vercel/routing-utils 6.6.1 accepted/transformed the API and SPA rules; required API paths and query captures were verified against those transformed rules. This is a routing-library check, not a Vercel cloud deployment.
- The real Function entrypoint was served locally: all 13 API paths preserved JSON/auth restrictions after rewriting. Authorized teacher/student login, Auth-header propagation, body forwarding and SOLO/Championship RPC behavior were tested with mocks.
- An ESM Function bundle excluded the standalone server/Vite/UI graph, and a plain TypeScript emit was successfully loaded by native Node without tsx or bundling. Relative API-graph imports have explicit executable extensions for Node ESM.
- A real Vite Preview build failed with missing bindings and passed with explicit synthetic QA bindings. No service was contacted by those builds. A normal local production build was run afterward.
- Browser regression against the built local app uses synthetic replies and blocks all external/write requests. No real password login, production RLS or production RPC write is claimed.

All Game Season drafts, visual components, animations, bank questions and game rules are preserved. A safe Preview can validate the hosting change before replacing production, but still requires explicit deployment approval and real QA integration evidence.
