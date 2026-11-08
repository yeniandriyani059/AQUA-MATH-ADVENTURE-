# Game Season — architecture proposal, not implementation

Status: DRAFT; no SQL executed; no application/runtime changes. Based on branch `security/backend-auth-hardening` at `f852898`. No production deployment, account provisioning, resets, or credential changes are authorized by this document.

## Evidence supplied by the operator

Production `save_game_attempt` is SECURITY DEFINER, validates auth.uid(), explicit SOLO/CHAMPIONSHIP mode and student participation in a Championship session with status OPEN. `valid_mode_session` requires SOLO without session_id/participant_id and Championship with both. No noninternal triggers were found on the four gameplay tables. Existing game_progress has UNIQUE(student_id); attempts have no demonstrated request-id uniqueness; participants have UNIQUE(session_id, student_id). RLS is enabled. These are operator-reported findings, not independently inspected definitions.

The branch's `is_active` session predicate is not proof of compatibility with production status OPEN. It must be reconciled from the actual columns and function source before integration. RLS enabled is not evidence of suitable grants or policies. UNIQUE(student_id) cannot represent independent per-mode/per-season progress: v2 must not upsert that table.

## Decision: additive, app-specific version 2

Prefer a dedicated, initially unexposed `aqua_math` schema and uniquely prefixed public RPC wrappers. Do not rename/drop/change public.game_attempts, game_progress, championship_sessions, championship_participants, public.save_game_attempt or Auth accounts. Do not replace their grants, RLS, constraints or defaults. This avoids a global change to shared tables whose consumers have not yet been inventoried.

New writes go to `aqua_math.attempts`, which has a real NOT NULL season_id. Public game_attempts stay in place as legacy assessment records. An app-owned `legacy_attempt_seasons` sidecar stores their verified archive-season association; public records receive no fabricated mode, session, score or timestamp. This is an explicit two-source design, not a claim that the existing public table has acquired a season_id column. If consumers require that exact column on public.game_attempts, reconsider only after ownership and all dependencies are confirmed; a shared-table ALTER is not the default.

Read RPCs present a tagged union (`source=legacy|season`, source table and source ID) for authorized archive reports. Active score/progress/leaderboard queries read only v2 rows with explicit scope_id and active season_id. Never merge legacy rows or snapshots when a v2 query is empty. Local storage is a cache/pending queue, not the season authority. Membership in a shared Auth project is not membership in AQUA.

## Proposed tables

| Table | Purpose and integrity |
| --- | --- |
| scopes | AQUA-owned class/cohort boundary; canonical active_season_id pointer, revision counter, enabled flag. No automatic discovery of all users. |
| teacher_authorizations | Trusted, operator-provisioned authority per scope and auth_user_id, including can_open_season and is_active. No self-registration or authenticated role-write grant. Existing teacher_profiles must also match the Auth UUID/role; exact predicate awaits metadata. |
| student_memberships | Explicit AQUA scope + existing student_profile ID + matching Auth UUID; active flag. Linking a student does not create/change an Auth account. |
| seasons | UUID, scope, name, DRAFT/ACTIVE/CLOSED/ARCHIVED, times and creator; at most one ACTIVE per scope. Closed/archive seasons retain records. |
| championship_sessions | V2 session UUID, scope, season, name, DRAFT/OPEN/CLOSED and timestamps. At most one OPEN Championship session per scope/season in this initial design. A future multiple-competition design requires an explicit session selector, never latest-created fallback. |
| championship_participants | Stable UUID, scope/season/session/student; UNIQUE(session, student), membership FK and composite session/season FK. No automatic membership creation by a student write. |
| attempts | Append-only UUID, scope, season, student, submitting Auth UUID, request UUID, explicit mode, nullable session/participant only for SOLO, validated result fields and normalized request payload. Mode/session CHECK and composite FKs prevent cross-scope/student/session linkage. |
| solo_progress | Separate per-scope/season/student progression, Level 1 default and empty completions. |
| championship_progress | Separate per-scope/season/session/student progression with valid participant linkage. No nullable-session uniqueness trick or shared UNIQUE(student_id). |
| legacy_attempt_seasons | Read-only archive map from explicitly verified existing attempt IDs to one AQUA archive season. No blanket mapping of all shared-project attempts. |
| legacy_progress_archives | Exact legacy progress JSON snapshot for explicitly verified rows, tagged as mixed/unclassified unless evidence proves mode/session attribution. Never seed new season from it. |
| legacy_participant_archives | Exact legacy participation JSON snapshot for verified records, original session/student IDs preserved. Does not alter old rows or invent a new participant relation. |
| season_operations | Unique teacher request ID + payload + resulting season/session + audit timestamps; enables safe retry of start-season and close/open operations. |

