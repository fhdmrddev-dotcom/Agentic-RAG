---
phase: 273-agent-authored-artifacts
plan: 03
subsystem: agent-tools
tags: [tool-dispatcher, openai-schema, pydantic, sse, closed-core, artifacts]

requires:
  - phase: 273-01
    provides: "models/artifact.py (validate_args, validate_dataset, refusal catalogue, RESULT_ID_KEY), db/artifacts.py (insert_artifact, get_artifact_by_ref, list_thread_labels), ToolContext.turn_tool_calls"
provides:
  - "backend/app/services/show_artifact_tool.py — handle_show_artifact, apply_transforms, build_caption, inherit_slots, build_result, DATA_BEARING_TOOLS"
  - "openai_service.SHOW_ARTIFACT_TOOL (+ D-11 guidance in its description) and CHAT_ONLY_TOOLS"
  - "the 30th _TOOL_REGISTRY entry, the _SUB_AGENT_EXCLUDED token, the grounding-offer subtraction"
affects: [273-04, 273-05, 273-06]

tech-stack:
  added: []
  patterns:
    - "Handler module per tool (the 272 search_documents_tool.py narrow cut): dispatcher keeps one import + one registry line"
    - "Emit the INSERT…RETURNING row unchanged as the SSE payload (live == reload by construction)"
    - "Id-first tool result, shrunk (values → columns → minimal) until < 2000 chars"

key-files:
  created:
    - backend/app/services/show_artifact_tool.py
    - backend/tests/unit/test_273_show_artifact_tool.py
    - backend/tests/unit/test_273_tool_wiring.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/harness/grounding.py
    - backend/tests/unit/test_085_tool_registration.py
    - backend/tests/unit/test_255_extension_contract_guard.py
    - backend/tests/unit/test_259_closed_core_inventory.py
    - backend/tests/unit/test_261_closed_core_inventory.py
    - backend/tests/unit/test_267_handoff.py
    - backend/tests/unit/test_267_tool_floor_union.py
    - backend/tests/unit/test_272_search_tool_move.py
    - backend/tests/unit/test_tool_dispatcher.py

key-decisions:
  - "Handler-only refusal reasons (only available in chat / {ref} isn't in this thread / that artifact isn't in this thread / the filter matched 0 of N rows / couldn't read that artifact / couldn't save the artifact) live in a closed _HR table in the handler module; every other reason comes from the 273-01 catalogue via its _refusal/_safe helpers"
  - "Caption sources are deduplicated on (tool, document, page); source_count counts the distinct facts before the 10-item cap"
  - "A new series name takes the lowest slot the PARENT did not use, falling back to the lowest free slot in the new chart"
  - "area is always stored stacked; other kinds store stacked = the call's value (None → false)"
  - "same_rows = no filter ran AND row count unchanged AND top_n did not narrow; select and sort alone keep same_rows true"

requirements-completed: []
requirements-contributed: [ART-01, ART-02, ART-03, ART-04]

duration: ~55min
completed: 2026-10-03
---

# Phase 273 Plan 03: show_artifact tool Summary

**The agent's `show_artifact` tool, end to end on the backend: its own handler module (belt → closed-vocabulary validation → first emission or by-reference re-encode of the stored rows → server-built caption → one insert → one `artifact` SSE event carrying the RETURNING row → an id-first result under 2,000 chars), its schema and D-11 guidance in `openai_service.py`, one registry line, and the chat-only fence — the closed core moved 29 → 30 by exactly this one counted tool.**

## Base

Worktree started on `master` (`86d9559bb`, the known quirk) and was reset to the orchestrator's
wave-1 merge SHA `a692f5cc829d6eab5cf239834095a619b14bce43` before any edit. Bootstrapped
(venv + node_modules junctions, env copies).

## Counts before / after (measured by `len`)

| Measure | PHASE_BASE | After |
|---|---|---|
| `_TOOL_REGISTRY` | 29 | **30** |
| `get_tools` web/sandbox off (self-improve default on) | 25 | **26** |
| `get_tools` every gate on | 28 | **29** |
| `get_tools` all three off | 23 | **24** |
| harness authoring offer (`GroundingBundle.tools`, every gate on) | 28 | **28** (show_artifact subtracted) |
| `get_explorer_tools()` | unchanged | unchanged (no show_artifact) |
| `SYSTEM_PROMPT` | — | byte-identical to PHASE_BASE (AST-extracted from `git show f76473497:…agent_loop.py`) |

`python -c "from app.services.tool_dispatcher import _TOOL_REGISTRY as R; print(len(R))"` → `30`.

## Every count-pin line edited (Task 2 step 5)

`grep -rn "== 29\|== 28\|== 25" backend/tests/unit` was run first; every hit was inspected and only
tool-count pins were edited (the others are byte caps, page sizes, IP corpora, audit-event counts —
untouched; `test_module7_tools.py` / `test_explorer_agent.py` untouched, they are in the frozen 71).

