---
phase: 111-metadata-enrichment-extraction-backend
plan: 04
subsystem: backend
tags: [metadata-enrichment, ingest-document, forced-emit, asyncio-run, jsonb-containment, cross-provider, graceful-degradation]

# Dependency graph
requires:
  - phase: 111-01
    provides: "3 app_settings extraction fields (extraction_model / extraction_window_cap / metadata_enrichment_mode default 'enriched') readable on UserEffectiveSettings via load_app_settings()"
  - phase: 111-02
    provides: "the enrichment engine in embedding_service.py — build_metadata_model / sample_for_extraction / read_enabled_field_defs / attach_confidence / async extract_metadata_enriched; legacy extract_metadata preserved byte-identical"
provides:
  - "ingest_document enriched/legacy branch — the only edit that turns the Plan-02 engine on for every real ingest (and /reextract, which converges here)"
  - "hoisted load_app_settings() above the metadata extract call (extraction_model/window_cap/mode in scope; duplicate read at the embedding step removed)"
  - "resolve_extraction_model(extraction_model) helper in embedding_service (META-03 model resolution: app_settings.extraction_model wins; unset/empty -> env settings.llm_model gpt-4o; never app_settings.llm_model)"
  - "nested _confidence attach AFTER model_dump(exclude_none=True), guarding None; flat fields stay top-level; lowercase tail unchanged (D-111-9)"
  - "asyncio.run bridge from the sync BackgroundTask into the async forced_emit caller (D-v2.5-01 does not fire — sync def, not an async handler)"
