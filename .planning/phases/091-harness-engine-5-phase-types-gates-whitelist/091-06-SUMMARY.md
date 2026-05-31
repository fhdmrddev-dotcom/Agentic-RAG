---
phase: 091-harness-engine-5-phase-types-gates-whitelist
plan: 06
subsystem: harness-enforcement
tags: [harness, whitelist, tool-budget, cross-provider, tool-dispatcher, config, openai-service]

# Dependency graph
requires:
  - phase: 091
    plan: 01
    provides: make_tool_context fixture carrying phase_whitelist + LlmAgentPhaseConfig.available_tools
provides:
  - "ToolContext.phase_whitelist (frozenset|None) + the single dispatch_tool() whitelist guard (HARNESS-05): out-of-phase tool refused with the D-04 guiding tool_result + D-06 tool_refused audit; None = Deep Mode literal no-op"
  - "openai_service.apply_tool_budget(schemas, model, whitelist): D-05 layer-1 whitelist filter + TOOL-05 per-provider max_tools cap (whitelist tools always retained); pure function for the harness executor (Plan 03)"
  - "max_tools field on the ModelCapability registry (absent = no cap) with all 7 Google/Gemini rows populated at 16 (SEED-035)"
affects: [091-03 phase executors (call run_task_sub_agent with allowed_tools + apply_tool_budget for tools_override)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single provider-agnostic enforcement site: whitelist guard at the TOP of dispatch_tool() (above _TOOL_REGISTRY.get), below all provider streaming branches — refusal is a ToolResult.result string (zero provider-branch edits)"
    - "None == Deep Mode == literal no-op: both the dispatch guard and apply_tool_budget skip entirely when phase_whitelist is None, preserving the Phase 089 byte-identical invariant"
    - "Soft ceiling yields to structural requirement: the TOOL-05 budget drops lowest-priority (assembly-order) tools first but NEVER a whitelisted tool"

key-files:
  created: []
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/openai_service.py
    - backend/app/config.py
    - backend/tests/test_harness_whitelist.py
    - backend/tests/test_tool_budget.py

key-decisions:
  - "apply_tool_budget is NOT wired into any Deep-Mode get_tools() call site in 091 — it is invoked only from the harness executor (Plan 03, phase config present). Google's max_tools=16 ceiling therefore applies only on the harness path; Explorer/General/Deep-Mode tool sets including Google stay byte-identical (SC#2)."
  - "max_tools=16 chosen as a conservative SEED-035 Google ceiling; absent-when-unregistered = no cap (the budget is a soft ceiling firing only for registered low-limit models)."
  - "_spawn_tool_refused_audit fire-and-forgets via ctx.spawn(write_audit(...)) and NEVER blocks the refusal — a missing pool/run_id, unset spawn, or failing spawn is swallowed (the clean refusal is the point); write_audit imported lazily inside the helper to avoid a load-time cycle."
  - "The 'retain whitelist while dropping non-whitelist fillers at the cap' drop-protection is defensive: with a whitelist set, stage-1 filtering already removes non-whitelist schemas, so the only live over-cap path is a whitelist larger than max_tools (all whitelist tools kept + a warning logged)."

requirements-completed: [HARNESS-05, TOOL-05]

# Metrics
duration: 5min
completed: 2026-05-31
---

# Phase 091 Plan 06: Per-Phase Tool-Whitelist Enforcement + Tool-Count Budget Summary

**Landed HARNESS-05 (a locked workflow phase refuses out-of-whitelist tool calls at the single provider-agnostic dispatch_tool() entry with a guiding D-04 tool_result + D-06 audit) and TOOL-05 (apply_tool_budget filters get_tools to the phase whitelist then caps at a per-provider max_tools soft ceiling), both literal no-ops in Deep Mode so Explorer/General — including Google — stay byte-identical.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-31T05:19:05Z
- **Completed:** 2026-05-31T05:23:36Z
- **Tasks:** 2
- **Files modified:** 5 (3 source + 2 test)

## Accomplishments

- **HARNESS-05 dispatch guard (Task 1):** Added `phase_whitelist: frozenset[str] | None = None` to the `ToolContext` dataclass (purely additive, last field, default None — no caller breaks) and ONE guard at the top of `dispatch_tool()`, above `_TOOL_REGISTRY.get`. When `phase_whitelist is not None` and the tool is outside it, dispatch returns the D-04 guiding `ToolResult` (`{"error":"tool_not_available_in_phase","tool":...,"allowed":[...],"message":"...Available tools here: [...]"}`) and fires a D-06 `tool_refused` audit via `_spawn_tool_refused_audit`. `None` (Deep Mode) skips the branch entirely → byte-identical to pre-091 dispatch. Zero provider-branch edits (Pitfall 3); the loop attaches the matching `tool_call_id` itself (Pitfall 4).
- **TOOL-05 budget + registry (Task 2):** Added `max_tools: int` to the `ModelCapability` TypedDict (`total=False` → absent = no cap) and populated all 7 Google/Gemini rows with `max_tools: 16` (SEED-035 conservative ceiling). Added the pure `apply_tool_budget(schemas, model, whitelist)` helper to `openai_service.py`: stage 1 = D-05 layer-1 whitelist filter (model only SEES allowed tools, skipped when `whitelist is None`); stage 2 = TOOL-05 cap reading `MODEL_CAPABILITIES[model].max_tools` — drops lowest-priority (assembly-order) non-whitelist tools first, ALWAYS retains whitelist tools, logs a warning if the whitelist alone exceeds the cap. Order preserved throughout. NOT wired into any Deep-Mode `get_tools()` call site — the harness executor (Plan 03) is the sole caller.
- **16 live contracts** (7 whitelist + 9 budget) flipped from Wave-0 skips to passing, covering refused-clean, in-whitelist-passes, None-no-op, audited, audit-failure-non-blocking, field-present, cap-at-max_tools, long-whitelist retention, no-cap-when-absent, unknown-model-no-cap, Deep-Mode byte-identical pass-through, and whitelist-filter-alone.

## Task Commits

Each task was committed atomically (TDD RED→GREEN folded into one `feat` per task — the Wave-0 skeleton already carried the skipped contracts; the live tests fail against pre-091 code and pass after the implementation, keeping the suite green per-commit):

1. **Task 1: ToolContext.phase_whitelist + dispatch_tool whitelist guard (HARNESS-05)** — `1a818851` (feat) — RED demonstrated (`test_toolcontext_has_phase_whitelist_field` failed: `phase_whitelist` not in `ToolContext.__dataclass_fields__`) → GREEN after the field + guard + `_spawn_tool_refused_audit` landed.
2. **Task 2: apply_tool_budget whitelist filter + TOOL-05 max_tools budget (Google)** — `dd308cbc` (feat) — RED demonstrated (`ImportError: cannot import name 'apply_tool_budget'`) → GREEN after the helper + `max_tools` registry field.

## Files Created/Modified

- `backend/app/services/tool_dispatcher.py` — `ToolContext.phase_whitelist` field; `_spawn_tool_refused_audit` helper; the single whitelist guard at the top of `dispatch_tool()` (above `_TOOL_REGISTRY.get`).
- `backend/app/services/openai_service.py` — pure `apply_tool_budget(schemas, model, whitelist)` (D-05 layer-1 filter + TOOL-05 cap, whitelist always retained). `get_tools` signature/behavior untouched.
- `backend/app/config.py` — `max_tools` on the `ModelCapability` TypedDict + all 7 Google/Gemini rows set to 16 (SEED-035 comment).
- `backend/tests/test_harness_whitelist.py` — 7 live HARNESS-05 contracts (was Wave-0 skeleton).
- `backend/tests/test_tool_budget.py` — 9 live TOOL-05 contracts (was Wave-0 skeleton).

## Decisions Made

- **Deep-Mode wiring deliberately deferred (SC#2):** `apply_tool_budget` ships in 091 but is invoked only from the harness executor path (Plan 03). No existing `get_tools()` call site is rewired, so the Google `max_tools` ceiling never touches Deep-Mode/Explorer/General. Verified by `grep -rn "apply_tool_budget" app/services/*_service.py app/api/*.py | grep -v openai_service.py` returning nothing.
- **`max_tools=16` for Google:** conservative SEED-035 ceiling sized from Gemini tool-count guidance; documented in a config comment. Other providers left without `max_tools` (default = no cap).
- **Audit is strictly best-effort:** the refusal is returned even if the audit spawn raises (`test_refusal_audit_failure_never_blocks_dispatch`), and `_spawn_tool_refused_audit` short-circuits when the ctx carries no pool/run_id.

## Deviations from Plan

None — plan executed exactly as written. Two test-authoring adjustments (not scope/behavior deviations): (1) `test_whitelist_tools_always_retained` was rewritten to prove the no-whitelist cap keeps the highest-priority survivors, because with a whitelist set, stage-1 filtering already removes non-whitelist tools — the over-cap-while-retaining-whitelist path is exercised instead by `test_budget_caps_long_whitelist_at_max_tools`; (2) the whitelist clean-refusal test was given a coro-closing spawn spy to silence a harmless never-awaited warning from the default fixture spawn.

## Issues Encountered

- The default `make_tool_context` `spawn` is `lambda *a, **k: None`, which discards the fire-and-forget audit coroutine without closing it → a `RuntimeWarning: coroutine 'write_audit' was never awaited`. Resolved by passing a coro-closing spawn spy in the affected test (production `ctx.spawn` schedules the coroutine, so this is a fixture-only artifact).

## Cross-Provider Safety (the critical invariant)

- The whitelist guard lives at the SINGLE dispatch entry, below all provider streaming/parsing branches; the refusal is a `ToolResult.result` string riding the existing tool_result append with the matching `tool_call_id` the loop tracks — no provider 400, zero provider-branch edits.
- Both the guard and `apply_tool_budget` are literal no-ops when `phase_whitelist is None` (Deep Mode). `apply_tool_budget` is unwired from every Deep-Mode `get_tools()` call site, so Explorer/General/Deep-Mode tool sets — including Google — are byte-identical to pre-091 (Phase 089 invariant / 075.x cascade prevention).

## Verification

- `cd backend && venv/Scripts/python -m pytest tests/test_harness_whitelist.py tests/test_tool_budget.py -q` → **16 passed**.
- `venv/Scripts/python -c "from app.services.tool_dispatcher import ToolContext; assert 'phase_whitelist' in ToolContext.__dataclass_fields__; from app.services.openai_service import apply_tool_budget; print('ok')"` → **ok**.
- Diff touches ONLY `tool_dispatcher.py`, `openai_service.py`, `config.py` (+ the 2 test files). Scope guard `grep -rn "apply_tool_budget" app/services/*_service.py app/api/*.py | grep -v openai_service.py` → **clean** (no Deep-Mode rewire).

## Next Phase Readiness

- Plan 03 (5 phase-type executors) can now build the per-phase `tools_override` via `apply_tool_budget(get_tools(user_settings), model, phase_whitelist)` and pass `phase_whitelist` (= `phase.available_tools` as a frozenset) onto each `ToolContext`. The two-layer D-05 enforcement (schema filter + dispatch backstop) is live.
- No blockers. No migration, no schema change in this plan.

## Self-Check: PASSED

- Both task commits present in git history: `1a818851`, `dd308cbc`.
- All 5 modified files verified on disk (none deleted; no unexpected deletions in either commit).
- 16 live contracts pass; smoke import prints `ok`; scope guard clean.

---
*Phase: 091-harness-engine-5-phase-types-gates-whitelist*
*Completed: 2026-05-31*
