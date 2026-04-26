---
phase: "054"
plan: "01"
subsystem: backend-tests
tags: [tdd, wave-0, red-tests, anthropic, openai, max-iterations]
dependency_graph:
  requires: []
  provides:
    - test contract for GEN-02 (Anthropic message/tool conversion)
    - test contract for GEN-04 (max_iterations config)
    - test contract for GEN-05 (_resolve_max_tokens provider bypass)
  affects:
    - backend/tests/unit/test_anthropic_service.py
    - backend/tests/unit/test_openai_service.py
    - backend/tests/unit/test_explorer_agent.py
tech_stack:
  added: []
  patterns:
    - pytest.importorskip for module-not-yet-created skip pattern
    - ast-based syntax validation for test files
    - source-code string search for configuration assertions
key_files:
  created:
    - backend/tests/unit/test_anthropic_service.py
  modified:
    - backend/tests/unit/test_openai_service.py
    - backend/tests/unit/test_explorer_agent.py
decisions:
  - "pytest.importorskip for anthropic_service — entire module skips cleanly when service not yet created"
  - "string-search approach for max_iterations test — lightweight, avoids mocking full route handler"
  - "tests 4-5 (openrouter/ollama) are RED in worktree base — user_settings override check not yet in worktree version of _resolve_max_tokens"
metrics:
  duration: "6 minutes"
  completed: "2026-04-26"
  tasks_completed: 3
  files_changed: 3
---

# Phase 054 Plan 01: TDD Wave 0 — Failing Tests for Reliable Agentic Generation

**One-liner:** Wave 0 RED tests establishing behavioral contract for Anthropic native SDK integration (message conversion, tool format, stop_reason mapping) and max_iterations config changes before any implementation.

## What Was Built

Three test files updated/created with 22 new test cases covering:
- **GEN-02**: Anthropic native message format conversion, tool format conversion, stop_reason mapping, cache_control placement
- **GEN-04**: max_iterations target values (explorer=8, general=15) via source-code string search
- **GEN-05**: _resolve_max_tokens provider bypass for native providers (anthropic/openai/google)

### Task 1: test_anthropic_service.py (14 tests, all skipped via importorskip)

Created `backend/tests/unit/test_anthropic_service.py` with 14 test cases in 3 classes:

- `TestConvertMessagesToAnthropic` (6 tests): system message stripping, user/assistant passthrough, tool_calls → content blocks conversion, tool results grouped into single user message (the critical Anthropic 400 prevention test)
- `TestConvertToolsToAnthropic` (4 tests): flat format conversion, cache_control on last tool only, empty list, input_schema key
- `TestStopReasonMapping` (4 tests): end_turn/tool_use/max_tokens/unknown mappings

Uses `pytest.importorskip` so the entire module skips cleanly until Wave 2 creates `anthropic_service.py`.

### Task 2: test_openai_service.py — TestResolveMaxTokensProviderBypass (5 tests, RED)

Added `_make_user_settings` factory with `llm_max_output_tokens` field and `TestResolveMaxTokensProviderBypass` class:
- Tests 1-3 (anthropic/openai/google): RED — bypass not yet implemented, current code returns user override
- Tests 4-5 (openrouter/ollama): Also RED in worktree base — worktree has older `_resolve_max_tokens` without user_settings check

### Task 3: test_explorer_agent.py — TestMaxIterationsConfig (3 tests, 2 RED)

Added `TestMaxIterationsConfig` class using source-code string search:
- `test_general_mode_max_iterations_is_15`: RED (current value=8, target=15)
- `test_explorer_mode_max_iterations_is_8`: Currently passes (string "= 8" exists for general mode — false positive due to string search approach), but gated by test 3
- `test_old_general_max_iterations_8_is_gone`: RED (count_15=0, not 1 as required)

All 3 tests pass together only after Wave 1 sets explorer=8 and general=15.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 15de6b9 | test(054-01): add test_anthropic_service.py — GEN-02 Wave 0 RED tests |
| Task 2 | 6c20ce1 | test(054-01): add TestResolveMaxTokensProviderBypass to test_openai_service.py — GEN-02/GEN-05 |
| Task 3 | 5a40ca3 | test(054-01): add TestMaxIterationsConfig to test_explorer_agent.py — GEN-04 |

## Deviations from Plan

### Worktree State Deviation

**Found during:** All tasks

**Issue:** This plan was written assuming the current main-repo state, but the worktree was branched from commit `017ca65` (the plan creation commit), which has an older version of `openai_service.py` (721 lines vs 848 in main repo). The older version of `_resolve_max_tokens` does NOT check `user_settings.llm_max_output_tokens` at all — that feature was added in Phase 53 work that is uncommitted in the main working tree.

**Impact on Task 2:** Tests 4-5 (`test_openrouter_provider_respects_user_override` and `test_ollama_provider_respects_user_override`) are RED in the worktree (both return the model/provider default, not the user override), whereas the plan expected them to PASS. They'll become GREEN as part of Wave 1 when the full `_resolve_max_tokens` is implemented with native provider bypass.

**Fix:** Tests written as specified in the plan. Wave 1 (054-02-PLAN.md) must implement both the user-settings override check AND the native provider bypass to make all 5 tests pass.

### test_explorer_mode_max_iterations_is_8 False Positive

**Found during:** Task 3

**Issue:** The string-search approach for `test_explorer_mode_max_iterations_is_8` finds "max_iterations = 8" in threads.py (used for GENERAL mode currently), making the test PASS before implementation. The plan expected it to fail.

**Fix:** Test 3 (`test_old_general_max_iterations_8_is_gone`) acts as a gate by asserting exactly 1 occurrence of each value. The overall contract is: all 3 tests in `TestMaxIterationsConfig` must pass simultaneously, which only happens when explorer=8 AND general=15.

## TDD Gate Compliance

This is a Wave 0 (RED) plan. No implementation code was written. Gate compliance:
- RED gate: All new tests written and committed with `test(054-01):` prefix
- GREEN gate: To be established by Wave 1 (054-02-PLAN.md)
- REFACTOR gate: Not applicable for test-only plan

## Known Stubs

None — this plan creates only test files; no production code with stubs.

## Threat Flags

None — test files only; no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files verified:
- `backend/tests/unit/test_anthropic_service.py` — EXISTS, 14 test functions, valid syntax
- `backend/tests/unit/test_openai_service.py` — EXISTS, 5 new test functions added, valid syntax
- `backend/tests/unit/test_explorer_agent.py` — EXISTS, 3 new test functions added, valid syntax

Commits verified in git log:
- 15de6b9 — FOUND
- 6c20ce1 — FOUND
- 5a40ca3 — FOUND
