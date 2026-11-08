# Backend security branch — review before activation

This branch does not deploy, migrate, change RLS/RPC, reset scores or modify production data.

## Configuration required before using this branch

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`): the existing project URL.
- `VITE_SUPABASE_ANON_KEY`: the project's public anon/publishable key. Never put a service-role key here.
- `TRUSTED_TEACHER_AUTH_IDS`: comma-separated Auth UUIDs, selected and verified by the operator from existing authorized teachers. No defaults. Do not derive this list from self-registration or user-editable metadata. This server-side configuration is an additional authority because the existing profile-creation policies have not been audited in production.
- The authorized user must also have an existing `teacher_profiles` row with matching `auth_user_id` and `role = teacher`.

No service-role key is used. Database clients carry the caller's Supabase access token and remain subject to existing RLS. Never broaden RLS to work around a denial.

## Compatibility and blocked work

Teacher email and legacy username mappings and all 14 student username mappings are retained. Passwords and accounts are unchanged. Missing server configuration, an expired token, a missing teacher profile or an empty trusted list denies administrative access. Existing teacher sessions must reauthenticate; fabricated and legacy custom tokens no longer work. Client-only hosting without the Express `/api/admin/verify` endpoint will not support this branch's teacher login. Confirm hosting/API availability and approved teacher UUIDs before activation.

Teacher self-registration and automatic profile/role repair are intentionally refused. Provisioning accounts, adding Auth accounts and resetting student passwords return an explicit unavailable response: they require a separately approved privileged mechanism. No elevated credentials are requested or consumed here. These operations must not be described as regression-validated production features.

The backend save-attempt route now uses the existing `save_game_attempt` RPC with the verified student's token instead of a direct insert. This also preserves the database's progress-update path. Its production definition/return shape and RLS permissions remain unverified. Mock tests establish application behavior, not production authorization. Integration verification needs a safe test project before activation. HTTP requests without a student bearer token can no longer select a student or save results.

## Known boundary requiring separate approval

The frontend still talks directly to Supabase for gameplay and some administrative data operations. A backend allowlist cannot prevent a malicious client from calling Supabase directly if existing production RLS/RPC permits it. Do not claim the entire production application is secure based on these backend changes. Audit actual policies and RPC definitions read-only first; any required database changes need separate approval. Reset implementation and Game Season are unchanged and must not be executed during validation.

Public class-code roster lookup remains the existing read-only flow, subject to existing RLS. It is not authentication. Review roster privacy separately if necessary.

## Safe local validation

From `/workspace/AQUA-MATH-ADVENTURE-`:

```sh
node --import tsx --import ./backend/offline-tests.ts --test backend/auth.test.ts src/game/rules.test.ts src/services/teacherAuth.test.ts
npm run lint
npm run build
```

The preload denies external fetch requests, and backend tests inject all Supabase operations. No production login, write, deletion, reset, or migration is part of these commands. The 14-account test verifies username mapping using mocks, not real credentials. 3D rendering and visual layout are unchanged; no browser interaction regression is claimed.
