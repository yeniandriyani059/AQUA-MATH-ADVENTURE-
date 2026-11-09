# Final database reset protection — READY FOR MIGRATION as a two-stage package

Decision based on the COMPLETED operator audit; no repeat audit is requested.
The operator confirmed RLS enabled, authenticated base DELETE/UPDATE/TRUNCATE,
no DELETE/UPDATE policy on the four score/session tables, teacher FOR ALL on
student_profiles, and no identified executable AQUA reset RPC. The old main
reset UI remains deployed. No Supabase command has been executed by this work.

## Minimal protection and scope

1. Keep the existing policies. SELECT-only RLS already denies web row DELETE /
   UPDATE on game_attempts, game_progress, championship_sessions and participants.
2. Install a profile row trigger, scoped to the VERIFIED 14 student_profiles.id.
   Reject changed championship_data, changed id/auth_user_id, and DELETE of those
   profiles. Same-value snapshot updates, name, character and is_active updates
   remain permitted subject to existing RLS. Other profile rows retain their
   normal CRUD, including the teacher policy. A bulk operation touching protected
   and other rows fails atomically; no other-app rows are partially cleared.
3. Add BEFORE DELETE statement triggers to the four already non-deletable game
   tables. For current_user anon/authenticated raise 42501, even if RLS would
   filter every row. The actual old reset tests attErr/progErr BEFORE clearing
   snapshots, local cache and queues: a definite error stops that continuation.
   No row deletion is newly denied under the reported policies (it was already
   denied); HTTP error replaces misleading zero-row success. Trusted owner /
   SECURITY DEFINER maintenance retains its existing role context. This does not
   create or authorize a privileged reset RPC.
4. Add BEFORE TRUNCATE statement triggers on those four tables + student_profiles.
   TRUNCATE BYPASSES RLS and cannot exclude AQUA rows. It is blocked on these shared
   tables, including owner/replica-mode attempts. No grants are expanded or revoked
   for whole-table/column CRUD; no CASCADE and no data rewrite are introduced.

All trigger functions are SECURITY INVOKER with empty search_path, no dynamic SQL
and no user-settable bypass flag. EXECUTE is revoked from public/web roles; a
trusted table owner creates the triggers. ENABLE ALWAYS prevents replica-mode
suppression. A trusted owner can still explicitly drop/disable triggers; no SQL
policy can protect against an administrator intentionally dismantling safeguards.

## Why freezing the snapshot alone is insufficient

The actual old source 69f9e5d ignores the error returned by its profile snapshot
UPDATE and can then erase localStorage/offline queue. Therefore the early DELETE
statement denial is necessary to stop the audited old reset control flow.
Database safeguards cannot universally prohibit arbitrary JavaScript from clearing
localStorage offline. They protect stored DB data irrespective of PWA version;
queue preservation is tested for the actual old reset implementation available
in the repository, not every possible unpublished/cached historical version.

## Profile deletion and identity reassignment

The guard works even before a student has attempts/participants, so protection
does not depend on existing FK children. A teacher cannot move an AQUA profile
outside the protected ID set or change its Auth mapping and then delete it.
Deleting those 14 profiles, editing their snapshots, or re-linking their Auth
identities requires a separately reviewed administrative migration; no bypass is
provided. This protects existing account linkage but does not grant permissions
over auth.users or implement any Auth account administration.

Freezing the ENTIRE championship_data field is intentional: legacy reset and a
legitimate cache writer use the same teacher/student JWT and field. They cannot
be reliably distinguished by payload shape, browser origin or a forgeable flag.
The current candidate no longer writes this legacy cache and derives official
results from normalized tables. If another application intentionally writes this
SAME field on these SAME 14 profiles, that write will also be blocked. Per-row
operations on other profiles are retained. Whole-table TRUNCATE is necessarily
blocked across applications because it would delete AQUA data too.

## SOLO and shared database compatibility

