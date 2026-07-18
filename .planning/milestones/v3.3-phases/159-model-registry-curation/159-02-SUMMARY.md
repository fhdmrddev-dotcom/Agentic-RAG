---
phase: 159-model-registry-curation
plan: 02
subsystem: api
tags: [fastapi, asyncpg, model-registry, admin, operator-gate, sqli-safe, feature-flag, pydantic]

# Dependency graph
requires:
  - phase: 149-model-registry (MODEL-01/MODEL-02)
    provides: "model_capabilities_overrides table + SQLi-safe upsert (set_model_capability), load_all_model_overrides + invalidate_model_overrides_cache, get_model_capability_async read path, router-level require_operator gate"
  - phase: 147-operator-control-plane (FLAG-01)
    provides: "PUT /admin/flags set_flag + _FLAG_HUMAN_NAMES/_FLAG_KEYS allowlist + save_app_settings honest-failure path"
  - phase: 159-model-registry-curation (plan 01)
    provides: "PROVIDER_ENDPOINTS roster + is_utility_model chat-filter (model_discovery_service)"
provides:
  - "POST /admin/models add-by-ID endpoint (add_model_by_id) — operator adds a single model by EXPLICIT id + provider; DB-only model_capabilities_overrides row lands enabled=false, served immediately"
  - "AddModelRequest Pydantic body (no enabled field — forced false server-side) + _ADD_MODEL_CAP_COLUMNS code-allowlist"
  - "model_discovery_filter_enabled key on _FLAG_HUMAN_NAMES — the persisted discovery-filter toggle rides PUT /admin/flags with zero new endpoint code"
