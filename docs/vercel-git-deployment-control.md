# Branch-specific automatic deployment control

Prepared locally on security/backend-auth-hardening. No push, merge, Vercel project
change or deployment is performed. Existing deployed websites remain unchanged.

`vercel.json` adds only:

```json
"git": {
  "deploymentEnabled": {
    "main": true,
    "security/backend-auth-hardening": false
  }
}
```

- Only security/backend-auth-hardening is disabled for automatic Git deployments.
- main stays explicitly enabled. All other unspecified branches default to true.
- No wildcard or project-wide `github.enabled=false` is used.
- This applies to BOTH aqua-adventure and aqua-adventure-test when their Git
  integration reads this root vercel.json from the incoming branch commit. The
  rule is branch-based, not project-name-based. A different project Root Directory
  with a different config would need separate treatment; cloud Root Directory
  settings were not inspected through a Vercel API in this task.
- The rule has not reached GitHub/Vercel yet. It will be available to Vercel's Git
  integration only after a separately approved push containing this configuration.
- It controls automatic Git deployment; this task does not authorize or perform
  later manual deployments. The production branch/domain is not changed.

Validation:

1. Strict JSON parsing passed. Every pre-existing build/install/output, Functions
   and API/SPA rewrite value is exactly equal to commit eebb9d1.
2. Configuration type-check passed against official VercelConfig generated from
   Vercel's vercel.json OpenAPI schema (plus the existing editor-only $schema
   annotation). Source pinned to Vercel repository commit
   84878e532142f0ac584953695658b324eb9e5b80:
   https://github.com/vercel/vercel/blob/84878e532142f0ac584953695658b324eb9e5b80/packages/config/src/types.ts#L260-L268
   The official GitConfig description explicitly says unspecified branches default
   to true. Direct retrieval of openapi.vercel.sh was denied with HTTP 403 by the
   environment proxy; no claim of validation against that live endpoint is made.
3. Exact-map/default checks passed for main, the protected branch, feature/example
   and security/backend-auth-hardening-extra. No other branch is disabled.
4. All 10 existing backend/vercel.test.ts routing/API/Preview guard tests passed,
   with the offline test preload. No service request or real deployment is tested.

No application logic, environment bindings, Supabase policies/data, Preview safety
checks or Game Season files were changed. No new dependencies were installed in
this repository. The official type source was inspected outside the checkout.
