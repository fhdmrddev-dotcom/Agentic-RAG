---
phase: 19-sub-agent-guards
plan: 01
status: complete
completed: 2026-04-10
---

## What was built
Added "maximum" to the APIError context-window keyword list in `threads.py`. This covers provider messages like "This model's maximum context length is 128000 tokens" which previously went undetected, causing silent failures instead of user-visible error messages.

## Key files
- `backend/app/api/threads.py` — keyword "maximum" added to error detection tuple
- `backend/tests/unit/test_api_error_guards.py` — 13 tests, all passing

## Verification
- All 13 unit tests pass
- "maximum" keyword confirmed in source via grep
- Sub-agent content cap (sub_agent_service.py lines 23-27) already existed and fires before API call ✓
