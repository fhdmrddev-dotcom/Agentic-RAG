---
phase: 101-template-fill-integrity-validation
plan: 02
subsystem: api
tags: [docxtpl, jinja2, python-docx, python-pptx, openpyxl, pydantic, template-fill, ooxml, ssti, structured-output]

# Dependency graph
requires:
  - phase: 101-01
    provides: "the 4 OOXML fixtures + the 2 Wave-0 TDD contract files (test_template_render.py + test_template_integrity.py) with 9 xfail-by-design stubs"
  - phase: 097
    provides: "the spike sources ported here (field_map.Cited, derive_fields.check_coverage + truncation guard, render_docx.build_context/render/assert_integrity)"
provides:
  - "template_render_service.py — the pure deterministic template-fill core (Cited model, GenericFieldMap fixed envelope, check_coverage citation gate, is_truncated guard, build_context + worded->numeric hook, render_docx_template trusted engine, run_replace_docx arbitrary engine, residual_tags_in, assert_integrity universal re-open, select_engine provenance router)"
  - "the NET-NEW run-coalescing scalar replace (Pitfall 1) — reassembles a {{token}} split across <w:r> runs; Jinja-free (SSTI structurally impossible on the upload path)"
  - "the 9 Wave-0 TMPL-02/TMPL-03 stubs flipped to real GREEN behavioral tests"
affects: [101-03, 101-04, 102]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden rule: LLM produces DATA, deterministic code produces the FILE (this module is the deterministic code)"
    - "Function-local heavy-lib imports (docxtpl/python-docx/python-pptx/openpyxl/jinja2) so the module imports cleanly in the backend venv where those libs are absent (Pitfall 4); render is sandbox-only at runtime"
    - "Provenance-routed engine selection (D-02 security boundary): library AssetRef -> docxtpl/Jinja; ephemeral upload -> non-Jinja run-replace; the template_input branch can NEVER return docxtpl"
    - "Run-coalescing scalar replace: collapse a token-bearing paragraph's runs into run[0] then str.replace; blank unmatched placeholder-shaped tokens for a clean delivered file; residual scan is the deterministic silent-miss detector"
    - "Generic fixed field-map envelope (scalars + collections) generalizing the spike's risk-register-specific shape (RESEARCH Open Q 2)"

key-files:
  created:
    - "backend/app/services/template_render_service.py — the deterministic core (686 lines)"
  modified:
    - "backend/tests/unit/test_template_render.py — 6 xfail stubs upgraded to GREEN"
    - "backend/tests/unit/test_template_integrity.py — 3 xfail stubs upgraded to GREEN"

key-decisions:
  - "Generic field-map = a FIXED two-bucket envelope (scalars: dict[str,Cited] + collections: dict[str,list[dict[str,Cited]]]), not a per-template dynamically-built model — simpler, stable cross-provider tool schema (RESEARCH Open Q 2 LEAN fixed envelope). build_generic_field_map_model returns GenericFieldMap regardless of keys; keys drive coverage + the tool-schema description only."
  - "Unmatched placeholder-shaped {{token}} tokens are BLANKED (not left in place) on the arbitrary path so a delivered file never carries a surviving template tag — the 'lean blank for clean cells' choice (RESEARCH Pitfall 1 step 3); only bare-identifier tokens are blanked (regex-guarded) so literal braces the user wanted survive (failure mode (b))."
  - "_iter_leaves + check_coverage + build_context tolerate BOTH the generic envelope AND the flat spike-style shape ({key: cited} + a list value as a collection) so the Wave-0 check_coverage/build_context stubs (which pass a flat dict) and the production envelope both work without the caller pre-normalizing."
  - "build_context default-blanks a 'score' key on every collection row so the trusted risk-register.docx template (which references {{ r.score }}) renders cleanly under the generic no-hook default — the derived VALUE stays Phase 104's job (D-11)."

patterns-established:
  - "TMPL-03 SandboxedEnvironment(autoescape=True) wired inside render_docx_template — mandatory regardless of provenance (defense-in-depth)"
  - "Universal integrity re-open: docx->Document, pptx->Presentation, xlsx->load_workbook; a non-opening file is never delivered; documented_limit set for pptx-table-growth + xlsx-chart-strip (D-06 no-silent-caps)"

requirements-completed: [TMPL-02, TMPL-03]

# Metrics
duration: 22min
completed: 2026-06-11
---

# Phase 101 Plan 02: Deterministic Template-Fill Core Summary

**A single pure, importable, sandbox-shippable module — `template_render_service.py` — carrying the cited field-map shape, the deterministic citation/coverage + truncation gates, BOTH fill engines (trusted docxtpl/Jinja row-growth + the net-new arbitrary run-coalescing scalar replace), the universal integrity re-open oracle, and provenance-routed engine selection; the 9 Wave-0 TMPL-02/TMPL-03 stubs flipped to real GREEN.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-11
- **Completed:** 2026-06-11
- **Tasks:** 1 (single HEAVY task by design — one cohesive deterministic core)
- **Files modified:** 3 (1 created, 2 test files upgraded)

