---
id: BUG-260528-03
title: Non-Anthropic providers show generic task descriptions during code generation
reported: 2026-05-28
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/streaming, backend/streaming]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: b660664
  date: 2026-05-28
---

# BUG-260528-03: Non-Anthropic providers show generic code task descriptions

## What we observed

During Kimi (Moonshot) execute_code calls, the task description shown in the tool panel says generic text like "Generating code" instead of specific descriptions like Anthropic's "generating slides 1-6" or "generating charts". The agent IS describing what it's doing in other parts of the chat text, but the tool panel doesn't surface it.

Anthropic was specifically fixed for this in prior phases — the fix uses `tool_args_progress` SSE events to extract the task description from streaming tool arguments.

## Why it matters

Users on non-Anthropic providers get a degraded experience — they can't see at a glance what the code execution step is doing without reading the full code block.

## Hypothesized cause

The `tool_args_progress` SSE event is likely only emitted or parsed correctly for Anthropic/OpenAI streaming formats. Kimi/Moonshot may stream tool arguments differently (e.g., full args in one chunk instead of progressive streaming), so the 5KB-boundary progress emit never fires.

## Surface classification

`Agentic-RAG` — cross-provider SSE parity. NOT an Anthropic bug — do not modify the working Anthropic path.

## Suggested routing

- **Fold into in-flight phase:** n/a — constraint: do not touch working Anthropic code paths
- **Defer to future phase / milestone:** Route to a future cross-provider polish phase
- **External — note only:** no

## Workarounds

Users can expand the code block to see what the agent is doing.
