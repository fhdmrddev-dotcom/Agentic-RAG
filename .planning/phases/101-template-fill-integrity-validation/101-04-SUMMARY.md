---
phase: 101-template-fill-integrity-validation
plan: 04
subsystem: api
tags: [tool-dispatcher, sandbox, docxtpl, template-fill, render, integrity-gate, citation-gate, workflow, ssr-sse, ooxml]

# Dependency graph
requires:
  - phase: 101-02
    provides: "template_render_service deterministic core (Cited, GenericFieldMap, check_coverage, is_truncated, build_context, render_docx_template, run_replace_docx, residual_tags_in, assert_integrity, select_engine)"
  - phase: 101-03
    provides: "template_asset_service.resolve_template_source — template byte resolution by provenance (library AssetRef vs ephemeral upload)"
  - phase: 100
    provides: "ephemeral kind='template_input' workspace_files + workspace_file_written SSE -> OutputFileCard"
  - phase: 085
    provides: "tool_dispatcher registry-pattern + ToolContext + sandbox substrate (_handle_execute_code shape)"
provides:
  - "render_template agent tool — the integration piece composing Plan 02 + Plan 03 + the sandbox substrate + the workspace persist"
  - "_handle_render_template handler — citation gate BEFORE render + integrity gate AFTER render + persist-only-when-both-pass (D-08 two failure classes)"
  - "_RENDER_DRIVER_SRC — self-contained sandbox render driver shipped into the container via copy_to_runtime"
  - "the G-5 extension contract proof: a new agent tool = handler + one _TOOL_REGISTRY line; threads.py byte-untouched"
