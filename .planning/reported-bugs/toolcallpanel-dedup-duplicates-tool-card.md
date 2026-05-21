---
id: BUG-260521-01
title: ToolCallPanel transiently renders duplicate card during streaming, collapses to one on snapshot reconcile (~10-15s window)
reported: 2026-05-21
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/streaming, frontend/components/chat/ToolCallPanel, frontend/providers/StreamsProvider]
folded_into: "075.2"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 0cd7990
  date: 2026-05-21
---

# BUG-260521-01: ToolCallPanel transiently renders duplicate card during streaming, collapses to one on snapshot reconcile

## What we observed

Verified via Chrome MCP during Phase 075.1 UAT (2026-05-21), then refined via operator observation post-UAT (2026-05-21 later):

- **OpenAI gpt-4.1, 45s sleep test**: Tool card "Step 1 — Running code — Running a 45-second sleep test script" rendered TWICE under the "Used 2 tools 56.6s" accordion DURING streaming. Both copies showed identical Python source, identical 45.0s duration, identical Output (2 lines: starting / done).
- **Anthropic claude-sonnet-4-6, primes-matplotlib test**: The first "Step 1: Generate the first 10 prime numbers" tool card ALSO duplicated under "Used 5 tools 55.6s" DURING streaming. Subsequent steps (matplotlib install/retry/install+plot) rendered as singles.
- **Operator-observed refinement (2026-05-21, sandbox-image rebuild test on a fresh chat)**: The duplicate is **TRANSIENT** — appears during the streaming + tool-completion window, then **collapses to a single card after ~10-15 seconds**. End state is correct (one card per tool_call_id). The 15s window corresponds to the time between SSE terminal event and snapshot reconcile-fetch returning canonical state.

Cross-provider reproduction with identical symptom (always on the FIRST tool of a run, never on later ones) rules out "model retried" as the cause — this is a frontend streaming-render issue, NOT a permanent dedup failure.

## Why it matters

**Severity = minor** (visual flicker only).

- Duplicate is purely a streaming-render artifact; the snapshot reconcile path correctly merges to one card.
- End-of-run state is correct (matches what's persisted to `messages.tool_calls` in the DB).
- User cognitive load during the ~10-15s window: "wait, did it run twice?" — answer is no, but the UX implies yes.
- This is the visible part of an underlying streaming-state vs canonical-state mismatch worth fixing for polish, but it doesn't break any workflow.

Plan 04's `deduplicatedToolCalls` logic IS working for the final canonical state. The bug is upstream of the dedup — the streaming reducer creates two entries during the SSE event sequence for the FIRST tool only, and the dedup-by-id treats them as distinct (likely different ids between streaming-placeholder and finalized-tool_use_complete events).

## Hypothesized cause

Most likely path given the timing fingerprint:

1. SSE `tool_call_started` event arrives → StreamsProvider reducer appends a new tool entry with an early/streaming-side id (or `null` id with a placeholder key).
2. SSE `tool_call_complete` event arrives → reducer appends ANOTHER entry with the finalized `tool_call_id` from the backend, because it doesn't match an existing entry by id.
3. ToolCallPanel.deduplicatedToolCalls sees two entries with different ids → renders both.
4. SSE `[done]` event fires → `_reattachAfterTransient` or `onTerminal` fires the snapshot reconcile fetch.
5. ~10-15s later, snapshot returns canonical `messages.tool_calls` with the single finalized entry.
6. Frontend swaps streaming-state with canonical → one card.

Code review WR-02 in `075.1-REVIEW.md` is directly relevant:

> `_isTransientStreamEnd` and `_reattachAfterTransient` each call `getSnapshot` independently, creating a two-probe race window. The second snapshot may see `active_runs: []` after the run has ended, causing the reattach to replay from cursor "0" and fire duplicate SSE callbacks.

If the two-probe race fires duplicate SSE callbacks, that could ALSO produce duplicate tool entries — separate from the streaming-vs-finalized id mismatch above. Either path (or both) could be the root.

Investigation should start by capturing all `tool_*` SSE events for a single tool_call_id and tracing the id stability through `StreamsProvider.tsx` reducer → `MessageItem.tsx` → `ToolCallPanel.tsx`. Specifically check whether the FIRST tool of a run gets two distinct ids in the streaming state.

## Surface classification

`Agentic-RAG` — frontend streaming-render bug in this app's chat UI.

## Suggested routing

Fold into **Phase 075.2** (cross-provider stability follow-up): 

1. Audit tool_call_id stability across the StreamsProvider reducer for the FIRST-tool case (compare to subsequent tools that don't duplicate)
2. Make the reducer update-in-place when a streaming entry is finalized with a new id (key by `name + position` if id changes)
3. Fix WR-02 two-probe getSnapshot race as the same wave
4. Optional: WR-01 (`onToolEnd` matching by name+status, not id) — same neighborhood

## Related

- Phase 075.1 closed B-260519-10 as "fixed" per Plan 04 SUMMARY; UAT showed the streaming-render duplicate, but post-UAT observation confirmed the canonical state is correct.
- 075.1-REVIEW.md WR-01 (`onToolEnd` matching by name+status, not id) — same neighborhood; combined fix recommended.
- 075.1-REVIEW.md WR-02 (two-probe getSnapshot race) — likely root cause or contributor.
- 075.1-REVIEW.md WR-03 (dedup fallback key collapse) — possibly compounds but probably not the primary cause given the duplicate is by-id, not by-fallback-key.
