---
slug: 260522-gdg-google-15-iter-loop-diagnostic
created: 2026-05-22
type: investigation
related_phase: 075.3 (planned, not yet inserted)
revertable: true
---

# Google 15-iteration loop — diagnostic logging patch

## Why

All 5 Gemini models (2.5-flash, 2.5-pro, 2.5-flash-lite, 3-flash-preview, 3.1-pro-preview) terminate with `*The model returned an empty response after 15 iterations*` on `threads.py:2910`, including for simple chat questions ("hi") that should not trigger any tool calls. To hit 15 iterations the agent loop's `tool_calls_buffer` must be non-empty in (almost) every iteration — Google is calling tools in a loop instead of producing text.

Four suspect parity gaps surfaced during the 2026-05-22 investigation (see conversation context for full audit):

1. `stream_options.include_usage` (`openai_service.py:880`) globally enabled in Phase 073-03; Google compat layer support unverified.
2. `parallel_tool_calls=False` *excluded* for Google (`openai_service.py:790`, `_NO_PARALLEL_TOOL_CALLS = {"google"}`) — Gemini may emit multiple tool calls per iteration.
3. `tool_choice="none"` on the final iteration (`threads.py:1601`) — never verified that Google's compat honors this.
4. Tool-result message shape (`threads.py:2850-2854`) — Google's compat may need a different shape than `{"role": "tool", "tool_call_id", "content"}`.

This patch installs a Google-only diagnostic log line so reproduction reveals which gap (or combination) is the actual cause, **before** committing to a full native-SDK split in the planned Phase 075.3.

## Patch

Insert a `logger.info` block at `backend/app/api/threads.py:1970`, immediately after the existing `logger.debug` for iteration shape. Gated on `active_provider_name == "google"` so zero overhead for OpenAI / Anthropic / OpenRouter / Ollama.

Captures per iteration:
- `iteration` (0-indexed)
- `model` (Gemini model id)
- `finish_reason` (normalized)
- `force_no_tools` (whether this is the forced-text final iteration)
- `content_len` (bytes of `full_content` so far)
- `tool_calls` count
- Per-tool: `idx`, `name`, `id_len`, `args_len`, `args_preview` (first 120 chars)

Marker prefix `[GOOGLE-DIAG]` for easy `grep`.

## How to use

1. Apply the patch (this task's diff).
2. Restart the backend (`uvicorn`).
3. In the chat UI, switch to `gemini-2.5-flash` (or any Google model) and send "hi".
4. Watch the uvicorn stdout for `[GOOGLE-DIAG]` lines.
5. Expect ~15 lines (one per iteration) showing what Gemini is actually doing.
6. Paste the lines back into the conversation.

## Expected signatures by root cause

- **Gap 1 (`include_usage` rejected):** likely 1-2 lines, finish_reason=None or error, then break. Not the 15-iteration symptom — would surface differently.
- **Gap 2 (`parallel_tool_calls`):** 15 lines, each with `tool_calls > 1` and same tool names repeated.
- **Gap 3 (`tool_choice=none` ignored):** 15 lines, with line 14 (force_no_tools=True) still having tool_calls > 0.
- **Gap 4 (tool-result format):** 15 lines, content_len=0 in every iteration, same tool called every time with identical args.
- **Something else:** signature will tell us what.

## Revert plan

Delete lines added at `backend/app/api/threads.py:1971-1992`. Net zero behavioral change for non-Google providers; Google's broken state restored to its pre-patch broken state. Atomic 1-commit removal.

## Done when

- Patch applied + 1 commit
- User reproduces with at least one Gemini model
- Diagnostic output captured (paste back or save to `.planning/quick/260522-gdg-google-15-iter-loop-diagnostic/REPRO.md`)
- Decision made on Phase 075.3 scope shape (hotfix-only vs full native split) informed by data
