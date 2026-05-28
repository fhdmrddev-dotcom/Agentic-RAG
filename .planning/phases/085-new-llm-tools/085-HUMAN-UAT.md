---
status: partial
phase: 085-new-llm-tools
source: [085-VERIFICATION.md, 085-VALIDATION.md]
started: 2026-05-28T00:00:00Z
updated: 2026-05-28T00:00:00Z
---

## Current Test

[awaiting human testing — 5 operator-only UAT rows queued from VALIDATION.md SC#10 matrix]

## Tests

### 1. Row 6 — ask_user + Stop button + redis-cli leak check
expected: Trigger ask_user prompt (any provider). While paused, click the Stop button in the UI. In a SEPARATE terminal run `redis-cli client list | grep subscribe` — must return 0 lines after ~5s. FC#2 (no leaked SUBSCRIBE clients).
result: [pending]

### 2. Row 7 — ask_user + browser reload survives
expected: Trigger ask_user prompt (Anthropic preferred for the matrix). While paused, refresh the browser. Panel should re-render the prompt via GET /threads/{tid}/ask_user/pending (Phase 085 endpoint already shipped). Submit a response — POST /runs/{rid}/ask_user_response returns 200, response recorded in messages, run status reflects completion or error. FC#3.
note: Full UI panel re-render lands in Phase 086 / 087 — the backend endpoint contract is already verified. Operator can manually call GET /pending to confirm the data is fetchable post-reload.
result: [pending]

### 3. Row 14 — write_todos status revert (Anthropic)
expected: Call write_todos with status='completed' for a todo. Then call write_todos again with status='pending' for the same todo. GET /threads/{tid}/todos returns the second call's state (full-state-replace). FC#7.
note: Full-state-replace semantics verified by unit test `tests/unit/test_085_todos_service.py::test_full_state_replace_ordering`. This operator row confirms end-to-end via UI flow.
result: [pending]

### 4. Row 15 — write_todos under long context (OpenAI, 50+ prior messages)
expected: Accumulate 50+ messages in a thread (continue an existing chat). Then send a prompt that triggers write_todos. SSE `todo_updated` event fires; GET /todos returns the canonical list. FC#7 (long-message SC#10 axis).
result: [pending]

### 5. Row 18 — OpenRouter free-tier all-3-tools best-effort
expected: Switch active provider to OpenRouter, pick a free-tier model (e.g. `google/gemma-4-31b-it:free` or `minimax/minimax-m2.5:free`). Issue prompts that trigger each of the 3 new tools (write_todos, task, ask_user). Read LangSmith trace to confirm Phase 084 Plan 05 sanitizer + normalizer handle the schema correctly (no provider 400s, no stringified args breaking the dispatcher). FC#5 + FC#8.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
