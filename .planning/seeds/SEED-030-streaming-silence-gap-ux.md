---
id: SEED-030
title: Streaming Silence Gap UX
planted: 2026-05-25
status: open
trigger: next milestone touching streaming, agent loop, or UI state
origin: SESSION-20260525-streaming-timeout-investigation.md
---

# SEED-030: Streaming Silence Gap UX

## Context

Session investigation (2026-05-25) identified that the 075.x phase series successfully addressed streaming plumbing, live code panels, step collapse, and status pills — but the **TTFT (Time-To-First-Token) silence gap** remains unsolved. During multi-iteration agent runs (especially complex tasks like PPTX generation from large documents), users experience 2-60s of silence per iteration where nothing visibly changes.

A quick-fix attempt (extra `planning` events, system prompt narration, `planningHint`/`maxIterations` fields) caused UI regressions and was reverted. The conclusion: this needs a **dedicated UX phase**, not quick SSE additions.

## Specific Gaps

1. **TTFT silence**: 2-60s per iteration where backend has NO data from provider. Existing "Thinking..." row is visible but static.
2. **No text between `execute_code` batches**: Model goes directly to `tool_use` without text content. The message area stays empty for the entire run.
3. **Google atomic tool args**: Live code panel empty until `tool_start` (SDK limitation).
4. **Step-list collapse hides download cards**: `execute_code` output files from earlier iterations are collapsed after 3+ steps.

## Potential Approaches (from investigation)

- **Elapsed timer on "Thinking" row**: Already has `elapsedMs` — just needs to be more prominent during long TTFT windows.
- **Exempt `execute_code` with `output_files` from Focus Mode collapse**: Keep download cards visible even when earlier steps are collapsed. Pure frontend, low risk.
- **Backend-injected synthetic progress text**: After each `code_execution_complete` when `finish_reason=tool_calls`, inject a synthetic `delta` event like "Code executed successfully. Continuing...". Risky — must not pollute the final persisted message.
- **Artifact-style preview panel**: Like claude.ai — each `execute_code` output rendered as a versioned artifact in a side panel. High impact, high effort.
- **Iteration timing estimation**: After 2+ iterations, estimate remaining time from past iteration durations and show a progress indicator.

## Anti-patterns (tried and failed)

- Adding extra `planning` events before LLM calls → heavy re-renders, state leakage
- System prompt narration rule → unpredictable model behavior, thinking text in chat
- New Message fields (`planningHint`, `maxIterations`) without full rendering lifecycle → leaked into UI

## Re-open Trigger

Next milestone that includes a phase touching streaming, agent loop, or UI state for the chat surface.

## References

- Full investigation: `.planning/reports/SESSION-20260525-streaming-timeout-investigation.md`
- Related phases: 075, 075.1–075.11, 066
- Hot files: `threads.py`, `StreamsProvider.tsx`, `RunCard.tsx`, `ToolCallPanel.tsx`