affects: [111-05-live-apply, 112-confidence-display, virtual-folders, auto-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode branch at the ingest call site: metadata_enrichment_mode != 'legacy' -> enriched forced_emit path; 'legacy' -> the untouched OpenAI json_object extract_metadata path byte-identical (any non-'legacy' value fails safe to enriched)"
    - "Caller-owned emit tool built inline from DynModel.model_json_schema() (the workflow_authoring/judge precedent) so the advertised tool == the validator by construction"
    - "Three graceful-degradation layers at the ingest site: (1) extract_metadata_enriched's own except->None [Plan 02], (2) this call-site except->emitted=None, (3) the existing outer try/except backstop — a failing/garbage/raising model NEVER blocks ingestion (doc still reaches status=completed)"
    - "asyncio.run inside the sync BackgroundTask is the prescribed sync->async bridge for a coroutine (NOT run_in_threadpool); mirrors the documents.py:211 _upload_pipeline precedent"
    - "resolve_extraction_model(extraction_model) — (extraction_model or '').strip() or settings.llm_model: app_settings wins, unset/empty falls back to the env gpt-4o default, never app_settings.llm_model"

key-files:
  created: []
  modified:
    - "backend/app/api/documents.py"
    - "backend/app/services/embedding_service.py"
    - "backend/tests/unit/test_111_extraction_model_resolve.py"
    - "backend/tests/integration/test_111_flat_filter_compat.py"

key-decisions:
  - "resolve_extraction_model added to embedding_service (Rule 1/2): test_111_extraction_model_resolve imports the symbol and the plan verify step requires it GREEN; the plan recipe's inline `app_settings.extraction_model or settings.llm_model` is replaced by a named, .strip()-guarded helper that is the test's contract"
  - "test_111_flat_filter_compat was a real failure, not xfail-by-design (Rule 1 test bug): the fixture wrapped metadata in json.dumps AND the pg_pool registers a jsonb codec (encoder=json.dumps) -> double-encoded into a JSON string scalar so @> containment never matched; fixed by passing the dict directly (codec encodes) and dropping the ::jsonb cast -> real jsonb object, flat @> matches even with nested _confidence (D-111-9), then un-xfailed"
  - "Used the module's existing `log` (logging.getLogger(__name__)) at the call site, not the plan recipe's `logger` (which is the embedding_service-internal name) — the in-scope name in ingest_document is `log`"
  - "Function-local imports (noqa: PLC0415) for get_model_capability + the 5 embedding_service enrichment symbols, matching documents.py's established local-import discipline; asyncio / load_app_settings / extract_metadata are already module-level imports (no double-import)"

patterns-established:
  - "The enriched wiring is ADDITIVE + reversible: the legacy branch runs extract_metadata(text) byte-identical; flipping app_settings.metadata_enrichment_mode='legacy' fully reverts to today's behavior"
  - "ingest_document and _upload_pipeline stay sync (def) — the engine async-ness is bridged with asyncio.run, not by making the ingest path async (D-v2.5-01 / Q5)"

requirements-completed: [META-01, META-03, META-04]

# Metrics
duration: ~25min
completed: 2026-06-15
---

# Phase 111 Plan 04: Wire Enriched/Legacy Metadata Branch into ingest_document Summary

**Turned the Plan-02 enrichment engine ON for every real ingest — hoisted `load_app_settings()` above the metadata extract, branched `ingest_document` on `metadata_enrichment_mode` (default-on `enriched` -> cross-provider `forced_emit` via `asyncio.run` inside the sync BackgroundTask, with a runtime `create_model` schema + head/tail window sample + nested `_confidence` attached after the dump; `legacy` -> the untouched OpenAI path byte-identical), preserved all three graceful-degradation layers, added the `resolve_extraction_model` helper the test contracts, and fixed + un-xfailed a double-`json.dumps` jsonb test bug that was masking the flat-filter compatibility proof — net-new failures = 0.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-15
- **Tasks:** 1 (TDD)
- **Files modified:** 4 (1 API + 1 service + 2 test files; none created, none deleted)

## Accomplishments
- **The single edit that makes the whole phase apply on real ingests.** `ingest_document` now branches on `app_settings.metadata_enrichment_mode`: the default-on `enriched` path builds a dynamic Pydantic model from `read_enabled_field_defs(supabase, user_id)`, builds the caller-owned `emit_document_metadata` tool from `DynModel.model_json_schema()`, samples the window with `sample_for_extraction(text, extraction_window_cap)` (not `content[:3000]`), and runs `asyncio.run(extract_metadata_enriched(...))`; `legacy` runs the untouched OpenAI `json_object` `extract_metadata(text)` byte-identical.
- **`load_app_settings()` hoisted** to just below the `ingestion_step=extracting` update, above the extract branch, so `extraction_model` / `extraction_window_cap` / `metadata_enrichment_mode` are in scope; the duplicate read at the old embedding-step site was removed (read ONCE).
- **Nested `_confidence` attached AFTER `model_dump(exclude_none=True)`, guarding the None case** — flat fields stay top-level, only `document_type` + `language` are lowercased (the tail is unchanged), `_confidence` is never lowercased and never promoted to a flat filter field (D-111-9).
- **All three graceful-degradation layers preserved**: the call-site `except -> emitted=None` (layer 2) sits between Plan-02's own `except -> {"emitted": None}` (layer 1) and the existing outer `try/except` backstop (layer 3). A failing/garbage/raising model -> `metadata_dict=None` -> the doc still reaches `status=completed`.
- **`resolve_extraction_model(extraction_model)` added** to `embedding_service` (META-03): `app_settings.extraction_model` wins when set; unset/empty falls back to the env `settings.llm_model` (gpt-4o), never a nonexistent `app_settings.llm_model`.
- **`ingest_document` and `_upload_pipeline` stay sync** — the engine's async-ness is bridged with `asyncio.run` (the `documents.py:211` `_upload_pipeline` precedent), NOT by making the path async and NOT by `run_in_threadpool` (it's a coroutine; D-v2.5-01 does not fire in the sync BackgroundTask).

## Task Commits

Each task was committed atomically:

1. **Task 1: Hoist load_app_settings + enriched/legacy branch + asyncio.run + _confidence attach (TDD)** — `1ee00b60` (feat)

**Plan metadata:** the orchestrator owns STATE.md / ROADMAP.md for this phase (see Deviations) — this SUMMARY is committed by the orchestrator, not a per-plan docs commit from this agent.

## Files Created/Modified
- `backend/app/api/documents.py` — `ingest_document`: hoisted `load_app_settings()` above the extract call (removed the duplicate at the embedding step); replaced `metadata = extract_metadata(text)` with the `enriched | legacy` branch (function-local imports for `get_model_capability` + the 5 enrichment symbols; `asyncio.run(extract_metadata_enriched(...))`; nested `_confidence` attach after the dump); the lowercase tail + persist site + outer backstop unchanged.
- `backend/app/services/embedding_service.py` — added `resolve_extraction_model(extraction_model)` (net-new helper, META-03); purely additive — legacy `extract_metadata` + the Plan-02 engine untouched.
- `backend/tests/unit/test_111_extraction_model_resolve.py` — un-xfailed both resolver assertions (now GREEN); removed the now-unused `import pytest`.
- `backend/tests/integration/test_111_flat_filter_compat.py` — fixed the double-`json.dumps` jsonb insert + containment query (pass the dict directly so the codec encodes once -> real jsonb object) and un-xfailed (now GREEN against live `:54322`).

