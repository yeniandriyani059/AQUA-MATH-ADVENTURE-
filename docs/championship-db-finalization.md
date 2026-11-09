> Latest operator audit is complete. The remaining reset gap is addressed by the two-stage database guard package in `docs/championship-reset-guards.md`; this earlier checkpoint is retained as history. No repeat permission audit is requested.

> Latest review: **NOT READY FOR MIGRATION** until legacy destructive reset execution is safely retired. See `docs/championship-last-review.md`. Candidate guard alone does not patch the old main website.

# Championship database patch — final review

Prepared on security/backend-auth-hardening after 9ba11b6. NOT applied to Supabase,
GitHub, Vercel, the candidate or the main website. No live accounts/scores read or
written. No Game Season files or 3D/animation/question assets changed.

## Review/install artifact

Use ONLY `docs/sql/aqua-championship.final.review.sql` after separate approval.
It supersedes `aqua-championship-rpcs.review.sql`; do not execute both. One
transaction installs lifecycle, discovery, RLS, private scope/receipt tables and
save routing together. Failure rolls everything back. There is no historical
INSERT/UPDATE/DELETE/backfill/reset in the installation statements. INSERT/UPDATE
inside function bodies only execute later when callers invoke those RPCs.

The exact production function body is not present in this checkout/context. The
migration avoids reconstructing it: `pg_get_functiondef` clones the current
seven-argument function to `aqua_championship_private.legacy_save_game_attempt`
and verifies byte-identical `prosrc`. It then replaces the public function with
a same-signature/defaults compatibility wrapper. SOLO and non-managed sessions
call that original body. Existing public function owner and EXECUTE ACL remain.
The backup preserves function settings/body and is not re-created on rerun.

Run as the original function owner. Preconditions reject unexpected overloads,
argument names/return/security mode, public schema CREATE rights for untrusted
roles, unexpected private schema owner, missing backup or wrapper/backup drift.
Self-referential legacy source also rejects installation rather than recursing.
This preserves logic without claiming that the unseen production source was
locally audited. Review the preserved definition/fingerprint and dependent
functions before live approval. Do not bypass a failed precondition blindly.

## Isolation in a shared database

`aqua_championship_private.sessions_v1` records ONLY sessions created by the new
AQUA open RPC. Existing sessions are never adopted or rewritten. Even another
application using the SAME teacher Auth ID remains outside save interception.
Only managed-session legacy saves enter the new core; other Championship calls
retain original behavior. The roster is 14 explicit student_profiles.id values.
created_by is the verified teacher_profiles.id, not the Auth UUID.

Private schema/tables have no anon/authenticated privileges, RLS is enabled and
there are no permissive write policies. Private functions have no public/client
EXECUTE. Public lifecycle RPCs internally validate the fixed teacher Auth UUID
and current existing teacher role. Students cannot create sessions or enroll.
Teacher SELECT policies use a guarded definer predicate restricted to managed
sessions. Existing student policies and existing open-session SELECT stay intact.
There is no service-role client or automatic creation of users/profiles/roles.

Additional READ-ONLY public RPCs list managed sessions for the authorized teacher
and OPEN memberships for the authenticated active student. They avoid granting
students access to teacher_profiles or private tables. Student IDs are derived
from auth.uid(), never accepted from the scoring client.

## Scoring and transaction protocol

New candidate calls `aqua_save_championship_attempt_v1` with frozen request UUID
and existing assessment payload. All validation and changes happen atomically:
1. Resolve exactly one active student and validate explicit AQUA roster/payload.
2. Acquire session FOR SHARE. Check managed scope and verified teacher owner.
3. Acquire the exact enrolled participant FOR UPDATE.
4. Serialize the student/request key; compare all payload fields on receipt replay.
5. Return the original response if already committed, even after CLOSED.
6. Otherwise require OPEN, allocate MAX(attempt_number)+1 within student/session/
   mission scope under the participant lock, insert one archive, recompute score
   as SUM(MAX(score) per mission), update completion and insert request receipt.

Close acquires the SAME session row FOR UPDATE. Save first => close waits for
save commit/rollback. Close first => new saves reject CLOSED. At higher isolation
levels PostgreSQL may abort a transaction with serialization errors; clients must
retry with the same key. Best-score examples: 60,90,70 on one mission => 90 and
three genuine attempt archives; another mission 80 => 170. Scores never touch
SOLO progress. No existing score is recomputed during migration.

No new UNIQUE constraint is added to legacy game_attempts: unknown historical
duplicates must not break installation. New managed writers all hold the same
participant lock, so MAX scope is serialized. The new receipt primary key is
(student_id,request_id), and attempt_id is UNIQUE. The two private tables are
additive app-specific storage. Their FK references protect committed archives;
old destructive reset/delete routines may consequently fail for these new data.
Do not run those routines or remove receipts to make them work.

## Old website compatibility — real limitation

The old seven-argument call remains accepted. For a managed session it receives
best-per-mission totals, locked numbering and proper close exclusion. But it has
NO request UUID: two identical calls cannot be distinguished from two genuine
plays. They can create two archives; `idempotency_supported=false` in the result
is explicit. Totals do not inflate. Never claim full legacy archive idempotency.

Known old main source 69f9e5d also looks up is_active and falls back to a cached
session; it is not a supported Championship UI for the new workflow. The actual
live main commit has not been independently verified. Keep main for SOLO and
use only the upgraded candidate for Championship. If all legacy devices must
have strict technical deduplication, deploying only this DB patch is insufficient:
upgrade those clients or separately approve rejecting legacy Championship calls.
Do not silently dedupe identical payloads: that would discard genuine plays.

