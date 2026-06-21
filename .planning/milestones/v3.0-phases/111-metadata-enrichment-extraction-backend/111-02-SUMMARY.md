---
phase: 111-metadata-enrichment-extraction-backend
plan: 02
subsystem: backend
tags: [forced-emit, pydantic, create-model, cross-provider, metadata-enrichment, window-sampling, service-role-scoping]

# Dependency graph
requires:
  - phase: 111-01
    provides: "lmstudio provider + 3 app_settings extraction fields (extraction_model / extraction_window_cap / metadata_enrichment_mode) on UserEffectiveSettings + the 6 Wave-0 xfail unit assertions this plan flips GREEN"
  - phase: 110-dm-foundations
    provides: "metadata_field_definitions table (migration 071 applied) + the service-role-scoping SECURITY lesson (D-111-6)"
provides:
  - "build_metadata_model(custom_defs) -> dynamic Pydantic model: 7 built-ins + custom fields (enum->Literal) + no-underscore confidence map; CLOSED field_type vocab rejects unknowns"
  - "attach_confidence(dumped) -> post-dump rename of public `confidence` into nested `_confidence` (the A1 step)"
  - "sample_for_extraction(text, cap) -> head(70%)+tail(30%)+elision window, full-text passthrough <= cap (META-04)"
  - "read_enabled_field_defs(supabase, uid) -> explicitly .or_(user_id,is_global)-scoped + fail-closed field-def read under service-role (D-111-6)"
  - "async extract_metadata_enriched(...) -> 4th forced_emit caller, caller-owned emit tool + strict=False + degrade layer 1 (D-111-8)"