Additive objects can still affect shared applications: new foreign keys may restrict deletion of shared profiles/accounts, and DDL can take locks. Those effects require lifecycle/ownership review; if unacceptable, redesign archive links as detached immutable snapshots instead of silently accepting global restrictions.

All new relationships use RESTRICT, not CASCADE, for seasons, assessment records and account references. The actual legacy ID types, referenced uniqueness, JSON schema and FK deletion effects remain metadata blockers. UUID assumptions in draft SQL are explicitly unverified.

An enrolled student with no rows in an active season reads score 0 and Level 1 from the read RPC. Missing rows do not create profiles or write to public.game_progress. Session-opening may explicitly create participant rows for approved active scope members in the same authorized transaction. Lazy progress creation occurs only for that season/mode/session at first confirmed attempt.

## Archive/data migration plan

1. Inventory shared-project ownership, table consumers, old clients, relevant function dependencies and existing permissions. Obtain a recoverable operator-managed backup and record schema/count/checksum evidence before any approved execution.
2. Produce an explicit operator-reviewed AQUA ownership manifest: scopes, authorized teachers, student profile/Auth pairs, legacy sessions/participants, attempt IDs and progress IDs. Names, hardcoded lists of 14 accounts, and membership of the Auth project alone are insufficient evidence that a shared row belongs solely to AQUA.
3. On an isolated clone/synthetic database, add only new objects, with no runtime grants or active season. Draft precondition guard is intentionally blocking; remove/replace it only after separate review of final metadata-bound SQL.
4. Create CLOSED/ARCHIVED season(s) for the verified legacy scope. For each approved attempt insert only a mapping row to the original public.game_attempts ID. If original historic periods are unknown, use one clearly labeled legacy archive rather than inventing dates or allocating attempts by updated_at.
5. Snapshot verified progress and participant rows exactly. Because UNIQUE(student_id) may have overwritten SOLO/Championship information, do not split a mixed legacy progress row speculatively. The authoritative attempt history remains available; unrecoverable historic progress semantics are labeled unknown.
6. Verify the map set equals the approved manifest, all original IDs and relations survive, copied JSON matches, and public row counts/checksums are unchanged. Preserve records of other apps and ambiguous records untouched and unmapped. Do not insert/select broadly from all public rows, seed accounts, reset old progress or delete old attempts.
7. Coordinate AQUA-specific cutover; see legacy-writer risk below. Open the first new active season only after v2 clients, reads, authorization and rollback/cutover plan pass isolated integration tests. All new players start at 0/Level 1 by empty v2 data, not by deleting archives.
8. After new season writes exist, rollback is an application routing decision, not permission to drop v2 tables/data or replay attempts into v1. Keep both datasets; a corrective forward migration is preferable.

### Legacy writers and shared-app compatibility — release blocker

Old AQUA clients may keep calling public.save_game_attempt after v2 cutover. Leaving v1 globally available preserves other apps but cannot force stale clients to use the active season. A frontend cache refresh/kill switch is helpful, not an authorization boundary. Do not globally revoke/replace v1 or change shared RLS to solve this without consumer inventory and approval. Determine whether v1 can reject only AQUA legacy writes using an existing trustworthy application/scope boundary without harming another app. Shared users/rows may make such a boundary impossible; that blocks cutover until a coordinated compatibility plan is approved.

Late v1 records must be reported for manual ownership/archive reconciliation, never automatically assigned to the active v2 season. Likewise, pre-v2 queues lack trustworthy season context; preserve them for reconciliation, not automatic conversion. Never assign an active season based on updated_at, device time or a newly selected session.

## Save RPC v2 contract — specification only

