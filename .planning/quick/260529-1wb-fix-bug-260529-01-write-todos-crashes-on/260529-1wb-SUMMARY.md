---
phase: 260529-1wb
plan: 01
subsystem: agent-tools
tags: [bugfix, write_todos, tool-dispatcher, openrouter, robustness]
quick: true
requires: []
provides:
  - "write_todos coerces stringified-JSON todos args and guards non-dict shapes"
  - "replace_todos defense-in-depth non-dict guard"
affects:
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/todos_service.py
tech-stack:
  added: []
  patterns:
    - "Coerce-then-validate at the tool-dispatch boundary for weak/proxied models"
    - "Defense-in-depth shape guard in the service layer mirroring the dispatcher guard"
key-files:
  created:
    - backend/tests/unit/test_write_todos_coercion.py
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/todos_service.py
decisions:
  - "Dispatcher is the primary fix (returns LLM-readable ToolResult errors for self-correction); replace_todos guard is defense-in-depth for direct callers"
metrics:
  duration: ~10min
  completed: 2026-05-29
requirements: [BUG-260529-01]
---

# Phase 260529-1wb Plan 01: Fix BUG-260529-01 write_todos crashes on stringified todos arg Summary

**One-liner:** `write_todos` now coerces a stringified-JSON `todos` arg (and guards non-list / non-dict shapes) at the dispatch boundary, so weak/OpenRouter-proxied models that serialize the nested arg as a string succeed instead of crashing with `'str' object has no attribute 'get'`.

## What Was Built

Three atomic changes closing BUG-260529-01:

1. **`_handle_write_todos` coercion + guards** (`tool_dispatcher.py`) — primary fix. Before the pre-DB validation loop:
   - If `todos_in` is a `str`, `json.loads` it; on `ValueError`/`TypeError` return a friendly `ToolResult` ("must be a JSON array of objects, not a string").
   - If `todos_in` is still not a `list`, return a friendly error.
   - Inside the loop, reject non-dict elements with a friendly error before any `.get()` call.
   The coerced `todos_in` (parsed `list[dict]`) flows unchanged to `replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)`. No duplicate `import json` (already at module top, line 18).

2. **`replace_todos` non-dict guard** (`todos_service.py`) — defense-in-depth. First check inside the `for t in todos:` loop raises `TodosValidationError` on non-dict elements, matching the established raise style, so the service never calls `.get()` on a non-dict even if invoked directly.

3. **Regression test** (`test_write_todos_coercion.py`) — 3 cases, no live Postgres (mocked pool + patched `replace_todos`):
   - (a) valid stringified array → `ToolResult` with `accepted: 1`, and the captured 3rd positional arg to `replace_todos` is a `list[dict]`.
   - (b) malformed string → `ToolResult` error starting `write_todos:`, no exception.
   - (c) list with non-dict element → `ToolResult` error starting `write_todos:`, not `AttributeError`.

## TDD Gate Compliance

Task 3 was `tdd="true"`. RED was verified explicitly: the two source files were temporarily reverted to the pre-fix commit (b56cad2) via `git checkout <sha> -- <files>`, the new test ran, and all three cases failed — cases (a) and (c) with the exact `AttributeError: 'str' object has no attribute 'get'` documented in the bug report. The fixed versions were then restored from HEAD and the test passed 3/3 (GREEN). Commit order in git log: `fix` (Task 1, 33e2b0a) → `fix` (Task 2, 1a06ede) → `test` (Task 3, c756522). The fixes were committed before the test commit because they were authored as Tasks 1–2; RED was proven against the pre-fix tree rather than via commit ordering.

## Verification

- New test: `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_write_todos_coercion.py -q` → `3 passed`.
- RED proof (pre-fix tree): `3 failed` — (a)/(b)/(c) all `AttributeError: 'str' object has no attribute 'get'` at `tool_dispatcher.py:1212`.
- No regression: `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_085_todos_service.py -q` → `22 passed`.
- AST + grep gates for Tasks 1 & 2 → `OK`.
- `git diff --name-only b56cad2..HEAD` → exactly the three `files_modified`; zero frontend, zero Phase 086 files.

## Deviations from Plan

None — plan executed exactly as written. Note: the task ran directly on branch `v2.5-dev` (no worktree) per the orchestrator constraint; no worktree/HEAD assertion applied.

## Commits

- `33e2b0a` fix(260529-1wb): coerce stringified/non-dict todos in _handle_write_todos
- `1a06ede` fix(260529-1wb): defense-in-depth non-dict guard in replace_todos
- `c756522` test(260529-1wb): regression for write_todos stringified/non-dict coercion

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: backend/app/services/tool_dispatcher.py (coercion + guards committed)
- FOUND: backend/app/services/todos_service.py (non-dict guard committed)
- FOUND: backend/tests/unit/test_write_todos_coercion.py
- FOUND commit: 33e2b0a
- FOUND commit: 1a06ede
- FOUND commit: c756522
