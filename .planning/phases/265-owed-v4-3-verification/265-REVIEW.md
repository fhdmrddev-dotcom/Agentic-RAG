---
phase: 265-owed-v4-3-verification
reviewed: 2026-09-23T00:00:00Z
depth: standard
diff_range: af280ed96..1ed7e149f
files_reviewed: 17
files_reviewed_list:
  - supabase/migrations/194_org_plan_columns_not_client_writable.sql
  - scripts/full-schema-supplement.sql
  - backend/app/api/experts.py
  - backend/app/services/harness_engine.py
  - backend/tests/integration/test_265_org_tier_self_upgrade.py
  - backend/tests/unit/test_262_expert_list_grants_api.py
  - backend/tests/unit/test_264_born_for_carrier.py
  - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
  - frontend/src/components/experts/catalog/startScopedChat.ts
  - frontend/src/components/experts/catalog/__tests__/startScopedChat.test.ts
  - frontend/src/lib/api/admin.ts
  - frontend/src/lib/api/schedules.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/lib/api/__tests__/entitlementRefusal.test.ts
  - .claude/hooks/extension-contract-guard.js
  - docs/EXTENSION-CONTRACT.md
  - scripts/launch-langsmith-mcp.py
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 265: Code Review Report

**Reviewed:** 2026-09-23
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

I reviewed the Phase 265 source diff (`af280ed96..1ed7e149f`, limited to backend/app, backend/tests, frontend/src, .claude/hooks, docs, scripts and supabase/migrations). It contains the ten small D-04 fixes and hotfix migration 194. I did not re-open deferred or accepted rows from `265-TRIAGE.md`. In particular, a disabled Expert can still be read through `GET /experts/{id}` and `/resolve`, and that is covered by R265-audit-fixes-02 (deferred to phase 267 / BUS-304).

**Migration 194 is correct and closes the self-upgrade hole. I found no blocker in it.**
- It revokes table-level INSERT and UPDATE from `anon`, from `authenticated` **and from `PUBLIC`**. It then clears the column-level UPDATE privileges and grants UPDATE back to `authenticated` only on `(name, slug, settings, updated_at)`. This avoids the trap where a column-level revoke does nothing because the table-level grant still stands.
- The columns listed match the live table exactly: `id, name, slug, subscription_tier, add_ons, settings, created_at, updated_at`. So the explicit column REVOKE will not fail on an unknown column.
- I checked the other ways in:
  - `create_org_with_default_dept`, the only SQL writer with a `p_subscription_tier` parameter, already has EXECUTE revoked from PUBLIC, anon and authenticated.
  - `tier_capabilities` gives client roles SELECT only.
  - DELETE is still granted, but there is no DELETE policy, so RLS blocks it.
  - No backend or frontend code writes `organizations` through a user-scoped client.
- The integration test checks the refusal by pgcode 42501, so an RLS `UPDATE 0` cannot make it pass. It also checks the catalogue directly and includes a case proving the four editable columns still work.

Two fixes do less than their triage rows claim. They are listed below as warnings.

## Warnings

### WR-01: The `getSetupStatus` timeout does not stop the boot spinner on a hung backend, because an unbounded `/public-config` fetch runs first

**File:** `frontend/src/lib/api/admin.ts:945` (fix) and `frontend/src/App.tsx:143-144`, `frontend/src/lib/supabase.ts:63` (unchanged callers)

**Issue:** UAT-265-257-2-OBS says: "a hung backend must fall through, never spin forever". At boot, App calls `await hydrateSupabaseFromRuntime(API_BASE)` **before** `await getSetupStatus()`. `hydrateSupabaseFromRuntime` does a plain `fetch(`${apiBase}/public-config`)` with no signal or timeout. If the whole backend hangs (accepts the connection, never replies), the hydrate call never settles. `getSetupStatus` is then never reached, `setupStatus` stays `null`, and the spinner still spins forever. The re-drive tested the patched fetch on its own in node, not the real boot sequence, so it could not catch this. The fix only works when `/setup/status` hangs and `/public-config` does not. Both routes are on the same process, so that is unlikely.

