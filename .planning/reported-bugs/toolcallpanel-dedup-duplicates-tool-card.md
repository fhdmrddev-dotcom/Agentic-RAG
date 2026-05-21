---
id: BUG-260521-01
title: ToolCallPanel renders same tool_call_id as duplicate card on first tool of a run
reported: 2026-05-21
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/streaming, frontend/components/chat/ToolCallPanel]
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: 0cd7990
  date: 2026-05-21
---

# BUG-260521-01: ToolCallPanel renders same tool_call_id as duplicate card on first tool of a run

## What we observed

Verified via Chrome MCP during Phase 075.1 UAT (2026-05-21):

- **OpenAI gpt-4.1, 45s sleep test**: Tool card "Step 1 — Running code — Running a 45-second sleep test script" rendered TWICE under the "Used 2 tools 56.6s" accordion. Both copies show identical Python source, identical 45.0s duration, identical Output (2 lines: starting / done). Initially attributed to OpenAI legitimately retrying.
- **Anthropic claude-sonnet-4-6, primes-matplotlib test**: The first "Step 1: Generate the first 10 prime numbers" tool card ALSO duplicated under "Used 5 tools 55.6s". Same code, same 119ms duration, same single-line output ("First 10 prime numbers: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]"). Subsequent steps (matplotlib install/retry/install+plot) rendered as singles.

Cross-provider reproduction with identical symptom (always on the FIRST tool of a run, never on later ones) rules out "model retried" as the cause — this is a frontend dedup issue.

## Why it matters

Cognitive load: users see "Used N tools" but the card list contains N-1 unique tools plus a phantom duplicate. Looks wrong even if functionally inert (the duplicate cards reflect the same successful execution).

Severity = minor: doesn't break any flow, doesn't lose data, only renders a redundant card. But it's a regression of B-260519-10 (Plan 04's "ToolCallPanel dedup" claim was that "Each tool_call_id renders exactly one card") — closing that claim was a phase deliverable.

## Hypothesized cause

Plan 04's `deduplicatedToolCalls` logic in `frontend/src/components/chat/ToolCallPanel.tsx:538-548` uses a fallback key when `id` is missing: ``${tc.name}-${tc.startedAt ?? ''}``. Code reviewer flagged this as WR-03 (075.1-REVIEW.md):

> The dedup fallback key produces "execute_code-" for all preparing entries (startedAt is undefined), so two sequential same-name preparing entries silently collapse into one in the dedup set.

But the UAT observation is the OPPOSITE — entries DUPLICATE, not collapse. So either:
(a) The primary `id` key is the same for both renders but the dedup `Map` somehow re-adds the entry (e.g., two SSE events update the same tool_call_id and both call `set()` without de-collision)
(b) The `id` differs between the streaming render and the post-completion final render (e.g., backend emits `tool_call_started` with a temporary id, then `tool_call_complete` with a permanent id), and the deduplicator treats them as different tools
(c) The reducer in StreamsProvider creates a NEW tool entry each time a `tool_call_start` event arrives, even if one with that id already exists

Investigation should start by capturing all `tool_*` SSE events for a single tool_call_id and tracing them through `StreamsProvider.tsx` → `MessageItem.tsx` → `ToolCallPanel.tsx`.

## Surface classification

`Agentic-RAG` — frontend rendering bug in this app's chat UI.

## Suggested routing

Fold into **Phase 075.2** (cross-provider stability follow-up): dedup-by-id at `ToolCallPanel.tsx` + tool_call_id stability audit across the StreamsProvider reducer + (optionally) the WR-02 two-probe getSnapshot race fix from 075.1-REVIEW.md.

## Related

- Phase 075.1 closed B-260519-10 as "fixed" per Plan 04 SUMMARY; UAT showed the regression.
- 075.1-REVIEW.md WR-01 (`onToolEnd` matching by name+status, not id) is in the same neighborhood; combined fix recommended.
- 075.1-REVIEW.md WR-03 (dedup fallback key collapse) may compound with this.
