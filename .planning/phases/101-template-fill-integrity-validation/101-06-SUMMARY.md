---
phase: 101-template-fill-integrity-validation
plan: 06
gap_closure: true
subsystem: api
tags: [template-fill, docxtpl, harness, tool-schema, command-injection, sandbox, openai-tools]

# Dependency graph
requires:
  - phase: 101 (Plans 02-05)
    provides: template_render_service deterministic core, template_asset_service byte resolver, render_template handler + driver, harness fill-phase whitelist wiring
provides:
  - render_template tool schema (RENDER_TEMPLATE_TOOL) reaching the model on a declaring fill phase (WR-01)
  - success-path persistence (leading-slash workspace path) for renders passing both gates (WR-02)
  - command-injection-safe out_filename (strict OOXML basename + shlex-quoted argv) (CR-01)
  - residual-token-aware integrity gate (blocks silent half-fills) (WR-03)
  - drift-free sandbox driver _replace_in_paragraph (mirrors audited production helper) (WR-04)
  - happy-path + visibility test coverage that was missing
affects: [Phase 102 (template-fill generalization), live UAT scoreboard, secure-phase 101]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Harness layer-1 tool-schema injection: augment apply_tool_budget candidate list with a tool schema ONLY when the phase whitelists it (Deep get_tools() stays byte-identical)"
    - "Defense-in-depth on model-controlled filenames: strict allow-list basename + shlex.quote every argv token + safe-default fallback"

key-files:
  created:
    - .planning/phases/101-template-fill-integrity-validation/101-06-SUMMARY.md
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/fixtures/seed_library_asset.py
    - backend/tests/fixtures/uat_fixture_ids.json
    - backend/tests/unit/test_template_render.py

key-decisions:
  - "RENDER_TEMPLATE_TOOL is NEVER added to get_tools() — Deep Mode stays byte-identical; the harness injects it into tools_override only when the fill phase whitelists it"
  - "CR-01 chose a SAFE DEFAULT (deliverable.<ext>) over a structured reject for a bad out_filename — keeps the happy path working; a cosmetic bad name never fails the whole render"
  - "WR-04 unified the driver helper as a verbatim behavioral copy of the production _replace_in_paragraph (IR-01) so the two cannot drift"
  - "Seeder is now DELETE-then-INSERT idempotent for a stale published fixture row (the immutability trigger is BEFORE-UPDATE only)"

patterns-established:
  - "Two-layer tool admission: layer 1 = the SCHEMAS the model sees (apply_tool_budget over get_tools()+schema-when-whitelisted); layer 2 = the dispatch backstop (ToolContext.available_tools / phase_whitelist)"

requirements-completed: []

# Metrics
duration: ~75min
completed: 2026-06-11
---

# Phase 101 Plan 06: Template-Fill Gap Closure Summary

**Fixed the 5 confirmed code-review findings that made render_template non-functional end-to-end (no tool schema, success-path persist failure) and carried a command-injection — the tool now reaches the model on a declaring fill phase, a passing render persists, a malicious out_filename is sanitized, a silent half-fill is blocked, and the sandbox driver no longer drifts from the audited helper.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-10T22:54:39Z
- **Completed:** 2026-06-11
- **Tasks:** 5 findings + seed fixture + tests (7 atomic commits)
- **Files modified:** 6

## Accomplishments

- **WR-01 (BLOCKER):** Added the `RENDER_TEMPLATE_TOOL` function-schema and wired it into the harness per-phase `tools_override` (via the shared `_phase_tools_override` helper) so the model finally SEES the tool on a declaring fill phase. Deep Mode stays byte-identical (`get_tools()` body unchanged; schema absent from its return).
- **WR-02 (BLOCKER):** Renders passing both gates now persist — the workspace path is normalized to a leading slash before `ws_write_file` (was a bare basename → `PathValidationError` → silent `persist_failed`).
- **CR-01 (SECURITY):** `out_filename` is coerced to a strict OOXML basename and the sandbox command is built argv-safely (`shlex.quote` every token; engine whitelisted) — the model-controlled, prompt-injectable filename can no longer reach the shell.
- **WR-03 (correctness):** The AFTER-render integrity gate now consults `residual_clean` — a file that opens but still contains surviving `{{tokens}}` (a silent non-fill) is blocked, with `residual_tags` surfaced for the harness retry loop.
- **WR-04 (correctness / IR-01):** The sandbox driver's `_replace_in_paragraph` is now a verbatim behavioral mirror of the audited production helper (`touched = matched or (blanked_text != replaced_text)`), so a matched token whose net text equals the original is coalesced instead of surviving.
- Updated the seeded UAT fixture to declare `available_tools: [search_documents, render_template]` and re-ran it against the live local stack.
- Closed the test gap that let WR-01/WR-02 ship green — added happy-path + visibility coverage for all 5 findings.

## Task Commits

1. **WR-01 — render_template schema → harness tools_override** - `6c5424d2` (fix)
2. **CR-01 + WR-02 — sanitize out_filename + argv-quote cmd; leading-slash persist** - `1cd8fb21` (fix)
3. **WR-03 — integrity gate consults residual_clean** - `037280e5` (fix)
4. **WR-04 — driver _replace_in_paragraph mirrors production touched-logic** - `19aefacb` (fix)
5. **Seed fixture declares render_template in available_tools (+ re-run)** - `cc0a59ff` (fix)
6. **Happy-path + visibility tests for the 5 fixes** - `bade0db2` (test)