## Frontend/backend changes

- Each NEW Championship queue row carries contract marker best-per-mission-v1
  and stable championshipRequestId. Mission UUID is reused when available.
- Keyed interrupted/uncertain sends retry the SAME request; fresh writes preflight
  OPEN for UX and the RPC checks again under lock. Known replay may confirm after
  closure. Mode/session/owner/payload never change across retries.
- Old Championship queues are held unchanged without silently assigning a new
  contract/key. SOLO's existing uncertain-write hold and seven-argument call stay.
- A persisted row inconsistent with owner/mode/session is blocked for review,
  rather than repeatedly replayed. Confirmation still reads the actual attempt.
- Teacher session discovery is scoped by read-only RPC, not latest global OPEN.
- Student Championship score/unlocks are projected from the captured session before
  mission access and after confirmation; that projection preserves SOLO state.
- API accepts optional requestId for keyed Championship calls; invalid IDs reject.
  Missing ID retains legacy compatibility. There is no fallback from failed keyed
  RPC to legacy save or SOLO. No new environment variables are required.

## Tests and limits

`scripts/test-championship-postgres.py` launches a FRESH PostgreSQL 16 Docker
container with --network none and no published ports. Its synthetic fixture
models the provided columns/constraints and the audited legacy weaknesses; it
is NOT a copy of the complete production function/schema. It installs the actual
review migration twice and uses real concurrent connections/roles/RLS/row locks.
Container is removed on exit. No Supabase URL/credential is used.

It verifies original-body preservation, SOLO before/after rollback probes, data
fingerprints, role denial, 14 participants/profile PK, concurrent duplicate and
distinct requests, MAX+1, best scores, receipt conflicts, transaction rollback,
both save/close lock orders, replay after closure, old caller behavior and another
application with the same teacher account. Node tests cover queue retry/owner/
mode and API contracts. Browser tests use mocks and block all external traffic.
These results do not prove live production grants, platform routing or unseen
original-function side effects. Review/check the live metadata before applying.

## Safest application order — approvals still required

1. Keep Championship unused on the old main website; preserve SOLO use. Record
   read-only fingerprints for Afina/Afiz SOLO attempts and game_progress using
   `aqua-championship-verification.readonly.sql`. Record original source/owner/ACL. Schedule a brief quiet window with no score
   submissions: creating FK references/policies can briefly wait on table locks;
   the migration has a 5-second lock timeout and fails atomically instead of
   forcing deployment through concurrent writes.
2. Review the ONE final migration and preconditions, including private schema,
   receipt retention and the legacy-client limitation. Obtain explicit permission
   for production migration separately from code push/deployment.
3. Apply atomically as the current function owner. On any precondition/lock timeout
   stop; do not weaken RLS/change owner to force it. No session is created by
   applying the migration. Compare SOLO fingerprints and backup source hash;
   verify SELECT policies, RLS and execute/schema privileges read-only.
4. With separate push/deployment permission, update ONLY aqua-adventure-test.
   Keep the main domain/project/branch and Preview guard unchanged. No new env
   variables. Read-only smoke test: teacher verify, SOLO dashboard values, empty
   managed sessions. The already deployed candidate is NOT updated by this work.
5. After explicit permission to write a test session/results into the shared DB,
   teacher opens ONE session with 14 participants. Test keyed Championship on
   candidate, best-score/retry behavior, leaderboard and close. Compare Afina/Afiz
   SOLO fingerprints again. Candidate writes are production DB writes; do not
   imply candidate is a separate database or run resets/cleanup afterward.
6. If rollback is needed, do not delete receipts/attempts/private schema. Prefer
   stopping Championship and keeping the compatible wrapper while fixing code.
   Restoring the original function from its preserved definition would restore
   old Championship weaknesses and needs a separate reviewed rollback plan after
   sessions are closed. A Vercel rollback alone does not revert the database.

## Final local verification (2026-11-09)

- 106 Node tests passed; 0 failed, skipped or cancelled.
- TypeScript and production build passed. Existing Vite __dirname/chunk-size
  warnings remain; no dependency or hosting configuration changes were needed.
- 16 PostgreSQL scenario groups passed against the actual migration using an
  isolated PostgreSQL 16 container and a synthetic legacy function/schema.
  Includes mid-registration rollback, owner/membership denial, duplicate and new
  plays, row-lock blocking in both orders, receipt replay after closure,
  per-mission best score, completion, other-app scope and unchanged SOLO records.
- Local browser Championship controls and Dashboard read-only regressions passed
  with all Supabase requests intercepted and no real remote writes. Includes
  desktop/mobile layouts, official score, errors and old queue preservation.
- SQL has only been executed against the disposable local fixture. No production
  query, login, migration, score save, push, merge or Vercel deployment occurred.

Reproduce Node checks with:

```sh
node --import tsx --import ./backend/offline-tests.ts --test backend/*.test.ts src/game/rules.test.ts src/services/teacherAuth.test.ts src/services/compatibility.test.ts src/services/championship.test.ts src/services/dashboardResults.test.ts src/services/championshipSessions.test.ts
npm run lint
npm run build
```

With local Docker and the postgres:16-bookworm image already available:

```sh
python scripts/test-championship-postgres.py
```

The test runner cannot take an external DB URL and always creates/removes its
own container using the local Docker socket, --network none and no exposed port.
