---
phase: quick
plan: 260407-vqw
subsystem: backend/context-management
tags: [context-window, token-estimation, agent-loop, trimming]
dependency_graph:
  requires: []
  provides: [context-window-management]
  affects: [backend/app/api/threads.py, backend/app/services/context_window.py]
tech_stack:
  added: []
  patterns: [chars/4-token-heuristic, atomic-tool-call-removal, sliding-window-trim]
key_files:
  created:
    - backend/app/services/context_window.py
    - backend/tests/unit/test_context_window.py
  modified:
    - backend/app/api/threads.py
    - backend/app/config.py
decisions:
  - "Character-based token estimation (chars/4) chosen over tiktoken — no external dependency, <1ms, accurate enough for trimming heuristic"
  - "Trim applied twice per iteration: once after history reconstruction (pre-loop) and once at start of each iteration loop to handle tool call growth"
  - "Atomic tool call removal: assistant+tool_calls message and its tool-role children removed together to prevent OpenAI API errors from orphaned tool results"
  - "reserve_recent=10 default ensures most recent context is never trimmed even under extreme pressure"
  - "context_window_max_tokens=100000 default is safe for gpt-4o 128k (leaves 28k for response + system prompt)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 4
---

# Phase quick Plan 260407-vqw: Context Window Management Summary

**One-liner:** Sliding-window context trimmer with atomic tool-call removal and chars/4 token estimation integrated into the agent loop.

## What Was Built

Long conversations with many tool calls accumulate messages that can exceed the model's context limit, causing silent failures. This plan implements:

1. **`backend/app/services/context_window.py`** — New service with three functions:
   - `estimate_tokens(text)` — chars/4 heuristic, handles None, returns 0 for empty
   - `estimate_messages_tokens(messages)` — sums content + tool_calls JSON + 4-token/message overhead
   - `trim_messages_to_fit(messages, max_tokens, reserve_recent)` — sliding-window trimmer that:
     - Always preserves the system message (index 0)
     - Always preserves the last `reserve_recent` messages
     - Removes oldest non-system messages first
     - Removes tool call sequences atomically (assistant+tool_calls + all following tool-role messages)
     - Inserts a `[Earlier conversation history was trimmed...]` marker after the system prompt when trimming occurs

2. **`backend/app/config.py`** — Added two settings:
   - `context_window_max_tokens: int = 100000` (configurable via `CONTEXT_WINDOW_MAX_TOKENS` env var)
   - `context_window_reserve_recent: int = 10` (configurable via `CONTEXT_WINDOW_RESERVE_RECENT` env var)

3. **`backend/app/api/threads.py`** — Integrated trimming in two places:
   - After `messages.extend(_reconstruct_history(...))` — trims accumulated prior conversation history before first LLM call
   - At the start of each `for iteration in range(max_iterations)` loop — trims after tool results are appended
   - Added `logger.debug("Agent iteration %d: ~%d tokens in %d messages", ...)` per iteration

4. **`backend/tests/unit/test_context_window.py`** — 13 unit tests covering all behaviors (all pass).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create context_window service (TDD) | 49798be | context_window.py, test_context_window.py, config.py |
| 2 | Integrate trimming into agent loop | 1e5977d | threads.py |

## Verification

- All 13 unit tests pass: `pytest tests/unit/test_context_window.py`
- Integration tests: 25/27 pass (2 failures are pre-existing mock issue unrelated to this plan — verified via git stash)
- Token estimation runs in <1ms (pure Python, no external calls)
- Short conversations unchanged (trim is a no-op when under max_tokens)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `backend/app/services/context_window.py` — created, verified exists
- `backend/tests/unit/test_context_window.py` — created, all 13 tests pass
- `backend/app/config.py` — context_window_max_tokens and context_window_reserve_recent added
- `backend/app/api/threads.py` — trim_messages_to_fit integrated at both call sites
- Commit 49798be exists: feat(quick-260407-vqw): add context_window service
- Commit 1e5977d exists: feat(quick-260407-vqw): integrate context window trimming into agent loop
