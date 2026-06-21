---
phase: 111-metadata-enrichment-extraction-backend
plan: 01
subsystem: testing
tags: [pytest, pydantic, app_settings, lmstudio, provider-routing, migration, metadata-enrichment]

# Dependency graph
requires:
  - phase: 110-dm-foundations
    provides: "metadata_field_definitions table + audit CHECK (metadata.field.create) + app_settings.document_management_enabled env_attr=None precedent"
provides:
  - "11 Wave-0 test_111_* scaffolds (6 unit + 5 integration) — RED/xfail, flip GREEN as Plans 02-05 land behavior"
  - "Migration 072 FILE (un-applied): 3 app_settings columns (extraction_model / extraction_window_cap / metadata_enrichment_mode) + metadata_field_definitions.options jsonb"
  - "First-class lmstudio provider in config (_PROVIDER_BASE_URLS + key_map + resolve branch with NO /v1 append)"
  - "3 app_settings-backed UserEffectiveSettings fields read via _build_settings_from_row (env_attr=None, absent from SettingsUpdate)"
affects: [111-02-engine, 111-03-crud, 111-04-wiring, 111-05-live-apply]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 RED: import not-yet-built symbols INSIDE test bodies + xfail(strict=False) so the suite exits 0 and each test flips GREEN when its owning plan ships"
    - "A1 no-underscore design: public `confidence` field survives model_dump(exclude_none=True); a `_confidence`-named field would be a Pydantic private attr and get dropped"
    - "app_settings-only setting: env_attr=None in _val(...) (the DMF-03 precedent) — DB-only, deliberately absent from SettingsUpdate (no UI write path)"
    - "First-class local provider via single _PROVIDER_BASE_URLS dict entry; registry-miss model infers to ollama fallback bucket => TIER-COERCE safe local default by construction"

key-files:
  created:
    - "backend/tests/unit/test_111_dynamic_model.py"
    - "backend/tests/unit/test_111_confidence_survives_exclude_none.py"
    - "backend/tests/unit/test_111_exclude_none_nonregression.py"
    - "backend/tests/unit/test_111_window_sampling.py"
    - "backend/tests/unit/test_111_extraction_model_resolve.py"
    - "backend/tests/unit/test_111_lmstudio_provider.py"
    - "backend/tests/integration/test_111_metadata_fields_crud.py"
    - "backend/tests/integration/test_111_field_def_scoping.py"
    - "backend/tests/integration/test_111_settings_readback.py"
    - "backend/tests/integration/test_111_flat_filter_compat.py"
    - "backend/tests/integration/test_111_audit_field_create.py"
    - "supabase/migrations/072_app_settings_extraction_model.sql"
  modified:
    - "backend/app/config.py"
    - "backend/app/models/user_settings.py"
    - "backend/.env.example"

key-decisions:
  - "lmstudio base_url uses rstrip('/') with NO /v1 append — LM Studio's URL already ends in /v1, unlike ollama which appends it (D-111-7)"
  - "The 3 new settings fields use env_attr=None (app_settings-only) and are NOT added to SettingsUpdate — DB-only, no UI (D-111-2)"
  - "Migration 072 includes the metadata_field_definitions.options jsonb (Q4 gap (a): enum field_type SHIPS) — one additive migration, the planner decision"
  - "lmstudio is NOT added to _NATIVE_TOOL_PROVIDERS — a registry miss infers to the ollama fallback bucket => forced_emission=False / native_tools=False => TIER-COERCE by construction (desired safe local default)"

patterns-established:
  - "Wave-0 RED scaffold: body-level imports + xfail(strict=False); suite exits 0 today, flips GREEN per owning plan"
  - "A1 confidence-survival design proof runs GREEN today on a plain BaseModel (no builder needed) while the dynamic-model variant xfails until Plan 02/03"

requirements-completed: [META-03]

# Metrics
duration: 9min
completed: 2026-06-15
---

# Phase 111 Plan 01: Wave-0 Scaffolds + Extraction Settings Substrate Summary

**Landed the Phase 111 substrate: 11 RED/xfail test_111_* scaffolds, an un-applied migration 072 (3 app_settings extraction columns + options jsonb), a first-class lmstudio provider with no /v1 double-append, and 3 app_settings-only UserEffectiveSettings fields — all additive, zero shared-path risk.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-15T18:08:29Z
- **Completed:** 2026-06-15T18:17:50Z
- **Tasks:** 3
- **Files modified:** 14 (12 created + 2 modified config/model; +1 .env.example)

## Accomplishments
- All 11 Wave-0 test scaffolds authored matching VALIDATION.md filenames EXACTLY; unit subset exits 0 (4 passed / 8 xfailed), integration exits 0 (skip-or-xfail clean, 3 xpassed against the already-migrated :54322 DB).
- BLOCKING A1 caveat encoded: the `confidence`-survives-`exclude_none` test proves a public `confidence` field survives `model_dump(exclude_none=True)` while a `_confidence`-named field would be a Pydantic private attr and silently dropped — locking the no-underscore design.
- Migration 072 authored as a FILE only (idempotent `ADD COLUMN IF NOT EXISTS`, mirrors 045); `full-schema.sql` untouched; live apply deferred to Plan 05's [BLOCKING] gate.
- lmstudio registered as a first-class provider (no Ollama-impersonation): resolves base_url with NO /v1 double-append; dummy `lm-studio` key; lmstudio unit test flipped GREEN.
- 3 settings fields (`extraction_model` / `extraction_window_cap` / `metadata_enrichment_mode`) declared + read back via `_build_settings_from_row` (env_attr=None), confirmed absent from `SettingsUpdate`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author all 11 Wave-0 test_111_* scaffolds (RED)** - `11c453ef` (test)
2. **Task 2: Author migration 072 (un-applied)** - `c17a9662` (feat)
3. **Task 3: Register lmstudio provider + 3 app_settings settings fields** - `bf7f34e3` (feat)

