---
phase: 148-governance-audit-users-feature-visibility
plan: 02
subsystem: backend-auth-governance
tags: [VIS-01, ADMIN-03, feature-visibility, ban-enforcement, migration-098, shared-auth-seam]
requires:
  - "148-01 (Wave-0 RED test scaffold + shared fixtures: banned_user, feature_visibility, mock_asyncpg_pool)"
  - "migration 097 app_settings.* TTL-cache substrate (Phase 147)"
  - "operator_service.is_operator (the ONE swappable audience boundary, Phase 146)"
provides:
  - "require_visible(feature) — per-endpoint VIS-01 gate factory (403-not-404); consumed by 148-04/05 wiring"
  - "feature_audience(feature) resolver + _GOVERNED_FEATURES cold-default map (D-06 polarity, ONE home)"
  - "set_feature_visibility(feature, audience) — atomic JSONB ||-merge writer; consumed by 148-04/06 PUT /admin/visibility"
  - "_is_banned(user_id) + app-layer ban check inside get_current_user (closes the stateless-JWT window)"
  - "app_settings.feature_visibility jsonb column + D-05 day-one seed (migration 098, AUTHORED not applied)"
affects:
  - "backend/app/dependencies.py (shared get_current_user auth seam — RED LINE; additive + fail-open only)"
  - "backend/app/models/user_settings.py (effective-settings model + TTL-cache reads)"
tech-stack:
  added: []   # zero new packages (RESEARCH audit confirmed)
  patterns:
    - "enum-shaped audience records {\"audience\":\"operators|everyone\"} — never boolean (SEED-115 forward-compat)"
    - "fail-OPEN ban check (no self-inflicted outage — mirrors maintenance_mode default-OPEN polarity)"
    - "atomic per-key JSONB || merge (avoids lost-update clobber vs whole-column SET)"
    - "dependency-factory closure with lazy import to break the user_settings->deps cycle"
key-files:
  created:
    - supabase/migrations/098_feature_visibility.sql
  modified:
    - backend/app/models/user_settings.py
    - backend/app/dependencies.py
decisions:
  - "Skipped requirements.mark-complete for VIS-01/ADMIN-03 — 148-02 is substrate only (gate factory + ban check + migration are not yet CALLED by any router until 148-04/05/06); marking complete now would be a false green. They complete at phase verify-work."
  - "get_current_user ban check placed OUTSIDE the auth try/except (Approach A) so the 403 is not folded into the 401 — the existing 401 paths stay byte-identical."
  - "Migration 098 AUTHORED but NOT applied (live apply + full-schema regen is 148-03's human checkpoint per plan)."
metrics:
  duration: ~15m
  tasks_completed: 3
  files_touched: 3
  completed: 2026-07-11
---

# Phase 148 Plan 02: Governance Substrate (VIS-01 gate + ban seam + migration 098) Summary

**One-liner:** The one shared-auth-path plan — a `require_visible(feature)` 403-not-404 gate factory, an enum-record `feature_audience` resolver with a single-home D-06 cold-default map + atomic JSONB-merge writer, a fail-open app-layer `banned_until` check inside `get_current_user`, and migration 098's `feature_visibility` JSONB column — the swappable audience boundary + by-construction ban seam every downstream 148 slice composes.

## What Was Built

**Task 1 — Migration 098 (`supabase/migrations/098_feature_visibility.sql`, commit `5b6ad2f6`):**
Additive `feature_visibility jsonb NOT NULL DEFAULT '{}'::jsonb` column on `app_settings` + idempotent `('global') ON CONFLICT DO NOTHING` + the D-05 day-one seed (`skill_studio`/`model_management` → `{"audience":"operators"}`; `workflow_authoring`/`governance_health` → `{"audience":"everyone"}`). Audience values are enum-shaped records, never bare booleans (SEED-115 forward-compat). Metadata-only — no audit-table CHECK touched (the new operator-ledger action codes write to free-text `operator_audit_log.action`; the platform `audit_log` 19-action CHECK is read-only here). Copied 097's apply-order + cloud-parity header verbatim. **Authored, not applied** — live apply is 148-03's human checkpoint.

