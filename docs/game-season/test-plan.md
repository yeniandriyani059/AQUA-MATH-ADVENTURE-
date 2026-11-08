# Nonproduction verification and approval gates

This is a test PLAN, not a record of executed database tests. Do not use a production URL or production account. No service-role key is requested. Database setup/seed operations require a separately approved isolated database and its normal migration/test role. Do not run the old reset function even in the main project.

## Gate 0 — metadata and shared-project ownership

Obtain both metadata SELECT reports, relevant function definitions, externally maintained consumer inventory, exact data/authority mapping and backup/restore plan. Verify whether public IDs are UUID and whether existing session status is OPEN only or has a synchronized is_active column too. Inspect all nested helpers, not just top-level RPC. Resolve naming collisions, owner roles, default privileges and API exposure. Confirm record retention rules before referencing shared tables.

New RESTRICT FKs can block deletions performed by other apps, including deletion of shared Auth accounts. Additive schema design is NOT automatically zero-impact. Explicitly approve those lifecycle restrictions for AQUA-owned links, or redesign links as detached immutable archive snapshots before finalization. Never choose CASCADE that deletes assessments as a convenience. Catalog DDL/FK validation and index builds can also contend with shared workloads; plan lock/time/statement limits with the operator.

## Gate 1 — isolated structural rehearsal

Create a separate database/project with synthetic accounts: at least two AQUA scopes, authorized teacher T1, a teacher for only scope 2, revoked teacher, ordinary Auth user, student A and B in scope 1, student C in scope 2, inactive student, and an unrelated second application's user/data. Reproduce actual legacy DDL from the audited metadata (including UNIQUE(student_id), valid_mode_session, status OPEN, participant uniqueness, and real RPC owner/grants) without importing production student data or credentials.

Only after explicit approval, transform the blocked draft into an environment-specific implementation. Run migrations there, with stop-on-error and a transaction-aware tool. The checked-in draft raises an exception before DDL and ends in ROLLBACK; it must never be described as an executed or deployable migration. Do not pass it through a tool that strips guards or auto-splits transactions.

Assert all new composite FKs, CHECKs and UNIQUE/partial indexes reject deliberate cross-scope/season/student/session links. Verify malformed mode, SOLO with participant/session, Championship missing either, and same-student mismatched participant all fail. Test actual role grants/RLS and deliberate calls that bypass the frontend. No teacher can self-grant authorization; a fabricated frontend token or self-created teacher profile is insufficient.

## Gate 2 — preservation and backfill rehearsal

Build a reviewed synthetic manifest with owned, ambiguous and unrelated records. Include students with legacy mixed/overwritten progress and records shared across applications. Assert:

- Public rows, account IDs, passwords, Auth relations, participant/session FKs and unrelated app results are unchanged.
- Every approved attempt has exactly one archive mapping; ambiguous/unowned attempts are not silently mapped or discarded. Exact legacy progress/participant snapshots compare equal to the original JSON at capture.
- Historical assessments remain readable only to authorized scope viewers, with tagged source IDs. New season reads do not use archives or championship_data snapshot fallbacks.
- Missing legacy mode attribution remains unknown. No updated_at-based reassignment, speculative progress splitting, account seed/provisioning or reset occurs.
- Interrupted/retried backfill detects already mapped records and verifies matching manifest/content rather than overwriting or mapping to a second scope. Maintain a backfill operation ledger in the final operator plan if scale requires batches.

## Gate 3 — atomic start and concurrency

Use separate concurrent PostgreSQL sessions and controlled failures:

1. Two authorized calls with one operation UUID and equal payload yield one season/session and one receipt.
2. Reuse operation UUID with changed name/flags/revision is a conflict, not a second season.
3. Two different operation UUIDs with the same expected scope revision: exactly one succeeds, the other gets stale-revision conflict.
4. Fail after closing old status, after new season insert, after participant creation and before pointer update: verify full rollback, no half-open season and no dangling pointer.
5. Race a save with a switch, following the same lock order. The attempt either commits in the old season before closure or fails after closure; it is never relabeled to the new season.
6. On closure, replay a previously committed attempt request: authorized owner gets the original receipt without progress/score changes. An uncommitted new old-season key fails. Revoked/inactive identities cannot retrieve data via replay.
7. Test teacher revocation racing with switch using the specified authority lock. No TOCTOU authority grant.
8. One OPEN session/ACTIVE season invariant survives concurrent calls and retries. Replay requests have no unauthorized side effects, regardless of old active pointers.

## Gate 4 — idempotency and scoring

Same student + same request UUID + same canonical payload across two devices/threads yields one attempt and one progress/participant effect. Repeat with reordered JSON fields and the same typed numbers; normalized equality should be stable. The same key with a different season/mode/session/location/count/duration fails. The same UUID for a different owner cannot disclose or reuse another student's receipt. No local cache is treated as proof of persistence.

Simulate timeout before transaction, rollback, disconnect after commit, and failed read-back. Reconcile via the receipt RPC using the ORIGINAL request UUID. Do not generate a new key to make retry pass. Crash during participant/progress updates must roll back attempt and receipt together. Ensure conflict handling never falls back to SOLO. Unique request IDs do not prevent cheating with a new request ID; verify existing replay/scoring rules independently.

For each location and level, known synthetic SOLO results modify only solo_progress and SOLO totals. Championship results modify only that season/session's participant/progress and ranking. Verify exact current best/latest score, tie-breakers and rounding against the audited old contract; do not silently import a proposed scoring change. Starting a season produces 0/Level 1 for both modes without deleting archives.

## Gate 5 — application/hosting and shared-project regression

After separately approved application integration, test two HP/browser profiles receiving the same active-season pointer/revision from Supabase. Start in S1, switch to S2, and reconnect: keep old context and receipt rules; never move old pending rows to S2. Switch A to B on one HP; B cannot submit A's queue. Pre-v2 and unowned queues are held for reconciliation.

Verify teacher login/refresh/logout, existing 14 account mappings using synthetic equivalents, Dashboard explicit-season reads, errors distinguished from genuine zero, archived assessments, and unchanged 3D/game visuals. Confirm the current is_active assumption is replaced or reconciled with audited OPEN semantics ONLY in that separately approved implementation.

Test Vercel/API integration on an approved nonproduction origin: Node runtime/handler, /api route ordering, Auth header forwarding, callback URLs, cold starts and request limits. Keep production egress blocked. Verify unrelated app RPCs, RLS permissions, session/account lifecycle and data reads/writes remain as before. Do not globally revoke v1 RPC to retire old AQUA clients; establish an approved scoped legacy-writer strategy first.

## Exit criteria

No failed/untested required authorization, preservation, idempotency, concurrency or shared-app checks; final SQL reviewed against actual metadata; reconciled ambiguous data plan; verified backup/restore; agreed v1 cutover/recovery and hosting integration; explicit user approval for implementation and later database execution. None of these are established by merely saving this draft.