**Plan metadata:** _final docs commit (this SUMMARY + STATE + ROADMAP)_

## Files Created/Modified
- `backend/tests/unit/test_111_dynamic_model.py` - build_metadata_model schema + closed field_type vocab (xfail until Plan 02/03)
- `backend/tests/unit/test_111_confidence_survives_exclude_none.py` - BLOCKING A1 no-underscore design proof (1 GREEN design proof + 1 xfail builder variant)
- `backend/tests/unit/test_111_exclude_none_nonregression.py` - empty author dropped, flat fields stay top-level
- `backend/tests/unit/test_111_window_sampling.py` - head+tail sampler with elision marker (xfail until Plan 02)
- `backend/tests/unit/test_111_extraction_model_resolve.py` - app_settings.extraction_model wins, falls back to settings.llm_model (gpt-4o)
- `backend/tests/unit/test_111_lmstudio_provider.py` - lmstudio registration (flipped GREEN in Task 3)
- `backend/tests/integration/test_111_metadata_fields_crud.py` - CRUD forces owner + is_global=false (live DB, xfail until Plan 03)
- `backend/tests/integration/test_111_field_def_scoping.py` - 2-user cross-leak negative on the .or_(user_id,is_global) predicate
- `backend/tests/integration/test_111_settings_readback.py` - migration 072 columns read back (xfail until Plan 05) + a DB-free defaults proof
- `backend/tests/integration/test_111_flat_filter_compat.py` - flat @> containment still matches with nested _confidence present
- `backend/tests/integration/test_111_audit_field_create.py` - live metadata.field.create INSERT+SELECT round-trip (raw asyncpg, mock-proof)
- `supabase/migrations/072_app_settings_extraction_model.sql` - 3 app_settings columns + metadata_field_definitions.options jsonb (un-applied)
- `backend/app/config.py` - lmstudio in _PROVIDER_BASE_URLS + key_map + lmstudio_base_url env field + resolve branch (no /v1 append)
- `backend/app/models/user_settings.py` - 3 UserEffectiveSettings field declarations + 3 _build_settings_from_row lines (env_attr=None)
- `backend/.env.example` - LMSTUDIO_BASE_URL=http://localhost:1234/v1

## Decisions Made
None beyond the planned D-111-2 / D-111-7 / Q4-gap-(a) decisions already captured in frontmatter — plan executed exactly as written.

## Deviations from Plan

None - plan executed exactly as written. All three tasks delivered the planned artifacts; all acceptance criteria met; no auto-fixes (Rules 1-3) and no architectural decisions (Rule 4) were required.

## Issues Encountered
- Two `model_fields`-on-instance Pydantic deprecation warnings in the confidence test were tidied to class-level access (`WithUnderscore.model_fields`) — cosmetic, in my own new test, not a behavioral fix.
- The `test_build_settings_defaults_without_db` pure-Python test was re-marked from `@pytest.mark.asyncio` to `@pytest.mark.xfail` (it is sync and must not hard-fail before Task 3 adds the fields) — caught and corrected within Task 1 before commit.

## Net-New Test Failures (SEED-056)
**Net-new failures = 0.** SEED-056 stash-and-rerun proof:
- **Base (`c6791c40`, plan stashed):** `tests/unit` = 59 failed / 806 passed
- **With-plan (`bf7f34e3`):** `tests/unit` = 59 failed / 810 passed
- Delta = +4 passed (the 4 new test_111 GREEN tests: 2 A1/exclude_none design proofs + 2 lmstudio); the 59 failures are identical pre-existing rot (test_sql_service / test_sandbox_service / test_streaming_reliability), unchanged by this plan.
- Full `test_111_*` set (unit + integration): 4 passed / 12 xfailed / 3 xpassed / 0 failures / 0 collection errors.

## User Setup Required
None - no external service configuration required for THIS plan. (Migration 072 is authored un-applied; Plan 05 owns the live apply. The LM Studio operator pre-req — Qwen2.5-7B-Instruct loaded on :1234 — is a Plan-04/05 live-UAT concern, not a Plan-01 setup step.)

## Next Phase Readiness
- Plan 02 (engine) consumes: the lmstudio provider, the 3 settings (`extraction_model` / `extraction_window_cap` / `metadata_enrichment_mode`), and the RED test_111 unit files (`build_metadata_model`, `sample_for_extraction`, `resolve_extraction_model`) that flip GREEN as it lands behavior.
- Plan 03 (CRUD) consumes: the integration scaffolds (`test_111_metadata_fields_crud`, `test_111_field_def_scoping`, `test_111_audit_field_create`).
- Plan 05 (live apply) crosses migration 072 into :54322 and regenerates full-schema.sql — `test_111_settings_readback` flips GREEN there.
- No blockers.

---
*Phase: 111-metadata-enrichment-extraction-backend*
*Completed: 2026-06-15*

## Self-Check: PASSED

All 13 artifacts verified on disk (11 test files + migration 072 + this SUMMARY); all 3 task commits (`11c453ef`, `c17a9662`, `bf7f34e3`) verified in git log.