**Task 2 — Resolver + writer (`backend/app/models/user_settings.py`, commit `af449ec3`):**
- `feature_visibility: dict = {}` field on `UserEffectiveSettings` + a builder read with the same double-serialization guard `provider_model_lists` uses.
- `_GOVERNED_FEATURES` — the ONE place the D-06 cold-read polarity lives (deny `skill_studio`/`model_management`, allow `workflow_authoring`/`governance_health`).
- `feature_audience(feature) -> str` — reads the stored enum record from the sync TTL cache, returns the stored `audience` only when it is a recognized enum value, falls back to the per-feature default on cold cache / DB blip / missing key / malformed record / unknown feature (unknown → safe-deny `operators`). Never reads or returns a boolean; never raises.
- `set_feature_visibility(feature, audience)` — atomic `feature_visibility = coalesce(feature_visibility,'{}'::jsonb) || $1::jsonb` merge (no lost-update clobber), deliberately NOT routed through `save_app_settings`; invalidates the cache.

**Task 3 — Gate factory + ban seam (`backend/app/dependencies.py`, commit `b6e419a1`):**
- `require_visible(feature)` — dependency FACTORY: no-op for operators AND Everyone-audience features (carve-outs byte-identical), else `HTTPException(403, "This feature is available to administrators only.")` (D-03 — NOT 404). `is_operator` is the ONE swappable boundary; `feature_audience` is lazy-imported inside the closure to break the `user_settings → deps` cycle.
- `_is_banned(user_id)` — `SELECT banned_until FROM auth.users WHERE id = $1` via the asyncpg pool; True only for a real future `banned_until`; **fails OPEN** on any read exception.
- Ban check inserted inside `get_current_user` AFTER `supabase.auth.get_user` validates and OUTSIDE the auth try/except (so the 403 is not folded into the 401): `if await _is_banned(...): raise HTTPException(403, "This account is disabled — contact your administrator.")`.
- `authenticate_operator_request` / `require_operator` byte-identical — the `/admin` 404 contract is untouched (verified via `git diff`).

## Verification

- **148-02-owned substrate tests GREEN (10/10 run together):** `test_148_require_visible.py` (3), `test_148_visibility_cold_default.py` (3), `test_148_ban_enforcement.py` (1), `test_148_ban_fail_open.py` (3).
- **146/147 regression backstop GREEN (78/78):** all `test_146_*` + `test_147_*` (operator gate, seed, active-runs, flag hide/refuse/failure-semantics, health probe, maintenance middleware, kill, workflows flag) — no regression on the shared auth path.
- **Full `test_148_*.py` sweep:** 11 passed / 20 failed — every one of the 20 failures is a downstream Wave-0 stub owned by later plans (carveouts + effective_features → 148-05; csv_export + platform_audit_filters/scope + view_platform_recorded → 148-04/06; disable + enable + operator_grant + roster → 148-06). Expected-RED per the plan's `<verification>`; none are 148-02's responsibility.

## Deviations from Plan

None — plan executed exactly as written (Tasks 1–3, no Rule 1/2/3 auto-fixes needed). One in-scope judgment call recorded under `decisions`: skipped `requirements.mark-complete` for VIS-01/ADMIN-03 because this substrate plan does not yet deliver the router wiring / admin endpoints / roster / CSV export / frontend those requirements span (they complete at phase verify-work, not at plan 2 of 9).

## Known Stubs

None in the harmful sense. `require_visible(...)` and `set_feature_visibility(...)` are built but not yet CALLED by any router/endpoint — this is by design for a substrate plan (148-04/05/06 consume them). The plan's own goal (build the swappable audience boundary + ban seam + migration) is fully achieved; nothing here renders empty/placeholder data to a UI.

## Threat Flags

None. All security-relevant surface introduced (the ban check on the shared auth seam, the `require_visible` 403, the JSONB audience write, the cold-read default polarity) was enumerated in the plan's `<threat_model>` (T-148-02/03/04/05/06/07) and mitigated as specified. No new endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the planned column.

## Pre-existing Note (out of scope, not fixed)

The ROADMAP progress table's Phase **147** row still reads `0/? | Not started` despite 147 having shipped (9/9). This is pre-existing drift from the `roadmap.update-plan-progress` verb quirk (MEMORY: reference_phase_complete_roadmap_gap), not caused by this plan. The Phase 148 row was hand-corrected to `2/9 | In Progress`.

## Self-Check: PASSED

- Files: FOUND `supabase/migrations/098_feature_visibility.sql`, FOUND `backend/app/models/user_settings.py`, FOUND `backend/app/dependencies.py`.
- Commits: FOUND `5b6ad2f6` (migration 098), FOUND `af449ec3` (resolver + writer), FOUND `b6e419a1` (require_visible + ban check).
