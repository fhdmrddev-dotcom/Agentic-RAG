---
phase: 148-governance-audit-users-feature-visibility
reviewed: 2026-07-12T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/document_governance.py
  - backend/app/api/evals.py
  - backend/app/api/features.py
  - backend/app/api/settings.py
  - backend/app/api/skill_test_cases.py
  - backend/app/api/skill_tuner.py
  - backend/app/api/workflows.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/app/services/governance_service.py
  - backend/app/services/operator_service.py
  - frontend/src/App.tsx
  - frontend/src/components/admin/AuditTab.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/FeatureVisibility.tsx
  - frontend/src/components/admin/UsersAndAccess.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/hooks/useEffectiveFeatures.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/nav-items.ts
  - supabase/migrations/098_feature_visibility.sql
findings:
  critical: 2
  warning: 3
  info: 4
  total: 9
status: issues_found
---

# Phase 148: Code Review Report

**Reviewed:** 2026-07-12
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 148 wires the operator-only Users & Access roster, cross-user platform-audit browse + capped CSV export, GoTrue disable/enable, operator grant/revoke, and the VIS-01 feature-visibility contract (`require_visible` 403 gate + the per-user `/features` map + the app-layer ban check).

The **backend security substrate is solid**: every `/admin` route inherits the router-level `require_operator` byte-identical-404 gate; `require_visible` correctly returns 403 (not 404) and preserves the Run carve-outs (`GET /settings/providers`, `/workflows/published|starters`, workflow launch); all cross-user reads in `governance_service.py` are parameterized (`$N` binds, `SELECT` of an explicit column list, `page_size` clamped ≤ 100, CSV COUNT-first refuse-over-50000); the self-disable / self-revoke 409 guards fire before any mutation; and the audit-floor "record a cross-user read / refused export leaves no receipt" discipline holds.

The defects cluster on the **frontend feature-forbidden plumbing** and one **auth-seam gap**. The `ApiError` constructor was made to dispatch a global `FEATURE_FORBIDDEN_EVENT` on **any** HTTP 403 under the assumption that "a 403 is uniquely a `require_visible` refusal." That assumption is false — the NEW ban check and the existing workflows kill-switch both return 403 — and the App-level listener's `refetchFeatures()` reaction turns a `/features` 403 (a banned user) into a self-sustaining request storm. Secondary issues: the ban seam does not cover the `/admin` surface, and the visibility panel renders a hardcoded (potentially stale/wrong) audience because no read endpoint exists.

## Critical Issues

### CR-01: Banned user triggers an infinite `/features` refetch storm

**File:** `frontend/src/lib/api.ts:40-45`, `frontend/src/lib/api.ts:3616-3622`, `frontend/src/App.tsx:127-139`
**Issue:** `getEffectiveFeatures()` throws `new ApiError(..., res.status)` on a non-OK response. The `ApiError` constructor unconditionally dispatches `FEATURE_FORBIDDEN_EVENT` whenever `status === 403`. `App.tsx`'s `onForbidden` handler reacts to that event by calling `refetchFeatures()`, which bumps the `useEffectiveFeatures` nonce and re-issues `getEffectiveFeatures()`.

For a **banned user**, `GET /features` runs through `get_current_user` → `_is_banned` → `403` (`dependencies.py:146-150`). So the cycle is:

```
getEffectiveFeatures() → 403 → new ApiError(403) → dispatch FEATURE_FORBIDDEN_EVENT
  → App.onForbidden → refetchFeatures() → nonce++ → getEffectiveFeatures() → 403 → …
```

This is an unbounded loop that hammers `/features` (each iteration also does a DB `banned_until` read + a Supabase `auth.get_user`) as fast as the network round-trips resolve, and keeps the "administrators only" banner re-arming. Any future 403 from `/features` (auth hiccup, misconfig) produces the same storm.

**Fix:** Do not let the effective-features read feed the bounce, and do not auto-dispatch on every 403. For example, make the map read throw a non-dispatching error and gate the event on the actual refusal:

