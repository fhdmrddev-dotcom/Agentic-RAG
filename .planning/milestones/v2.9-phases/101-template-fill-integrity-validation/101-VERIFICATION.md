---
phase: 101-template-fill-integrity-validation
verified: 2026-06-11T08:00:00Z
status: human_needed
score: 4/4 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cross-provider field-map emission — full native roster (OpenAI / Anthropic / Google / DeepSeek / Moonshot / GLM / MiniMax + OpenRouter)"
    expected: "Each provider produces an openable filled file AND a cited field-map in the run log. A degrading provider is documented (D-15 / Cond 7 pass-or-documented)."
    why_human: "Live LLM calls per provider; non-deterministic; SC#10 4-axis scoreboard requires real sandbox renders and real KB retrieval. The sandbox image must be rebuilt (docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/) and SANDBOX_IMAGE bumped before running. Cached sessions keep the old image — use FRESH chats."
  - test: "SC#4 failure mode #1 — docx run-split silent miss (arbitrary path, live sandbox)"
    expected: "A workflow fill with an ephemeral upload whose template contains a {{token}} fragmented across runs produces a file where the token is correctly filled. residual-tag scan result [] in the run log."
    why_human: "Requires the rebuilt sandbox image + a live workflow run against the arbitrary-upload path. The unit test (test_run_merge_replaces_split_token) covers the deterministic core in the venv; the live sandbox end-to-end is the remaining UAT."
  - test: "SC#4 failure mode #3 — produced file won't open (integrity gate live)"
    expected: "Force an integrity failure (e.g. deliberately corrupt the template before fill). The run shows a named integrity error, the cited field-map is visible as fallback output, and no file appears in the workspace output panel."
    why_human: "Requires a live sandbox run + operator-observable run-honesty surface. The unit test (test_render_template_integrity_fail_preserves_field_map) covers the gate logic; the operator must observe the UI result."
  - test: "SC#4 failure mode #4 — pptx variable-row table limit"
    expected: "Fill table-deck.pptx via a workflow. Produced file opens. Verdict carries documented_limit: 'pptx cannot grow tables (python-pptx >=1.0.0)'. Pass OR explicitly documented."
    why_human: "Requires live sandbox render of a pptx template. Upstream library hard limit (python-pptx); the documented_limit field is set in the driver code but observable only via a live run."
  - test: "SC#4 failure mode #5 — xlsx chart strip"
    expected: "Fill chart-book.xlsx via a workflow. Scalars fill correctly. Verdict carries documented_limit: 'openpyxl drops charts on save'. Chart loss is documented, not silent."
    why_human: "Requires live sandbox render of the chart-bearing xlsx fixture. Observable only in a real run."
  - test: "SC#4 failure mode #6 — xlsx merged-cell mis-write"
    expected: "Merged-cell anchor (A4:B4) fills correctly OR verdict documents the limit. Integrity re-open passes (file opens). No silent corruption."
    why_human: "Requires live sandbox render of chart-book.xlsx which contains a merged-cell range. Observable in a real run."
  - test: "Sandbox isolation — render works only with SANDBOX_ENABLED + new image"
    expected: "With SANDBOX_ENABLED=true and agentic-rag-sandbox:101.1 image: fill succeeds. An old cached session (pre-image-bump) surfaces the honest 'sandbox_image_stale' error."
    why_human: "Requires Docker Desktop + the rebuilt sandbox image + a real fill run. The ModuleNotFoundError path is handled in code but the isolation proof needs an operator-observable run."
  - test: "Integrity-fail run-honesty surface in the UI"
    expected: "A forced integrity failure shows the specific error naming the integrity failure; the extracted cited field-map data is visible as fallback output in the run panel."
    why_human: "UI run-honesty surface; operator-recognizable. The code path (D-08 failure class 2) is fully wired and unit-tested; the operator must observe the panel render."
---

# Phase 101: Template-Fill Integrity Validation — Verification Report