## Decisions Made
- **`resolve_extraction_model` added to `embedding_service`** — `test_111_extraction_model_resolve.py` imports the symbol and the plan verify step (`pytest ... -x -q` GREEN) requires it; the plan recipe's inline `app_settings.extraction_model or settings.llm_model` was replaced by a named, `.strip()`-guarded helper. The test is the contract (same reconciliation pattern Plan 02 used for `cap` vs `cap_chars`).
- **The flat-filter test was genuinely failing, not xfail-by-design** — a Rule-1 test bug double-encoded the metadata; fixed at the source (see Deviations) rather than leaving it as a standing xfail. The synthetic-row proof stands on its own; it does NOT require a real-pipeline run.
- **Used the in-scope `log`, not `logger`** — the plan recipe referenced `logger.warning`, but `ingest_document`'s in-scope logger is `log` (`logging.getLogger(__name__)`). Adapted to the live name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical function] resolve_extraction_model helper**
- **Found during:** Task 1
- **Issue:** The plan's `<verify>` runs `test_111_extraction_model_resolve.py -x -q` and the acceptance requires it GREEN, but the test imports `resolve_extraction_model` from `embedding_service`, which did NOT exist (Plan 02's `provides` list omits it; the plan recipe inlined the resolution as `app_settings.extraction_model or settings.llm_model`). Without the symbol the test stays xfail / errors on import.
- **Fix:** Added `resolve_extraction_model(extraction_model: str | None) -> str` to `embedding_service` — `(extraction_model or "").strip() or settings.llm_model` (function-local `from app.config import settings`). Wired it at the call site as `model = resolve_extraction_model(app_settings.extraction_model)`. Un-xfailed both test assertions (removed the now-unused `import pytest`).
- **Files modified:** `backend/app/services/embedding_service.py`, `backend/app/api/documents.py`, `backend/tests/unit/test_111_extraction_model_resolve.py`
- **Verification:** `pytest tests/unit/test_111_extraction_model_resolve.py -x -q` -> 2 passed (was 2 xfailed). The grep acceptance `app_settings.extraction_model or settings.llm_model` is satisfied semantically via the helper (env gpt-4o fallback, NOT `app_settings.llm_model`).
- **Committed in:** `1ee00b60` (Task 1 commit)

**2. [Rule 1 — Bug] test_111_flat_filter_compat double-json.dumps stored metadata as a JSON string scalar**
- **Found during:** Task 1 (the plan instructs to un-xfail this test "if it can seed a synthetic row" — it can; the fixture self-seeds)
- **Issue:** Running the test with `--runxfail` showed a REAL failure (`row is None`), not an xfail-by-design. Root cause (diagnosed against live `:54322`): the `pg_pool` fixture registers a jsonb type codec (`encoder=json.dumps`), and the `seeded_doc` fixture ALSO wrapped the dict in `json.dumps(...)` and cast `$8::jsonb` — so the value was double-encoded into a JSON **string scalar** (`'"{...}"'`), and a flat `@>` **object** containment never matches a string scalar. The product behavior was correct; the test was masking itself.
- **Fix:** Pass the dict DIRECTLY (the codec encodes it once), drop the explicit `json.dumps` wrapper and the `::jsonb` cast in both the INSERT and the SELECT containment filter. Verified at the DB: the row now stores a real jsonb object and `metadata @> '{"document_type":"report"}'` matches True WITH the nested `_confidence` present. Un-xfailed the test.
- **Files modified:** `backend/tests/integration/test_111_flat_filter_compat.py`
- **Verification:** `pytest tests/integration/test_111_flat_filter_compat.py -q` -> 1 passed (was 1 xfailed). Independently reproduced the corruption + the fix with a standalone asyncpg probe before/after.
- **Committed in:** `1ee00b60` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical function, 1 test bug)
**Impact on plan:** Both were necessary to satisfy the plan's own `<verify>`/acceptance (the resolver symbol) and to make the flat-filter compatibility proof real (D-111-9). No scope creep — both are inside Plan 04's named files. The product wiring matches the plan recipe exactly.