**Plan metadata:** _(final docs commit — SUMMARY + STATE + ROADMAP)_

## Files Created/Modified

- `backend/app/services/openai_service.py` - Added `RENDER_TEMPLATE_TOOL` + `_build_render_template_tool()` (built from `build_field_map_tool_schema([])`; Pitfall 4 safe). `get_tools()` body UNCHANGED.
- `backend/app/services/harness/phase_types.py` - Added `_phase_tools_override` (candidate-list augmentation when whitelisted), wired into `_exec_llm_agent` + `_exec_llm_batch_agents`, corrected the misleading `_effective_tools` docstring (two-layer mechanism).
- `backend/app/services/tool_dispatcher.py` - `_safe_out_filename` + `_SAFE_OUT_FILENAME_RE` + `_VALID_RENDER_ENGINES` (CR-01); argv-safe command via `shlex.quote` (CR-01); leading-slash `ws_path` before persist (WR-02); `residual_clean` in the integrity gate + `residual_tags` payload (WR-03); driver `_replace_in_paragraph` mirrors production (WR-04).
- `backend/tests/fixtures/seed_library_asset.py` - Fill phase declares `available_tools`; seeder is DELETE-then-INSERT idempotent for stale published rows; read-back asserts `render_template` present.
- `backend/tests/fixtures/uat_fixture_ids.json` - Regenerated by the seed re-run.
- `backend/tests/unit/test_template_render.py` - 6 new gap-closure tests (schema visibility, harness override, success persist, injection, residual gate, driver coalesce).

## Decisions Made

- **Deep byte-identical preserved structurally:** the render schema is injected into the harness `tools_override` candidate list (when whitelisted) BEFORE `apply_tool_budget`, never into `get_tools()`. Verified `get_tools()` does not appear in the openai_service diff (function body unchanged) and `render_template` is absent from its return.
- **CR-01 chose the safe-default path** over a structured reject for a bad filename (least-surprising; documented in the handler docstring).
- **Driver/production unification (IR-01):** rather than patch the driver guard in isolation, the driver helper now mirrors the production `touched` logic verbatim so the two source-of-truth copies cannot diverge again.

## Deviations from Plan

None beyond the explicitly-scoped fixes. Two notes:

- The plan suggested either a safe-default OR a structured reject for CR-01 — chose the safe default (documented).
- The seed fixture's idempotency had to be upgraded from `ON CONFLICT DO NOTHING` to DELETE-then-INSERT to actually refresh a STALE published row (the immutability trigger is BEFORE-UPDATE only, so DELETE is permitted). Without this, a re-run would have kept the old config and the live UAT would still see render_template unadmitted.

## Issues Encountered

- **Pre-existing rot (NOT net-new):** `backend/tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts` fails — confirmed identical failure at the pre-101-06 base of the touched files (a `KeyError: 'tool_call_id'` in `harness_engine.py`'s ask_user expiry cleanup, unrelated to this plan's changes). This is part of the documented SEED-056 rot.

## Red-Line Compliance

- **Deep Mode byte-identical:** `get_tools()` body unchanged (not in diff); `render_template` absent from `get_tools()` (verified programmatically + by `test_render_template_schema_reaches_model_when_whitelisted`).
- **Shared provider gateway not branched:** the field-map emission rides the unmodified gateway; no per-provider branch added.
- **Pitfall 4 intact:** no docxtpl/python-docx import at any backend module top — the schema build uses only `GenericFieldMap.model_json_schema()`; heavy libs stay function-local / in the driver string.
- **threads.py untouched (G-5):** not modified.

## Seed Re-Run Status

Re-ran `backend/tests/fixtures/seed_library_asset.py` against the live local stack (Postgres :54322 / Storage :54321 both up). The published fixture row `00000000-0000-0000-0000-0000000101a0` now carries `available_tools: ["search_documents", "render_template"]` (verified via psycopg2 read-back). Ready for live UAT.

## Test Results

- Target suites (`test_template_render.py` + `test_template_integrity.py` + `test_tool_dispatcher.py`) + `test_harness_whitelist.py`: **46 passed, 0 failed.**
- 6 new gap-closure tests all green.
- Net-new full-suite failures: **0** (the single harness_gates failure is pre-existing SEED-056 rot, proven by reverting the touched files to base).

## Next Phase Readiness

- The render_template feature is now functional end-to-end on the agent path (schema reaches the model, success persists, gates enforce integrity + residual cleanliness, injection surface closed).
- Live cross-provider UAT can proceed against the re-seeded fixture (the scoreboard's 4-axis bandwidth — see 101-VALIDATION.md).
- secure-phase 101 should re-confirm CR-01 (command injection) is CLOSED with the argv-quote + basename allow-list.

## Self-Check: PASSED

- Created file exists: `.planning/phases/101-template-fill-integrity-validation/101-06-SUMMARY.md` (this file)
- All 6 task commits present in `git log` (6c5424d2, 1cd8fb21, 037280e5, 19aefacb, cc0a59ff, bade0db2)
- Target test suites green (46 passed)
- Seed re-run confirmed via DB read-back
- Deep byte-identical confirmed (get_tools unchanged in diff; render_template absent from get_tools())

---
*Phase: 101-template-fill-integrity-validation*
*Completed: 2026-06-11*