**Phase Goal:** A workflow fills that exact uploaded/library template from project-KB content into a real, openable deliverable — every value cited, and a corrupt file can never reach the user as "done."
**Verified:** 2026-06-11T08:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | BOTH provenance paths (trusted library docxtpl/Jinja + arbitrary-upload non-Jinja run-replace) work end-to-end via cited field-map; deterministic core is code-complete | VERIFIED (automated) / HUMAN NEEDED (live sandbox) | `template_render_service.py` 686 lines exports all 9 contract symbols; `run_replace_docx` is AST-verified Jinja-free; `render_docx_template` uses `SandboxedEnvironment(autoescape=True)`; `_handle_render_template` wires the full pipeline (resolution → citation gate → sandbox render → integrity gate → persist); all 17 named unit tests GREEN. Live cross-provider fill requires human UAT (see human_verification). |
| 2 | A filled template is re-opened with the same library to assert integrity before delivery; a corrupt or unopenable file is caught and never delivered | VERIFIED (automated) / HUMAN NEEDED (live observe) | `assert_integrity` in both `template_render_service.py` and `_RENDER_DRIVER_SRC` re-opens with `Document`/`Presentation`/`load_workbook`; `test_corrupt_file_never_delivered` GREEN; `_handle_render_template` step 5 checks `verdict.rendered AND verdict.opened` and never calls `ws_write_file` on failure; `test_render_template_integrity_fail_preserves_field_map` GREEN. Operator must observe the UI surface in a live run. |
| 3 | Rendering runs inside the sealed, network-less sandbox with `SandboxedEnvironment(autoescape=True)` — untrusted template cannot execute server-side (SSTI contained) | VERIFIED (structural) | `select_engine("template_input")` returns `"run_replace"` (hard-asserted — `assert engine != "docxtpl"` at line 677); `run_replace_docx` in the driver never imports docxtpl/jinja2 (only `from docx import Document`); `SandboxedEnvironment(autoescape=True)` is present in the driver's `render_docx_template` function (line 1267); `test_template_input_routes_to_non_jinja_engine` GREEN; `test_autoescape_contains_xml_special_chars` GREEN; `test_render_driver_is_self_contained` confirms no `app.*` imports. `SANDBOX_ENABLED=false` returns an honest error with NO local-venv fallback. |
| 4 | The named failure modes (run-split miss, XML corruption, pptx variable-row table, xlsx chart strip, merged-cell mis-write, won't-open) are exercised as UAT rows and pass or are documented | PARTIALLY VERIFIED (automated for #1/#2/#3) / HUMAN NEEDED (live for #4/#5/#6) | SC#4 #1 (run-split): `test_run_merge_replaces_split_token` GREEN; SC#4 #2 (XML `& < >`): `test_autoescape_contains_xml_special_chars` GREEN; SC#4 #3 (won't-open): `test_corrupt_file_never_delivered` + `test_render_template_integrity_fail_preserves_field_map` GREEN; SC#4 #4 (pptx grow-table): `documented_limit` wired in driver code, live pptx fill is HUMAN UAT; SC#4 #5 (xlsx chart strip): `documented_limit` wired, live xlsx fill is HUMAN UAT; SC#4 #6 (merged-cell): integrity re-open path is wired, live fill is HUMAN UAT. |

**Score:** 4/4 truths verified (automated sub-claims all GREEN); 8 live-UAT items remain human_needed.

---

### Deferred Items