Proposed name: public.aqua_math_save_attempt_v2(p_scope_id uuid, p_season_id uuid, p_request_id uuid, p_mode text, p_session_id uuid, p_level_number integer, p_location_id integer, p_correct_count integer, p_wrong_count integer, p_duration_seconds integer).

Return one JSON object with protocol_version=2, attempt_id, student_id, scope_id, season_id, mode, session_id, participant_id, stored score, completed_at and replayed flag. Exact field types/rounding must be aligned with existing scoring and duration semantics; do not silently change grading. Caller supplies no authoritative student_id, participant_id, score, role or timestamp. Resolve the active existing student identity from auth.uid() and trusted membership; validate account active status and any existing profile relationship. Metadata must establish whether durations are integer or numeric before finalization.

Within one transaction:

1. Require a nonanonymous valid Auth identity, scope enabled, trusted membership and active existing profile. Lock the scope row (all save/open/retry operations follow the same lock order) before inspecting the mutable active pointer. Never authorize using an arbitrary request's teacher/student IDs or user_metadata role.
2. Canonicalize mode and typed payload; include protocol, scope, season, session, location, level, counts and duration. Do not default invalid mode to SOLO. Require SOLO session NULL and Championship a supplied session UUID.
3. Look up UNIQUE(scope_id, auth_user_id, request_id). If an existing completed attempt has exactly the same normalized payload, return it unchanged, even if the season/session has since closed. A currently revoked/inactive identity still fails authorization. If payload differs, fail with an explicit conflict; do not reuse the ID for another season/mode.
4. For a new key require the supplied season equals the scope's active pointer and its status ACTIVE. Championship additionally requires an OPEN session in that same scope/season and the same student's enrolled participant. Old-season new writes fail; no reassignment or SOLO fallback.
5. Lock season/session/participant/progress rows in a documented consistent order after the scope lock. Insert attempt and update only the relevant progress table and participant aggregate in the same transaction. Failure rolls everything back; do not catch exceptions and perform a different-mode insert.
6. Return persisted values. A separate read-back/status RPC may reconcile an unknown network outcome using the same authenticated owner and request key; it never replays with a fresh key. Clients keep the key and original scope/season/session until confirmation.

The request identity excludes mutable device timestamps and retry counts. JSONB canonical typed equality can compare payloads without requiring a new pgcrypto extension. If a digest is later added, verify installed extension/schema and compare actual normalized fields too. No extension installation is assumed.

For concurrent same-key requests, the scope lock plus UNIQUE constraint ensures one insert/effect. A future higher-throughput design may use advisory/row locks or INSERT ON CONFLICT, but must preserve the same atomic semantics and lock order. The constraint is the invariant, not a local cache. Different request UUIDs are different requests: preventing a malicious client from minting new IDs requires separately verified game attempt/scoring rules, not a claim of content-based deduplication.

## Atomic start-season RPC — specification only

Proposed name: public.aqua_math_start_season_v2(p_scope_id uuid, p_expected_revision bigint, p_operation_id uuid, p_name text, p_open_championship boolean).

Require auth.uid(), an active trusted teacher_authorizations row with can_open_season, and an existing matching teacher profile. The backend UUID allowlist alone cannot authorize a direct database RPC. Bootstrap authority through an approved operator migration only; students and teachers cannot grant themselves authority. Do not use signup-created profiles as sufficient proof.

Transaction: lock scope row; verify teacher authority under a compatible authorization-row lock; check season_operations replay first; reject a reused operation ID with different payload; check expected_revision; close old ACTIVE season and old OPEN v2 sessions; create new season, optional OPEN Championship session and approved participant rows; set pointer and increment revision; record actor, old/new IDs and the operation receipt. No attempts/progress/archive rows are deleted or rewritten. Empty new-season progress reads 0/Level 1. A conflicting concurrent teacher request with stale revision fails rather than silently creating another season. The pointer and partial unique ACTIVE/OPEN indexes provide database invariants.

Every step commits together, or none does. Writes racing with the switch serialize under the same scope lock: an attempt either belongs to the old season before closure or is rejected afterward. The same old committed request may still retrieve its receipt after closure. Reopening an archived season or administrative score corrections are not included in this permission.

## Read RPCs, isolation and mobile convergence