## Accomplishments

- **The deterministic core exists** (`template_render_service.py`, 686 lines — exceeds the 220 min-lines must-have). Exports all 9 contract symbols: `Cited`, `check_coverage`, `is_truncated`, `build_context`, `render_docx_template`, `run_replace_docx`, `assert_integrity`, `residual_tags_in`, `select_engine` (+ `GenericFieldMap`, `build_generic_field_map_model`, `build_field_map_tool_schema`, `_num` helper).
- **The one genuinely-new algorithm shipped** — `run_replace_docx`'s two-stage run-coalescing scalar replace reassembles a `{{client_name}}` fragmented across 3 `<w:r>` runs (the Pitfall-1 reproduction), is verifiably Jinja-free (AST-checked — SSTI structurally impossible on the upload path), and leaves a clean delivered file (residual scan == `[]`).
- **All 9 Wave-0 stubs upgraded to real GREEN behavioral tests** (the 098/099/100 un-mark-on-landing convention) — a silent XPASS can no longer mask a regression. `11 passed` (6 named + the [1]/[5]/[20] parametrize counts as 3 + 3 integrity = 11 test items).
- **Both RED LINES honored structurally:** NO LLM call here (the field-map emission rides the shared gateway in Plan 03); NO top-level heavy-lib import (all docxtpl/python-docx/python-pptx/openpyxl/jinja2 imports are function-local — the pure helpers import cleanly in the backend venv where docxtpl is absent, Pitfall 4).

## Task Commits

1. **Task 1: Port + generalize the deterministic core into template_render_service.py** — `f0549733` (feat)
   - TDD GREEN commit. The matching RED commit (the xfail stubs) landed in Plan 101-01 Task 2 (`315cbe57`) per the cross-plan TDD convention, so this plan's commit is the GREEN feat + the stub-upgrade.

**Plan metadata:** _(this commit — docs: complete plan)_

## Files Created/Modified

- `backend/app/services/template_render_service.py` (created) — the pure deterministic core. Sections: (1) field-map models — `Cited` (port) + `GenericFieldMap` fixed envelope + `build_generic_field_map_model` + `build_field_map_tool_schema`; (2) `check_coverage` + `_iter_leaves` (generalized citation gate); (3) `is_truncated`; (4) `build_context` + `_num`/`_cell`/`_build_row` (D-11 hook); (5) `render_docx_template` (trusted docxtpl + SandboxedEnvironment(autoescape=True)); (6) `run_replace_docx` + `_replace_in_paragraph` (the net-new run-merge); (7) `residual_tags_in`; (8) `assert_integrity` (universal re-open + documented_limit); (9) `select_engine` (provenance routing + D-02 assert).
- `backend/tests/unit/test_template_render.py` (modified) — dropped 6 `xfail(strict=False)` markers (5 funcs, the parametrize counts as one) + updated the module docstring to the "Plan 101-02 has landed" upgrade note.
- `backend/tests/unit/test_template_integrity.py` (modified) — dropped 3 `xfail` markers + updated the docstring + removed the now-unused `pytest` import.

## Decisions Made

See frontmatter `key-decisions` for the four substantive calls (fixed envelope; blank-unmatched-tokens; dual-shape tolerance; default-blank score). All are within the plan's explicit discretion grants (RESEARCH Open Q 2 fixed envelope; Pitfall 1 step 3 "lean blank"; D-11 generic-hook default-None).

## Deviations from Plan

None requiring a deviation rule — the plan was executed as written. One behavioral detail the test contract surfaced (handled within plan discretion, not a deviation):

- **The arbitrary-path residual contract is "blank unmatched tokens," not "leave them."** `test_run_merge_replaces_split_token` passes only `{"client_name": ...}` yet asserts `residual_tags_in == []` even though the fixture also carries an unmatched `{{report_title}}` control token. The plan's `<action>` step 6(c) named this a planner's choice ("leave the token OR blank it; lean blank for clean cells, mirroring `render_docx._cell`"). I implemented the BLANK choice — a regex-guarded sub that blanks only bare-identifier `{{token}}` placeholders (so literal braces the user wanted survive — failure mode (b)). This is the documented discretion call resolved by the test contract, not a plan deviation.

## Issues Encountered

- **First run-merge pass left the control token as a residual** (`['{{report_title}}']` != `[]`). The fixture's `make_fixtures.py` documents `{{report_title}}` as a "clean control token" not in the test's scalar map; the test contract requires a clean delivered file (no surviving placeholder). Resolved by adding the blank-unmatched-placeholders sub (above). Re-ran → GREEN.

## SEED-056 net-new-failure proof

