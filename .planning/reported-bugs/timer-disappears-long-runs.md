---
id: BUG-260528-01
title: Timer disappears during long-running agent cycles (non-Anthropic providers)
reported: 2026-05-28
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/streaming, frontend/chat]
folded_into: "095"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: b660664
  date: 2026-05-28
---

# BUG-260528-01: Timer disappears during long-running agent cycles

## What we observed

During a Kimi (Moonshot) full run generating a DBA defence PPTX (~11 steps, multiple execute_code calls), the timer above the chat disappeared after some time. Agent status indicators like "Analyzing document..." remained visible, confirming the run was still active.

This is distinct from BUG-260526-04 (timer lost on temp-id to DB UUID swap), which was fixed in Phase 083-02 by using `runId` as stable React key. The new issue occurs later in the run lifecycle.

## Why it matters

Users lose confidence that the agent is still working when the timer vanishes during long multi-step tasks. The "Analyzing document..." text is a partial signal but doesn't convey elapsed time or step progress.

## Hypothesized cause

Possible causes:
1. RunCard timer component has an internal timeout that stops rendering after N seconds
2. A stream event (e.g., run_status transition) causes the timer section to unmount while tools continue
3. SSE keepalive gap causes the frontend to consider the run "stale" and hide the timer

## Surface classification

`Agentic-RAG` — frontend timer rendering issue, not provider-specific.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** Route to a future frontend polish phase
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds

Users can observe the tool panel expanding with new steps as evidence the run is active.
