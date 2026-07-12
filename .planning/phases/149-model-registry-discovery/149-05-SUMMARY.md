---
phase: 149-model-registry-discovery
plan: 05
subsystem: backend
tags: [model-registry, admin, operator-gated, sqli-safe, capability-write, model-picker, deprecated-badge, asyncpg]

# Dependency graph
requires:
  - phase: 149-01
    provides: model_capabilities_overrides.deprecated column + get_model_capability_async DB overlay (null-clears-to-DEF mechanism) + app_settings.llm_model_locked
  - phase: 149-04
    provides: api.ts ModelRegistryRow / ModelCapabilityPatch shapes + FullAppSettings.deprecated_models the responses must match
  - phase: 146
    provides: require_operator router gate (byte-identical 404) + operator_audit_floor + set_flag allowlist-write template
  - phase: 148
    provides: _FLAG_KEYS / _VISIBILITY_FEATURES code-constant allowlist pattern + honest-failure receipt discipline
provides:
  - "GET /admin/models — the full-union registry read (built-in MODEL_CAPABILITIES DEF ∪ DB override OVR ∪ DB-only rows), each tagged capability_source + enabled/deprecated + is_default/is_locked + overridden_fields (D-149-03)"
  - "PATCH /admin/models/{id} — SQLi-safe capability write: _MODEL_CAP_COLUMNS allowlist → parameterized asyncpg upsert → null-clears-to-DEF Reset → invalidate cache → ✎ model.capability.set receipt (MODEL-01 / D-149-02)"
  - "load_all_model_overrides() — all-rows override read (enabled AND disabled) with its own 30s TTL, separate from the enabled-only hot cache (Pitfall 1)"
  - "_build_providers disabled-filter across BOTH merge branches (static-registry + legacy db_model_lists) — `enabled` becomes real for the picker (D-149-08)"
  - "deprecated_models[] in the settings payload (D-149-05 picker badge source)"
affects: [149-06, 149-07, model-registry-tab, settings-model-picker, chat-model-picker]

# Tech tracking
tech-stack:
  added: []  # zero new packages
  patterns:
    - "Allowlist-before-SQL write: a code-constant column set (_MODEL_CAP_COLUMNS) gates the PATCH; unknown key → 422 before any DB touch; upsert values via $N binds (mirrors set_flag's _FLAG_KEYS guard)"
    - "null-clears-to-DEF Reset: raw dict body preserves present-null-vs-omitted; explicit null → SQL NULL (overlay falls through to built-in DEF), omitted key → never touched"
    - "Two-cache split: enabled-only hot cache for the request path (unchanged) + all-rows cache for the editor/picker-filter (Pitfall 1); one invalidate zeros both"
    - "Additive response fields (overridden_fields, deprecated_models) — Plan 07 extends the TS type; older consumers ignore them"

key-files:
  created:
    - backend/tests/test_149_registry_read.py
    - backend/tests/test_149_enabled_enforce.py
    - backend/tests/test_149_model_gate.py
    - backend/tests/test_149_model_write.py
  modified:
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/api/admin.py

key-decisions:
  - "GET /admin/models is floor-EXEMPT (poll-style read, the /admin/runs + /admin/users precedent, D-07) — the tab re-fetches; audit_is_write=False marks it a read."
  - "PATCH uses a raw `dict` body (not a Pydantic model) so present-with-null (clear→DEF) and omitted (untouched) are genuinely distinguishable — the D-149-02 Reset mechanism."
  - "invalidate_model_overrides_cache() now zeros BOTH the hot cache and the all-rows cache so a write is visible to both reads on the next request (SC#1)."
  - "provider (NOT NULL) for a first-time INSERT is derived from get_model_capability(model_id) (registry/inferred); an existing OVR row keeps its stored provider (ON CONFLICT does not touch it)."
  - "Response rows carry an additive overridden_fields list (per-field OVR-vs-DEF) so Plan 07's editor can render Reset; the seven core fields match api.ts ModelRegistryRow exactly."

patterns-established:
  - "Registry union builder (_registry_row): OVR-over-DEF with both discernible via overridden_fields; capability_source registry|db_override; is_default/is_locked from app_settings."

requirements-completed: [MODEL-01]

# Metrics
duration: ~8min
completed: 2026-07-12
---

# Phase 149 Plan 05: Model Registry Backend Core Summary

