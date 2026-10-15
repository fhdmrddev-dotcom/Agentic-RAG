---
id: BUG-261015-03
title: ask_user's schema REQUIRES timeout_seconds but calls it "Optional", so models pick ~60 s and the pause expires before a person can answer
reported: 2026-10-15
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/agent-loop, backend/tools, frontend/ask-user]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 22c409c2c
  date: 2026-10-15
---

# BUG-261015-03: ask_user's required timeout makes models pick ~60 s

## What we observed

Found while driving the Phase 282 SC#10 board live (2026-10-15, `282-LIVE-EVIDENCE.md`, pass 1).

The prompt was "Before answering, use the ask_user tool to ask me which colour I prefer: Red or Blue…". It
was sent to five native providers, and in every one the question **expired unanswered after about 60 s**:

| Row | Model | Run started | Run completed | Final message |
|---|---|---|---|---|
| 3 | gemini-3.5-flash | 13:45:43 | 13:47:01 | "Since the tool call timed out before a selection was made…" |
| 4 | deepseek-v4-pro | 13:46:07 | 13:47:19 | "the question timed out without a response…" |
| 5 | glm-5.2 | 13:46:08 | (expired before the answer, ~13:49) | "my question timed out before you could respond…" |
| 6 | MiniMax-M3 | 13:46:10 | 13:47:24 | "You didn't respond in time…" |
| 7 | kimi-k2.6 | 13:46:11 | 13:47:38 | "No response was received…" |

OpenAI `gpt-5.6-sol` left the value to the 300 s default. Its first ask expired at 300 s and it asked again.

Pass 2 used the same prompt plus "with timeout_seconds set to 1200". All five paused until they were
answered, and each run completed naming Blue.

## Why it matters

A person who reads the question, switches tabs, or simply thinks for a minute finds the run already ended.
The agent then says "you didn't respond in time". The pause is technically reachable, but in practice it
cannot be answered, which defeats the paused-run work in FIX-07.

## Hypothesized cause

In `backend/app/services/openai_service.py` (around lines 1135-1137), the ask_user tool schema lists
`timeout_seconds` in `"required"`, which strict mode needs. Its description, however, says *"Optional.
Maximum seconds to wait. Server clamps."* A model that must supply a value and has no guidance picks a
small round number. The server default of 300 s (`tools/agent_control.py:322`) only applies when the value
is null.

## Suggested routing

Small and contained (G-3 sized): describe the parameter so models pass `null` unless the user asked for a
deadline, and/or apply a server-side floor. Because this changes provider-facing tool text, a
cross-provider re-drive of the pause prompt is required before it is closed. Not folded into 282: 282's
pause rows passed once the wait was long enough, and this is a separate defect found during the drive.
