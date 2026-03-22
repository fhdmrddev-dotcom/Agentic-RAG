---
phase: 07-explorer-sub-agent
plan: 01
subsystem: backend
tags: [explorer-agent, agent-mode, tools, system-prompt, unit-tests]
dependency_graph:
  requires: []
  provides: [explorer-agent-backend, agent_mode-field, EXPLORER_SYSTEM_PROMPT, get_explorer_tools]
  affects: [backend/app/api/threads.py, backend/app/services/openai_service.py, backend/app/models/message.py]
tech_stack:
  added: []
  patterns: [agent-mode-branching, tools-override-pattern, tdd-red-green]
key_files:
  created:
    - backend/tests/unit/test_explorer_agent.py
  modified:
    - backend/app/models/message.py
    - backend/app/services/openai_service.py
    - backend/app/api/threads.py
decisions:
  - "tools_override=None signals 'use default get_tools()' — no tools_override means default mode is truly unchanged"
  - "History mock returns 2 messages in tests to suppress auto-title path (requires len==1 to trigger)"
  - "Pre-existing test failures (13) confirmed present before and after changes — not regressions from this plan"
metrics:
  duration: "3 min 30 sec"
  completed: "2026-03-22"
  tasks: 2
  files: 4
---

# Phase 07 Plan 01: Explorer Sub-Agent Backend Wiring Summary

**One-liner:** Explorer agent mode with KB-focused system prompt, 6-tool list, and branching logic via `agent_mode` field on MessageCreate.

## What Was Built

The backend now supports an `agent_mode` parameter on the `POST /threads/{id}/messages` endpoint. When `agent_mode="explorer"` is passed, `send_message` uses a distinct `EXPLORER_SYSTEM_PROMPT`, passes only the 6 KB navigation tools via `tools_override`, and raises `max_iterations` from 5 to 8. Default mode is completely unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add agent_mode + EXPLORER_SYSTEM_PROMPT + get_explorer_tools() | 8d3237c | message.py, openai_service.py |
| 2 | Branch send_message on agent_mode + unit tests | 3babeb9 | threads.py, test_explorer_agent.py |

## Requirements Satisfied

- **AGENT-01:** `agent_mode` field on `MessageCreate` with `"default"` as default
- **AGENT-02:** `get_explorer_tools()` returns exactly `[ls, tree, grep, glob, read_document, analyze_document]` — no search_documents, query_documents, or web_search
- **AGENT-03:** `EXPLORER_SYSTEM_PROMPT` instructs coherent synthesized answer in prose, handles empty-result case, and directs filename usage for `analyze_document`

## Test Results

- **Explorer agent tests:** 19/19 passed (`tests/unit/test_explorer_agent.py`)
- **Regressions:** 0 — same 13 pre-existing failures before and after (unrelated to this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock side_effect exhaustion on auto-title path**
- **Found during:** Task 2 — first run of send_message integration-style tests
- **Issue:** `_setup_thread_mocks` provided 5 execute() entries but auto-title fires when history has exactly 1 user message, causing `StopIteration`
- **Fix:** Changed history mock to return 2 messages so `len(history_resp.data) == 1` guard is false and auto-title path is skipped — simpler than adding title mock entries
- **Files modified:** `backend/tests/unit/test_explorer_agent.py`
- **Commit:** 3babeb9

## Known Stubs

None — all branching logic is fully wired. `tools_override=None` in default mode correctly falls back to `get_tools()` in `create_streaming_chat`.

## Self-Check: PASSED
