---
phase: 14-code-execution-sandbox
plan: "02"
subsystem: backend
tags: [sandbox, tool-definition, llm-tools, python]
dependency_graph:
  requires: [14-01]
  provides: [EXECUTE_CODE_TOOL, conditional-tool-registration]
  affects: [openai_service, threads-system-prompt]
tech_stack:
  added: []
  patterns: [conditional-tool-registration, tdd]
key_files:
  created:
    - backend/tests/unit/test_sandbox_tools.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/api/threads.py
decisions:
  - "EXECUTE_CODE_TOOL definition lives in openai_service.py alongside all other tool constants"
  - "get_explorer_tools() is never modified — execute_code is general-mode only"
  - "SYSTEM_PROMPT in threads.py updated as tool #13 with key rule entry"
metrics:
  duration: "1min 18sec"
  completed: "2026-04-03"
  tasks_completed: 1
  files_modified: 3
requirements_completed: [SAND-01, SAND-04, SAND-13]
---

# Phase 14 Plan 02: Execute Code Tool Definition Summary

**One-liner:** EXECUTE_CODE_TOOL constant with code/libraries/output_files schema, conditionally registered in get_tools() when sandbox_enabled=True, never in explorer tools.

## What Was Built

Added the `EXECUTE_CODE_TOOL` LLM tool definition to `openai_service.py` and wired it conditionally into `get_tools()`. The tool is the LLM-facing side of the sandbox — it tells the model what the `execute_code` function signature is so it can call it. The actual execution handler comes in Plan 03.

### Tool Schema

- `code` (string, **required**) — Python code to execute
- `libraries` (array of strings, optional) — PyPI packages to install
- `output_files` (array of strings, optional) — filenames expected in `/sandbox/output/`

### Registration Logic

```python
if settings.sandbox_enabled:
    tools.append(EXECUTE_CODE_TOOL)
```

`get_explorer_tools()` is unchanged — never includes execute_code.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for execute_code tool registration | 436ff61 | backend/tests/unit/test_sandbox_tools.py |
| 1 (GREEN) | EXECUTE_CODE_TOOL definition + conditional registration | 0801097 | backend/app/services/openai_service.py, backend/app/api/threads.py |

## Verification Results

- `pytest tests/unit/test_sandbox_tools.py` — 4 passed
- `python -c "from app.services.openai_service import EXECUTE_CODE_TOOL; print(EXECUTE_CODE_TOOL['function']['name'])"` → `execute_code`
- Pre-existing failures in `test_explorer_agent.py` and `test_openai_service.py` confirmed pre-existing (not introduced by this plan)

## Acceptance Criteria

- [x] `backend/app/services/openai_service.py` contains `EXECUTE_CODE_TOOL = {`
- [x] `backend/app/services/openai_service.py` contains `"name": "execute_code"`
- [x] `backend/app/services/openai_service.py` contains `if settings.sandbox_enabled:`
- [x] `backend/app/services/openai_service.py` contains `tools.append(EXECUTE_CODE_TOOL)`
- [x] SYSTEM_PROMPT in threads.py contains `execute_code` (tool #13 entry + key rule)
- [x] `get_explorer_tools()` does NOT reference EXECUTE_CODE_TOOL
- [x] New tests for sandbox tool registration pass (4/4)
- [x] Pre-existing test failures confirmed pre-existing (not introduced here)

## Deviations from Plan

None - plan executed exactly as written. The implementation was already partially present in the working tree (placed there by the previous agent working on plan 14-01), so commits were created to properly stage the completed work.

## Known Stubs

None — tool definition is complete. The execution handler (what happens when the LLM calls execute_code) is the subject of Plan 03.

## Self-Check: PASSED

- `backend/app/services/openai_service.py` — exists and contains EXECUTE_CODE_TOOL
- `backend/app/api/threads.py` — exists and contains execute_code in SYSTEM_PROMPT  
- `backend/tests/unit/test_sandbox_tools.py` — exists, 4 tests pass
- Commit 436ff61 — exists (RED)
- Commit 0801097 — exists (GREEN)