affects: [111-04-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4th forced_emit caller: caller-owned EMIT tool from <DynModel>.model_json_schema() + schema_model=<DynModel> + strict=False + real UserEffectiveSettings (the workflow_authoring/judge precedent, RESEARCH Pattern 1)"
    - "Dynamic Pydantic model via create_model: 7 immutable built-ins + per-def field-type mapping; CLOSED vocab raises ValueError on unknown type (no silent str fallback)"
    - "A1 no-underscore confidence: public `confidence` (default_factory=dict) survives model_dump(exclude_none=True); attach_confidence renames it to the nested `_confidence` containment key after the dump"
    - "head(70%)+tail(30%) window sampler with elision marker replaces content[:3000]; truncate-then-degrade, never fails"
    - "Service-role explicit scoping: .or_(f'user_id.eq.{owner},is_global.eq.true') pushed to DB + Python-side fail-closed (own or is_global) filter; query exception -> [] (built-ins only), never a bare full-table read"
    - "Degrade layer 1: extract_metadata_enriched wraps forced_emit in its own except -> {'emitted': None}; a failing/garbage/raising model NEVER breaks ingestion"

key-files:
  created: []
  modified:
    - "backend/app/services/embedding_service.py"
    - "backend/tests/unit/test_111_dynamic_model.py"
    - "backend/tests/unit/test_111_window_sampling.py"
    - "backend/tests/unit/test_111_confidence_survives_exclude_none.py"
    - "backend/tests/unit/test_111_exclude_none_nonregression.py"
    - "backend/tests/integration/test_111_field_def_scoping.py"

key-decisions:
  - "sample_for_extraction's second param is named `cap` (not the plan-recipe `cap_chars`) so the Wave-0 RED test keyword `sample_for_extraction(text, cap=...)` flips GREEN; Plan 04's positional call is unaffected (Rule 1 reconciliation, test is the contract)"
  - "build_metadata_model RAISES ValueError on an unknown field_type instead of the recipe's silent str fallback — the RED test_field_type_vocabulary expects rejection (the plan <behavior> explicitly permits this: 'or the model rejects it — match the test's expectation')"
  - "attach_confidence added as a net-new function (Rule 2) — test_111_confidence_survives_exclude_none imports it from embedding_service; the recipe deferred the attach to Plan 04 but the RED test requires the symbol now"
  - "test_111_field_def_scoping flipped GREEN now (not deferred) — migration 071 already applied at Phase 110 so the metadata_field_definitions table exists; the raw-SQL .or_ predicate proof XPASSED, so the xfail was removed"
  - "confidence carrier named `confidence` (no leading underscore) per the BLOCKING A1 design — overriding RESEARCH Pattern 2's literal `fields['_confidence']`, which would be a Pydantic-2 private attr dropped from model_dump"

patterns-established:
  - "All Phase 111 engine code is PURELY ADDITIVE to embedding_service.py — zero existing lines removed (only the import block extended); legacy extract_metadata / chunk_text / embed_chunks are byte-identical"

requirements-completed: []

# Metrics
duration: ~14min
completed: 2026-06-15
---

# Phase 111 Plan 02: Cross-Provider Enrichment Engine Summary

**Built Phase 111's only genuinely net-new service code — the dynamic-model builder, the head+tail window sampler, the explicitly-user-scoped fail-closed field-def reader, and the async `extract_metadata_enriched` that rides `forced_emit` as its 4th caller — all purely additive, with the legacy OpenAI-json_object `extract_metadata` preserved byte-identical as the `legacy` reversibility path; flipped 7 Wave-0 RED assertions GREEN with net-new failures = 0.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-06-15
- **Tasks:** 2
- **Files modified:** 6 (1 service + 5 test files; all modified, none created)

## Accomplishments
- `build_metadata_model(custom_defs)` builds a runtime `DynamicDocumentMetadata` = the 7 immutable built-ins + each enabled custom field (`enum`→`Literal[*options]`, others via `_FIELD_TYPE_MAP`) + a no-underscore `confidence: dict[str,float]` map; the CLOSED field_type vocab `{string,date,number,boolean,enum}` raises `ValueError` on an unknown type (no silent str fallback).
- `attach_confidence(dumped)` performs the A1 post-dump rename of public `confidence` → nested `_confidence` (display-only containment key, never a flat filter dimension; empty `confidence` dropped silently).
- `sample_for_extraction(text, cap)` replaces `content[:3000]` with head(70%)+tail(30%)+elision-marker sampling; full-text passthrough when `len <= cap`; truncate-then-degrade, never fails (META-04).
- `read_enabled_field_defs(supabase, uid)` reads owner+global ENABLED field defs under service-role with an EXPLICIT `.or_(user_id.eq,is_global.eq.true)` DB predicate + a Python-side fail-closed `(own or is_global)` filter; query exception → `[]` (built-ins only), never a bare full-table read (D-111-6 / the 110 SECURITY lesson).
- `async extract_metadata_enriched(...)` is the 4th `forced_emit` caller: caller-owned `emit_document_metadata` tool + the dynamic `schema_model` + `strict=False` + a real `UserEffectiveSettings`; the system prompt carries the per-field confidence calibration bands + the description-as-data prompt-injection mitigation; wraps `forced_emit` in its own `except → {"emitted": None}` (degrade layer 1 — a failing/garbage/raising model NEVER breaks ingestion, D-111-8).
- The legacy sync `extract_metadata` (OpenAI `json_object`, hardwired gpt-4o) is preserved byte-identical as the `legacy` reversibility path; no EmitFieldMap forced-tool reuse anywhere (tool == validator by construction, T-111-02-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: build_metadata_model + attach_confidence + sample_for_extraction + read_enabled_field_defs (pure helpers)** — `f7ff0a65` (feat)
2. **Task 2: async extract_metadata_enriched — forced_emit caller + degrade layer 1** — `48982da3` (feat)

**Plan metadata:** the orchestrator owns STATE.md / ROADMAP.md for this phase (see Deviations) — this SUMMARY is committed by the orchestrator, not a per-plan docs commit from this agent.

## Files Created/Modified
- `backend/app/services/embedding_service.py` — +5 net-new symbols (`build_metadata_model`, `attach_confidence`, `sample_for_extraction`, `read_enabled_field_defs`, `extract_metadata_enriched`) + `_FIELD_TYPE_MAP` / `_FIELD_TYPE_VOCAB` module constants + the `pydantic` / `typing.Literal` imports; legacy `extract_metadata` untouched (purely additive — zero existing lines removed).
- `backend/tests/unit/test_111_dynamic_model.py` — un-xfailed `test_custom_fields_in_schema` + `test_field_type_vocabulary` (both GREEN).
- `backend/tests/unit/test_111_window_sampling.py` — un-xfailed both sampler tests (GREEN); removed the now-unused `import pytest`.
- `backend/tests/unit/test_111_confidence_survives_exclude_none.py` — un-xfailed `test_confidence_survives_exclude_none_and_attaches` (imports + exercises `attach_confidence`); removed the now-unused `import pytest`.
- `backend/tests/unit/test_111_exclude_none_nonregression.py` — un-xfailed `test_dynamic_model_drops_none_author` (GREEN); removed the now-unused `import pytest`.
- `backend/tests/integration/test_111_field_def_scoping.py` — un-xfailed the 2-user cross-leak negative (the raw-SQL `.or_` predicate proof; GREEN against the live `:54322` DB).

## Decisions Made
- **`sample_for_extraction(text, cap)` parameter name** — named `cap` (not the recipe's `cap_chars`) to match the Wave-0 RED test's `cap=` keyword; Plan 04 calls it positionally so it is unaffected.
- **`build_metadata_model` rejects unknown field_types** — raises `ValueError` (the RED `test_field_type_vocabulary` expects rejection; the plan `<behavior>` explicitly permits "the model rejects it — match the test's expectation").
- **`attach_confidence` added now** — the RED `test_111_confidence_survives_exclude_none` imports it from `embedding_service`; the recipe deferred the attach to Plan 04 but the symbol is required to flip the test GREEN.
- **`test_111_field_def_scoping` flipped GREEN now** — migration 071 (the `metadata_field_definitions` table) is already applied at Phase 110, so the raw-SQL scoping predicate runs live; the test XPASSED, so the xfail was removed (the planned outcome for a scoping proof that doesn't need migration 072's `options` column).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Plan/test reconciliation] sample_for_extraction parameter name**
- **Found during:** Task 1
- **Issue:** The plan recipe defines `sample_for_extraction(text, cap_chars)`, but the Wave-0 RED test (`test_111_window_sampling.py`) calls `sample_for_extraction(text, cap=32000)` with the keyword `cap`. The recipe name would make the test raise `TypeError: unexpected keyword 'cap'`.
- **Fix:** Named the second positional parameter `cap`. Plan 04's positional call `sample_for_extraction(text, app_settings.extraction_window_cap)` is unaffected (positional binding is name-agnostic). The RED test is the binding contract.
- **Files modified:** `backend/app/services/embedding_service.py`
- **Commit:** `f7ff0a65`

**2. [Rule 1 — Plan/test reconciliation] build_metadata_model rejects unknown field_type**
- **Found during:** Task 1
- **Issue:** The plan recipe's `_TYPE_MAP.get(ftype, (str|None, None))` silently coerces an unknown field_type to `str`, but the RED `test_field_type_vocabulary` asserts `pytest.raises((ValueError, KeyError, TypeError))` on `field_type="spaceship"`.
- **Fix:** Added a closed-vocab guard that raises `ValueError` on any `field_type` outside `{string,date,number,boolean,enum}`. The plan `<behavior>` explicitly anticipated this: "field_type outside {...} → falls back to str|None (or the model rejects it — match the test's expectation)." The test expects rejection.
- **Files modified:** `backend/app/services/embedding_service.py`
- **Commit:** `f7ff0a65`

**3. [Rule 2 — missing critical function] attach_confidence**
- **Found during:** Task 1
- **Issue:** `test_111_confidence_survives_exclude_none.py` (a Task-1 GREEN target) imports `attach_confidence` from `embedding_service`. The recipe text says "Attach to metadata_dict['_confidence'] AFTER the dump (Plan 04)" — i.e. it deferred the *call site* to Plan 04 but the *function symbol* is required now to flip the RED test GREEN.
- **Fix:** Added `attach_confidence(dumped)` — pops the public `confidence` key and renames it to the nested `_confidence` containment key (empty/missing dropped silently). This is the A1 step Plan 04 will invoke at the ingest call site.
- **Files modified:** `backend/app/services/embedding_service.py`
- **Commit:** `f7ff0a65`

### Shared-artifact rule (orchestrator-owned STATE/ROADMAP)
Per the plan's `<CRITICAL_shared_artifact_rule>`, this agent did NOT touch, write, or commit `.planning/STATE.md` or `.planning/ROADMAP.md`, and ran NO `gsd-sdk query state.*` / `roadmap.*` / `record-metric` / `add-decision` verbs (the documented STATE.md balloon-bug recurrence). The execute-plan.md `<state_updates>` and `<final_commit>` steps were intentionally SKIPPED — the orchestrator is the sole writer of those files for Phase 111 and owns the final SUMMARY commit.

## Issues Encountered
- None blocking. Removed three now-unused `import pytest` statements from the unit test files whose only `pytest` usage was the removed `@pytest.mark.xfail` decorators (keeps the files lint-clean; `test_111_dynamic_model.py` retains `import pytest` because its `test_field_type_vocabulary` still uses `pytest.raises`).
- Reworded one docstring sentence so the literal token `_emit_forced_tool` no longer appears in `embedding_service.py` — the Task-2 acceptance criterion `grep "_emit_forced_tool" ... returns NOTHING` was tripping on an explanatory docstring reference (the code never reuses it; the criterion's intent is "no reuse").

## Net-New Test Failures (SEED-056)
**Net-new failures = 0.** Stash/baseline-vs-HEAD proof on the broader unit slice:
- **Base (`9c16561e`, pre-plan):** `tests/unit` = 59 failed / 810 passed / 8 xfailed
- **With-plan (`48982da3`):** `tests/unit` = 59 failed / 816 passed / 2 xfailed
- **Delta = +6 passed / −6 xfailed** (the 6 Wave-0 assertions flipped from xfail to GREEN). The 59 failures are byte-identical pre-existing rot (`test_sql_service.py` + `test_streaming_reliability.py` — the exact baseline the 111-01 SUMMARY recorded), unchanged by this plan.
- **4 named verification files:** baseline 2 passed / 6 xfailed → with-plan 8 passed / 0 xfailed.
- **Full `test_111_*` set (unit + integration):** 11 passed / 6 xfailed / 2 xpassed / **0 failures / 0 collection errors** — the remaining 6 xfailed + 2 xpassed are Plan-03/04/05-owned (CRUD endpoint, migration-072 settings readback, audit round-trip).

## GREEN tests flipped by this plan
| Test | File | Was | Now |
|------|------|-----|-----|
| test_custom_fields_in_schema | unit/test_111_dynamic_model.py | xfail | GREEN |
| test_field_type_vocabulary | unit/test_111_dynamic_model.py | xfail | GREEN |
| test_full_text_returned_when_under_cap | unit/test_111_window_sampling.py | xfail | GREEN |
| test_head_and_tail_when_over_cap | unit/test_111_window_sampling.py | xfail | GREEN |
| test_confidence_survives_exclude_none_and_attaches | unit/test_111_confidence_survives_exclude_none.py | xfail | GREEN |
| test_dynamic_model_drops_none_author | unit/test_111_exclude_none_nonregression.py | xfail | GREEN |
| test_scoped_read_excludes_other_users_private_field | integration/test_111_field_def_scoping.py | xfail (xpass) | GREEN |

## User Setup Required
None for THIS plan. The engine is callable but not yet wired into `ingest_document` (Plan 04). The live LM Studio operator pre-req (Qwen2.5-7B-Instruct on `:1234`) and migration 072 apply remain Plan-04/05 concerns.

## Next Phase Readiness
- **Plan 04 (wiring)** consumes: `build_metadata_model`, `sample_for_extraction`, `read_enabled_field_defs`, `extract_metadata_enriched`, and `attach_confidence`. It builds the `emit_document_metadata` tool from `DynModel.model_json_schema()` in the caller, hoists `load_app_settings()` above the extract call, branches `enriched | legacy` on `app_settings.metadata_enrichment_mode`, and bridges sync→async via `asyncio.run(...)` inside the BackgroundTask.
- **Plan 05 (live apply)** crosses migration 072 (the `options` column + the 3 extraction settings) into `:54322` — after which `test_111_settings_readback` and the `options`-dependent paths flip GREEN.
- No blockers.

---
*Phase: 111-metadata-enrichment-extraction-backend*
*Completed: 2026-06-15*

## Self-Check: PASSED

All 7 referenced artifacts verified on disk (1 service file + 5 modified test files + this SUMMARY); both task commits (`f7ff0a65`, `48982da3`) verified in git log.
