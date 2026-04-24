---
phase: 20-blank-response-guards
plan: 01
status: complete
completed: 2026-04-10
---

## What was built

Three blank-response failure modes patched in `backend/app/api/threads.py`:

1. **Force-no-tools empty content fallback** — When the final forced-no-tools iteration produces no text content, a human-readable fallback message is yielded before `[DONE]` instead of silently closing the stream.

2. **finish_reason=length mid-tool-call guard** — When streaming hits the token limit while assembling a tool call (`tool_calls_buffer` non-empty), the partial call is discarded and an error SSE event is emitted. Previously the loop exited cleanly with no output.

3. **maybe_single() hardening** — `load_skill` and `read_skill_file` now handle `maybe_single()` returning `None` without raising unhandled exceptions.

## Key files
- `backend/app/api/threads.py` — all three guards added to the agent loop
- `backend/tests/unit/test_blank_response_guards.py` — unit tests for all three paths

## Verification
- Committed in d996f9f alongside phases 21-24
- Guards confirmed present via grep of threads.py