None. All phase scope delivered.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/template_render_service.py` | Pure deterministic core: Cited, GenericFieldMap, check_coverage, is_truncated, build_context, render_docx_template, run_replace_docx, assert_integrity, residual_tags_in, select_engine | VERIFIED | 686 lines; all 9 named symbols exported; function-local heavy-lib imports (Pitfall 4 compliant); `SandboxedEnvironment(autoescape=True)` inside `render_docx_template` at line 384; `run_replace_docx` imports only `from docx import Document` (no jinja2/docxtpl). |
| `backend/app/services/template_asset_service.py` | `resolve_template_source` — provenance-keyed byte resolution (library AssetRef → Storage; kind='template_input' → workspace), returns bytes + provenance + clean errors | VERIFIED | Exports `resolve_template_source`; reuses `_read_from_storage` / `_get_file_content` (run_in_threadpool wrapped, D-v2.5-01); all 5 result keys always returned via `_result()` helper; ephemeral path user-scoped on `created_by`; two-query expired/never-uploaded distinction; never raises raw 404. |
| `backend/app/services/tool_dispatcher.py` | `_handle_render_template` handler + `_RENDER_DRIVER_SRC` + one `_TOOL_REGISTRY` line | VERIFIED | `_handle_render_template` at line 1473; `_RENDER_DRIVER_SRC` at line 1186; registry line `"render_template": _handle_render_template` at line 2271; handler implements truncation guard → citation gate → resolve bytes → sandbox render → integrity gate → persist + SSE; no `import docxtpl` at module top; `ws_write_file` + `workspace_file_written` emit only on both-gates-pass. |
| `backend/app/services/harness/phase_types.py` | `render_template` admitted to a declaring fill phase via the 099 whitelist pattern; Deep byte-identical | VERIFIED | Documenting comment block at `_effective_tools` names `render_template` as a declared FILL-phase tool; no executable auto-injection; `_build_phase_tool_context` unchanged (threads `_effective_tools(phase)` into `available_tools=_tools` + `phase_whitelist=frozenset(_tools)`); `test_fill_phase_admits_render_template`, `test_non_fill_phase_excludes_render_template`, `test_deep_mode_whitelist_none_noop` all GREEN. |
| `backend/app/models/harness.py` | Co-lock comment pointer updated: "implemented in Phase 101 (template_asset_service)" | VERIFIED | Line 189: `assets: list[AssetRef] | None = None  # co-lock — implemented in Phase 101 (template_asset_service)`; model parses and imports cleanly; zero schema change, zero migration. |
| `backend/tests/unit/test_template_render.py` | 14 named tests all GREEN (6 render + 2 gate + 1 driver + 3 admission/whitelist tests + 2 from parametrize) | VERIFIED | 14 passed (17 counting test_template_integrity.py items): all VALIDATION.md test names present; no xfail markers remaining. |
| `backend/tests/unit/test_template_integrity.py` | 3 named integrity tests all GREEN | VERIFIED | 3 passed; corrupt_file_never_delivered, autoescape_contains_xml_special_chars, template_input_routes_to_non_jinja_engine all GREEN. |
| `backend/Dockerfile.sandbox` | `docxtpl==0.20.2` in the pinned pip block; NOT in requirements.txt | VERIFIED | Line 52: `docxtpl==0.20.2 \`; grep of `requirements.txt` finds no match; Phase-101 comment present above the line. |
| `backend/tests/fixtures/uat_fixture_ids.json` | `definition_id`, `asset_id`, `storage_path` keys present | VERIFIED | File exists; definition_id `00000000-0000-0000-0000-0000000101a0`, asset_id `d8a54002.../workspace-files` Storage path, workspace_file_id present. |
| OOXML fixtures (4 files) | risk-register.docx, arbitrary-split-token.docx, table-deck.pptx, chart-book.xlsx | VERIFIED | All 4 files exist under `backend/tests/fixtures/templates/`; make_fixtures.py present for deterministic regeneration. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `render_docx_template` | `jinja2.sandbox.SandboxedEnvironment` | `SandboxedEnvironment(autoescape=True)` inside function | WIRED | Line 384 in `template_render_service.py`; also line 1267 in `_RENDER_DRIVER_SRC` driver string. |
| `select_engine("template_input")` | `"run_replace"` (never `"docxtpl"`) | Hard assert `engine != "docxtpl"` | WIRED | Lines 674-678 in `template_render_service.py`; `_RUN_REPLACE_PROVENANCES` frozenset includes `"template_input"`. `test_engine_selection_by_provenance` + `test_template_input_routes_to_non_jinja_engine` GREEN. |
| `_handle_render_template` | `resolve_template_source` + `check_coverage` + `select_engine` | Imports at function scope; called in order before sandbox | WIRED | Lines 1504-1505 import both services; `check_coverage` called at line 1552; `select_engine` called at line 1602. |
| `_handle_render_template` | `sandbox_manager.get_or_create` + `copy_to_runtime` / `copy_from_runtime` | `run_in_threadpool(_ship_and_run)` | WIRED | Lines 1627-1690; three `copy_to_runtime` calls (template bytes, field-map JSON, driver source); `copy_from_runtime` harvest at line 1680. |
| `_handle_render_template` | `ws_write_file` + `workspace_file_written` SSE | Persist + emit only when `verdict.rendered AND verdict.opened` | WIRED | Line 1726 integrity gate; `ws_write_file` at line 1752; `ctx.emit(... 'workspace_file_written' ...)` at line 1770. `test_render_template_integrity_fail_preserves_field_map` confirms ws_write_file is NOT called on integrity failure. |
| `_TOOL_REGISTRY` | `_handle_render_template` | One registry line | WIRED | Line 2271: `"render_template": _handle_render_template`; registry count test asserts 25 entries and `render_template` in `EXPECTED_TOOLS`, GREEN. |
| `phase_types._effective_tools` | `phase_whitelist=frozenset` (both layers) | Declared `render_template` flows through unchanged | WIRED | `_build_phase_tool_context` threads `_effective_tools(phase)` into both `available_tools=_tools` (layer 1) and `phase_whitelist=frozenset(_tools)` (layer 2); `test_fill_phase_admits_render_template` GREEN. |
| `dispatch_tool` whitelist guard | Deep mode no-op | `if ctx.phase_whitelist is not None` at line 2314 | WIRED | Guard is unchanged; `phase_whitelist=None` in Deep → guard not entered → byte-identical. `test_deep_mode_whitelist_none_noop` GREEN. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `_handle_render_template` | `template_bytes` | `resolve_template_source` → Storage download or workspace_files read | Yes — real Storage/DB bytes, user-scoped, expiry-gated | FLOWING |
| `_handle_render_template` | `field_map` | args from LLM tool call (cited Pydantic model) | Yes — emitted by LLM; citation gate validates `retrieved_ids` membership | FLOWING (automated gate verified; live emission is human UAT) |
| `_handle_render_template` | `verdict` (rendered, opened, residual_clean) | Sandbox driver stdout JSON | Yes — driver reads template bytes + field-map, runs real render + integrity re-open | FLOWING (code wiring verified; live sandbox execution is human UAT) |
| `_handle_render_template` | `produced` (file bytes) | `copy_from_runtime("/sandbox/output", ...)` | Yes — real bytes harvested from sandbox; only persisted when `verdict.rendered AND verdict.opened` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 17 named template/integrity tests GREEN | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_template_render.py backend/tests/unit/test_template_integrity.py -q` | 17 passed, 1 warning | PASS |
| Dispatcher registry count = 25, render_template present | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_tool_dispatcher.py -q` | 15 passed, 1 warning | PASS |
| No top-level `import docxtpl` / `from docxtpl` in template_render_service.py or tool_dispatcher.py | grep pattern | 0 matches in both files | PASS |
| `docxtpl==0.20.2` in Dockerfile.sandbox; absent from requirements.txt | grep pattern | Line 52 match in Dockerfile; 0 matches in requirements.txt | PASS |
| `SandboxedEnvironment(autoescape=True)` present in BOTH the service module AND the driver string | grep pattern | template_render_service.py line 384; _RENDER_DRIVER_SRC line 1267 | PASS |
| `select_engine("template_input")` returns `"run_replace"` and hard-asserts it is not `"docxtpl"` | code inspection | Lines 674-678; `assert engine != "docxtpl"` | PASS |
| `ws_write_file` + `workspace_file_written` SSE blocked when integrity gate fails | `test_render_template_integrity_fail_preserves_field_map` | PASS | PASS |
| `threads.py` untouched (G-5) | git diff | No changes to `backend/app/api/threads.py` | PASS |
| dispatch_tool whitelist guard byte-unchanged (Deep no-op) | code inspection line 2314 | `if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist` — unchanged | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TMPL-02 | 101-01, 101-02, 101-03, 101-04, 101-05 | A workflow can fill a template from project-KB content — LLM emits a cited Pydantic field-map (each field nullable, carrying source chunk/page), pinned sandbox code renders deterministically; BOTH trusted (docxtpl/Jinja) and arbitrary-upload (non-Jinja run-replace) paths supported | CODE COMPLETE — mark CLOSED | All automated truths verified. The deterministic core (`template_render_service.py`) + asset resolution (`template_asset_service.py`) + tool integration (`_handle_render_template`) + phase admission (`phase_types.py` whitelist) are fully wired and tested. Live cross-provider fill is human UAT. Per the project multi-plan convention (matching the 099/WFSKILL-01 precedent), TMPL-02 is CLOSEABLE at this phase verification step. |
| TMPL-03 | 101-01, 101-02, 101-04 | A filled template is validated before delivery — re-opened with the same library to assert integrity (corrupt file never delivered); rendering runs inside the sealed sandbox with `jinja2.sandbox.SandboxedEnvironment` (SSTI contained) | CODE COMPLETE — mark CLOSED | `assert_integrity` in both the service module and the driver; `SandboxedEnvironment(autoescape=True)` mandatory on the docxtpl path; `template_input` → `run_replace` (SSTI structurally impossible); `SANDBOX_ENABLED=false` → honest error, no local fallback; `test_corrupt_file_never_delivered` + `test_autoescape_contains_xml_special_chars` + `test_template_input_routes_to_non_jinja_engine` GREEN. TMPL-03 is CLOSEABLE. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no `return null`/`return {}` stubs, no hardcoded empty data flowing to rendering, no console.log-only implementations found in the phase's modified files. The `numeric_hook=None` default in `build_context` is an intentional generic seam (D-11 — the derived-field VALUES are Phase 104 content, documented as such, NOT a stub).

---

### Human Verification Required

The following items require live operator UAT with the rebuilt sandbox image. All 8 are live-execution items, not code gaps.

**Prerequisite for all live items:** Rebuild the sandbox image and bump the env var before running UAT:
```
docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/
```
Then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env`. Use FRESH chats — cached sessions keep the old image until idle eviction (~30 min).

