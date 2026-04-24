---
phase: 051-context-window-management
plan: "01"
subsystem: testing
tags: [tdd, wave-0, context-window, sub-agent, tiktoken, model-info]
dependency_graph:
  requires: []
  provides:
    - backend/tests/unit/test_sub_agent_routing.py
    - backend/tests/unit/test_context_window.py (tiktoken additions)
    - backend/tests/unit/test_settings.py
    - frontend/src/lib/model-info.test.ts
  affects:
    - backend/app/services/sub_agent_service.py (Wave 1 target)
    - backend/app/services/context_window.py (Wave 1 target)
    - backend/app/api/settings.py (Wave 1 target)
    - frontend/src/lib/model-info.ts (Wave 2/3 target)
tech_stack:
  added: []
  patterns:
    - Lazy import pattern (imports inside test functions so collect-only works before production code exists)
    - SimpleNamespace for lightweight user_settings fixtures
    - pytest.skip for conditional tiktoken availability
key_files:
  created:
    - backend/tests/unit/test_sub_agent_routing.py
    - backend/tests/unit/test_settings.py
    - frontend/src/lib/model-info.test.ts
  modified:
    - backend/tests/unit/test_context_window.py
decisions:
  - "Used SimpleNamespace (not MagicMock) for user_settings in routing tests — matches test_sub_agent_intelligence.py pattern exactly"
  - "Lazy imports inside test bodies so --collect-only works before Wave 1 implements production code"
  - "test_settings.py is a new file (did not exist) — created with docstring header per plan spec"
  - "Vitest verification done via main repo frontend node_modules (worktree shares parent repo's node_modules for CI)"
metrics:
  duration: "312s (~5 min)"
  completed: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 051 Plan 01: Wave 0 Test Stubs Summary

**One-liner:** Created failing test stubs for all four Phase 51 test targets — 18 routing tests, 3 tiktoken tests, 3 settings tests, 7 frontend MODEL_INFO tests, all RED until Wave 1/2 implement production code.

## What Was Built

Wave 0 of Phase 51: Nyquist compliance setup. Four test files (or additions to existing files) that establish the automated verification harness for all five Phase 51 requirements before any production code is written.

### Files Created / Modified

| File | Type | Tests Added | Covers |
|------|------|-------------|--------|
| `backend/tests/unit/test_sub_agent_routing.py` | NEW | 18 | CTX-01, CTX-02 |
| `backend/tests/unit/test_context_window.py` | APPENDED | 3 | CTX-05 |
| `backend/tests/unit/test_settings.py` | NEW | 3 | CTX-03 |
| `frontend/src/lib/model-info.test.ts` | NEW | 7 | CTX-04 |

**Total: 31 new test functions across 4 files**

### Test Collection Verification

```
pytest --collect-only on all 3 backend files: 45 tests collected (0 errors)
vitest run on model-info.test.ts: FAIL "Cannot find module './model-info'" (expected RED state)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | ab4a16f | test(051-01): add failing test stubs for sub-agent keyword routing CTX-01/CTX-02 |
| Task 2 | 2a0e16a | test(051-01): add tiktoken and settings test stubs CTX-03/CTX-05 |
| Task 3 | c57e000 | test(051-01): add MODEL_INFO frontend test stub CTX-04 |

## Deviations from Plan

None — plan executed exactly as written.

The acceptance criteria in the plan specified 16+ test functions for test_sub_agent_routing.py; the implementation contains 18 (plan shows `test_generation_keywords_case_insensitive` tests two assertions in one function, bringing the raw assertion count higher but function count to 18 matching what pytest collects).

## RED State Confirmation

All test files are in the expected RED state:
- `test_sub_agent_routing.py`: Will fail at runtime with `ImportError: cannot import name '_is_generation_task' from 'app.services.sub_agent_service'` (collect-only works via lazy imports)
- `test_context_window.py` tiktoken tests: Will skip if tiktoken not installed; will fail if `_TIKTOKEN_AVAILABLE` not exported (Wave 1 adds this)
- `test_settings.py`: Will fail with `ImportError` or `ValidationError` as `sub_agent_max_output_tokens` field does not yet exist
- `model-info.test.ts`: Fails with "Cannot find module './model-info'" — production file not yet created

## Known Stubs

None — test files only. No production code stubs introduced.

## Threat Flags

None — test files are developer-only artifacts with no runtime security surface.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `backend/tests/unit/test_sub_agent_routing.py` | FOUND |
| `backend/tests/unit/test_settings.py` | FOUND |
| `frontend/src/lib/model-info.test.ts` | FOUND |
| `.planning/phases/051-context-window-management/051-01-SUMMARY.md` | FOUND |
| Commit ab4a16f (routing tests) | FOUND |
| Commit 2a0e16a (tiktoken + settings tests) | FOUND |
| Commit c57e000 (model-info.test.ts) | FOUND |
