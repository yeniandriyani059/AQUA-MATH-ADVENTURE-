> Superseded by `docs/championship-db-finalization.md` and `docs/sql/aqua-championship.final.review.sql`. The text below records the earlier checkpoint, not the current implementation.

# Championship save patch — review specification, not executable migration

Status: BLOCKED on the exact production `pg_get_functiondef` output. The repository
contains the caller and metadata SELECTs, not the full function body. Do not
reconstruct/replace shared `save_game_attempt` from an audit summary. Do not
execute the Championship administration migration or enable the UI in production
until this patch and its local PostgreSQL tests have been reviewed.

## Accepted scoring rule

The user chose **best score per mission**. For each `(session_id, student_id,
location_id)`, take MAX(score) from CHAMPIONSHIP attempts. `official_score` is
SUM of these mission maxima within that session. Never add every attempt score.
A lower/equal legitimate new attempt is archived but does not increase the total.
A higher attempt replaces that mission's contribution. SOLO code/data is untouched.
Do not recompute previously stored rows as part of migration. Recompute only the
participant being saved in a newly authorized session transaction. Historical
sessions/attempts are not rewritten.

## Required lock protocol inside the CHAMPIONSHIP branch

The following is an integration fragment, NOT a replacement function. Variable
names, types and exact predicates must be adapted to the real body:

```sql
-- After authenticated student identification; BEFORE participant or attempt locks.
-- Do not filter status in this SELECT: check the locked row's current status.
SELECT cs.status INTO v_locked_session_status
FROM public.championship_sessions AS cs
WHERE cs.id = p_session_id
FOR SHARE;
-- Require FOUND. At repeatable-read/serializable retry serialization failures
-- with the SAME request ID; never change mode/session/request identity.

-- Then SELECT the exact enrolled (session_id, student_id) participant FOR UPDATE.
-- Validate ownership, registration and the appropriate AQUA session/roster scope.
-- No missing-participant upsert. No registration from a score submission.
-- Then read/check request receipt (see below).
-- Exact known receipt can return the original result without new writes,
-- including after closure; any new request requires the locked status = OPEN.
-- Allocate attempt_number only after serialization of its complete MAX scope.
-- Insert one attempt, update score from per-mission maxima, save receipt,
-- return response. Every operation is in the same transaction.
```

`FOR SHARE` conflicts with close RPC's `FOR UPDATE`. Save first => close waits
until save commits/rolls back. Close first => new save sees CLOSED and writes
nothing. `FOR KEY SHARE` is insufficient. Lock order everywhere must be session
then participant then receipt/attempt. Audit all other writers of these rows.
The open/close advisory lock serializes lifecycle requests; it does not replace
this row lock protocol.

## MAX(attempt_number) + 1

The participant lock serializes submissions for ONE student in ONE session.
It only makes MAX+1 safe if the production MAX query's scope is no wider than
that lock's scope (e.g. student + session + mission). If MAX includes other
sessions or SOLO, a shared allocation lock or redesigned Championship-only scope
is required. Do not change the SOLO scope or numbering without auditing its
callers. A suitable unique constraint is a final defense once exact scope and
existing data have been verified read-only; do not infer or install it yet.

## Technical idempotency is distinct from best-score aggregation

Best-score totals prevent repeated low/equal attempts inflating the leaderboard,
but do NOT prevent duplicate game_attempts/attempt_number increments.

Required durable receipt: namespace AQUA, authenticated student, session,
request UUID, full validated payload, attempt ID and original JSON result.
Use a composite UNIQUE key for request ownership (at least student + request
UUID); compare the session and ALL scoring payload fields on replay. Reusing a
key with a changed payload must fail. Scope receipt RLS/EXECUTE permissions to
RPC-internal access; no direct client insert/update/delete. Receipt insertion,
attempt insertion and official score update must commit atomically.

The current frontend already freezes `idempotencyKey` at mission start, but the
seven-argument production function does not accept it. It must reach the DB:
- Prefer a distinctly named AQUA Championship RPC with `p_request_id`, keeping
  the existing SOLO call/signature unchanged.
- Also block/delegate the legacy Championship branch for AQUA sessions so it
  cannot bypass receipt/best-score rules. Do not affect unrelated applications.
- Alternatively replace the audited function's exact signature/body and design
  a compatible request-key contract; avoid ambiguous PostgREST overloads.
The final choice requires the full function definition and all dependent callers.
No caller is switched to a fictitious RPC in this change.

The current offline queue conservatively holds `sending`/`uncertain` requests;
it does not blindly retry them. Preserve that behavior until durable idempotency
is installed and tested. Preserve old queues without replaying/deleting them.

## Required local PostgreSQL integration tests before deployment

Use actual PostgreSQL roles/auth.uid test fixture + production schema/function
copies, synthetic accounts only. Run separate connections, not Promise mocks:
1. Save holds session SHARE: close blocks; save commit then close succeeds.
2. Close holds session UPDATE: new save blocks, then rejects CLOSED; no writes.
3. Save rollback unblocks close without partial attempt/score/receipt.
4. Concurrent same request ID => one attempt, one result, one receipt.
5. Same request ID + changed owner/session/payload => rejection.
6. Different request IDs, same mission, scores 60/90/70 => total 90, three archives.
7. Another mission score 80 => total 170, other students/sessions unchanged.
8. Concurrent different requests => unique correct attempt numbers, total best.
9. Receipt replay after close returns original confirmed attempt, no new writes.
10. Record and compare SOLO rows/outputs before and after; unchanged.

Do not claim these tests passed until the real function and a local PostgreSQL
fixture are available. Node/Playwright mocks cannot validate row locks or RLS.

## Read-only input still needed

```sql
SELECT p.oid::regprocedure AS signature,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'save_game_attempt'
  AND p.prokind = 'f';
```
Only share reviewed function source; omit credentials if any are embedded.