```ts
// getEffectiveFeatures: never feed the graceful-bounce loop — use a plain Error.
export async function getEffectiveFeatures(): Promise<EffectiveFeatures> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/features`, { headers })
  if (!res.ok) throw new Error("Failed to load feature visibility.")   // NOT ApiError
  const body = (await res.json()) as { features?: EffectiveFeatures }
  return body.features ?? {}
}
```

And distinguish a real `require_visible` refusal from other 403s at the dispatch site (see CR-02) rather than status alone.

### CR-02: `FEATURE_FORBIDDEN_EVENT` mis-fires on non-visibility 403s (workflows kill-switch, banned account)

**File:** `frontend/src/lib/api.ts:35-45`
**Issue:** The `ApiError` constructor asserts "a 403 is UNIQUELY a `require_visible` feature refusal in this app … no other endpoint surfaces a 403 ApiError." That is not true. Confirmed 403 sources that flow through `ApiError`:

- `backend/app/api/threads.py:949-953` — the FLAG-01 workflows kill-switch returns `403 "Workflows are currently disabled by the administrator"`. This is on the `postMessage` path, which throws `throw new ApiError(detail, res.status)` (`api.ts:527-533`).
- `backend/app/dependencies.py:146-150` — the NEW ban check returns `403 "This account is disabled…"` on the shared auth path, reachable through many `ApiError`-throwing calls (`postMessage`, `answerAskUser`, all `/admin` and feature calls).

When an operator disables workflows and a user launches one, the user now gets the App-level graceful bounce: `App.tsx:131-135` ignores the real message and hardcodes `"This feature is available to administrators only."`, then `setActiveView("chat")` and `refetchFeatures()`. So a legitimate, reachable flow shows a **wrong message**, navigates the user away, and fires a spurious features refetch — on top of `StreamsProvider.sendMessage`'s own error handling of the same `ApiError`.

**Fix:** Gate the dispatch on the actual server refusal detail, not the bare status, so only `require_visible` refusals bounce:

```ts
// Only a require_visible refusal carries this exact server detail.
const VISIBILITY_REFUSAL = "This feature is available to administrators only."
if (status === 403 && message === VISIBILITY_REFUSAL && typeof window !== "undefined") {
  window.dispatchEvent(new CustomEvent(FEATURE_FORBIDDEN_EVENT, { detail: { message, status } }))
}
```

(Have `require_visible` and the App listener agree on that literal, and keep `postMessage`/ban 403s out of the bounce path.)

## Warnings

### WR-01: Ban enforcement does not cover the `/admin` surface — a disabled operator keeps operator powers

**File:** `backend/app/dependencies.py:204-231`
**Issue:** The app-layer ban check (`_is_banned`) is only called inside `get_current_user`. The `/admin` surface authenticates through `authenticate_operator_request`, which validates the token and returns the identity but never calls `_is_banned`. `disable_user` (`admin.py:776-811`) allows disabling any non-self user, including another operator. A disabled operator's existing access token still passes `supabase.auth.get_user` (per the `_is_banned` docstring, GoTrue does not reject a live token's ban), so that operator retains full `/admin` access until token expiry — and `enable_user` has no self-guard, so they can `POST /admin/users/{self}/enable` to lift their own ban or disable the operator who disabled them.

**Fix:** Apply the ban check on the operator path too, e.g. in `authenticate_operator_request` after resolving the user:

```python
if user is None:
    raise _NOT_FOUND
if await _is_banned(user.id):
    raise _NOT_FOUND   # fold into the byte-identical 404 (non-discoverable)
