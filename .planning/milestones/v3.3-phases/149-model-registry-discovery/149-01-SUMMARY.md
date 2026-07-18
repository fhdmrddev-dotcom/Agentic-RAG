---
phase: 149-model-registry-discovery
plan: 01
subsystem: database
tags: [supabase, migration, model-registry, model_capabilities_overrides, app_settings, config, pydantic-typeddict]

# Dependency graph
requires:
  - phase: 081.1 (migration 053)
    provides: model_capabilities_overrides table + get_model_capability_async DB-overlay read path + read-all RLS policy
  - phase: 148 (migration 098)
    provides: metadata-only ADD COLUMN migration shape + header-comment style mirrored here
provides:
  - "model_capabilities_overrides.deprecated (boolean NOT NULL DEFAULT false) — the informational deprecated badge state (D-149-04)"
  - "model_capabilities_overrides.deprecated_reason (text, nullable) — optional operator note"
  - "app_settings.llm_model_locked (boolean NOT NULL DEFAULT false) — forward-compatible org-lock policy flag (D-149-07)"
  - "ModelCapability.deprecated TypedDict field + `deprecated` in the get_model_capability_async DB-overlay tuple (D-149-03) — a discovery-confirmed DB-only row carries deprecated with zero code edits"
affects: [149-02, 149-03, 149-04, model-registry-read-write, capability-guards, model-picker-badge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-as-living-registry: new capability state added via idempotent ADD COLUMN + one entry in the existing async overlay tuple — no static MODEL_CAPABILITIES hand-add"
    - "Forward-compat policy flag (llm_model_locked) shipped beside app_settings.llm_model ahead of the v3.4 per-user model layer that will read it"

key-files:
  created:
    - supabase/migrations/099_model_registry_deprecated.sql
    - backend/tests/test_149_config_overlay.py
  modified:
    - backend/app/config.py
    - supabase/full-schema.sql

key-decisions:
  - "deprecated ≠ disabled (D-149-04/D-149-05): `deprecated` is a badge-only informational state; `enabled` alone controls availability — a deprecated model can stay enabled (warn-and-steer)."
  - "No new RLS policy: migration 053 already ships `FOR SELECT TO authenticated USING (true)` on model_capabilities_overrides; app_settings writes are service-role only."
  - "No static MODEL_CAPABILITIES hand-add — the overlay tuple + TypedDict field are the only code touch; the DB is the living registry (D-149-03)."

patterns-established:
  - "Overlay-tuple extension: adding a capability field = one string in the get_model_capability_async non-None DB-field tuple + one TypedDict field, never a merge-logic change."

requirements-completed: [MODEL-01, MODEL-02]

# Metrics
duration: ~15min (incl. human-action checkpoint wait)
completed: 2026-07-12
---

# Phase 149 Plan 01: Model Registry Schema + Read-Path Foundation Summary

**Added `deprecated`/`deprecated_reason` to `model_capabilities_overrides` and `llm_model_locked` to `app_settings` via idempotent migration 099, applied it live, and taught `get_model_capability_async` to overlay `deprecated` from the DB so a discovery-confirmed DB-only row carries its badge state with zero code edits.**

## Performance

- **Duration:** ~15 min (including the human-action checkpoint wait for the operator to apply the migration)
- **Started:** 2026-07-12T11:15Z (first task commit)
- **Completed:** 2026-07-12T11:20Z (schema regenerated + committed)
- **Tasks:** 3 (Task 1 authored, Task 2 human-action checkpoint applied by operator, Task 3 code overlay)
- **Files modified:** 4 (2 created, 2 modified/regenerated)

## Accomplishments
- Migration 099 authored with three idempotent `ADD COLUMN IF NOT EXISTS` statements (deprecated + deprecated_reason on `model_capabilities_overrides`; llm_model_locked on `app_settings`), no RLS policy, no data backfill.
- Migration applied to the live local Supabase DB by the operator (per CLAUDE.md rule — SQL editor, never `db push`/`db reset`); `supabase/full-schema.sql` regenerated via a live-DB dump (no reset) and committed alongside the migration.
- `ModelCapability` TypedDict gains an informational `deprecated: bool`; `get_model_capability_async`'s DB-overlay tuple gains `"deprecated"` so a non-None DB value flows through to the registry + picker (D-149-03). Merge logic, `capability_source="db_override"` tag, and `_build_inferred_defaults` base all left untouched.
- Overlay test green (3 passed): asserts a mocked `deprecated=true` and `deprecated=false` DB row surfaces on the capability dict tagged `db_override`, and that no DB row leaves `deprecated` absent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 099 (deprecated + deprecated_reason + llm_model_locked)** - `904fa6a1` (feat)
2. **Task 3: Add `deprecated` to ModelCapability TypedDict + read-path overlay + test** - `667df4da` (feat)
3. **Task 2: Apply migration 099 live (operator) + regenerate full-schema.sql** - `eb085a82` (chore)

_Task 3 was executed and committed before the Task 2 checkpoint (its unit test mocks `_load_model_overrides` and does not depend on the applied migration), so the human-action checkpoint was the last thing blocking._

**Plan metadata:** committed by the orchestrator (SUMMARY.md).

## Files Created/Modified
- `supabase/migrations/099_model_registry_deprecated.sql` - Three idempotent ADD COLUMN statements + phase-149 header comment mirroring 098's style.
- `backend/app/config.py` - `ModelCapability.deprecated` TypedDict field; `"deprecated"` added to the `get_model_capability_async` non-None DB-overlay tuple.
- `backend/tests/test_149_config_overlay.py` - Overlay test: mocked deprecated=true/false/absent → asserts overlay + `db_override` tag.
- `supabase/full-schema.sql` - Regenerated (live-DB dump, no reset) reflecting the applied migration.

## Decisions Made
- **deprecated ≠ disabled** (D-149-04/D-149-05): informational badge state; `enabled` still solely controls availability. Documented in both the migration header and the TypedDict docstring.
- **No new RLS policy / no data backfill:** the 053 read-all policy covers the new columns; existing override rows inherit `deprecated=false` from the column DEFAULT.
- **No static MODEL_CAPABILITIES hand-add:** the DB is the living registry (D-149-03); the only code touch is the overlay tuple + TypedDict field.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The Task 1 combined-verify Bash line initially exited non-zero because my extra `! grep` guard flagged the CLAUDE.md "NEVER db push/db reset" *comment* (line 20) — a false positive; the plan's own automated verify and the acceptance criteria (no such DDL statements) both pass, and the comment mirrors the 098 precedent verbatim. No file change needed.

## User Setup Required

None for this plan beyond the completed operator checkpoint. **Cloud parity DEFERRED** to the standing production-push checklist: migration 099 must be pasted into the CLOUD Supabase SQL editor at promotion (migrations 079+ are already pending on cloud — do not touch cloud now).

## Next Phase Readiness
- The two columns + the overlaid `deprecated` field now exist end-to-end (schema + live DB + read path), so downstream 149 plans (registry read/write UI, capability guards, picker badge) can build on them.
- No blockers.

## Self-Check: PASSED

- Created files verified present: `099_model_registry_deprecated.sql`, `test_149_config_overlay.py`, `149-01-SUMMARY.md`.
- Commits verified in git log: `904fa6a1` (migration), `667df4da` (overlay + test), `eb085a82` (full-schema regen), `8f1f80e4` (summary).
- Live-DB columns confirmed in regenerated `full-schema.sql`: `model_capabilities_overrides.deprecated`/`deprecated_reason`, `app_settings.llm_model_locked`.
- Overlay test `test_149_config_overlay.py`: 3 passed.
- STATE.md / ROADMAP.md not modified by this executor (orchestrator owns those writes).

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-12*