| File | Line(s) | Change |
|---|---|---|
| `test_259_closed_core_inventory.py` | :39-42 (docstring + assert + message) | 29 → 30, Phase 273 comment |
| `test_259_closed_core_inventory.py` | :114 | `len(tool_dispatcher._TOOL_REGISTRY) == 30` |
| `test_261_closed_core_inventory.py` | :40-43 (docstring + assert + message) | 29 → 30, Phase 273 comment |
| `test_267_handoff.py` | :411 | 29 → 30 |
| `test_267_tool_floor_union.py` | :408 | 29 → 30 |
| `test_272_search_tool_move.py` | :73 | 29 → 30 |
| `test_tool_dispatcher.py` | :63-75 (test renamed `…_exactly_30_entries`, docstring, assert) + `EXPECTED_TOOLS` gains `show_artifact` | 29 → 30 |
| `test_085_tool_registration.py` | :280-283, :285-290 | `get_tools` 25 → 26 and 28 → 29 |
| `test_255_extension_contract_guard.py` | `expected_tools` set | gains `"show_artifact"` with a Phase 273 comment |

## The description text (D-11, 1,615 chars ≤ 3,000)

> Show the user an interactive chart, table or single metric, rendered below your answer. Use when: you have numbers worth seeing in the chat (a trend, a comparison, a breakdown, one headline figure) — call this instead of drawing a chart with code. Do not use for: a FILE the user asked for (a PNG, an image, a chart 'for the deck' or 'for the report') — use execute_code for that. Data: `columns` [{name, type: number|string, unit?}] plus `rows`, one cell per column. Pass bare numbers (1234.5, not "$1,234" or "12%"); units go in the column's `unit`. Max 500 rows and 20 columns: aggregate first if you have more. chart: {kind: line|bar|area|scatter, x: <a column>, y: [<number columns>], stacked?} — at most 4 series (scatter 3); no pie, use a bar chart or a table for parts of a whole. metric: {value_column, compare_column?, label?, compare_label?} over exactly one row. table: columns and rows only. To change, filter, sort or redraw an artifact you already showed ("make it a bar chart", "only Q3", "top 5"), call again with from_artifact=<its artifact_id or label, e.g. "chart 1"> and NO columns or rows; add transform {filter: [{column, op: eq|in|range, value|values|min|max}], sort: {column, direction}, top_n, select: [columns]} to narrow it. The stored values are reused exactly; nothing is re-fetched. After the call, write one or two sentences about what it shows. Example: {"component":"chart","title":"Revenue by quarter","columns":[{"name":"quarter","type":"string"},{"name":"revenue","type":"number","unit":"$K"}],"rows":[["Q1",120],["Q2",135]],"chart":{"kind":"bar","x":"quarter","y":["revenue"]}}

The example is parsed out of the description and fed to `validate_args` by the wiring suite.

## The success result's note (RESEARCH OQ2 — resolved here)

`Shown to the user below your answer as {label}. Now write one or two sentences about what it shows; do not repeat its numbers as a table. To change, filter, sort or redraw it later, call show_artifact again with from_artifact="{id}" (or "{label}") and NO columns or rows.`

## OWED — OV-273-02

The full registry/handler split of `tool_dispatcher.py` is **still owed** (272 named it for 273; 273
took only the narrow cut — one import, one registry line, one `_SUB_AGENT_EXCLUDED` token).
**Re-open trigger:** the next phase whose `files_modified` names `tool_dispatcher.py` proposes the
extraction FIRST. Recorded in `show_artifact_tool.py`'s docblock and on the import line.

## Task Commits

1. **Task 1 RED** — `65a7be348` test(273-03): failing tests for the show_artifact handler
2. **Task 1 GREEN** — `dcb66d247` feat(273-03): show_artifact handler module
3. **Task 2 RED** — `b6777d44a` test(273-03): failing tests for show_artifact wiring and counts
4. **Task 2 GREEN** — `fe668bc24` feat(273-03): wire show_artifact — schema, one registry line, chat-only exclusions, count pins

## Verification

- Plan verify set (15 files: both new suites, eight pin suites, `test_075_5_google_native`,
  `test_103_grounding_fidelity`, `test_115/116_tool_wiring`, `test_151_registration`) → **224 passed**.
- Other suites that read the tool set: 14 unit files → **213 passed**; `tests/test_147_flag_hide`,
  `test_147_flag_refuse`, `test_129_openrouter_require_params`, `test_182_grounding_bundle`,
  `test_harness_whitelist`, `test_tool_budget` → **44 passed**.
- Acceptance greps: no module-level dispatcher import in `show_artifact_tool.py`;
  `grep -c '"error"'` → **0**; no retrieval / sandbox / sql import and no `execute_code(` call.