---

#### 1. Cross-Provider Field-Map Emission — Full Native Roster (TMPL-02, SC#10)

**Test:** Run a fill workflow (using the seeded `risk-register-fill-101uat` definition, `uat_fixture_ids.json`) on each of OpenAI / Anthropic / Google / DeepSeek / Moonshot / GLM / MiniMax + OpenRouter. On each: inspect the run log for the cited field-map JSON and confirm the produced file opens without a repair banner.
**Expected:** An openable `.docx` file appears in the workspace output panel for each provider. The run log carries a `render_template` tool result with `status: ok` + the cited field-map. A provider that degrades (e.g. GLM structured-output recovery, DeepSeek truncation) is documented in the run log (pass OR documented, per D-15 / Cond 7).
**Why human:** Live LLM calls per provider; non-deterministic; requires the rebuilt sandbox image + a live KB with content; cross-provider SC#10 4-axis scoreboard.

#### 2. SC#4 Failure Mode #1 — docx Run-Split Silent Miss (Arbitrary Upload Path)

**Test:** Upload `arbitrary-split-token.docx` (the fragmented `{{client_name}}` fixture) as a template input. Run a fill workflow (ephemeral path — no `asset` in tool args). Confirm the produced file contains "Acme Co" (or the KB-sourced value) in place of `{{client_name}}`.
**Expected:** The produced file opens cleanly; the run log shows `residual_tags: []` in the verdict; no `{{client_name}}` token surviving in the document text.
**Why human:** Requires live sandbox render of the docx run-replace path. The unit test (`test_run_merge_replaces_split_token`) covers the deterministic algorithm; end-to-end sandbox execution needs a real Docker container.

