# Last compatibility review — NOT READY FOR MIGRATION

Review after 539ff5e. No production query/reset/migration, push, merge or deployment
was performed. SQL remains a review artifact. No CASCADE, archive deletion or new
destructive database grants/policies/triggers were added. Four Game Season drafts,
question bank, 3D/animation assets and SOLO gameplay/scoring are unchanged.

## Location contract: compatible

Actual data source: src/data/locations.ts MISSION_LOCATIONS and LEVELS.

| location_id sent as text | level_number |
| --- | --- |
| '1', '2' | 1 |
| '3', '4' | 2 |
| '5', '6' | 3 |
| '7', '8' | 4 |
| '9', '10' | 5 |

AquaCityCanvas finds the MissionLocation metadata by its id; WorldMapModal passes
the same object. App captures loc.id in MissionRun; MissionQuizModal submits
location.id; the submit handler checks that ID against the captured run.
gameStorage derives Math.ceil(locationId / 2); attemptSync serializes locationId
with String() and sends the integer level. For IDs 1..10 that equals SQL integer
(location_id::integer + 1) / 2. No SQL/caller correction is needed. SOLO serialization
and the original function path are left unchanged. Tests import the real metadata,
exercise all ten wire payloads and send all ten coordinates to PostgreSQL.

## Reset finding: safety-critical compatibility gap

At 539ff5e the candidate's leaderboard reset was disabled, but its **Reset Data
Permainan** button and destructive service implementation were still reachable.
That gap is fixed in this branch: both buttons are unavailable; service execution
returns an explicit unavailable response BEFORE authentication, network, DELETE,
profile updates or localStorage/queue changes. A stale modal/direct module caller
cannot execute it. Read-only preview/export helpers are not a reset permission.

The known old source commit 69f9e5d still wires BOTH buttons to the reset modal.
Its reset service performs separate REST operations in this order:
1. DELETE attempts.
2. DELETE game_progress, even if step 1 failed.
3. DELETE participants for ALL/CHAMPIONSHIP, without checking that operation's error.
4. Only then inspect attempts/progress errors.
5. On apparent success, clear championship_data (potentially all profiles), delete
   local student cache AND the offline queue, and reload Dashboard.
No enclosing database transaction spans these requests. Neither button closes a
session via the new lifecycle RPC. Deletion is not a substitute for session close.
The live main/candidate build was not inspected remotely; local changes do not
patch already deployed browser bundles or caches.

### Why NO ACTION foreign keys must stay

- attempt_requests_v1.attempt_id blocks deleting a confirmed attempt (23503).
  This preserves both assessment archive and the durable retry reference.
- sessions_v1.session_id blocks deleting a managed session, even after other
  child rows have been handled (23503). Session closure must UPDATE status.
- These FKs do NOT protect game_progress and do NOT protect a participant with no
  attempts. A later, separately authorized DELETE can still erase those rows.
- One failed bulk attempt DELETE rolls back that ONE statement, not the later
  HTTP requests. Partial reset remains possible if the teacher has DELETE access.
- With only SELECT RLS policies a granted DELETE affects zero visible rows; without
  a table grant it errors 42501. Do not claim the observed database currently
  permits deletion: that depends on its real grants, DELETE/ALL policies and any
  privileged reset RPC. A SELECT policy never grants DELETE by itself.
- Even when row deletion is blocked, the legacy path can misreport success,
  clear snapshots under UPDATE permission and discard the local offline queue.

CASCADE or removing the FK would hide the error by deleting archive/idempotency
state, weakening retry guarantees and permitting accidental loss of scores. Neither
is an acceptable compatibility fix. No protective trigger or global permission
change is silently added to the shared database.

## Production save compatibility and remaining limits

The reviewed 7-argument signature/defaults, JSONB result, mode/session invariants
and provided attempt columns match the patch. The installation checks actual
signature, owner, argument names and SECURITY DEFINER mode, preserves the original
function definition and checks body identity. SOLO forwards the same seven values
to that preserved function; installation never updates SOLO attempts/progress.
Private scope means existing sessions/other apps are not adopted by this patch.

New keyed Championship calls are idempotent, best-per-mission and locked against
close/number allocation races. Old seven-argument callers have no request UUID:
totals are best-score safe for managed sessions, but duplicate archives cannot be
distinguished from genuine new plays. Use the upgraded candidate for Championship.

The complete live source/grants were not fetched or executed in this review.
PostgreSQL testing uses the actual migration with a SYNTHETIC legacy implementation
of the audited behavior. Preservation tests prove the mechanism on that fixture,
not a live end-to-end production certification. Record original function metadata
and SOLO fingerprints using the existing read-only verification SQL before any
approved application. No one has modified Afina/Afiz live scores in this task.

## Release blockers and safe next step

NOT READY FOR MIGRATION under the requested guarantee of compatibility with the
old main website's reset buttons. Candidate-only disabling does not secure main.
Before migration, an approved plan must retire destructive reset execution in all
served versions that can access this database, including the main site's older
bundle and any privileged reset RPC. Do not solve it by broad permission changes
that might affect another app. Existing unupgraded offline pages require particular
attention; merely changing a new button label does not revoke their old code.

The supplied aqua-reset-access.readonly.sql inventories relevant grants, DELETE/
ALL/UPDATE policies, role bypass and potential privileged reset functions WITHOUT
performing a delete. Review that alongside the deployed main version. If old
reset access cannot be safely retired within the current authorization, stop
before migration and obtain a separate main-site/reset authorization decision.
Then verify scores/queues remain preserved; only after that approve the atomic
Championship migration and candidate-only release. Do not run a live reset as a test.

## Local results for this review

- 108 Node tests passed, including all actual location coordinates and zero-call,
  zero-cache-mutation reset refusal for ALL/SOLO/CHAMPIONSHIP + individual scopes.
- 20 PostgreSQL scenario groups passed in a disposable network-isolated container:
  prior transaction/idempotency/best-score/SOLO checks plus real game coordinates,
  no-delete RLS behavior, both new FK failures and partial legacy reset probes.
- The authorized DELETE policies used to reproduce the defect exist ONLY in the
  disposable fixture; they use a restricted teacher/roster predicate and are NOT
  part of the migration. Destructive compatibility probes roll back; final SOLO
  snapshots remain unchanged. No production credentials are used.
- TypeScript and production build passed; existing Vite warnings remain.
- Browser regressions verify disabled reset controls and normal session lifecycle
  using mocks, plus the existing read-only SOLO/Dashboard/queue/mobile checks.