affects: [159-plan-03 (migration 103 + readback + _DIRECT_COLUMNS), 159-plan-04, 159-plan-05, 159-plan-06 (frontend add-by-ID form + filter toggle call these contracts)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Add-by-ID = a NEW POST /admin/models route (never overloads the capability PATCH, which infers provider + excludes it from its allowlist); explicit provider from the body, validated against PROVIDER_ENDPOINTS"
    - "enabled forced to the literal False in the write (not a body field) — an add can never auto-enable (149 opt-in-enable rule / SC#3)"
    - "Case-folded duplicate guard (built-in MODEL_CAPABILITIES ∪ load_all_model_overrides) — the WR-02 precedent, so a case-variant like GLM-4.5 can't phantom-duplicate glm-4.5"
    - "Persisted operator toggle rides the set_flag allowlist via ONE _FLAG_HUMAN_NAMES entry — zero new endpoint code (the 147 ride-along pattern)"

key-files:
  created:
    - "backend/tests/test_159_add_model.py — 12 tests (happy path, forced-false, roster, empty id, duplicate x4, enabled-ignored, persist-500, non-operator 404)"
    - "backend/tests/test_159_filter_flag.py — 5 over-HTTP tests (allowlist, off/on -> 204 routed to save_app_settings, bogus key -> 422, non-operator 404)"
  modified:
    - "backend/app/api/admin.py — AddModelRequest + _ADD_MODEL_CAP_COLUMNS + add_model_by_id route; model_discovery_filter_enabled added to _FLAG_HUMAN_NAMES; pydantic import gained ConfigDict"

key-decisions:
  - "Reused the set_model_capability upsert verbatim (INSERT ... ON CONFLICT (model_id) DO UPDATE SET col=EXCLUDED.col): column names ONLY from the code allowlist (_ADD_MODEL_CAP_COLUMNS + model_id/provider/enabled), values ONLY as \\$N binds — no client identifier/value reaches a SET clause (T-159-02)"
  - "enabled is written as the literal False and is NOT a field on AddModelRequest — a body carrying enabled:true is structurally ignored (SC#3, T-159-03)"
  - "Duplicate guard is CASE-FOLDED against MODEL_CAPABILITIES ∪ overrides → 409; never clobbers an existing row, never adds a case-variant second row (WR-02 precedent)"
  - "The add-by-ID handler strips the body id once (/ space/tab/newline) and uses the cleaned value for the dedup check, the stored row, the return, AND the audit label — a minor correctness extension over the plan's strip-for-empty-check-only, so a re-add can never phantom-differ by trailing whitespace"
  - "Filter toggle write is ONLY the _FLAG_HUMAN_NAMES key (Make-no-other-change) — the app_settings column + readback + _DIRECT_COLUMNS land in Plan 03's migration 103; the write test STUBS save_app_settings because this Wave-1 plan runs AHEAD of the operator-applied migration"

patterns-established:
  - "New non-GET /admin route carries its OWN non-operator 404 regression test (the 146 gate auto-enumerates GET only)"
  - "ConfigDict(protected_namespaces=()) on a Pydantic body with a model_-prefixed field (model_id) to silence the protected-namespace warning"

requirements-completed: []  # MODEL-03 is a phase-spanning requirement delivered across all 6 plans — NOT marked complete at plan 02 (verify-work owns the final flip)

# Metrics
duration: ~30 min
completed: 2026-07-18
---

# Phase 159 Plan 02: Add-by-ID Endpoint + Filter-Toggle Write Key Summary

**A SQLi-safe operator-gated `POST /admin/models` add-by-ID endpoint that lands a DB-only `model_capabilities_overrides` row `enabled=false` (never auto-enabled), plus the one `_FLAG_HUMAN_NAMES` key that lets the persisted discovery-filter toggle ride `PUT /admin/flags` with zero new endpoint code.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-18T23:00:00Z (approx)
- **Completed:** 2026-07-18T23:30:00Z (approx)
- **Tasks:** 2
- **Files modified:** 3 (1 source modified, 2 test files created)

## Accomplishments
- **`POST /admin/models` add-by-ID** (`add_model_by_id`): an operator adds a single model by EXPLICIT id + provider; the write reuses the exact SQLi-safe parameterized upsert proven in `set_model_capability` (code-allowlist columns + `$N` binds), forces `enabled=false`, and the row is served immediately by `get_model_capability_async` on the next request (no restart — the write invalidates the override cache). D-159-02.
- **Validation runs BEFORE any DB touch** (allowlist-before-touch): blank id → 422; provider outside `PROVIDER_ENDPOINTS` → 422; wrong-typed cap → 422; a model already in the registry (built-in OR override, CASE-FOLDED) → 409. Honest failure: a `model.add_failed` stamp + a real 500 on a persist error (never a false 2xx); a `model.added` ✎ receipt on success.
- **Filter-toggle write half** (D-159-04): `model_discovery_filter_enabled` joins the `_FLAG_HUMAN_NAMES` code-constant allowlist, so `PUT /admin/flags` accepts + routes it via `save_app_settings` with zero new endpoint code (the 147 honest-failure path preserved).
- **17 new tests** (12 add-by-ID + 5 filter-flag) green; the shipped 147/149 model + flag suites still green (61 passed across the combined verification set — no regression).

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /admin/models add-by-ID endpoint (DB-only row, lands disabled)** — `de97b963` (feat)
2. **Task 2: Filter-toggle write key rides set_flag (D-159-04 write half)** — `2fec8aca` (feat)

## Files Created/Modified
- `backend/app/api/admin.py` — added `AddModelRequest` (Pydantic body, no `enabled` field, `ConfigDict(protected_namespaces=())`) + `_ADD_MODEL_CAP_COLUMNS` code-allowlist + the `@router.post("/models")` `add_model_by_id` route; added `model_discovery_filter_enabled` to `_FLAG_HUMAN_NAMES`; `from pydantic import BaseModel, ConfigDict`.
- `backend/tests/test_159_add_model.py` — 12 tests mirroring `test_149_model_write.py` (direct-handler + recording-pool for the write/guard logic; `client` + asyncpg-pool-mock for the non-operator 404).
- `backend/tests/test_159_filter_flag.py` — 5 over-HTTP tests (`operator_override` forces the gate; `save_app_settings` stubbed to assert routing, since mig 103 lands in Plan 03).

## Decisions Made
- **Reused the `set_model_capability` upsert verbatim** — `INSERT ... ON CONFLICT (model_id) DO UPDATE SET col = EXCLUDED.col, updated_at = now()`; column names come ONLY from `["model_id", "provider", *present_cols, "enabled"]` (all code constants), values are `$N` asyncpg binds. Source-asserted in the happy-path test: `"kimi-k3" not in sql and "moonshot" not in sql` + `"$1" in sql` + `"EXCLUDED" in sql` (T-159-02).
- **`enabled` is the forced literal `False`, bound last, and is NOT a field on `AddModelRequest`** — a body carrying `enabled:true` is dropped by Pydantic (default `extra="ignore"`), so the persisted row is always `enabled=false` (SC#3 / T-159-03).
- **Case-folded duplicate guard** — `mid_lc in {k.lower() for k in MODEL_CAPABILITIES} | {k.lower() for k in overrides}` → 409, so `GPT-4o`/`GLM-4.5` can't phantom-duplicate `gpt-4o`/`glm-4.5` (WR-02 precedent).
- **Filter toggle: `_FLAG_HUMAN_NAMES` key ONLY** — per the plan's "Make NO other change to `set_flag`"; the `app_settings` column, the fail-soft readback, and the `main._DIRECT_COLUMNS` entry are Plan 03 (migration 103, operator-applied). The over-HTTP test stubs `save_app_settings` because this Wave-1 plan runs ahead of that migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Store/return/dedup the STRIPPED model_id, not the raw body value**
- **Found during:** Task 1 (add_model_by_id implementation)
- **Issue:** The plan's action (1) strips the id only for the non-empty CHECK, then uses `body.model_id` (raw) in the persisted row, the return, and the audit label. A body id can carry leading/trailing whitespace or slashes a URL path param would not, so storing the raw value would (a) persist a whitespace-padded id and (b) make the row's id inconsistent with the case-folded dedup key (computed on the stripped value) — a later clean re-add would phantom-differ and slip past the 409 guard.
- **Fix:** Strip the id once into a local `model_id = body.model_id.strip("/ \t\r\n")` and use that cleaned value consistently for the dedup check, the upsert, the `{"model_id": ...}` return, and the `model.added` label. `body.provider` is used verbatim (already roster-validated).
- **Files modified:** backend/app/api/admin.py
- **Verification:** `test_empty_model_id_rejected_422` (whitespace/slash-only strips to empty → 422, no write) + the happy-path/duplicate tests assert the cleaned id round-trips; 20 tests green.
- **Committed in:** `de97b963` (Task 1 commit)

**2. [Rule 2 - Missing hygiene] ConfigDict(protected_namespaces=()) on AddModelRequest**
- **Found during:** Task 1 (AddModelRequest with a `model_id` field)
- **Issue:** Pydantic v2 emits a UserWarning at class-definition for any `model_`-prefixed field name (`model_id` conflicts with the protected `model_` namespace) — noisy import-time warning.
- **Fix:** `model_config = ConfigDict(protected_namespaces=())` (the Pydantic-recommended resolution); added `ConfigDict` to the pydantic import.
- **Files modified:** backend/app/api/admin.py
- **Verification:** No protected-namespace warning in the test run (only the unrelated urllib3/requests version warning).
- **Committed in:** `de97b963` (Task 1 commit)

---

**Total deviations:** 2 (1 correctness, 1 hygiene) — both within Task 1, both additive/defensive.
**Impact on plan:** No scope creep. Both keep the endpoint correct + clean; the SQLi wall, the forced-disable, and the case-folded dedup are exactly as specified.

## Issues Encountered
- The generic `state.update-progress` / `state.record-session` / `state.record-metric` SDK verbs do not fit this project's custom narrative STATE.md (the fields they look for aren't present) — consistent with the project's orchestrator-owned STATE/ROADMAP convention. `state.advance-plan` (Plan 2→3) and `roadmap.update-plan-progress` (159) both applied cleanly; the narrative Current Position + milestone progress counter are left for the orchestrator.

## User Setup Required
None for this plan. Note: Plan 03 authors **migration 103** (`app_settings.model_discovery_filter_enabled` column) which the operator must apply to the local Supabase SQL editor + regenerate the full schema (and cloud-parity at promotion). Until then the filter-toggle WRITE is accepted + routed, but its readback is fail-soft (Plan 03 wires the readback).

## Next Phase Readiness
- The two backend WRITE contracts the frontend needs (Plans 04-06) are live: `POST /admin/models` (add-by-ID) and `PUT /admin/flags {key: "model_discovery_filter_enabled"}`.
- **Plan 03 (Wave 1) blocker for the filter READBACK:** migration 103 + the `main._DIRECT_COLUMNS` readback entry + the `Settings` field are NOT in this plan (by design — the write half only).
- MODEL-03 stays open until all 6 plans ship + verify-work (not marked complete here).

## Self-Check: PASSED
- `backend/tests/test_159_add_model.py` — FOUND
- `backend/tests/test_159_filter_flag.py` — FOUND
- `add_model_by_id` in `backend/app/api/admin.py` — FOUND (1)
- `"model_discovery_filter_enabled"` in `backend/app/api/admin.py` — FOUND (1)
- Commit `de97b963` (Task 1 feat) — FOUND
- Commit `2fec8aca` (Task 2 feat) — FOUND

---
*Phase: 159-model-registry-curation*
*Completed: 2026-07-18*