#### 3. SC#4 Failure Mode #3 — Produced File Won't Open (Live Integrity Gate + UI Honesty)

**Test:** Force an integrity failure — e.g. use a deliberately corrupt template (truncate the zip to 1 KB). Run a fill workflow. Observe the run panel.
**Expected:** No file appears in the workspace output panel. The run panel shows a specific error naming the integrity failure (not a generic crash). The cited field-map values are visible as fallback output in the run panel (D-08 fallback).
**Why human:** Operator must observe the UI run-honesty surface. The code path is fully wired and tested; the panel render behavior needs a live run.

#### 4. SC#4 Failure Mode #4 — pptx Variable-Row Table Limit

**Test:** Upload `table-deck.pptx` as a template and run a fill workflow with a `collections.rows` in the field-map (more rows than the template's 2). Confirm the result.
**Expected:** Produced pptx opens without a repair banner. The run log's `render_template` verdict carries `documented_limit: "pptx cannot grow tables (python-pptx >=1.0.0)"`. Pass OR explicitly documented (rows do not grow, limit is named).
**Why human:** Requires live sandbox pptx render. The `documented_limit` field is wired in the driver code; confirmation needs a real run with the rebuilt image.

#### 5. SC#4 Failure Mode #5 — xlsx Chart Strip

**Test:** Upload `chart-book.xlsx` as a template and run a fill workflow. Confirm scalars fill and the chart is stripped on save.
**Expected:** Produced xlsx opens. Scalar tokens (e.g. `{{title}}`) are filled. Run log verdict carries `documented_limit: "openpyxl drops charts on save"`. No silent corruption.
**Why human:** Requires live sandbox xlsx render. The `documented_limit` logic is wired in the driver; observable only in a real run.

#### 6. SC#4 Failure Mode #6 — xlsx Merged-Cell Mis-Write

**Test:** Upload `chart-book.xlsx` (which has merged cell `A4:B4` with `{{merged_note}}`). Run a fill workflow that includes a `merged_note` value. Confirm the result.
**Expected:** The merged-cell anchor fills correctly OR the verdict documents the limit. Integrity re-open passes (file opens). No silent corruption.
**Why human:** Requires live sandbox xlsx render. Merged-cell behavior is in the python-docx run-replace path; confirmation needs a real run.

#### 7. Sandbox Isolation Proof

**Test:** With `SANDBOX_ENABLED=true` and the new image: confirm a fill succeeds. Then (optionally) leave a cached session running past 30 min with the old image and attempt a fill — confirm the honest `sandbox_image_stale` error appears.
**Expected:** New chat fills successfully. Stale session surfaces: "The sandbox image is missing docxtpl. Rebuild it … and start a NEW chat."
**Why human:** Requires Docker Desktop + the rebuilt image + a real fill run. The code path for the stale-image error is wired (lines 1696-1705); observation needs a real container.

#### 8. Integrity-Fail UI Surface (D-08 Run Honesty)

**Test:** Force an integrity failure via a corrupt template (see item #3 above). Observe the run panel carefully.
**Expected:** The run panel shows the specific integrity error. Below or alongside the error, the extracted cited field-map (with source_chunk_id, source_doc, source_page for each cited value) is visible as fallback output, preserving the extracted knowledge even though the file was not delivered.
**Why human:** UI run-honesty requires an operator to confirm the panel layout shows the fallback field-map data, not just a generic error toast.

---

### Gaps Summary

No gaps found. Every code-level must-have is delivered and verified:

- `template_render_service.py` is substantive (686 lines), exports all 9 contract symbols, has function-local heavy-lib imports (Pitfall 4 compliant), `SandboxedEnvironment(autoescape=True)` wired, `run_replace_docx` is Jinja-free.
- `template_asset_service.py` resolves both provenance branches with user-scoping, expiry gate, and clean relay-able errors.
- `_handle_render_template` in `tool_dispatcher.py` implements the full D-08 two-gate flow (citation gate BEFORE, integrity gate AFTER), persists only on both-gates-pass, preserves the field-map fallback on failure, and uses `workspace_file_written` SSE verbatim.
- `_RENDER_DRIVER_SRC` is self-contained (no `app.*` imports), has `SandboxedEnvironment(autoescape=True)` on the docxtpl branch, `Document`-only on the run_replace branch, and always prints one JSON verdict line.
- `render_template` is admitted to declaring fill phases via the 099 whitelist pattern with no auto-injection, no Deep widening, and the dispatch guard byte-unchanged.
- 32/32 unit tests (17 template/integrity + 15 dispatcher) pass.
- Red-line invariants confirmed: SSTI structurally impossible on the untrusted path; corrupt file never delivered (gate in handler + `assert_integrity` in driver); Deep mode byte-identical; threads.py untouched (G-5); no `docxtpl` in `requirements.txt`.
- TMPL-02 and TMPL-03 are CODE COMPLETE and ready to mark closed in REQUIREMENTS.md.

The 8 human_verification items are all live-execution UAT items (cross-provider fill, SC#4 named failure modes, sandbox isolation, UI run-honesty surface) that require the operator to rebuild the sandbox image and run real fill workflows. These are not code gaps — the wiring is present and correct. Status is `human_needed`.

---

_Verified: 2026-06-11T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
