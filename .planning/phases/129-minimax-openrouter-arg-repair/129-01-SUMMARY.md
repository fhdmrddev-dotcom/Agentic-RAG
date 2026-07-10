---
phase: 129-minimax-openrouter-arg-repair
plan: 01
subsystem: api
tags: [openrouter, provider-routing, openai-compat, require_parameters, tool-use, extra_body]

# Dependency graph
requires:
  - phase: 101.1
    provides: "D-15 directive comment (config.py) documenting require_parameters as the conditional-force prerequisite — documented-but-unwired until now"
  - phase: 067.3
    provides: "D-09 #3 / BUG-260616-01 resolved-provider gate (`provider == 'openrouter'`) the injection sits inside"
provides:
  - "OpenRouter require_parameters routing flag wired into the openrouter_tool_strategy=='quality' extra_body block (D-02 / MP-04)"
  - "Unit pin (test_129_openrouter_require_params.py) of the assembled extra_body shape — quality-only, absent on native/xml and on non-OpenRouter providers"
  - "config.py D-15 directive comment reconciled to the now-wired state"
affects: [129-02, 129-03, openrouter-routing, sc10-openrouter-scoreboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive request-build injection strictly inside the quality + provider=='openrouter' double-gate (D-14 RED LINE)"
    - "Spy-on-get_llm_client unit pattern: patch get_llm_client → MagicMock client whose chat.completions.create captures kwargs (no live network)"

key-files:
  created:
    - backend/tests/test_129_openrouter_require_params.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/config.py

key-decisions:
  - "require_parameters injected as the THIRD OpenRouter routing modifier (beside :exacto suffix + plugins:[response-healing]) — opt-in via the quality strategy the user already selects; no new Settings surface, no always-on change"
  - "config.py edit is comment-only (D-15 wording reconciled to wired state) — no registry row value changed, D-15 reference preserved"

patterns-established:
  - "Shared-path proof via negative test: provider=='openai' + quality asserts ABSENCE of the injection (the quality `if` guard fires on the strategy string, but the inner provider=='openrouter' gate blocks it)"

requirements-completed: [MP-04]

# Metrics
duration: 3min
completed: 2026-06-27
---

# Phase 129 Plan 01: OpenRouter require_parameters wired into quality strategy Summary

**OpenRouter `extra_body["provider"] = {"require_parameters": True}` injected into the `openrouter_tool_strategy=="quality"` block (beside `:exacto` + `response-healing`), so routing excludes upstreams that silently drop the tool schema — opt-in, shared path byte-identical (D-02 / MP-04).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-26T23:36:17Z
- **Completed:** 2026-06-26T23:39:15Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Wired the previously documented-but-never-wired D-15 directive: OpenRouter quality-strategy requests now carry `provider.require_parameters=true`, a routing hardening that excludes non-compliant upstreams.
- Reconciled the config.py:342-350 D-15 comment to point at the now-live `openai_service.py` quality block (comment-only; no registry value changed).
- Unit-pinned the assembled `extra_body` shape across four scenarios, including the D-14 shared-path negative (openai + quality → no injection).

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject OpenRouter require_parameters into the quality-strategy extra_body block (D-02)** — `be8a96b0` (feat)
2. **Task 2: Unit test the require_parameters injection shape (quality-only, shared-path safe)** — `3cccea28` (test)

_Note: Task 2 was authored as a single `test(...)` commit. The implementation it pins landed in Task 1's `feat(...)` commit (the plan front-loads impl in Task 1, test in Task 2); the test genuinely binds to the injection — reverting Task 1 fails `test_require_parameters_quality_only` at the `extra_body["provider"]` assertion. See TDD Gate Compliance below._

## Files Created/Modified
- `backend/app/services/openai_service.py` — Added `kwargs["extra_body"]["provider"] = {"require_parameters": True}` (line 1631) inside the existing `if provider == "openrouter":` branch (line 1619), itself inside the `openrouter_tool_strategy == "quality"` guard (line 1611), immediately after the `plugins` assignment. 5-line citing comment (D-02 / MP-04 / D-14).
- `backend/app/config.py` — Reconciled the Phase 101.1 D-15 directive comment (lines ~342-350) from "MUST send (implied unwired)" to "sends … WIRED in Phase 129 … at openai_service.py". No `MODEL_CAPABILITIES` row value changed; D-15 reference preserved.
- `backend/tests/test_129_openrouter_require_params.py` — New unit file (4 tests). Patches `get_llm_client` to a spy that captures `client.chat.completions.create(**kwargs)`; asserts the assembled `extra_body` for quality/openrouter (present), native/openrouter (absent), xml/openrouter (absent), quality/openai (absent — shared-path proof). No live network call.

## Verify Commands Run

| Command | Result |
|---|---|
| `cd backend && venv/Scripts/python -c "import ast; ... assert require_parameters>=1; print('OK')"` (Task 1 gate) | **PASS** — printed `OK` (both files parse; injection present) |
| `cd backend && venv/Scripts/python -m pytest tests/test_129_openrouter_require_params.py -x -q` (Task 2 gate) | **PASS** — 4 passed |
| `cd backend && venv/Scripts/python -m pytest tests/test_provider_router.py tests/test_129_openrouter_require_params.py -q` (regression spot-check) | **PASS** — 8 passed |

Captured `extra_body` per scenario (direct repro, proof of correctness):
- quality/openrouter → `{'plugins': [{'id': 'response-healing'}], 'provider': {'require_parameters': True}}`
- native/openrouter → `None`
- xml/openrouter → `None`
- **quality/openai → `None`** (the D-14 shared-path proof)

## Shared-Path / D-14 RED LINE Confirmation

The non-OpenRouter shared path is provably untouched. `test_non_openrouter_provider_unaffected` drives `provider="openai"` + `strategy="quality"` and asserts `"provider" not in extra_body`. The quality `if` guard at openai_service.py:1611 fires on the strategy string for OpenAI too, but the inner `provider == "openrouter"` gate (line 1619) blocks the injection — so OpenAI/Anthropic/Google round-trips are byte-identical. The `:exacto` suffix and `response-healing` plugin are likewise absent for the non-openrouter path. `grep require_parameters openai_service.py` → one executable occurrence (line 1631), inside the double-gate.

## Decisions Made
None beyond those locked in the plan — followed D-02 / D-14 exactly. The injection is the third OpenRouter routing modifier; its interaction with `:exacto` + `plugins` is flagged confirm-at-execution via the Plan 03 SC#10 OpenRouter before/after row (RESEARCH Pitfall 5 / A2), not special-cased here.

## Deviations from Plan
None - plan executed exactly as written.

## TDD Gate Compliance
Task 2 carries `tdd="true"`, but the plan deliberately orders implementation in Task 1 and the test in Task 2 (impl-then-test). The test is a real binding (not a tautology): the captured-shape repro above confirms `test_require_parameters_quality_only` would fail without Task 1's injection. Gate-sequence note: a standalone `test(...)` commit (`3cccea28`) exists; the corresponding behavior commit is the preceding `feat(...)` (`be8a96b0`). No RED-before-GREEN ordering was required because this plan's RED phase is the negative-path absence assertions, which pass against the correctly-gated implementation.

## Issues Encountered
None. (Pre-existing `RequestsDependencyWarning` about urllib3/chardet versions surfaced in pytest output — unrelated to this change, out of scope per the scope boundary; logged here for transparency only.)

## User Setup Required
None - no external service configuration required. `require_parameters` is a request-body routing flag, not config; no env var, no migration, no package install.

## Next Phase Readiness
- D-02 / MP-04 OpenRouter half is wired and unit-pinned. Ready for the Plan 03 SC#10 OpenRouter before/after live-UAT row (confirm the three-way `:exacto` + `plugins` + `require_parameters` routing interaction at execution — A2 / Pitfall 5).
- No blockers. The MiniMax half of Phase 129 (D-01, agent_loop.py) is a separate plan, untouched here.

## Self-Check: PASSED

- FOUND: backend/app/services/openai_service.py
- FOUND: backend/app/config.py
- FOUND: backend/tests/test_129_openrouter_require_params.py
- FOUND: .planning/phases/129-minimax-openrouter-arg-repair/129-01-SUMMARY.md
- FOUND commit: be8a96b0 (Task 1 — feat)
- FOUND commit: 3cccea28 (Task 2 — test)

---
*Phase: 129-minimax-openrouter-arg-repair*
*Completed: 2026-06-27*