Full backend suite: `115 failed, 1227 passed, 7 skipped, 3 xfailed, 1 error` — at the documented SEED-056 rot baseline (~98-114 pre-existing failing tests). **Net-new failures from this plan = 0:**
- NONE of the 115 failures touch `test_template_render.py` / `test_template_integrity.py` (grep-confirmed) — my plan's 11 tests are all GREEN.
- The failing modules (`test_sql_service.py`, `test_streaming_reliability.py`, `test_077_cross_cancel.py`) are unrelated to template fill and fail IDENTICALLY at baseline (proven by running `test_sql_service.py` + `test_streaming_reliability.py` in isolation: `13 failed` regardless of this plan's changes).
- The new service module is a brand-new file no pre-existing test imports, so it cannot have broken anything. The only other changes were dropping xfail markers in 2 test files (which only made passing tests report as PASS instead of XPASS).

## Acceptance Criteria Verification

- ✅ `template_render_service.py` exists and exports all 9 contract symbols (+ the generic-envelope helpers).
- ✅ `SandboxedEnvironment(autoescape=True)` matches inside `render_docx_template` (line 384).
- ✅ The docxtpl import is INSIDE `render_docx_template` (lines 379-381), NOT at module top level (Pitfall 4).
- ✅ `run_replace_docx` imports `from docx import Document` and does NOT import docxtpl or jinja2 anywhere in its path (AST-verified — both `run_replace_docx` and `_replace_in_paragraph` report zero forbidden imports).
- ✅ All 9 Wave-0 tests pass as real GREEN: `test_field_map_covers_template_keys`, `test_check_coverage_flags_uncited_and_invented`, `test_truncated_emission_rejected`, `test_trusted_render_grows_rows[1]/[5]/[20]`, `test_run_merge_replaces_split_token`, `test_engine_selection_by_provenance`, `test_corrupt_file_never_delivered`, `test_autoescape_contains_xml_special_chars`, `test_template_input_routes_to_non_jinja_engine` — `11 passed`.
- ✅ `from app.services.template_render_service import Cited, check_coverage, select_engine` runs in the backend venv WITHOUT a docxtpl import error (the pure helpers are function-local-safe).

## Threat Model Compliance (101-02 STRIDE register)

- **T-101-02-01 (SSTI via Jinja):** `SandboxedEnvironment(autoescape=True)` wired in `render_docx_template` — mandatory regardless of provenance.
- **T-101-02-02 (`& < >` XML corruption):** autoescape on the docxtpl path; python-docx `.text` setter auto-escapes on the run_replace path; `assert_integrity` re-open catches residual corruption. `test_autoescape_contains_xml_special_chars` GREEN.
- **T-101-02-03 (spoofed citation):** `check_coverage` deterministic set-membership flags `invented_citation_count` (source_chunk_id ∉ retrieved_ids) + `uncited_value_count`. `test_check_coverage_flags_uncited_and_invented` GREEN.
- **T-101-02-04 (SSTI via upload):** `select_engine("template_input") -> "run_replace"` with a hard `assert engine != "docxtpl"`; `run_replace_docx` is AST-verified Jinja-free. `test_template_input_routes_to_non_jinja_engine` GREEN.
- **T-101-02-05 (run_replace silent miss):** `residual_tags_in` scan after replace = the deterministic silent-miss detector; a surviving `{{` is an honest verdict line. `test_run_merge_replaces_split_token` asserts `residual_tags_in == []` GREEN.

## Known Stubs

None. Every exported function is fully implemented and behaviorally tested. The `numeric_hook=None` default in `build_context` is an intentional generic seam (D-11 — the derived-field VALUES are Phase 104 content, NOT a stub); the `documented_limit` field is set, not a placeholder. The `_handle_render_template` tool handler + sandbox driver + asset resolution are Plans 03/04 (explicitly out of this plan's scope — this is the pure core they build on).

## Next Phase Readiness

- **Plan 101-03 (the `render_template` tool handler) is unblocked** — it ships these render functions INTO the sandbox via `copy_to_runtime`, drives the field-map emission through the shared gateway (so all 8 providers inherit the NATIVE/STRUCTURED trap handling), runs `check_coverage` + `assert_integrity` as the two gates, and persists via `write_file`. The deterministic core it composes is now complete.
- **Plan 101-04 (asset resolution)** consumes `select_engine` for provenance routing (library AssetRef vs `kind='template_input'`).
- **Live UAT (Plan 03+) operator setup reminder** (carried from Plan 101-01): rebuild + bump the sandbox image — `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/` then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env` (NEW chats only). The render functions need docxtpl, which is in the sandbox image (Plan 101-01 Task 3) but NOT the backend venv.

## Self-Check: PASSED

- FOUND: `backend/app/services/template_render_service.py`
- FOUND: `.planning/phases/101-template-fill-integrity-validation/101-02-SUMMARY.md`
- FOUND commit: `f0549733`

---
*Phase: 101-template-fill-integrity-validation*
*Completed: 2026-06-11*