- `git diff a692f5cc8 -- tool_dispatcher.py`: **3** added non-comment lines (import, registry line,
  exclusion token). `git diff a692f5cc8 -- agent_loop.py` → empty.
- `grep -c CHAT_ONLY_TOOLS harness/grounding.py` → 2.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/273-agent-authored-artifacts` → `ledger gate OK`.
- Backend gate at `fe668bc24` (`node ../scripts/check-backend-unit-baseline.cjs`), verbatim:
  `71 failed, 6640 passed, 1 skipped, 2 xfailed, 2 xpassed, 48 warnings in 440.78s (0:07:20)` /
  `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).`
  The failed SET was `diff`ed against `273-BASELINES.md` §(a) (both sorted, 71 ids each): the only
  diff line is `test_retrieval_service.py::TestSearchDocuments::test_joins_results_with_documents_table`,
  which appears in this run with a `RuntimeWarning` path glued onto the end of its id — the
  interleaving artifact BASELINES already records (it moves between ids run to run). Same 71 tests;
  **SET ⊆ baseline holds**. passed 6585 (273-01 head) → 6640 = **+55**, this plan's two new suites
  (41 + 14).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, own test] the plan's worst-case result dataset cannot be stored**
- **Found during:** Task 1 GREEN.
- **Issue:** "500 rows × 20 columns of 200-char strings" is ~2 MB; `validate_args` correctly refuses
  it at the 256 KiB store cap, so the handler can never reach `build_result` with it.
- **Fix:** the < 2000 assertion is driven on `build_result` directly with that dataset (plus 50
  200-char `filter_in` values in `operations` — a strictly worse case than any reachable one), and a
  second test drives the handler with the largest storable 500 × 20 table. Both assert < 2000 and the
  id-first key. Committed in `dcb66d247` alongside the RED-suite fix below.

**2. [Rule 1 - Bug, own test] `AsyncMock(side_effect=<callable instance>)` never awaited the fake**
- AsyncMock awaits a side_effect only when it recognises a coroutine *function*; the fake store's
  async `__call__` was passed as the instance. Fixed to `side_effect=store.__call__` (commented).

**3. [Rule 2 - correctness] failed calls are not caption sources even when their status reads `done`**
- `agent_loop` persists every dispatched call with `status: "done"`, so "status != done" alone
  cannot exclude a failure. `_call_failed` also reads the result: a JSON object with an error key, a
  `status` in {error, refused, failed, timeout, cancelled}, a non-zero `exit_code`, or the
  dispatcher's plain-text failure forms (`Error…`, `Could not …`, `… not found.`).

**4. [Discretion] small choices, recorded so they are not mistaken for the plan**
- `show_artifact` is appended to the ungated base list immediately after `ask_user` (pinned by
  `test_show_artifact_follows_ask_user`).
- The handler also refuses "only available in chat" when `current_user["id"]` or `thread_id` is
  missing or not a UUID (same belt).
- `read_document` and the search tools are named by tool only in the caption (their args carry an
  id or a query, not a document name); `query_tables.document_name`/`page` and
  `analyze_document.filename` supply document/page.
- The stored spec is round-tripped through `StoredArtifactSpec` before insert (a belt; a failure is
  the catalogue fallback refusal, never a 500).

## Observations (not this plan's to fix)

- `tests/test_093_glm_max_steps.py` / `tests/test_096_ci_workflow_regression.py` (outside the gate
  `tests/unit`) did not finish inside 120 s in a combined run; neither pins a tool count (grepped).
- Harness phases reach `show_artifact` in no path: their `ToolContext` always carries
  `parent_run_id` and a non-None `phase_whitelist` (task_service.py:561/614, phase_types.py:660), and
  the authoring offer no longer lists it, so the publish fidelity rule rejects it by name.

## Known Stubs

None. `ctx.turn_tool_calls` is still `None` on every caller until 273-04 wires it; the caption then
reads "values provided by the agent" — by design.

## Threat Flags

None beyond the plan's register: no new endpoint; the one new data path (by-reference read) is
bound to thread + caller (T-273-14) and tested.

## TDD Gate Compliance

RED `65a7be348` → GREEN `dcb66d247` (Task 1: collection failed on the missing module);
RED `b6777d44a` → GREEN `fe668bc24` (Task 2: 11 failed, 3 passed — the three that passed are the
explorer exclusion, the offer-stays-28 guard and the SYSTEM_PROMPT pin, all of which hold at base by
design and are regression guards).

## Self-Check: PASSED

`git diff --name-only a692f5cc8 HEAD` lists exactly the plan's 14 `files_modified` (3 created, 11
modified); commits `65a7be348`, `dcb66d247`, `b6777d44a`, `fe668bc24` present in `git log`.
STATE.md / ROADMAP.md / agent_loop.py / frontend untouched.