No attempt, game_progress row, profile value, score or account is changed during
guard installation. The preserved SOLO RPC writes game_attempts/game_progress;
these guards do not reject INSERT or normal progress UPDATE. The old frontend's
snapshot mirror is a separate, subsequent request; the audited implementation
ignores its returned error and still returns the already-committed assessment
rows. It may log an error and its legacy snapshot stays unchanged. Current
candidate reads canonical rows and does not depend on that mirror.

Non-cascading Championship receipt/session FKs remain unchanged. Two private
namespace/receipt tables and protected public RPCs from the main migration keep
new keyed retries idempotent and best-per-mission scores transactionally correct.
Legacy seven-argument saves still have no request UUID; they cannot promise
archive idempotency. Use the upgraded candidate for Championship. Other-app
sessions remain outside AQUA's private namespace.

## SQL review artifacts and exact application order

1. `docs/sql/aqua-reset-guards.review.sql`: install first as the trusted table /
   function owner. One transaction; repeatable CREATE OR REPLACE / named trigger
   replacement; no data statements. It does NOT depend on Championship RPCs or
   need their roster helper to be executable by web roles.
2. `docs/sql/aqua-championship.final.review.sql`: install second as the original
   save_game_attempt owner. It now explicitly REFUSES installation unless all
   ten guards are enabled ALWAYS, have the correct trigger types and reference
   the intended functions (1 profile row guard, 5 TRUNCATE, 4 web DELETE).
3. Keep the old UI reset disabled in the development code. Updating main is NOT
   required to enforce DB guards against its old requests, but eventual PWA/UI
   updates avoid showing unsupported reset controls. No push/deploy is authorized.

After separate user approval, apply stage 1 then stage 2 during a brief quiet
window. Record the existing SOLO fingerprints first using the already prepared
read-only verification script; compare afterward. Check trigger installation with
`aqua-reset-guards-verification.readonly.sql`. This verifies newly installed
objects, not a request to rerun the completed permission audit. Do not execute a
real reset or TRUNCATE on Supabase as a smoke test. A deliberate rejected request
is unnecessary when local tests and installed metadata can be checked read-only.

Then obtain separate push/candidate deployment approval, update only
`aqua-adventure-test`, and run read-only auth/SOLO/Dashboard checks. Only after an
explicit production-data-write approval open one official session and test scores.
No domain change, main merge, service-role credential, Game Season or cleanup is
part of this work. Do not drop guards or receipts as a rollback shortcut.

## Local verification

- 23 PostgreSQL scenario groups pass in a fresh network-isolated PostgreSQL 16
  container. The fixture now models the operator-confirmed base rights and teacher
  FOR ALL policy. It verifies every one of the 14 profile guards, bulk rollback,
  other-profile CRUD, ordinary metadata edits, TRUNCATE bypass before protection,
  rejection afterward (including replica mode), early web DELETE errors, missing-
  guard install refusal, repeatable guard/main installation, original-body/SOLO
  preservation, concurrency, retry, best scores and namespace isolation.
- 111 Node tests pass. Three tests execute the REAL old reset/mirror function
  source extracted from local commit 69f9e5d against mocks. The negative control
  proves snapshot-only denial still clears queues; DELETE denial stops cleanup
  for ALL/SOLO/CHAMPIONSHIP and individual/global scopes. The old snapshot mirror
  still returns committed SOLO assessment data after a denied cache update.
- TypeScript passes. Runtime application code/visuals are unchanged in this turn;
  the production build and browser regressions passed in the prior review.
- SQL was tested ONLY in the disposable local fixture. It is not a clone of the
  full production function/schema and is not live Supabase verification. No
  production score, account, data or environment setting was changed.

READY FOR MIGRATION means this reviewed TWO-STAGE package can be submitted for
approval based on the completed audit and local evidence. It does not mean the
current unmodified database is already protected or that execution is authorized.
The Championship SQL alone without the guards remains not ready and fails closed.