affects: [101-05 (phase admission + UAT), 102 (validation-gate library), 104 (PM flagship content pack — numeric_hook values)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LLM produces DATA (the cited field-map = the tool's typed argument), deterministic code in the SEALED sandbox produces the FILE (Pitfall 4)"
    - "Two-gate D-08 contract: citation/coverage gate BEFORE render (rejects without rendering), integrity re-open gate AFTER render (never persists a non-opening file); both return a structured ToolResult the harness bounded-retry loop reads, preserving the cited field-map as fallback"
    - "Sandbox render driver as a module-level SOURCE STRING shipped via copy_to_runtime + run by `python -u` (no docxtpl import in backend/app/**)"
    - "VERBATIM reuse of the workspace_file_written SSE -> OutputFileCard (no new UI surface for the deliverable)"

key-files:
  created: []
  modified:
    - "backend/app/services/tool_dispatcher.py — _handle_render_template + _RENDER_DRIVER_SRC + one _TOOL_REGISTRY line"
    - "backend/tests/unit/test_template_render.py — 3 offline gate/driver tests"
    - "backend/tests/unit/test_tool_dispatcher.py — registry count 24 -> 25 + render_template in EXPECTED_TOOLS (Rule 1)"

key-decisions:
  - "Tasks 1 + 2 committed together in one file commit (the handler references the driver const in the same module — not cleanly separable per-hunk)"
  - "placeholder_keys for the BEFORE-render coverage gate derived from the field-map's own scalar+collection (or flat) keys; the template's exact key set is verified at render time by docxtpl — the load-bearing assertion is the key-list-independent uncited/invented counts"
  - "Sandbox interaction wrapped in run_in_threadpool (D-v2.5-01) — the ship+run+harvest is synchronous blocking I/O via the cached session"
  - "A missing/garbled sandbox verdict is treated as a FAILURE (never persisted) — T-101-04-05"

patterns-established:
  - "G-5 extension contract: tool = handler + one registry line; threads.py + dispatch_tool whitelist guard byte-unchanged"
  - "render-driver-as-source-string: a self-contained app.*-free Python script inlining the Plan-02 pure functions, shipped into the sandbox, never crashes (always prints one JSON verdict line)"

requirements-completed: [TMPL-02, TMPL-03]

# Metrics
duration: 32min
completed: 2026-06-10
---

# Phase 101 Plan 04: render_template Tool Integration Summary

**The `render_template` agent tool — composes the Plan-02 deterministic core + Plan-03 byte resolution + the existing sandbox substrate + the existing workspace persist into one G-5 handler: citation gate BEFORE render, sandbox render via a shipped self-contained driver, integrity re-open gate AFTER render, persist + reuse `workspace_file_written` SSE ONLY when both gates pass — a corrupt file is never delivered.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-06-10T21:38Z (approx)
- **Completed:** 2026-06-10T22:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **`_handle_render_template`** (`tool_dispatcher.py`) — the one integration piece. The LLM emits the cited field-map as the tool's typed argument; the handler runs the D-08 two-gate flow:
  1. **Truncation guard** (`is_truncated`) — a `stop_reason=max_tokens` / `finish_reason=length` emission is rejected (never treat a truncated empty field-map as "no data found").
  2. **Citation/coverage gate BEFORE render** (`check_coverage`, D-08 class 1) — any uncited value or invented citation rejects the call WITHOUT resolving the template or touching the sandbox.
  3. **Resolve bytes by provenance** (`resolve_template_source`) + **select engine** (`select_engine`) — library `AssetRef` -> `docxtpl`, ephemeral upload -> `run_replace`.
  4. **Render in the SEALED sandbox** (`sandbox_manager.get_or_create` + `copy_to_runtime` x3 + `python -u <driver>` + `copy_from_runtime` harvest) — gated on `settings.sandbox_enabled` with an honest error and NO local-venv fallback (TMPL-03); a `ModuleNotFoundError`/missing-docxtpl surfaces the rebuild-the-image error.
  5. **Integrity gate AFTER render** (D-08 class 2) — `verdict.rendered AND verdict.opened` required; a non-opening file is NEVER persisted and the cited field-map is preserved as fallback output.
  6. **Persist + SSE** — `ws_write_file` then VERBATIM `workspace_file_written` emit so `OutputFileCard` renders the deliverable (no new UI), ONLY when both gates pass.
- **`_RENDER_DRIVER_SRC`** — a self-contained sandbox render driver SOURCE STRING. No `app.*` imports (the container has no `backend/app` on its path); imports ONLY the sandbox-image libs (docxtpl / python-docx / python-pptx / openpyxl / jinja2). Inlines `build_context` / `render_docx_template` / `run_replace_docx` / `residual_tags_in` / `assert_integrity`. `SandboxedEnvironment(autoescape=True)` on the docxtpl branch (TMPL-03 — SSTI containment + XML-safe). Never crashes — every exit path prints exactly one JSON verdict line; the integrity re-open infers fmt from the out-path extension and uses the SAME library (`Document` / `Presentation` / `load_workbook`).
- **`_TOOL_REGISTRY`** — one line `"render_template": _handle_render_template`. `threads.py` byte-untouched (G-5); the `dispatch_tool` whitelist guard byte-unchanged (Deep stays byte-identical; the handler is inert unless the model calls `render_template`).
- **No `docxtpl` import in `backend/app/**`** (Pitfall 4) — render is sandbox-only.

## Task Commits

Tasks 1 and 2 landed in one commit (the handler references `_RENDER_DRIVER_SRC` in the same module — not cleanly separable per-hunk):

1. **Task 1 + Task 2: render_template handler + sandbox render driver** — `8e12744e` (feat)

**Plan metadata:** (this commit — SUMMARY + STATE + ROADMAP)

## Files Created/Modified

- `backend/app/services/tool_dispatcher.py` — added `_handle_render_template` (the integration handler), `_RENDER_DRIVER_SRC` (the shipped-into-sandbox render driver), and one `_TOOL_REGISTRY` line.
- `backend/tests/unit/test_template_render.py` — 3 offline tests: `test_render_template_rejects_uncited_before_render` (BEFORE gate short-circuits before resolver/sandbox — poisons both so a reject is the only pass), `test_render_template_integrity_fail_preserves_field_map` (AFTER gate -> `status=failed` + `field_map` fallback + `ws_write_file` never called), `test_render_driver_is_self_contained` (driver compiles + `app.*`-free + autoescape + the three integrity loaders + a single JSON verdict).
- `backend/tests/unit/test_tool_dispatcher.py` — registry count assertion 24 -> 25 + `render_template` added to `EXPECTED_TOOLS` (Rule 1, see Deviations).

## Decisions Made

- **Single commit for both tasks** — the handler and the driver const live in the same module and the handler depends on the const; per-hunk separation would split a coherent unit.
- **Coverage-gate `placeholder_keys`** derived from the field-map's own keys (the uncited/invented counts the gate rejects on are key-list-independent; the template's exact key set is enforced by docxtpl at render time).
- **`run_in_threadpool` around the whole ship+run+harvest** — the sandbox session API is synchronous blocking I/O (D-v2.5-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the registry-count assertion in test_tool_dispatcher.py (24 -> 25)**
- **Found during:** Task 1 (the required `_TOOL_REGISTRY` addition)
- **Issue:** `test_tool_dispatcher.py::test_registry_has_exactly_24_entries` hard-asserts `len(_TOOL_REGISTRY) == 24`. Adding the mandated `render_template` registry line (the plan's explicit requirement + an acceptance criterion) makes the registry 25 entries, so the count test failed. This failure is DIRECTLY caused by the current task's required change (not pre-existing rot) — confirmed by stash-at-base (the test was 15/15 green at baseline with 24 tools).
- **Fix:** Renamed the test to `test_registry_has_exactly_25_entries`, updated the assertion to `== 25`, added `"render_template"` to `EXPECTED_TOOLS`, and updated the two doc-comments. Same convention prior phases used when adding tools (085 moved this count 21 -> 24).
- **Files modified:** `backend/tests/unit/test_tool_dispatcher.py`
- **Verification:** `test_tool_dispatcher.py` 15/15 green; the count + expected-tools + callable tests all pass.
- **Committed in:** `8e12744e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a count assertion invalidated by the required registry addition).
**Impact on plan:** The fix is the correct in-scope update for the mandated registry line. No scope creep — `test_tool_dispatcher.py` was not in the plan's `files_modified`, but the change to it is the direct, necessary consequence of the plan's own acceptance criterion (one registry line).

## Issues Encountered

- **`os.splitext` AttributeError** during the first test run — `import os as _os_local` exposes `_os_local.path.splitext`, not `_os_local.splitext`. Fixed to `_os_local.path.splitext` and removed a dead `out_fmt` local (the driver infers fmt internally from the out-path extension). Re-ran: all 3 new tests green.

## Threat surface scan

No new security surface beyond the plan's `<threat_model>`. The handler adds NO new network endpoint, NO new auth path, NO schema change. The produced file lands in the WORKSPACE via the existing `ws_write_file` (which applies `validate_path`), never the KB (CLAUDE.md ingestion-manual-only NOT violated). All seven planned STRIDE threats (T-101-04-01..07) are mitigated:
- T-101-04-01 (render in sandbox) — `sandbox_manager.get_or_create` + driver shipped via `copy_to_runtime`; no docxtpl in `backend/app/**`; `SANDBOX_ENABLED=false` -> honest error, no local-venv fallback.
- T-101-04-02 (citation gate) — `check_coverage` runs BEFORE render; uncited/invented -> reject without rendering.
- T-101-04-03 (integrity gate) — `assert_integrity` re-opens in the sandbox; `opened=False` -> never persisted; honest error + field-map fallback.
- T-101-04-04 (engine selection) — `select_engine` routes `template_input` -> `run_replace` (non-Jinja); the untrusted upload never reaches Jinja in the driver.
- T-101-04-05 (verdict parse) — a missing/garbled/non-`opened` verdict is a FAILURE (never persists); a `ModuleNotFoundError` surfaces the rebuild-image error.
- T-101-04-06 (produced file path) — `ws_write_file` applies `validate_path`; the file lands in the workspace.
- T-101-04-07 (G-5 hot file) — `render_template` is a tool (handler + one registry line); `threads.py` byte-unchanged (`git diff --stat` empty).

## Known Stubs

None — the handler is fully wired (real resolver, real sandbox ship/run/harvest, real persist + SSE). No hardcoded empty values flow to the UI; no placeholder text. The render driver is complete inline code.

## TDD Gate Compliance

This plan is `type: execute` (not `type: tdd`). The two offline gate tests + the driver test were added alongside the implementation in the same commit. The full sandbox render + cross-provider field-map emission stay LIVE UAT (101-VALIDATION.md Manual-Only) — not duplicated as automated tasks.

## Next Phase Readiness

- **Plan 101-05** (phase admission + UAT) can wire `render_template` into the fill-phase tool whitelist and author the live UAT rows. The render tool is callable from BOTH workflow fill phases AND Deep chat (the "AI colleague" value, D-01).
- **Operator setup before live UAT** (already noted in STATE.md from Plan 01): rebuild + bump the sandbox image — `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/` then `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env` (NEW chats only; cached sessions keep the old image until idle eviction). Without docxtpl in the image, the handler returns the honest `sandbox_image_stale` error.
- **TMPL-02 / TMPL-03 stay OPEN in REQUIREMENTS.md** — the render tool landed, but the end-to-end fill behavior (live sandbox render + phase admission Plan 05 + cross-provider UAT) is not yet observable; the requirements mark complete at phase verification (the 099/WFSKILL-01 multi-plan convention).

## Self-Check: PASSED

- FOUND: `.planning/phases/101-template-fill-integrity-validation/101-04-SUMMARY.md`
- FOUND: `backend/app/services/tool_dispatcher.py`
- FOUND: `backend/tests/unit/test_template_render.py`
- FOUND: `backend/tests/unit/test_tool_dispatcher.py`
- FOUND commit: `8e12744e` (feat(101-04): add render_template agent tool + sandbox render driver)

---
*Phase: 101-template-fill-integrity-validation*
*Completed: 2026-06-10*