## Issues Encountered
- `test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool` fails — confirmed PRE-EXISTING via a stash/baseline check (fails identically at `47504508` without this plan's changes); NOT a regression from touching `ingest_document`. Out of scope (not Plan 04's file). The `_upload_pipeline`/`ingest_document` sync-exemption rows in that sweep still pass.

## Net-New Test Failures (SEED-056)
**Net-new failures = 0.** Baseline-vs-HEAD on the broader unit slice:
- **Base (`47504508`, pre-plan):** `tests/unit` = 59 failed / 845 passed / 2 xfailed
- **With-plan (`1ee00b60`):** `tests/unit` = 59 failed / 847 passed / 0 xfailed
- **Delta = +2 passed / −2 xfailed** (the 2 resolver assertions flipped xfail->GREEN). The 59 failures are byte-identical pre-existing rot (`test_sql_service.py` + `test_streaming_reliability.py` — the exact baseline the 111-01/02 SUMMARYs recorded), unchanged by this plan.
- **Integration:** `test_111_flat_filter_compat.py` flipped 1 xfailed -> 1 passed (separate slice).
- **Full `test_111_*` set (unit + integration):** 48 passed / 1 xfailed / 1 xpassed / **0 failures / 0 collection errors**. The remaining xfailed + xpassed are Plan-05-owned (`test_111_settings_readback.py` — migration 072 live-apply gate).

## GREEN tests flipped by this plan
| Test | File | Was | Now |
|------|------|-----|-----|
| test_resolves_to_app_settings_when_set | unit/test_111_extraction_model_resolve.py | xfail | GREEN |
| test_falls_back_to_env_llm_model_when_unset | unit/test_111_extraction_model_resolve.py | xfail | GREEN |
| test_flat_containment_still_matches_with_confidence | integration/test_111_flat_filter_compat.py | xfail (real failure under --runxfail) | GREEN |

## Threat surface scan
No new security-relevant surface beyond the plan's `<threat_model>`. The 4 registered threats are addressed in the shipped wiring: T-111-04-01 (DoS via failing model) — all three backstop layers preserved (LIVE-verify per axis (d), VALIDATION.md); T-111-04-02 (`_confidence` leaking into the flat space / being lowercased) — attached as a single nested key after the dump, lowercase tail unchanged, proven by the (now-GREEN) flat-filter test; T-111-04-03 (cross-user field-def over-return) — routed through Plan-02's explicitly-scoped fail-closed `read_enabled_field_defs(supabase, user_id)`; T-111-04-04 (passing app-level Settings into the gateway) — passes the real `UserEffectiveSettings` from `load_app_settings()` (has `.active_provider`), NOT `config.settings`. No threat flags.

## Shared-artifact rule (orchestrator-owned STATE/ROADMAP)
Per the plan's `<CRITICAL_shared_artifact_rule>`, this agent did NOT touch, write, or commit `.planning/STATE.md` or `.planning/ROADMAP.md`, and ran NO `gsd-sdk query state.*` / `roadmap.*` / `record-metric` / `add-decision` verbs (the documented STATE.md balloon-bug recurrence). The execute-plan.md `<state_updates>` and `<final_commit>` steps were intentionally SKIPPED — the orchestrator is the sole writer of those files for Phase 111 and owns the final SUMMARY commit.

## User Setup Required
None for THIS plan. The enriched path is now LIVE for new ingests, but its full cross-provider/local exercise depends on Plan 05 (migration 072's 3 extraction-settings columns + `options` column live-applied to `:54322`) and the LM Studio operator pre-req (Qwen2.5-7B-Instruct on `:1234`). Until migration 072 lands, `app_settings` reads fall back to the field defaults gracefully (`metadata_enrichment_mode` defaults to `enriched`, so the enriched path is on by default).

## Next Phase Readiness
- **Plan 05 (live apply)** crosses migration 072 into `:54322` (the 3 extraction settings + `options` column), after which `test_111_settings_readback` flips GREEN and the operator can drive the SC#4 4-axis live UAT (cross-provider / local lmstudio / long-doc window-lift / failing-model degradation) authored in VALIDATION.md as Manual-Only.
- The enriched/legacy branch + `_confidence` attach are the substrate Phase 112 (confidence display) consumes.
- No blockers.

---
*Phase: 111-metadata-enrichment-extraction-backend*
*Completed: 2026-06-15*

## Self-Check: PASSED

All 5 referenced artifacts verified on disk (2 source files + 2 modified test files + this SUMMARY); the task commit (`1ee00b60`) verified in git log.