- public.aqua_math_get_context_v2(p_scope_id): returns authorized membership, active season ID, revision, applicable OPEN Championship session and protocol version. All HP use this database response, rechecking on login/resume/before new mission. Subscription/polling is only an optimization.
- public.aqua_math_get_progress_v2(p_scope_id,p_season_id,p_session_id): derive own student or authorized teacher scope; explicit mode partition, no legacy/snapshot fallback. Empty known active context yields 0/Level 1; a query error is an error, not a fabricated zero.
- public.aqua_math_get_leaderboard_v2(p_scope_id,p_season_id,p_session_id): Championship only; session must belong to requested season; deterministic scoring/tie-breakers copied from the verified existing contract. Never aggregate all historical sessions or combine SOLO.
- public.aqua_math_get_receipt_v2(p_scope_id,p_request_id): authenticated owner or specifically authorized teacher, request/attempt result only. Reconcile timeout without insert/update.
- Archive reads require scope authority and tagged source identity; never expose unrelated public legacy rows or other classes. Authorized teachers may need only aggregate/assessment fields, not credentials.

## RLS, grants and constraints

New tables have RLS enabled, default-deny, and no authenticated/anon/PUBLIC DML grants. Private schema is not added to PostgREST exposure by assumption. New public wrapper functions have default PUBLIC/anon EXECUTE explicitly revoked, and receive only reviewed authenticated EXECUTE grants after implementation passes tests. Table/schema/default privileges must be inventoried because Supabase projects can have broad defaults. Do not alter project-wide defaults.

Prefer narrowly reviewed SECURITY DEFINER wrappers with a trusted nonlogin owner, fixed search_path (e.g. pg_catalog), fully qualified object names and explicit current-user checks on every path. Choose/verify owner privileges before implementation. Table owners/definers can bypass RLS; enabling RLS is not a substitute for authorization in these wrappers. Do not assume FORCE RLS plus an owner definer will work without appropriate policies. Any future direct authenticated reads require scoped policies and column-level grants, tested independently. No service-role key is requested or used by app clients.

Required invariants/indexes: scope/season composite FKs; one ACTIVE season per scope; one OPEN v2 session per scope/season; explicit mode/session/participant CHECK with FK guaranteeing participant student equals attempt student; separate progress PKs; UNIQUE(scope,Auth user,request) on v2 attempts; UNIQUE(scope,actor,operation ID) for season operations; UNIQUE(session,student) participants; season/student/mode/time and session/score read indexes as justified by actual queries. No removal of UNIQUE(student_id) from public.game_progress and no change to existing valid_mode_session.

## Metadata required before final SQL

Run the read-only companion `metadata-required.sql` and existing `../sql/supabase-championship-audit.sql` with an authorized operator. Needed:

- Full columns, ID types, NOT NULL/default/generated values, enum labels and score/time semantics for all referenced tables; exact valid_mode_session and every PK/FK/UNIQUE/CHECK/index (incoming FKs as well).
- Complete source/signatures/owners/search_path/grants for save_game_attempt and ALL nested authorization, membership, scoring, session and aggregate helpers; view/materialized-view definitions and dependent function consumers. pg_depend does not reliably discover dynamic SQL, PL/pgSQL text calls or external apps; owner inventory remains necessary.
- Actual session status column/type/OPEN behavior, membership enrollment fields, participant_id semantics, and game_progress fields and historic mode overwrite behavior.
- All RLS policy expressions/roles, enabled/forced flags, schema/table/column/function grants, default privileges, API-exposed schemas, publication memberships and PostgreSQL version/extensions. API settings and external consumers may require dashboard/operator confirmation beyond catalog SQL.
- Trusted teacher ownership source and bootstrap authority, existing profile/role relationships, student/account matching, shared rows/users, existing object-name collisions in aqua_math/public v2 RPC prefixes, migration tooling and transaction boundaries.
- Approved AQUA ownership manifest, record counts/consistency and ambiguity reports from the operator, backup/restore and maintenance/cutover strategy; do not copy credentials or unrelated personal data into this repo.

Until obtained, draft DDL is NOT final, public wrapper bodies intentionally fail closed, there are no runtime EXECUTE grants or backfill DML, and production activation is blocked.
