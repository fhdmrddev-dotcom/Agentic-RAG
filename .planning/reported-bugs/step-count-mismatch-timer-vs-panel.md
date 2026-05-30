---
id: BUG-260528-02
title: Step count on timer does not match step count on tool panel header
reported: 2026-05-28
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/chat, frontend/streaming]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: b660664
  date: 2026-05-28
---

# BUG-260528-02: Step count mismatch between timer and tool panel header

## What we observed

During a Kimi multi-step run, the step count displayed on the timer (RunCard) did not match the step count shown on the tool panel header. The two counters appear to track different things or update at different cadences.

## Why it matters

Inconsistent step counts confuse users about how much work the agent has done and how much remains.

## Hypothesized cause

The RunCard timer likely counts `iteration_start` SSE events while the ToolCallPanel header counts `tool_start` events. Multiple tools can execute within a single iteration, or an iteration may produce no tools (pure text response). The counters measure different things.

## Surface classification

`Agentic-RAG` — frontend counter synchronization.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** Route to a future UX consistency phase
- **External — note only:** no

## Workarounds

None needed — cosmetic inconsistency only.