**The registry hub: `GET /admin/models` renders the full union (built-in DEF ∪ DB override OVR ∪ DB-only rows with source/default/lock/overridden-field state), `PATCH /admin/models/{id}` is the SQLi-safe allowlist+parameterized capability write with null-clears-to-DEF Reset + cache invalidation + an honest ✎ receipt, and the picker becomes registry-driven — disabled models are hidden across both merge branches (`enabled` is now real) while `deprecated_models` surfaces the badge.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-12T07:33:31Z
- **Completed:** 2026-07-12T07:41Z
- **Tasks:** 3 (all `tdd="true"`)
- **Files:** 7 (4 test files created, 3 source files modified)

## Accomplishments

- **Task 1 — all-rows read + picker disabled-filter + deprecated_models:** `load_all_model_overrides()` reads ALL override rows (no `enabled` filter) into its own 30s-TTL cache, separate from the enabled-only hot cache the request path still reads (Pitfall 1). `_build_providers` now hides any operator-disabled model from BOTH unfiltered merge branches — the static-registry merge (`MODEL_CAPABILITIES`, :449-455) AND the legacy `db_model_lists`/env-CSV branch (`app_settings.provider_model_lists`, :431-438) — warmed by an `await load_all_model_overrides()` call added to `load_app_settings_async` before the sync builder runs. `deprecated_models[]` (enabled deprecated overrides) is added to the settings payload for the badge.
- **Task 2 — `GET /admin/models`:** the full union — every built-in `MODEL_CAPABILITIES` model as a DEF row (`capability_source="registry"`), every override as an OVR row (`db_override`), every DB-only model as a DB-only row — enveloped as `{"models": [...]}`. Each row carries `enabled`/`deprecated`, the effective capability values (OVR-over-DEF), `is_default`/`is_locked` (from `app_settings.llm_model` + `llm_model_locked`), and an additive `overridden_fields` list so the editor can render OVR-vs-DEF/Reset. Reads the all-rows cache so disabled rows appear. Floor-EXEMPT poll read; the router gate is the sole authority.
- **Task 3 — `PATCH /admin/models/{id}`:** rejects any body key not in `_MODEL_CAP_COLUMNS` (the seven editable columns) with 422 **before any SQL** (T-149-11 — no client field name reaches a SET clause); a valid patch runs a parameterized `INSERT ... ON CONFLICT (model_id) DO UPDATE` (values via `$N` binds). Reset semantics: a key present with explicit `null` writes SQL NULL (the `get_model_capability_async` non-None overlay then falls through to the built-in DEF), while an omitted key is never touched. On success it invalidates the TTL cache (SC#1) and stamps a ✎ `model.capability.set` receipt; a persistence failure stamps `model.capability.write_failed` and raises a real 500 (never a false 2xx).

## Task Commits

Each task committed atomically (test + implementation together per task):

1. **Task 1: all-rows read + picker disabled-filter + deprecated_models** — `06b88358` (feat)
2. **Task 2: GET /admin/models full-union registry read + 404 gate** — `55f859f0` (feat)
3. **Task 3: PATCH /admin/models/{id} SQLi-safe capability write + Reset** — `25b26c3e` (feat)

**Plan metadata:** committed by the orchestrator (SUMMARY.md + shared tracking files).

## Files Created/Modified

- `backend/app/models/user_settings.py` — `load_all_model_overrides()` + its all-rows cache; `invalidate_model_overrides_cache()` now zeros both caches; `_build_providers` disabled-set filter across both branches; `load_app_settings_async` warm-up.
- `backend/app/api/settings.py` — `deprecated_models: list[str]` on `FullSettingsResponse` populated from the enabled overrides cache.
- `backend/app/api/admin.py` — `_MODEL_CAP_COLUMNS` allowlist; `_registry_row` union-row builder; `GET /admin/models`; `PATCH /admin/models/{model_id}`; imports for `MODEL_CAPABILITIES`/`_infer_provider_for`/`invalidate_model_overrides_cache`.
- `backend/tests/test_149_registry_read.py` — all-rows-vs-hot-cache + TTL-invalidate (Task 1) + endpoint union/source/default-lock (Task 2).
- `backend/tests/test_149_enabled_enforce.py` — disabled model hidden from BOTH merge branches; absent-override still lists.
- `backend/tests/test_149_model_gate.py` — non-operator byte-identical 404 on GET/PATCH; no write reached; route-enumeration backstop (mirrors 146).
- `backend/tests/test_149_model_write.py` — unknown-field-422-no-SQL; upsert+invalidate+stamp; null-clears-vs-omitted-untouched; empty-noop; persistence-failure-500+write_failed.

## Decisions Made

- **Floor-EXEMPT registry read:** `GET /admin/models` is a poll-style read (the tab re-fetches) — no `operator_audit_floor`, `audit_is_write=False`, matching the `/admin/runs` + `/admin/users` precedent (D-07).
- **Raw `dict` body for PATCH:** the only faithful way to preserve present-null (clear→DEF) vs omitted (untouched) — a Pydantic model would erase the distinction.
- **One invalidate, both caches:** `invalidate_model_overrides_cache()` zeros the hot cache and the all-rows cache so an edit is visible to the request path and the registry read on the next request (SC#1).
- **Additive response fields:** `overridden_fields` (registry rows) and `deprecated_models` (settings) are additive — the seven core `ModelRegistryRow` fields match api.ts exactly; Plan 07 extends the TS type.

## Deviations from Plan

None — plan executed as written. Small explicit choices left to Claude's discretion by the plan/RESEARCH: the registry write API shape (union read + field-patch upsert with null-clears semantics), the audit vocabulary (`model.capability.set` / `model.capability.write_failed`), and the DEF-vs-OVR render shape (`overridden_fields`) — all consistent with the interfaces and the 146/148 patterns.

## Security (threat model)

All Task-3 threat-register mitigations are implemented and tested:

- **T-149-10 (EoP / SC#4):** GET + PATCH inherit the router-level `require_operator` → byte-identical 404 for non-operators (no RLS backstop; the gate is the sole authority). Tested in `test_149_model_gate.py`.
- **T-149-11 (SQLi):** `_MODEL_CAP_COLUMNS` allowlist rejects unknown keys with 422 BEFORE any SQL; the upsert is parameterized asyncpg — no client field name reaches a SET clause. Tested (`test_unknown_field_rejected_before_any_sql`).
- **T-149-12 (Repudiation):** every write stamps a ✎ `model.capability.set` receipt via `operator_audit_floor`; a failed persist stamps `model.capability.write_failed` + 500 (honest, no false success).
- **T-149-13 (routing integrity):** `invalidate_model_overrides_cache()` on every write (both caches) so an edit takes effect on the next request (≤30s cross-worker — the accepted SC#1 semantics).
- **T-149-SC:** zero new packages.

## Known Stubs

None. The lock semantics + default/locked-disable guard + live discovery endpoint are Plan 06 (explicitly out of scope for this base write, per the plan); the Model Registry tab that consumes these seams is Plan 07. Those are deliberate cross-plan handoffs, not stubs.

## TDD Gate Compliance

All three tasks are `tdd="true"`. Tests and implementation were committed together per task (test + feat in one commit rather than separate RED/GREEN commits) — each task's verify block was run green before its commit. No plan-level `type: tdd` gate applies here (this is a `type: execute` plan), and no MVP+TDD runtime gate mode was passed by the orchestrator.

## Verification

- `pytest tests/test_149_registry_read.py tests/test_149_model_gate.py tests/test_149_enabled_enforce.py tests/test_149_model_write.py` → **20 passed**.
- Adjacent regression green: `test_149_config_overlay.py` (3), `test_146_operator_gate.py` (6), `test_147_flag_failure_semantics.py` (6), `test_147_flag_refuse.py`, `test_148_visibility_cold_default.py`, `test_148_carveouts.py` → all pass (26 in the batch).

## Next Phase Readiness

- Plan 06 can wire the guards (no-dead-default / locked-disable refusal), the dedicated `PUT /admin/models/{id}/lock`, and `POST /admin/models/discover` on top of this base write + union read.
- Plan 07's Model Registry tab can consume `GET /admin/models` + `PATCH /admin/models/{id}` (the api.ts seams from 149-04) directly; `overridden_fields` is available for the Reset affordance.
- The picker badge lights up automatically now that `deprecated_models` lands in the settings payload.
- No blockers.

## Self-Check: PASSED

- Created files verified present: `test_149_registry_read.py`, `test_149_enabled_enforce.py`, `test_149_model_gate.py`, `test_149_model_write.py`, `149-05-SUMMARY.md`.
- Modified files verified present: `user_settings.py`, `settings.py`, `admin.py`.
- Commits verified in git log: `06b88358` (Task 1), `55f859f0` (Task 2), `25b26c3e` (Task 3).
- Full 149 suite: 20 passed; adjacent regression: green.
- STATE.md / ROADMAP.md NOT modified by this executor (orchestrator owns those writes).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