return {"id": user.id, "email": user.email}
```

(Keep it fail-OPEN like `_is_banned` so a DB blip never locks operators out.)

### WR-02: Feature-visibility panel renders a hardcoded default audience — stale/wrong after any prior flip

**File:** `frontend/src/components/admin/ControlRoomPage.tsx:170-181`, `frontend/src/components/admin/FeatureVisibility.tsx:140`
**Issue:** There is no read endpoint for the persisted audience map, so the Control Room seeds `visibility` from `DEFAULT_VISIBILITY` (the day-one polarity) and only mutates it on local flips. After any prior operator changes the persisted audience (e.g. `skill_studio → everyone`) and the page is reloaded — or a second operator opens it — the panel still shows the seeded default (`operators`), which contradicts the actual enforced state. On a security-governance surface this is misleading: an operator can believe a feature is locked to operators when it is actually open to everyone (or vice-versa).

**Fix:** Add a read (e.g. extend `GET /features` for operators to return the raw audience map, or a small `GET /admin/visibility`) and seed `visibility` from it instead of `DEFAULT_VISIBILITY`; fall back to the default only until that read resolves. Enforcement is already correct server-side — this is about not displaying a false audience.

### WR-03: Migration 098 seed is not data-idempotent — a re-run wipes operator-customized audiences

**File:** `supabase/migrations/098_feature_visibility.sql:42-47`
**Issue:** The header states the migration is "idempotent … safe to re-run", and the CLOUD PARITY note says to paste the same SQL into the cloud SQL editor. But the seed is an unconditional whole-column overwrite:

```sql
UPDATE public.app_settings SET feature_visibility = jsonb_build_object(
  'skill_studio', jsonb_build_object('audience','operators'), ...
) WHERE id = 'global';
```

Re-running after an operator has changed any audience resets **all four** features back to the day-one defaults (silent governance-state reset / data loss). It is schema-idempotent (`ADD COLUMN IF NOT EXISTS`) but not data-idempotent.

**Fix:** Only seed keys that are absent, so a re-run preserves runtime customizations:

```sql
UPDATE public.app_settings
SET feature_visibility =
  jsonb_build_object(
    'skill_studio', jsonb_build_object('audience','operators'),
    'model_management', jsonb_build_object('audience','operators'),
    'workflow_authoring', jsonb_build_object('audience','everyone'),
    'governance_health', jsonb_build_object('audience','everyone')
  ) || coalesce(feature_visibility, '{}'::jsonb)   -- existing keys win
WHERE id = 'global';
```

## Info

### IN-01: `GET /admin/audit` limit is unclamped

**File:** `backend/app/api/admin.py:562-577`, `backend/app/services/operator_service.py:91-111`
**Issue:** `limit` is taken straight from the query string and passed to `.limit(limit)` with no upper bound, unlike the roster/platform reads which clamp `page_size ≤ 100`. It is operator-gated, so impact is low, but an operator can request an arbitrarily large page.
**Fix:** Clamp in `get_recent_operator_audit`, e.g. `limit = max(1, min(int(limit), 500))`.

### IN-02: `browse_platform_audit` uses the raw (unclamped) `page_size` for `has_more`/`offset`

**File:** `backend/app/api/admin.py:633-648`
**Issue:** The service clamps the LIMIT to ≤ 100, but the controller computes `offset = (page-1)*max(1,page_size)` and `has_more = len(rows) == page_size` with the unclamped client value, and echoes the raw `page_size` in the response. For any `page_size > 100` this yields wrong `has_more` and pagination gaps. The frontend fixes `page_size = 50`, so this is currently latent.
**Fix:** Clamp `page_size` in the controller with the same `_clamp_page_size` the service uses, and derive `offset`/`has_more` from the clamped value.

### IN-03: Roster `doc_count` counts all document rows including non-latest versions

**File:** `backend/app/services/governance_service.py:185-196`
**Issue:** `LEFT JOIN (SELECT user_id, count(*) … FROM documents GROUP BY user_id)` counts every `documents` row, but that table carries version history (`is_latest`). The roster's "docs" figure therefore over-counts versioned documents.
**Fix:** If the intent is logical-document count, add `WHERE is_latest = true` to the documents sub-select.

### IN-04: Tightening `workflow_authoring` hides the whole Workflows home, including the run library

**File:** `frontend/src/lib/nav-items.ts:36`
**Issue:** The single "Workflows" nav entry is tagged `feature: workflow_authoring`. When an operator sets that audience to operators-only, non-operators lose the entire Workflows page — which also hosts the published/starter launch library — even though the backend deliberately keeps launch/published ungated ("running workflows stays open to everyone", `workflows.py:105-108`, `FeatureVisibility.tsx:99-104`). Launch survives only via the chat composer's Harness picker, so the capability isn't fully lost, but the nav gating contradicts the stated carve-out.
**Fix:** Either split a launch-only Workflows entry that stays ungated, or document that the Workflows home is authoring-scoped and launch is expected via the composer when the feature is tightened.

---

_Reviewed: 2026-07-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