**Fix:** Bound the hydrate fetch the same way. It already falls back to the baked client in its `catch`.
```ts
// frontend/src/lib/supabase.ts:63
const r = await fetch(`${apiBase}/public-config`, { signal: AbortSignal.timeout(10_000) })
```
Add a RED case that renders App against a never-resolving fetch and asserts that the spinner goes away.

### WR-02: Migration 194 re-grants client UPDATE on `organizations.settings`, which the schema names as the future home of per-org provider config and BYO keys

**File:** `supabase/migrations/194_org_plan_columns_not_client_writable.sql:35` (mirrored in `scripts/full-schema-supplement.sql:502`)

**Issue:** The migration's own header says "No app code writes organizations". Even so, it grants UPDATE on `name, slug, settings, updated_at` back to `authenticated`. The column comment (`full-schema.sql:2382`) calls `settings` the "forward-compat home: per-org provider config / BYO keys / model selection" (SEED-120). Today nothing reads it, so nothing can be exploited yet. But once a backend reader lands, any org admin can write arbitrary JSON there directly through PostgREST. That bypasses whatever validation the backend API adds, for example a provider base-URL allowlist (SSRF) or the `enc:v1:` envelope. This is the same class of bug 194 just fixed for `add_ons`: an entitlement-style jsonb column that a client can write. The grant is also not needed today, because no client path uses it.

**Fix:** Grant back only what a client path actually uses today (possibly nothing). At minimum, drop `settings`:
```sql
GRANT UPDATE (name, slug, updated_at) ON public.organizations TO authenticated;
```
Then update `_EDITABLE_COLUMNS` / `_PROTECTED_COLUMNS` in `test_265_org_tier_self_upgrade.py` to match. If a later change needs clients to write `settings`, route it through a validated backend endpoint instead of a PostgREST grant.

## Info

### IN-01: The extension-contract hook reports every scanner failure as a "violation"

**File:** `.claude/hooks/extension-contract-guard.js:60-64`
**Issue:** The `catch` runs for any `execFileSync` failure: a real violation (exit 1), the 10 s timeout, a crash in the scanner, or a missing `node`. All of them get the heading "EXTENSION CONTRACT … violation in <file>". A timeout or harness error sends the editing agent looking for a violation that does not exist.
**Fix:** Branch on `err.status === 1` for the violation message. For anything else (`err.signal`, `err.code === 'ETIMEDOUT'`, or another status), send "extension-contract scanner could not run: …".

### IN-02: The migration 194 regression guard only runs when someone runs the integration suite

**File:** `backend/tests/integration/test_265_org_tier_self_upgrade.py:52-54`
**Issue:** The test lives under `tests/integration` and skips when there is no live Postgres. The mandatory gate is `pytest tests/unit`, so it never runs this file. Nothing automated stops a future `full-schema.sql` regeneration or migration from quietly putting the table-level grant back.
**Fix:** Add the `has_column_privilege` catalogue check to the deploy parity checklist next to `get_advisors(security)`, or run the integration file in CI against the bootstrapped schema.

### IN-03: The migration header is dated after the day it was written

**File:** `supabase/migrations/194_org_plan_columns_not_client_writable.sql:8`, `backend/tests/integration/test_265_org_tier_self_upgrade.py:12`
**Issue:** Both say "Measured on production 2026-09-24". The phase ran on 2026-09-23. Evidence in this project is supposed to be dated accurately.
**Fix:** Correct it to the actual date of the read-only production measurement.

### IN-04: The isolated LangSmith MCP venv is only checked with the Windows layout

**File:** `scripts/launch-langsmith-mcp.py:100-106`
**Issue:** `isolated_exe` is only built as `.tools/langsmith-mcp-venv/Scripts/<cmd>.exe`. The POSIX fallback only looks in `backend/venv/bin`. On Linux or macOS the isolated venv is never used, and the script falls back to the backend venv, the exact setup the comment warns against.
**Fix:** Also check `.tools/langsmith-mcp-venv/bin/<cmd>` before falling back to `backend/venv`.

---

_Reviewed: 2026-09-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
